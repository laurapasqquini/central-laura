// Financeiro pessoal: lê os extratos do Nubank (CSV da conta, CSV do cartão, PDF da conta),
// classifica cada movimentação e resume o mês. Valor com sinal: + entrou, − saiu.
// Nada aqui guarda o arquivo: só as movimentações lidas vão para a central.

const semAcento = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const numBR = (s) => Number(String(s).replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));

export const CATEGORIAS = {
  // entradas
  salario: { nome: 'RANKEN (salário)', tipo: 'entrada', icone: '🎾' },
  vt: { nome: 'Vale-transporte', tipo: 'entrada', icone: '🚌' },
  gralha: { nome: 'Gralha (comissão)', tipo: 'entrada', icone: '🐦' },
  recebido: { nome: 'Pix recebido', tipo: 'entrada', icone: '📥' },
  outras_entradas: { nome: 'Outras entradas', tipo: 'entrada', icone: '➕' },
  // gastos
  mercado: { nome: 'Mercado e padaria', tipo: 'gasto', icone: '🛒' },
  comida: { nome: 'iFood e restaurantes', tipo: 'gasto', icone: '🍔' },
  bares: { nome: 'Bares e saídas', tipo: 'gasto', icone: '🍻' },
  transporte: { nome: 'Transporte (Uber, 99)', tipo: 'gasto', icone: '🚗' },
  esporte: { nome: 'Esporte e academia', tipo: 'gasto', icone: '🎾' },
  saude: { nome: 'Saúde e farmácia', tipo: 'gasto', icone: '💊' },
  beleza: { nome: 'Beleza', tipo: 'gasto', icone: '💅' },
  casa: { nome: 'Contas da casa', tipo: 'gasto', icone: '🏠' },
  assinaturas: { nome: 'Assinaturas', tipo: 'gasto', icone: '📺' },
  compras: { nome: 'Compras', tipo: 'gasto', icone: '🛍️' },
  educacao: { nome: 'Educação', tipo: 'gasto', icone: '📚' },
  pix_pessoas: { nome: 'Pix para pessoas', tipo: 'gasto', icone: '👤' },
  outros: { nome: 'Outros', tipo: 'gasto', icone: '❔' },
  // não contam
  // guardar: não é gasto nem entrada (PicPay e caixinhas do Nubank)
  guardou: { nome: 'Guardou (PicPay, caixinha)', tipo: 'guardar', icone: '🐷' },
  resgatou: { nome: 'Tirou do guardado', tipo: 'guardar', icone: '🔓' },
  ignorar: { nome: 'Não conta (fatura, entre contas)', tipo: 'ignorar', icone: '↔️' },
};

// Palavra-chave → categoria (a primeira que bater)
const REGRAS = [
  [/pagamento de fatura|pagamento recebido|valor adicionado na conta por cartao/, 'ignorar'],
  // caixinhas do Nubank (RDB): aplicação = guardou; resgate = tirou
  [/resgate rdb|resgate.*caixinha|dinheiro resgatado|resgatad/, 'resgatou'],
  [/aplicacao rdb|rdb\b|caixinha|dinheiro guardado|guardado/, 'guardou'],
  [/yotha ranking/, 'salario'],
  [/julia maria ferreira ricobello/, 'gralha'],
  [/uber|99 ride|\b99\b|\*99|taxi|posto|combustiv|shell|ipiranga/, 'transporte'],
  [/ifd\*|ifood|restaurante|lanch|lanc\b|petiscaria|pizza|burger|burguer|sushi|acai|lanchonete|vila velha/, 'comida'],
  [/craft|bar\b|ultra club|pub|choperia|cervej/, 'bares'],
  [/mercado(?! pago| livre)|supermerc|atacad|padaria|panificadora|hortifruti|coronel zacarias/, 'mercado'],
  [/tennis|tenis|beach|arena|esporte|wellhub|gympass|academia|mauatenisclub|complexo|sports/, 'esporte'],
  [/farmac|drogaria|droga|clinica|fisio|laborat|psico|odonto/, 'saude'],
  [/salao|barbear|estetica|manicure|cabelo/, 'beleza'],
  [/sanepar|copel|telefonica|vivo|claro|\btim\b|internet|condominio|aluguel|energia/, 'casa'],
  [/apple\.com|google|disney|netflix|spotify|prime video|amazon prime|youtube|bytedance|deezer|hbo|max\b|globoplay/, 'assinaturas'],
  [/shopee|mercado livre|mercadolivre|amazon|shein|magalu|jim\.com|aliexpress|marketplace|renner|riachuelo/, 'compras'],
  [/universidade|faculdade|curso|escola|livraria/, 'educacao'],
];

