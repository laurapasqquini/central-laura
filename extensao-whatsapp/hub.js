// RANKEN Hub › Beach Tênis: lê os números da tela (só os totais, nenhum nome de atleta)
// e manda para a Central sozinho, uma vez por dia ou quando mudarem. Não altera nada no Hub.

const linhasDaTela = () => (document.querySelector('main') || document.body).innerText.split('\n').map((s) => s.trim()).filter(Boolean);
const numero = (s) => {
  const m = String(s || '').match(/-?[\d.]+(,\d+)?/);
  return m ? Number(m[0].replace(/\./g, '').replace(',', '.')) : null;
};

function lerBeach() {
  const L = linhasDaTela();
  const depois = (re) => {
    const i = L.findIndex((l) => re.test(l));
    return i >= 0 ? numero(L[i + 1]) : null;
  };
  const total = depois(/^TODAS AS CIDADES$/i);
  // só lê com o filtro "todas as cidades / todas" (senão os números são de um recorte)
  const chipTodas = numero((L.find((l) => /^Todas \d+$/.test(l)) || '').slice(6));
  if (total == null || chipTodas !== total) return null;
  const receita = numero((L.find((l) => /R\$\s*[\d.,]+\s*\/\s*m[eê]s/i.test(l)) || '').replace(/^[^R]*R\$/, ''));
  const kits = L.find((l) => /a retirar$/.test(l));
  const n = {
    'Beach · atletas': total,
    'Beach · Maringá': depois(/MARING[AÁ]$/i),
    'Beach · Santa Fé': depois(/SANTA F[EÉ]$/i),
    'Beach · pagantes': depois(/PAGANTES$/i),
    'Beach · receita/mês (R$)': receita,
    'Beach · assinatura': depois(/ASSINATURA$/i),
    'Beach · Pix': depois(/^\S*\s*PIX$/i),
    'Beach · cortesias': depois(/CORTESIAS$/i),
    'Beach · desistiram': depois(/DESISTIRAM$/i),
    'Beach · precisa decidir': depois(/PRECISA DECIDIR$/i),
    'Beach · aguardando aprovação': depois(/AGUARDANDO APROVA/i),
    'Beach · kits a retirar': kits ? numero(kits) : null,
  };
  for (const k of Object.keys(n)) if (n[k] == null) delete n[k];
  return Object.keys(n).length >= 4 ? n : null;
}

function aviso(texto, ms = 6000) {
  const d = document.createElement('div');
  d.textContent = texto;
  d.style.cssText = 'position:fixed;top:16px;right:16px;z-index:99999;max-width:360px;padding:14px 18px;border-radius:14px;background:#1e1b4b;color:#fff;font:600 15px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), ms);
}

// Sorteio Diário › Ganhadores do dia: nome, data, cidade/esporte e prêmio dos últimos 12 dias
// (para a Lolis lembrar o prazo de 7 dias e conferir se deu certo). O telefone fica no Hub.
// Sorteio Diário › Programação: por dia, a marca do dia e os patrocinadores (prêmio, retirada, Instagram).
// Lê a cidade/esporte que estiver selecionada na tela. Telefones não são lidos.
function lerProgramacao() {
  const main = document.querySelector('main');
  if (!main || !/MARCA DO DIA/.test(main.innerText)) return null;
  const sels = [...main.querySelectorAll('select')];
  const escolhido = sels.map((s) => (s.options[s.selectedIndex]?.text || '').trim());
  const [cidade, esporte] = escolhido;
  if (!cidade || !esporte) return null;
  // copia a tela trocando cada lista suspensa pelo item escolhido (senão aparecem todas as opções)
  const copia = main.cloneNode(true);
  [...copia.querySelectorAll('select')].forEach((s, i) => s.replaceWith(document.createTextNode(`\n§${escolhido[i]}\n`)));
  copia.style.cssText = 'position:absolute;left:-99999px;top:0;width:1200px';
  document.body.appendChild(copia);
  const L = copia.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
  copia.remove();

  const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const dias = {};
  let dia = null;
  let pat = null;
  L.forEach((l, k) => {
    if (DIAS.includes(l)) {
      dia = dias[l] = { titulo: '', patrocinadores: [] };
      pat = null;
      return;
    }
    if (!dia || l.startsWith('§') || /^🎨/.test(l) || l === 'Add') return;
    if (!dia.titulo && /^(SEGUNDA|TERÇA|QUARTA|QUINTA|SEXTA|SÁBADO|DOMINGO)\b/i.test(l)) return (dia.titulo = l);
    if (L[k + 1] === '✕') {
      pat = { nome: l, premio: '', local: '', insta: '', contato: '', telefone: '' };
      dia.patrocinadores.push(pat);
      return;
    }
    if (!pat) return;
    if (/^🎁/.test(l)) pat.premio ||= l.replace(/^🎁\s*/, '').replace(/\s*·\s*principal$/, '');
    else if (/^📍/.test(l)) pat.local = l.replace(/^📍\s*/, '');
    else if (/^📷/.test(l)) pat.insta = l.replace(/^📷\s*@?/, '');
    else if (/^👤/.test(l)) pat.contato = l.replace(/^👤\s*/, '');
    else if (/^📱/.test(l)) pat.telefone = l.replace(/^📱\s*/, ''); // para o botão "Abrir no WhatsApp" da mensagem ao apoiador
  });
  // o prêmio escolhido numa lista suspensa vem marcado com §🎁
  L.forEach((l, k) => {
    if (!/^§🎁/.test(l)) return;
    for (let j = k; j >= 0; j--)
      if (L[j + 1] === '✕' && L[j] !== '✕') {
        for (const d of Object.values(dias)) for (const p of d.patrocinadores) if (p.nome === L[j]) p.premio = l.replace(/^§🎁\s*/, '').replace(/\s*·\s*principal$/, '');
        break;
      }
  });
  return Object.keys(dias).length ? { cidade, esporte, dias } : null;
}

