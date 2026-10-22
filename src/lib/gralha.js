// Cálculo de orçamento da Gralha Azul a partir do catálogo importado da planilha.

export const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const isMaringa = (cidade) => /maring/.test(norm(cidade));

// Preço da faixa: a maior quantidade mínima que a quantidade pedida alcança.
export function priceFor(prod, qtd) {
  const faixas = [...prod.faixas].sort((a, b) => a.min - b.min);
  const atual = [...faixas].reverse().find((f) => qtd >= f.min);
  const proxima = faixas.find((f) => f.min > qtd);
  return { atual, proxima, abaixoMinimo: !atual };
}

// Produtos cujo NOME bate com a busca vêm antes dos que só batem pela aba ou tecido.
export function search(produtos, q, aba) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  return produtos
    .filter((p) => {
      if (aba && p.aba !== aba) return false;
      const hay = norm([p.nome, p.tecido, p.personalizacao, p.tamanho, p.aba].join(' '));
      return terms.every((t) => hay.includes(t));
    })
    .map((p) => ({ p, score: terms.filter((t) => norm(p.nome).includes(t)).length }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}

// "camiseta algodão, samba, body" -> um grupo de resultados por termo
export const searchMany = (produtos, q, aba) =>
  q
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((termo) => ({ termo, results: search(produtos, termo, aba) }));

// Nome de cada faixa: "5 a 14 peças", "51 ou mais"
export function faixasLabel(prod) {
  const fs = [...prod.faixas].sort((a, b) => a.min - b.min);
  if (fs.length === 1 && fs[0].min <= 1) return [{ label: 'Unidade', preco: fs[0].preco }];
  return fs.map((f, i) => {
    const max = f.max ?? (fs[i + 1] ? fs[i + 1].min - 1 : null);
    return { label: max == null ? `${f.min} ou mais` : max === f.min ? `${f.min} peças` : `${f.min} a ${max} peças`, preco: f.preco };
  });
}

// Mensagem só com a tabela de preços (cliente ainda sem quantidade definida).
export function mensagemTabela({ cliente, cidade, itens, produtos, descontoTexto, ativacao }) {
  const out = ['*ORÇAMENTO GRALHA AZUL UNIFORMES*', ''];
  if (cliente) out.push(`Cliente: ${cliente}`, '');
  itens.forEach((it, i) => {
    const p = produtos.find((x) => x.id === it.prodId);
    out.push(`*${i + 1}) ${p.nome}*`);
    if (detalhe(p)) out.push(detalhe(p));
    faixasLabel(p).forEach((f) => out.push(`• ${f.label}: ${brl(f.preco)}`));
    if (p.prazo) out.push(`Prazo: ${p.prazo}`);
    out.push('');
  });
  out.push(`*Frete:* ${isMaringa(cidade) ? 'grátis para Maringá-PR' : 'a calcular conforme o endereço de entrega'}`);
  if (String(descontoTexto || '').trim()) {
    const d = String(descontoTexto).trim();
    out.push(`${rotuloDesconto(ativacao)} ${ehPorcentagem(d) ? `${d} nos produtos` : `${brl(descontoValor(d, Infinity))} no pedido`}`);
  }
  // os 5% à vista não vão no orçamento: só se o cliente pedir desconto
  out.push('*Pagamento:* 50% no fechamento do pedido e 50% no envio', '', assinatura());
  return out.join('\n');
}

// rodapé de todo orçamento (em itálico no WhatsApp)
const assinatura = (d = new Date()) => `_Orçamento enviado em ${d.toLocaleDateString('pt-BR')} pela vendedora Laura_`;

export const detalhe = (p) => [p.tecido, p.tamanho, p.personalizacao].filter(Boolean).join(' · ');

// Desconto de ativação: "10%" = porcentagem dos produtos; "150" ou "150,00" = valor em R$
export function descontoValor(texto, produtosTotal) {
  const s = String(texto || '').trim();
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) || 0;
  const v = /%/.test(s) ? (produtosTotal * n) / 100 : n;
  return Math.min(Math.max(0, Math.round(v * 100) / 100), produtosTotal);
}
const ehPorcentagem = (texto) => /%/.test(String(texto || ''));

export function totals(itens, produtos, frete, descontoTexto) {
  const linhas = itens.map((it) => {
    const p = produtos.find((x) => x.id === it.prodId);
    const { atual } = priceFor(p, it.qtd);
    const unit = it.precoManual ?? atual?.preco ?? 0;
    return { ...it, p, unit, subtotal: unit * it.qtd };
  });
  const produtosTotal = linhas.reduce((s, l) => s + l.subtotal, 0);
  const desconto = descontoValor(descontoTexto, produtosTotal);
  const comDesconto = produtosTotal - desconto;
  const total = comDesconto + (frete || 0);
  return { linhas, produtosTotal, desconto, total, aVista: comDesconto * 0.95 + (frete || 0) };
}

const rotuloDesconto = (ativacao) => `*Desconto${ativacao ? ` · ${ativacao}` : ''}:*`;