// Chave da "regra aprendida": a contraparte (nome no Pix) ou o estabelecimento, sem números de parcela
export function chaveDe(desc = '') {
  const d = semAcento(desc);
  const pix = d.match(/pix(?: no credito)? - ([^-(]+?)(?: -|\(|$)/) || d.match(/(?:recebida|enviada)(?: pelo pix)? - ([^-(]+?)(?: -|\(|$)/);
  if (pix) return `pix:${pix[1].trim()}`;
  return d.replace(/ - parcela \d+\/\d+/, '').replace(/^compra no debito - /, '').replace(/\s+/g, ' ').trim();
}

export function categoriaAuto(desc, valor) {
  const d = semAcento(desc);
  // RANKEN: o Pix pequeno é o vale-transporte; o salário (líquido do holerite) é o grande
  if (/yotha ranking/.test(d) && valor > 0 && valor < 1000) return 'vt';
  for (const [re, cat] of REGRAS) if (re.test(d)) return cat;
  if (valor > 0) return /recebid/.test(d) ? 'recebido' : 'outras_entradas';
  if (/transferencia enviada|pix/.test(d)) return 'pix_pessoas';
  return 'outros';
}

// ── Leitura dos arquivos ──
function linhasCSV(texto) {
  const out = [];
  for (const linha of texto.replace(/\r/g, '').split('\n')) {
    if (!linha.trim()) continue;
    const cols = [];
    let cur = '';
    let aspas = false;
    for (const ch of linha) {
      if (ch === '"') aspas = !aspas;
      else if (ch === ',' && !aspas) {
        cols.push(cur);
        cur = '';
      } else cur += ch;
    }
    cols.push(cur);
    out.push(cols.map((c) => c.trim()));
  }
  return out;
}

export function lerCSV(texto) {
  const [cab, ...linhas] = linhasCSV(texto);
  const h = cab.map((c) => semAcento(c));
  // cartão de crédito: date,title,amount (positivo = gasto; negativo = pagamento ou estorno)
  if (h[0] === 'date' && h.includes('title')) {
    const vistos = {};
    return linhas.map(([data, desc, valor]) => {
      const v = -numBR(valor.replace(/^-\s*/, '-'));
      const base = `cartao:${data}:${semAcento(desc)}:${v}`;
      vistos[base] = (vistos[base] || 0) + 1; // compras iguais no mesmo dia
      return { id: `${base}:${vistos[base]}`, data, desc, valor: Math.round(v * 100) / 100, origem: 'cartao' };
    });
  }
  // conta: Data,Valor,Identificador,Descrição
  if (h[0] === 'data' && h.includes('identificador')) {
    const brutas = linhas.map(([data, valor, id, desc]) => ({ id: `conta:${id}:${Number(valor) > 0 ? 'e' : 's'}`, ident: id, data: data.split('/').reverse().join('-'), desc, valor: Number(valor), origem: 'conta' }));
    return marcarPixNoCredito(brutas);
  }
  throw new Error('Não reconheci este CSV. Use o extrato da conta ou do cartão exportado pelo app do Nubank.');
}

// Pix no Crédito: na conta entra "valor adicionado por cartão" e sai o Pix (mesmo identificador);
// o gasto de verdade já está no cartão, então os dois lados da conta não contam
function marcarPixNoCredito(lista) {
  const adicionados = lista.filter((x) => /valor adicionado na conta por cart/i.test(x.desc));
  const credito = new Set(adicionados.map((x) => x.ident).filter(Boolean));
  // no PDF não tem identificador: o par é o Pix enviado no mesmo dia com o mesmo valor
  const pares = new Set();
  for (const a of adicionados.filter((x) => !x.ident)) {
    const par = lista.find((y) => !pares.has(y) && y !== a && y.data === a.data && Math.abs(y.valor + a.valor) < 0.005 && /enviad/i.test(y.desc));
    if (par) pares.add(par).add(a);
  }
  return lista.map((x) => {
    const { ident, ...resto } = x;
    return credito.has(ident) || pares.has(x) ? { ...resto, cat: 'ignorar', auto: 'Pix no Crédito (conta no cartão)' } : resto;
  });
}

const MESES = { JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06', JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12' };
// PDF do extrato da conta: datas "02 SET 2026", blocos "Total de entradas/saídas", descrição em 1+ linhas e o valor no fim
export async function lerPDF(arrayBuffer) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const linhas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const t = await (await doc.getPage(i)).getTextContent();
    let y = null;
    let atual = [];
    for (const it of t.items) {
      const yy = Math.round(it.transform[5]);
      if (y !== null && Math.abs(yy - y) > 2) {
        linhas.push(atual.join(' ').trim());
        atual = [];
      }
      y = yy;
      if (it.str.trim()) atual.push(it.str.trim());
    }
    linhas.push(atual.join(' ').trim());
  }
  if (!linhas.some((l) => /^Movimenta/.test(l))) throw new Error('Não reconheci este PDF. Use o extrato da conta do Nubank (ou o CSV).');
  const nome = linhas.find(Boolean) || ''; // 1ª linha do extrato: o nome da titular
  const out = [];
  let data = null;
  let sinal = -1;
  let desc = [];
  let dentro = false;
  const vistos = {};
  for (const l of linhas) {
    if (/^Movimenta/.test(l)) {
      dentro = true;
      continue;
    }
    if (!dentro || !l) continue;
    // cabeçalho e rodapé que se repetem em cada página
    if (l === nome || /^(Tem alguma dúvida|metropolitanas|Caso a solução|disponíveis em|Extrato gerado)/i.test(l) || /CPF Agência Conta|DE \d{4} VALORES EM R\$/.test(l) || /^\d{4,}-\d$/.test(l)) continue;
    const dt = l.match(/^(\d{2}) ([A-Z]{3}) (\d{4})\b(.*)$/);
    let resto = l;
    if (dt && MESES[dt[2]]) {
      data = `${dt[3]}-${MESES[dt[2]]}-${dt[1]}`;
      resto = dt[4].trim();
    }
    const tot = resto.match(/^Total de (entradas|saídas)/i);
    if (tot) {
      sinal = /entradas/i.test(tot[1]) ? 1 : -1;
      desc = [];
      continue;
    }
    if (!resto) continue;
    const val = resto.match(/^(.*?)\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/);
    if (val && data) {
      if (val[1]) desc.push(val[1]);
      const d = desc.join(' ').replace(/\s+/g, ' ').trim();
      const v = sinal * numBR(val[2]);
      const base = `pdf:${data}:${semAcento(d)}:${v}`;
      vistos[base] = (vistos[base] || 0) + 1;
      if (d) out.push({ id: `${base}:${vistos[base]}`, data, desc: d, valor: v, origem: 'conta' });
      desc = [];
    } else desc.push(resto);
  }
  const lista = marcarPixNoCredito(out);
  lista.nome = nome;
  return lista;
}

// { itens, nome } — o nome só vem do PDF (serve para reconhecer Pix entre contas da própria titular)
export async function lerArquivo(file) {
  if (/\.pdf$/i.test(file.name)) {
    const itens = await lerPDF(await file.arrayBuffer());
    return { itens, nome: itens.nome };
  }
  return { itens: lerCSV(await file.text()), nome: '' };
}

// mesma movimentação vinda do PDF e do CSV da conta: data + valor + descrição parecida
export function jaExiste(t, existentes) {
  if (existentes[t.id]) return true;
  if (t.origem !== 'conta') return false;
  // o CSV escreve "Pix - NOME" e o PDF "Pix NOME": compara sem os " - "
  const norm = (s) => semAcento(s).replace(/ - /g, ' ').slice(0, 25);
  const d = norm(t.desc);
  return Object.values(existentes).some((x) => x.origem === 'conta' && x.data === t.data && Math.abs(x.valor - t.valor) < 0.005 && norm(x.desc) === d);
}

// categoria final: a escolhida na mão > a regra aprendida > a automática
// Pix entre contas da própria titular (ex.: para outro banco dela) não conta como gasto nem entrada
const entreContas = (t, meuNome) => !!meuNome && semAcento(t.desc).includes(semAcento(meuNome));
// Pix para a própria conta no PicPay = guardou (e o que volta de lá = tirou); outras contas dela = não conta
const entreContasCat = (t) => (/picpay/i.test(t.desc) ? (t.valor < 0 ? 'guardou' : 'resgatou') : 'ignorar');
export const categoriaDe = (t, regras = {}, meuNome = '') => t.catManual || t.cat || regras[chaveDe(t.desc)] || (entreContas(t, meuNome) ? entreContasCat(t) : categoriaAuto(t.desc, t.valor));

export function resumoMes(fin, mes) {
  const regras = fin.regras || {};
  const lista = Object.values(fin.transacoes || {})
    .filter((t) => t.data.startsWith(mes))
    .map((t) => ({ ...t, categoria: categoriaDe(t, regras, fin.meuNome) }))
    .sort((a, b) => b.data.localeCompare(a.data) || a.desc.localeCompare(b.desc));
  const conta = lista.filter((t) => CATEGORIAS[t.categoria]?.tipo !== 'ignorar');
  const entrou = conta.filter((t) => CATEGORIAS[t.categoria]?.tipo === 'entrada').reduce((s, t) => s + t.valor, 0);
  // gasto = saídas das categorias de gasto (estorno abate)
  const gastos = conta.filter((t) => CATEGORIAS[t.categoria]?.tipo === 'gasto');
  const saiu = -gastos.reduce((s, t) => s + t.valor, 0);
  const porCat = (tipo) =>
    Object.entries(
      conta
        .filter((t) => CATEGORIAS[t.categoria]?.tipo === tipo)
        .reduce((acc, t) => ((acc[t.categoria] = (acc[t.categoria] || 0) + (tipo === 'gasto' ? -t.valor : t.valor)), acc), {}),
    )
      .map(([cat, total]) => ({ cat, total: Math.round(total * 100) / 100, itens: conta.filter((t) => t.categoria === cat) }))
      .filter((x) => Math.abs(x.total) >= 0.01)
      .sort((a, b) => b.total - a.total);
  // guardado no mês: o que foi para PicPay/caixinha e o que voltou
  const guardar = lista.filter((t) => CATEGORIAS[t.categoria]?.tipo === 'guardar');
  const guardou = -guardar.filter((t) => t.valor < 0).reduce((s, t) => s + t.valor, 0);
  const tirou = guardar.filter((t) => t.valor > 0).reduce((s, t) => s + t.valor, 0);
  return { lista, entrou, saiu, sobrou: entrou - saiu, guardou, tirou, guardadoItens: guardar, gastosPorCat: porCat('gasto'), entradasPorCat: porCat('entrada'), ignoradas: lista.filter((t) => CATEGORIAS[t.categoria]?.tipo === 'ignorar') };
}