let enviando = false;
const jaAvisado = new Set();
let avisouFalha = false;
async function mandar(tipo, dados, chave, texto, quieto = false) {
  const hoje = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD
  const assinatura = hoje + JSON.stringify(dados);
  const salvo = (await chrome.storage.local.get(chave))[chave];
  if (salvo === assinatura) {
    // já mandou isso hoje: avisa uma vez por tela, para não ficar a dúvida (leitura em segundo plano não avisa)
    if (!quieto && !jaAvisado.has(chave)) {
      jaAvisado.add(chave);
      aviso(`✓ ${texto.replace(/^✓\s*/, '').replace(/ na Central$/, '')} já está na Central (nada novo)`, 4000);
    }
    return;
  }
  enviando = true;
  chrome.runtime.sendMessage({ tipo, dados }, async (r) => {
    enviando = false;
    if (r?.ok) {
      await chrome.storage.local.set({ [chave]: assinatura });
      aviso(texto);
    } else {
      // mostra o motivo (ex.: extensão sem login neste Chrome) em vez de falhar calada
      aviso(`⚠️ Central: ${r?.erro || chrome.runtime.lastError?.message || 'não consegui enviar'}`, 8000);
    }
  });
}

// aba "?central=auto" (versões antigas abriam o Sorteio Diário escondido uma vez por dia)
const AUTO = new URLSearchParams(location.search).get('central') === 'auto';

// os ganhadores agora vêm da API (lerGanhadoresApi) em qualquer página do Hub: não abre mais a aba do sorteio.
// Se uma aba antiga "?central=auto" ainda abrir, lê pela API e fecha.
if (AUTO) {
  lerGanhadoresApi(true);
  setTimeout(() => chrome.runtime.sendMessage({ tipo: 'fechar-aba' }), 4000);
}

// ── Atividades › Minha equipe › Lolis: o que está "Ainda em aberto" com ela vira tarefa dela na Central ──
// (às 13h25 a extensão abre esta tela sozinha, numa aba em segundo plano; também lê quando a Laura abre)
const AUTO_EQUIPE = new URLSearchParams(location.search).get('central') === 'equipe';
const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function lerEquipeLolis() {
  if (!/^\/atividades\/equipe/.test(location.pathname)) return null;
  const L = linhasDaTela();
  // só a Lolis, e só no dia de hoje (a tela deixa navegar para outros dias)
  const cab = L.find((l) => /^Lolis · /.test(l));
  if (!cab) return null;
  const hoje = new Date();
  const m = cab.match(/(\d{1,2}) de (\p{L}+)/u);
  if (!m || +m[1] !== hoje.getDate() || MESES_PT.indexOf(m[2].toLowerCase()) !== hoje.getMonth()) return null;
  const ini = L.findIndex((l) => /^Ainda em aberto/.test(l));
  const fim = L.findIndex((l, i) => i > ini && /^Adiou$/.test(l));
  if (ini < 0) return null;
  const bloco = L.slice(ini + 1, fim > ini ? fim : undefined);
  const abertas = [];
  bloco.forEach((l, i) => {
    if (/^\d+$/.test(l) || /^prazo /i.test(l) || (l === l.toUpperCase() && /[A-ZÀ-Ú]/.test(l) && !/[a-zà-ú]/.test(l))) return; // contagem, prazo, subtítulo
    if (/^(Nenhuma|Nada) /.test(l)) return; // "Nenhuma tarefa…", "Nada pendente pra hoje nem atrasado."
    const p = (bloco[i + 1] || '').match(/^prazo (\d{2})\/(\d{2})/i);
    let prazo = null;
    if (p) {
      let ano = hoje.getFullYear();
      if (+p[2] - 1 < hoje.getMonth() - 6) ano++;
      prazo = `${ano}-${p[2]}-${p[1]}`;
    }
    abertas.push({ titulo: l, prazo });
  });
  return { dia: hoje.toLocaleDateString('sv-SE'), abertas };
}