export function mensagem({ cliente, cidade, itens, produtos, frete, freteTexto, descontoTexto, ativacao }) {
  const { linhas, produtosTotal, desconto, total } = totals(itens, produtos, frete, descontoTexto);
  // com mais de um item, vale o prazo mais longo (dias úteis contam como 7/5 de corridos)
  const diasMax = (t) => Math.max(...(t.match(/\d+/g) || [0]).map(Number)) * (/úteis/i.test(t) ? 7 / 5 : 1);
  const prazos = linhas.map((l) => l.p.prazo).filter(Boolean).sort((a, b) => diasMax(b) - diasMax(a)).slice(0, 1);
  const out = ['*ORÇAMENTO GRALHA AZUL UNIFORMES*', ''];
  if (cliente) out.push(`Cliente: ${cliente}`, '');
  linhas.forEach((l, i) => {
    out.push(`*${i + 1}) ${l.p.nome}*`);
    if (detalhe(l.p)) out.push(detalhe(l.p));
    out.push(`${l.qtd} un × ${brl(l.unit)} = *${brl(l.subtotal)}*`, '');
  });
  if (prazos.length) out.push(`*Prazo de produção:* ${prazos.join(' / ')}`);
  out.push(`*Frete:* ${isMaringa(cidade) ? 'grátis para Maringá-PR' : frete ? `${brl(frete)}${cidade ? ` (${cidade})` : ''}` : freteTexto || 'a calcular conforme o endereço de entrega'}`);
  out.push('');
  if (desconto > 0) out.push(`Produtos: ${brl(produtosTotal)}`, `${rotuloDesconto(ativacao)} −${brl(desconto)}${ehPorcentagem(descontoTexto) ? ` (${String(descontoTexto).trim()})` : ''}`);
  // os 5% à vista não vão no orçamento: só se o cliente pedir desconto (o valor fica na tela)
  out.push(`*Total: ${brl(total)}*`, '', '*Pagamento:* 50% no fechamento do pedido e 50% no envio', '', assinatura());
  return out.join('\n');
}

// ---- Comissão da Laura (padrão: 8% sobre o total do pedido) ----
export const cfgComissao = (state) => ({ comissao: 8, base: 'total', ...(state.gralhaCfg || {}) });

// Valor do pedido: o do contrato (se já foi montado) ou o do orçamento
export function valoresPedido(p) {
  if (p.contrato) {
    const produtos = p.contrato.itens.reduce((s, i) => s + i.tamanhos.reduce((a, t) => a + (Number(t.qtd) || 0), 0) * (Number(i.preco) || 0), 0);
    const frete = Number(p.contrato.frete) || 0;
    // desconto de ativação: o do contrato (que começa igual ao do orçamento)
    const desconto = descontoValor(p.contrato.desconto ?? p.descontoTexto, produtos);
    if (produtos > 0) return { produtos: produtos - desconto, frete, total: produtos - desconto + frete, desconto };
  }
  const frete = Number(p.frete) || 0;
  const total = Number(p.total) || 0;
  return { produtos: Math.max(0, total - frete), frete, total, desconto: Number(p.desconto) || 0 };
}

// Cidades já usadas nos pedidos, com os fretes cobrados (o mais recente primeiro).
// Alimenta a sugestão de cidade e de frete no orçamento.
export function cidadesConhecidas(pedidos) {
  const por = {};
  for (const p of pedidos || []) {
    const nome = (p.cidade || '').trim();
    if (!nome) continue;
    const c = (por[norm(nome)] ||= { nome, fretes: [] });
    const frete = valoresPedido(p).frete;
    const pecas = (p.contrato ? p.contrato.itens.reduce((s, i) => s + i.tamanhos.reduce((a, t) => a + (Number(t.qtd) || 0), 0), 0) : 0) || (p.itens || []).reduce((s, i) => s + (Number(i.qtd) || 0), 0);
    if (frete > 0) c.fretes.push({ frete, cliente: p.cliente, data: p.editadoEm || p.createdAt, pecas });
  }
  for (const c of Object.values(por)) c.fretes.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  return por;
}
export const cidadeDe = (conhecidas, cidade) => conhecidas[norm((cidade || '').trim())] || null;

// Resumo por ativação: quantos orçamentos, quantos fecharam, quanto vendeu e quanto de desconto deu
export function resumoAtivacoes(pedidos) {
  const por = {};
  for (const p of pedidos || []) {
    const nome = (p.contrato?.ativacao ?? p.ativacao ?? '').trim();
    if (!nome) continue;
    const r = (por[nome.toLowerCase()] ||= { nome, orcamentos: 0, fechados: 0, vendido: 0, desconto: 0, perdidos: 0 });
    r.orcamentos++;
    if (p.stage === 'perdido') r.perdidos++;
    else if (dataFechamento(p) || ['fechado', 'contrato'].includes(p.stage)) {
      const v = valoresPedido(p);
      r.fechados++;
      r.vendido += v.total;
      r.desconto += v.desconto || 0;
    }
  }
  return Object.values(por).sort((a, b) => b.vendido - a.vendido || b.orcamentos - a.orcamentos);
}

export const comissaoDe = (p, cfg) => {
  const v = valoresPedido(p);
  return ((cfg.base === 'produtos' ? v.produtos : v.total) * (Number(cfg.comissao) || 0)) / 100;
};

// Data em que o pedido fechou (1ª vez que foi para "fechado" ou "contrato")
export const dataFechamento = (p) => (p.history || []).find((h) => ['fechado', 'contrato'].includes(h.stage))?.date || null;