// Expansão: os itens dos projetos (Expansão › cidade › Checklist) que estão com a Lolis e ainda não foram feitos.
// A tela "Ainda em aberto" só mostra o que vence hoje; os projetos trazem tudo, com o prazo. Só leitura.
const ESPORTE_EXP = { beach_tennis: 'Beach Tennis', tenis: 'Tênis', padel: 'Padel' };
const cidadeBonita = (s = '') =>
  s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i && ['de', 'do', 'da', 'dos', 'das'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
async function comExpansao(n) {
  try {
    const eq = (await (await fetch('/api/equipe', { cache: 'no-store' })).json()).equipe || [];
    const lolis = eq.find((p) => /lolis/i.test(p.nome))?.id;
    if (!lolis) return n;
    const lista = await (await fetch('/api/match-admin/expansao/projetos', { cache: 'no-store' })).json();
    const ja = new Set(n.abertas.map((a) => a.titulo.trim().toLowerCase()));
    // o prazo que vale é o da tarefa em Atividades (é o que a Laura muda); o do checklist do projeto pode ficar velho
    const deleguei = await fetch('/api/atividades?filtro=deleguei', { credentials: 'include', cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const listaDel = Array.isArray(deleguei) ? deleguei : deleguei?.atividades || Object.values(deleguei || {}).find(Array.isArray) || [];
    const prazoAtividade = new Map(listaDel.filter((x) => x.titulo && x.status !== 'concluida' && x.prazo).map((x) => [x.titulo.trim().toLowerCase(), x.prazo.slice(0, 10)]));
    const extras = [];
    for (const p of lista.projetos || lista || []) {
      const j = await (await fetch(`/api/match-admin/expansao/projetos/${p.id}`, { cache: 'no-store' })).json();
      const nome = `${ESPORTE_EXP[j.projeto.esporte] || j.projeto.esporte} ${cidadeBonita(j.projeto.cidade)}`;
      for (const i of j.itens || []) {
        if (i.feito || i.nao_se_aplica || !(i.responsaveis || []).includes(lolis)) continue;
        const titulo = `[Expansão ${nome}] ${i.titulo}`;
        if (ja.has(titulo.toLowerCase())) continue;
        extras.push({ titulo, prazo: prazoAtividade.get(titulo.toLowerCase()) || (i.prazo ? i.prazo.slice(0, 10) : null), descricao: [i.ajuda, `No Hub: Expansão › ${nome} (marque o item no Checklist quando terminar)`].filter(Boolean).join('\n\n') });
      }
    }
    return { ...n, abertas: [...n.abertas, ...extras] };
  } catch {
    return n;
  }
}

// Descrição de cada tarefa em aberto: abre "Detalhes da tarefa" (clicando no título), lê o texto e fecha.
// Fica guardada na extensão, para não abrir de novo a mesma tarefa.
let lendoDetalhes = false;
async function comDetalhes(n) {
  const { descEquipe = {} } = await chrome.storage.local.get('descEquipe');
  if (!lendoDetalhes) {
    lendoDetalhes = true;
    for (const a of n.abertas) {
      if (descEquipe[a.titulo] !== undefined) continue;
      const span = [...document.querySelectorAll('main span, main button')].find((e) => e.textContent.trim() === a.titulo);
      const botao = span?.closest('button') || span;
      if (!botao) continue;
      botao.click(); // abre os detalhes (só leitura)
      await new Promise((r) => setTimeout(r, 900));
      const janela = [...document.querySelectorAll('[role=dialog], .fixed')].find((d) => /Detalhes da tarefa/.test(d.innerText));
      if (janela) {
        const L = janela.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
        const ini = L.findIndex((l) => l === a.titulo);
        const fim = L.findIndex((l, i) => i > ini && l === 'Status');
        descEquipe[a.titulo] = ini >= 0 ? L.slice(ini + 1, fim > ini ? fim : undefined).join('\n') : '';
      } else descEquipe[a.titulo] = '';
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); // fecha
      await new Promise((r) => setTimeout(r, 400));
    }
    // guarda só as das tarefas que ainda estão em aberto
    for (const k of Object.keys(descEquipe)) if (!n.abertas.some((a) => a.titulo === k)) delete descEquipe[k];
    await chrome.storage.local.set({ descEquipe });
    lendoDetalhes = false;
  }
  return { ...n, abertas: n.abertas.map((a) => ({ ...a, descricao: descEquipe[a.titulo] || '' })) };
}

// ── Telefone das cobranças Pix ("Cobrar mensalidade Pix — Nome …"): a tarefa do Hub não tem o número,
// então a extensão busca o nome em Cadastros (só digita na busca e lê o link do WhatsApp) e guarda.
const AUTO_TEL = new URLSearchParams(location.search).get('central') === 'tel';
const semAcentoX = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const nomePix = (titulo = '') => (titulo.match(/^Cobrar (?:mensalidade|renova[cç][aã]o) Pix\s*[—-]\s*([^—(]+?)\s*(?:\(|[—-]|$)/i) || [])[1]?.trim() || '';

// põe o telefone já conhecido em cada cobrança Pix e, se faltar algum, abre Cadastros para buscar
async function comTelefonePix(n) {
  const { telPix = {}, sessao, telPixPedidoEm = 0 } = await chrome.storage.local.get(['telPix', 'sessao', 'telPixPedidoEm']);
  const nomes = [...new Set(n.abertas.map((a) => nomePix(a.titulo)).filter(Boolean))];
  const faltam = nomes.filter((x) => telPix[x] === undefined);
  // só no computador da Laura (logada), no máximo a cada 30 min
  if (sessao && faltam.length && Date.now() - telPixPedidoEm > 30 * 60e3) {
    await chrome.storage.local.set({ telPixFaltam: faltam, telPixPedidoEm: Date.now() });
    chrome.runtime.sendMessage({ tipo: 'abrir-aba', url: `${location.origin}/cadastros?central=tel` });
  }
  return { ...n, abertas: n.abertas.map((a) => (telPix[nomePix(a.titulo)] && telPix[nomePix(a.titulo)] !== '-' ? { ...a, telefone: telPix[nomePix(a.titulo)] } : a)) };
}

async function rodarAutoTel() {
  const { telPixFaltam = [], telPix = {} } = await chrome.storage.local.get(['telPixFaltam', 'telPix']);
  let busca = null;
  for (let i = 0; i < 40 && !busca; i++) {
    await new Promise((r) => setTimeout(r, 500));
    busca = document.querySelector('main input[placeholder^="Buscar por nome"]');
  }
  const achados = {};
  if (busca) {
    const setValor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const nome of telPixFaltam) {
      setValor.call(busca, nome); // só a busca da tela, não altera nada
      busca.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 1500));
      const alvo = semAcentoX(nome);
      const linha = [...document.querySelectorAll('main tr')].find((tr) => {
        const n = semAcentoX((tr.querySelector('td')?.innerText || '').split('\n')[0]);
        return n && (n === alvo || n.startsWith(alvo) || alvo.startsWith(n));
      });
      const tel = ((linha?.querySelector('a[href*="wa.me/"]')?.getAttribute('href') || '').match(/wa\.me\/(\d+)/) || [])[1] || '';
      telPix[nome] = tel || '-'; // '-' = não achou (não busca de novo)
      if (tel) achados[nome] = tel;
    }
    // guarda só os últimos 200 nomes
    const chaves = Object.keys(telPix);
    for (const k of chaves.slice(0, Math.max(0, chaves.length - 200))) delete telPix[k];
    await chrome.storage.local.set({ telPix, telPixFaltam: [] });
  }
  if (Object.keys(achados).length) chrome.runtime.sendMessage({ tipo: 'telefones', dados: achados }, () => chrome.runtime.sendMessage({ tipo: 'fechar-aba' }));
  else chrome.runtime.sendMessage({ tipo: 'fechar-aba' });
}
if (AUTO_TEL) rodarAutoTel();

// ── 6x0 6x0 (Torneios › 6x0 6x0): os da arte da semana = jogo NO PRAZO, etapa em andamento,
// ainda sem o 📷 (não saiu no Instagram). Lê a mesma API que a tela do Hub usa (só leitura, sem cliques).
const AUTO_6X0 = new URLSearchParams(location.search).get('central') === '6x0';
async function ler6x0() {
  const r = await fetch('/api/torneios/6x0', { credentials: 'include' });
  if (!r.ok) return null;
  const j = await r.json();
  const CIDADE = { 'maringá': 'Maringá', maringa: 'Maringá', londrina: 'Londrina' };
  const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const tel = (nome) => {
    const i = (j.inscritos || []).find((x) => x.nome === nome || (x.nome_dupla && `${x.nome} / ${x.nome_dupla}` === nome) || nome.startsWith(`${x.nome} /`));
    return i?.whatsapp || '';
  };
  const ganhadores = (j.itens || [])
    .filter((i) => i.etapa_status !== 'finished' && i.esporte === 'tenis' && CIDADE[i.cidade])
    .filter((i) => i.resultado_em && i.resultado_em.slice(0, 10) <= i.rodada_fim) // no prazo (verde)
    .filter((i) => !i.instagram_em) // ainda não saiu na arte do Instagram
    .map((i) => ({ nome: i.vencedor, cidade: CIDADE[i.cidade], rodada: String(i.rodada), classe: (i.classe || '').replace(/^Classe\s*/, ''), lancado: ddmm(i.resultado_em), brinde: !!i.voucher_em, telefone: tel(i.vencedor) }))
    .sort((x, y) => x.cidade.localeCompare(y.cidade) || x.nome.localeCompare(y.nome));
  return { dia: new Date().toLocaleDateString('sv-SE'), ganhadores };
}
async function rodarAuto6x0() {
  let dados = null;
  try {
    dados = await ler6x0();
  } catch {
    /* sem dados */
  }
  if (dados) chrome.runtime.sendMessage({ tipo: 'seiszero', dados }, () => chrome.runtime.sendMessage({ tipo: 'fechar-aba' }));
  else chrome.runtime.sendMessage({ tipo: 'fechar-aba' });
}
if (AUTO_6X0) rodarAuto6x0();
let ultimo6x0 = 0;
// clicou no 📷 ou no 🎁 do 6x0 no Hub: relê e manda a lista nova para a Central logo em seguida
document.addEventListener(
  'click',
  (e) => {
    const b = e.target.closest?.('button');
    if (b && /Postado no Instagram|Voucher do/i.test(b.getAttribute('title') || b.getAttribute('aria-label') || b.textContent || '')) {
      ultimo6x0 = 0;
      setTimeout(() => tentar(), 2500);
    }
  },
  true,
);

// ── Atividades (lista da Laura): o que está em aberto com ela vira tarefa dela na Central ──
// (de 2 em 2 horas a extensão abre esta tela numa aba em segundo plano; também lê quando a Laura abre)
const AUTO_LAURA = new URLSearchParams(location.search).get('central') === 'laura';

// a tela de Atividades com as tarefas da Laura: a antiga ("O dia de Laura") ou a nova (filtro "Minhas" ligado)
function mainDaLaura() {
  if (location.pathname !== '/atividades') return null;
  const main = document.querySelector('main');
  if (!main) return null;
  const ativo = (nome) => [...main.querySelectorAll('button')].some((b) => b.textContent.trim() === nome && /bg-marca-preto/.test(b.className));
  // com "Deleguei" ou "Recorrentes" ligado a lista não é a da Laura: ler aí apagava a fila de concluir
  // e fazia as tarefas dela "saírem" da Central (a aba automática passa pelo Deleguei para concluir as da Lolis)
  if (ativo('Deleguei') || ativo('Recorrentes')) return null;
  const minhas = ativo('Minhas');
  return /O dia de Laura/.test(main.innerText) || minhas || /tarefas suas pra resolver/.test(main.innerText) ? main : null;
}

// cartões em aberto (ATRASADAS, HOJE, SEM PRAZO…; as concluídas ficam de fora), com o título
function cartoesAbertos(main) {
  const out = [];
  for (const card of main.querySelectorAll('div[class*="border-l-[3px]"]')) {
    // sobe pelos blocos até achar o título da seção; pula os que começam pelo próprio cartão,
    // senão uma tarefa escrita em maiúsculas, como "CAMPEAS", parece título de seção
    const primeira = (card.innerText || '').split('\n')[0].trim();
    let sec = card;
    let cab = '';
    while (sec && sec !== main) {
      const f = (sec.innerText || '').split('\n')[0].trim();
      if (f !== primeira && /^[A-ZÀ-Ú ]{4,}( \(\d+\))?$/.test(f)) {
        cab = f;
        break;
      }
      sec = sec.parentElement;
    }
    if (!cab || /^CONCLU/.test(cab)) continue;
    // o primeiro botão do cartão é o de concluir (vazio): o título é o botão com texto
    const titulo = [...card.querySelectorAll('button')].map((b) => b.textContent.trim()).find(Boolean);
    if (titulo) out.push({ card, titulo });
  }
  return out;
}

function lerAtividadesLaura() {
  const main = mainDaLaura();
  if (!main || concluindo) return null; // enquanto conclui, a tela troca de filtro

  const hoje = new Date();
  const iso = (d) => d.toLocaleDateString('sv-SE');
  const abertas = [];
  for (const { card, titulo } of cartoesAbertos(main)) {
    const meta = card.innerText.split('\n').map((s) => s.trim()).filter(Boolean).slice(1);
    let prazo = null;
    const lim = meta.map((l) => l.match(/^Limite: (\d{2})\/(\d{2})\/(\d{4})/)).find(Boolean);
    if (lim) prazo = `${lim[3]}-${lim[2]}-${lim[1]}`;
    else if (meta.includes('Hoje')) prazo = iso(hoje);
    else if (meta.includes('Ontem')) prazo = iso(new Date(hoje - 864e5));
    else if (meta.includes('Amanhã')) prazo = iso(new Date(+hoje + 864e5));
    abertas.push({ titulo, prazo, urgente: meta.some((l) => /URGENTE/.test(l)) });
  }
  return abertas.length ? { dia: iso(hoje), abertas } : null;
}

// O que a Laura deu como feito na Central e ainda está em aberto aqui: a extensão clica em "Concluir tarefa"
// no cartão (só na lista dela e só em cartões em aberto). Se o Hub abrir alguma janela, para e não mexe em mais nada.
let concluindo = false;
let ultimoConcluir = 0;
async function concluirNoHub() {
  const main = mainDaLaura();
  if (!main || concluindo) return 0;
  concluindo = true;
  try {
    const resp = await new Promise((r) => chrome.runtime.sendMessage({ tipo: 'hub-concluir-lista' }, r));
    const lista = resp?.ok ? resp.lista || [] : [];
    if (!lista.length) return 0;
    const bate = (titulo) =>
      lista.some((h) => (h.titulo && h.titulo.trim() === titulo) || (h.pix && /^Cobrar (mensalidade|renova[cç][aã]o) Pix/i.test(titulo) && nomePix(titulo).toLowerCase() === h.pix.trim().toLowerCase()));
    const concluir = async (raiz, filtro) => {
      let n = 0;
      for (const { card, titulo } of cartoesAbertos(raiz)) {
        if (!filtro(titulo)) continue;
        const btn = card.querySelector('button[aria-label="Concluir tarefa"]');
        if (!btn || btn.disabled) continue;
        btn.click();
        await new Promise((r) => setTimeout(r, 900));
        const janela = document.querySelector('[role="dialog"]');
        if (janela) {
          // tarefa atrasada: o Hub pergunta "O que foi feito?" (nota opcional) → confirma em "✓ Resolvido".
          // Qualquer outra janela: para e não mexe em mais nada.
          const resolvido = [...janela.querySelectorAll('button')].find((b) => b.textContent.trim() === '✓ Resolvido');
          if (!/O que foi feito\?/.test(janela.textContent) || !resolvido) break;
          resolvido.click();
          await new Promise((r) => setTimeout(r, 900));
          if (document.querySelector('[role="dialog"]')) break;
        }
        n++;
      }
      return n;
    };
    const minhas = lista.filter((h) => !h.lolis);
    const daLolis = lista.filter((h) => h.lolis).map((h) => h.titulo.trim());
    let feitos = minhas.length ? await concluir(main, bate) : 0;
    // tarefas da Lolis que ela deu como feitas: aparecem em "Deleguei" (a tela da equipe não tem o botão de concluir);
    // conclui lá e volta para "Minhas"
    if (daLolis.length && AUTO_LAURA) { // só na aba automática: não troca o filtro da tela que a Laura está usando
      const filtroBtn = (nome) => [...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === nome);
      const deleguei = filtroBtn('Deleguei');
      if (deleguei) {
        deleguei.click();
        await new Promise((r) => setTimeout(r, 2500));
        feitos += await concluir(document.querySelector('main'), (t) => daLolis.includes(t.trim()));
        filtroBtn('Minhas')?.click();
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    if (feitos) aviso(`✓ ${feitos} ${feitos > 1 ? 'tarefas concluídas' : 'tarefa concluída'} no Hub (feitas na Central)`, 5000);
    return feitos;
  } finally {
    concluindo = false;
  }
}

// Pagamento Pix (Torneios): quem está "a cobrar" vai para a Central, que monta a cobrança do dia
const dadosPix = () =>
  fetch('/api/torneios/pix', { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) =>
      Array.isArray(j?.itens)
        ? {
            hoje: j.hoje,
            itens: j.itens
              .filter((i) => i.situacao === 'a_cobrar')
              .map((i) => ({ id: String(i.ranking_user_id || i.id), nome: (i.nome || '').trim(), telefone: i.telefone || '', esporte: i.esporte, vencimento: i.vencimento, valor: i.valor })),
          }
        : null,
    )
    .catch(() => null);
// Programação do sorteio diário de todas as cidades e esportes, direto da API do Hub (a mesma da tela
// Sorteio › Programação): patrocinador novo chega na Central sem precisar abrir a tela certa
const CIDADES_PROG = { maringa: 'Maringá', londrina: 'Londrina', curitiba: 'Curitiba' };
const ESPORTES_PROG = { tenis: 'Tênis', beach_tennis: 'Beach Tennis', padel: 'Padel' };
const DIAS_PROG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
let ultimaProgApi = 0;
async function lerProgramacoesApi() {
  if (Date.now() - ultimaProgApi < 30 * 60e3) return;
  ultimaProgApi = Date.now();
  for (const [c, cidade] of Object.entries(CIDADES_PROG))
    for (const [e, esporte] of Object.entries(ESPORTES_PROG)) {
      const j = await fetch(`/api/torneios/sorteio-programacao?cidade=${c}&esporte=${e}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (!j?.itens?.length) continue;
      const dias = {};
      const diaDe = (n) => (dias[DIAS_PROG[n % 7]] ||= { titulo: '', patrocinadores: [] });
      for (const m of j.marcas || []) {
        // texto livre ("DA CURTINHA") já vem com o artigo; marca de patrocinador usa o artigo escolhido (DA/DO)
        const marca = m.titulo_livre?.trim() ? m.titulo_livre.trim() : m.empresa ? `${m.artigo || 'DO'} ${m.empresa}` : '';
        if (marca) diaDe(m.dia_semana).titulo = `${DIAS_PROG[m.dia_semana % 7].toUpperCase()} ${marca.toUpperCase()}`;
      }
      for (const i of j.itens)
        diaDe(i.dia_semana).patrocinadores.push({
          nome: i.empresa,
          premio: i.premio_descricao || '',
          local: i.premio_local || '',
          insta: (i.instagram || '').replace(/^@/, ''),
          contato: i.premio_contato_nome || '',
          telefone: i.premio_contato_whatsapp || '',
        });
      for (const [nome, d] of Object.entries(dias)) if (!d.patrocinadores.length) delete dias[nome];
      await mandar('programacao', { cidade, esporte, dias }, `ultimoProg-${cidade}-${esporte}`, `✓ Programação ${cidade} · ${esporte} na Central`, true);
      await new Promise((r) => setTimeout(r, 1500));
    }
}

// Ganhadores do sorteio diário de todas as cidades e esportes, direto da API do Hub (a mesma da aba
// "Ganhadores do dia"), já com cidade, esporte, prêmios e WhatsApp. Lê de qualquer página do Hub, a cada 15 min,
// sem abrir a tela do sorteio. (A leitura da tela trocava nome e cidade em alguns cartões e perdia o Beach.)
let ultimosGanhadores = 0;
async function ganhadoresDaApi() {
  const j = await fetch('/api/torneios/sorteio-ganhadores', { credentials: 'include', cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const lista = Array.isArray(j) ? j : j?.ganhadores;
  if (!Array.isArray(lista)) return null;
  const limite = new Date(Date.now() - 12 * 864e5).toLocaleDateString('sv-SE');
  return lista
    .filter((x) => x.nome && x.data_sorteio && x.data_sorteio.slice(0, 10) >= limite)
    .map((x) => ({
      nome: x.nome.trim(),
      data: x.data_sorteio.slice(0, 10),
      local: [x.cidade, x.esporte].filter(Boolean).join(' · '),
      patrocinador: x.patrocinador || '',
      premio: x.premio || '',
      extra: Math.max(0, (x.premios?.length || 1) - 1),
      telefone: (x.whatsapp || '').replace(/\D/g, ''),
      api: true,
    }));
}
function lerGanhadoresApi(forcar = false) {
  if (!forcar && Date.now() - ultimosGanhadores < 15 * 60e3) return;
  ultimosGanhadores = Date.now();
  ganhadoresDaApi().then((g) => g && g.length && mandar('ganhadores', g, 'ultimoGanhadores', `✓ ${g.length} ganhadores recentes na Central`, true));
}

// Plano (Central): os projetos da Expansão (checklist, responsável, estreia) e os atletas pagantes por praça,
// direto da API do Hub, a cada 30 min. Só leitura.
let ultimoPlano = 0;
function lerPlanoApi() {
  // nas telas da Expansão (criando ou mexendo em projeto) lê a cada minuto; no resto do Hub, a cada 30 min
  const naExpansao = /^\/match-admin\/expansao/.test(location.pathname);
  if (Date.now() - ultimoPlano < (naExpansao ? 60e3 : 30 * 60e3)) return;
  ultimoPlano = Date.now();
  const json = (url) => fetch(url, { credentials: 'include', cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  json('/api/match-admin/expansao/projetos').then(async (j) => {
    const lista = Array.isArray(j) ? j : j?.projetos;
    if (!Array.isArray(lista)) return;
    // locais de cada projeto (aba Locais): quantos são e quantos já têm o WhatsApp do responsável.
    // Abre o detalhe de cada projeto no máx. a cada 5 min; no meio-tempo repete a última contagem.
    const { contagemLocais = {}, contagemEm = 0 } = await chrome.storage.local.get(['contagemLocais', 'contagemEm']);
    if (Date.now() - contagemEm > 5 * 60e3) {
      for (const x of lista) {
        const d = await json(`/api/match-admin/expansao/projetos/${x.id}`);
        if (!Array.isArray(d?.locais)) continue;
        // o telefone do responsável pode estar no próprio local ou na aba Contatos (dono/sócio ligado à academia)
        const tel = (t) => (t || '').replace(/\D/g, '').length >= 10;
        const viaContatos = new Set((d.contatos || []).filter((c) => c.academia_id && tel(c.whatsapp)).map((c) => c.academia_id));
        contagemLocais[x.id] = { locais: d.locais.length, comResponsavel: d.locais.filter((l) => tel(l.contato_whatsapp) || viaContatos.has(l.id)).length };
      }
      await chrome.storage.local.set({ contagemLocais, contagemEm: Date.now() });
    }
    const projetos = lista.map((x) => ({
      ...(contagemLocais[x.id] || {}),
      id: x.id,
      cidade: x.cidade,
      esporte: x.esporte,
      status: x.status,
      estreia: x.data_lancamento || null,
      responsavel: x.responsavel_nome || '',
      total: x.total || 0,
      feitos: x.feitos || 0,
    }));
    mandar('expansao', { projetos }, 'ultimaExpansao', `✓ ${projetos.length} praças da Expansão na Central`, true);
  });
  json('/api/atletas/dashboard').then((j) => {
    if (!Array.isArray(j?.linhas)) return;
    // pessoas pagantes (assinatura ativa ou pago por fora) por praça e esporte
    const por = {};
    for (const l of j.linhas) {
      if (!l.pagante || l.cancelado || l.cortesia || l.socio) continue;
      (por[`${l.praca}|${l.esporte}`] ||= new Set()).add(l.user_id);
    }
    const pracas = Object.fromEntries(Object.entries(por).map(([k, s]) => [k, s.size]));
    mandar('pagantes', { total: j.totais?.pagantes ?? null, pracas }, 'ultimosPagantes', '✓ Atletas pagantes na Central', true);
  });
}

let ultimoPix = 0;
function lerPix() {
  if (Date.now() - ultimoPix < 30 * 60e3) return;
  ultimoPix = Date.now();
  dadosPix().then((p) => p && mandar('pix', p, 'ultimoPix', `✓ ${p.itens.length} cobranças Pix na Central`, true));
}

// Descrição das tarefas da Laura: na lista dela o Hub abre "Editar tarefa"; lê a descrição e
// fecha em "Cancelar" (nunca salva nada). Fica guardada na extensão, para não abrir de novo.
// Só abre as tarefas na aba automática: com a Laura usando a tela, usa só o que já tem guardado
// (para nunca fechar uma tarefa que ela esteja editando).
let lendoLaura = false;
// As tarefas em aberto da Laura direto da API de Atividades (título, prazo, urgência, descrição e hora em que
// entraram). Não depende do filtro que está na tela nem de abrir janela: a leitura da tela já trocou descrição
// entre tarefas e leu o "Deleguei" como se fosse dela. Sem a API, volta para a leitura da tela.
async function abertasDaApi() {
  const j = await fetch('/api/atividades?filtro=minhas', { credentials: 'include', cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const lista = Array.isArray(j) ? j : j?.atividades || Object.values(j || {}).find(Array.isArray);
  if (!Array.isArray(lista)) return null;
  const abertas = lista
    .filter((x) => x.titulo && x.status !== 'concluida' && !x.arquivada_em && !x.parent_id)
    .map((x) => ({
      titulo: x.titulo.trim(),
      prazo: x.prazo ? x.prazo.slice(0, 10) : null,
      urgente: !!x.urgente,
      descricao: (x.descricao || '').trim(),
      ...(x.criado_em ? { criadoEm: x.criado_em } : {}),
    }));
  return { dia: new Date().toLocaleDateString('sv-SE'), abertas, fonte: 'api' };
}
const completarLaura = async (n, buscar) => comTelefonePix((await abertasDaApi()) || (await comDescricaoLaura(n, buscar)));

async function comDescricaoLaura(n, buscar) {
  // descLaura2: as descrições guardadas antes da correção (algumas trocadas entre tarefas) são lidas de novo
  const { descLaura2: descLaura = {} } = await chrome.storage.local.get('descLaura2');
  const chave = (a) => `${a.titulo}|${a.prazo || ''}`;
  if (buscar && !lendoLaura) {
    lendoLaura = true;
    for (const a of n.abertas) {
      if (a.descricao || descLaura[chave(a)] !== undefined) continue; // já veio da API
      const botao = [...document.querySelectorAll('main div[class*="border-l-[3px]"] button')].find((b) => b.textContent.trim() === a.titulo);
      if (!botao) continue;
      botao.click(); // abre a tarefa
      // só lê a descrição da janela DESTA tarefa (o campo do título tem o mesmo texto); se a janela ainda é a
      // da tarefa anterior ou demorou a abrir, não guarda nada e tenta de novo na próxima leitura
      let caixa = null;
      for (let t = 0; t < 15 && !caixa; t++) {
        await new Promise((r) => setTimeout(r, 200));
        const campo = [...document.querySelectorAll('input')].find((e) => (e.value || '').trim() === a.titulo.trim());
        let box = campo?.parentElement;
        for (let up = 0; box && up < 8 && !box.querySelector('textarea'); up++) box = box.parentElement;
        caixa = box?.querySelector('textarea') || null;
      }
      if (caixa) descLaura[chave(a)] = caixa.value.trim();
      const cancelar = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Cancelar');
      if (cancelar) cancelar.click(); // fecha sem salvar
      else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((r) => setTimeout(r, 400));
    }
    for (const k of Object.keys(descLaura)) if (!n.abertas.some((a) => chave(a) === k)) delete descLaura[k];
    await chrome.storage.local.set({ descLaura2: descLaura });
    lendoLaura = false;
  }
  return { ...n, abertas: n.abertas.map((a) => ({ ...a, descricao: a.descricao || descLaura[chave(a)] || '' })) };
}

async function rodarAutoLaura() {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    let n = lerAtividadesLaura();
    if (n) {
      // primeiro conclui aqui o que já foi feito na Central, depois lê de novo o que sobrou em aberto
      if (await concluirNoHub()) {
        await new Promise((r) => setTimeout(r, 2000));
        n = lerAtividadesLaura() || n;
      }
      const pix = await dadosPix();
      if (pix) await new Promise((r) => chrome.runtime.sendMessage({ tipo: 'pix', dados: pix }, r));
      const completo = await completarLaura(n, true);
      chrome.runtime.sendMessage({ tipo: 'hub-laura', dados: completo }, () => chrome.runtime.sendMessage({ tipo: 'fechar-aba' }));
      return;
    }
  }
  chrome.runtime.sendMessage({ tipo: 'fechar-aba' });
}
if (AUTO_LAURA) rodarAutoLaura();

async function rodarAutoEquipe() {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const n = lerEquipeLolis();
    if (n) {
      const completo = await comTelefonePix(await comExpansao(await comDetalhes(n)));
      chrome.runtime.sendMessage({ tipo: 'hub-lolis', dados: completo }, () => chrome.runtime.sendMessage({ tipo: 'fechar-aba' }));
      return;
    }
  }
  chrome.runtime.sendMessage({ tipo: 'fechar-aba' });
}
if (AUTO_EQUIPE) rodarAutoEquipe();

async function tentar() {
  if (enviando || AUTO || AUTO_EQUIPE || AUTO_LAURA || AUTO_TEL || AUTO_6X0) return;
  // 6x0: a lista da Central acompanha o Hub. Relê ao usar qualquer página do Hub (no máx. a cada 3 min),
  // em qualquer dia: quem ganhou o 📷 no Hub sai da lista sem esperar a próxima quarta
  if (Date.now() - ultimo6x0 > 3 * 60e3) {
    ultimo6x0 = Date.now();
    ler6x0().then((d) => d && mandar('seiszero', d, 'ultimo6x0', `✓ ${d.ganhadores.length} ganhadores do 6x0 na Central`), () => {});
    // contato da retirada de cada patrocinador ("Prêmio do sorteio" no cadastro): o que vai para os atletas
    fetch('/api/torneios/patrocinadores-info', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const lista = (Array.isArray(j) ? j : j?.patrocinadores || Object.values(j || {}).find(Array.isArray) || [])
          .map((x) => ({ empresa: x.empresa, contato: x.premio_contato_nome || '', telefone: x.premio_contato_whatsapp || '' }))
          .filter((x) => x.empresa && (x.contato || x.telefone));
        if (lista.length) setTimeout(() => mandar('programacao', { retiradas: lista }, 'ultimoRetiradas', `✓ Contatos de retirada dos apoiadores na Central`), 1500);
      })
      .catch(() => {});
  }
  lerPix();
  lerProgramacoesApi();
  lerGanhadoresApi();
  lerPlanoApi();
  if (location.pathname === '/atividades') {
    if (!lerAtividadesLaura()) return;
    enviando = true; // segura outras leituras enquanto conclui
    const agora = Date.now() - ultimoConcluir > 45e3; // a tela muda o tempo todo: olha a Central no máx. a cada 45 s
    if (agora) ultimoConcluir = Date.now();
    (agora ? concluirNoHub() : Promise.resolve(0))
      .then((f) => f && new Promise((r) => setTimeout(r, 2000)))
      .finally(() => {
        enviando = false;
        const n = lerAtividadesLaura();
        if (n) completarLaura(n, false).then((c) => mandar('hub-laura', c, 'ultimoLaura', `✓ ${c.abertas.length} tarefas suas em aberto na Central`));
      });
    return;
  }
  if (/^\/atividades\/equipe/.test(location.pathname)) {
    const n = lerEquipeLolis();
    if (n && !lendoDetalhes) comDetalhes(n).then(comExpansao).then(comTelefonePix).then((c) => mandar('hub-lolis', c, 'ultimoEquipe-v2', `✓ ${c.abertas.length} tarefas em aberto da Lolis na Central`));
    return;
  }
  if (/^\/beach/.test(location.pathname)) {
    const n = lerBeach();
    if (n) mandar('numeros', n, 'ultimoHub', '✓ Números do Beach na Central');
  } else if (/^\/sorteio/.test(location.pathname)) {
    // na tela do sorteio, a cada mudança (ex.: acabou de sortear) confere a API de novo, no máx. a cada 30 s
    if (Date.now() - ultimosGanhadores > 30e3) lerGanhadoresApi(true);
    const p = lerProgramacao();
    if (p) mandar('programacao', p, `ultimoProg-${p.cidade}-${p.esporte}`, `✓ Programação ${p.cidade} · ${p.esporte} na Central`);
    else if (/MARCA DO DIA/.test(document.querySelector('main')?.innerText || '') && !avisouFalha) {
      avisouFalha = true;
      aviso('⚠️ Central: não consegui ler a Programação desta tela', 8000);
    }
  }
}

// se a extensão foi atualizada com esta aba aberta, ela perde a ligação: avisa para dar F5
const seguro = async () => {
  try {
    if (!chrome.runtime?.id) throw new Error('desconectada');
    await tentar();
  } catch (e) {
    if (!avisouDesconexao) {
      avisouDesconexao = true;
      aviso('⚠️ Central: a extensão foi atualizada. Aperte F5 nesta aba.', 10000);
    }
  }
};
let avisouDesconexao = false;
let t = null;
new MutationObserver(() => {
  clearTimeout(t);
  t = setTimeout(seguro, 1500); // espera a tela terminar de carregar
}).observe(document.body, { childList: true, subtree: true, characterData: true });
setTimeout(seguro, 2000);
