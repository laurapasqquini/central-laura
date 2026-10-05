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
export function mensagemTabela({ cliente, cidade, itens, produtos }) {
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
  out.push('5% de desconto no pagamento à vista', '*Pagamento:* 50% no fechamento do pedido e 50% no envio');
  return out.join('\n');
}

export const detalhe = (p) => [p.tecido, p.tamanho, p.personalizacao].filter(Boolean).join(' · ');

export function totals(itens, produtos, frete) {
  const linhas = itens.map((it) => {
    const p = produtos.find((x) => x.id === it.prodId);
    const { atual } = priceFor(p, it.qtd);
    const unit = it.precoManual ?? atual?.preco ?? 0;
    return { ...it, p, unit, subtotal: unit * it.qtd };
  });
  const produtosTotal = linhas.reduce((s, l) => s + l.subtotal, 0);
  const total = produtosTotal + (frete || 0);
  return { linhas, produtosTotal, total, aVista: produtosTotal * 0.95 + (frete || 0) };
}

export function mensagem({ cliente, cidade, itens, produtos, frete, freteTexto }) {
  const { linhas, total, aVista } = totals(itens, produtos, frete);
  const prazos = [...new Set(linhas.map((l) => l.p.prazo).filter(Boolean))];
  const out = ['*ORÇAMENTO GRALHA AZUL UNIFORMES*', ''];
  if (cliente) out.push(`Cliente: ${cliente}`, '');
  linhas.forEach((l, i) => {
    out.push(`*${i + 1}) ${l.p.nome}*`);
    if (detalhe(l.p)) out.push(detalhe(l.p));
    out.push(`${l.qtd} un × ${brl(l.unit)} = *${brl(l.subtotal)}*`, '');
  });
  if (prazos.length) out.push(`*Prazo de produção:* ${prazos.join(' / ')}`);
  out.push(`*Frete:* ${isMaringa(cidade) ? 'grátis para Maringá-PR' : frete ? `${brl(frete)}${cidade ? ` (${cidade})` : ''}` : freteTexto || 'a calcular conforme o endereço de entrega'}`);
  out.push('', `*Total: ${brl(total)}*`, `À vista (5% de desconto nos produtos): *${brl(aVista)}*`, '', '*Pagamento:* 50% no fechamento do pedido e 50% no envio');
  return out.join('\n');
}

// ---- Comissão da Laura (padrão: 8% sobre o total do pedido) ----
export const cfgComissao = (state) => ({ comissao: 8, base: 'total', ...(state.gralhaCfg || {}) });

// Valor do pedido: o do contrato (se já foi montado) ou o do orçamento
export function valoresPedido(p) {
  if (p.contrato) {
    const produtos = p.contrato.itens.reduce((s, i) => s + i.tamanhos.reduce((a, t) => a + (Number(t.qtd) || 0), 0) * (Number(i.preco) || 0), 0);
    const frete = Number(p.contrato.frete) || 0;
    if (produtos > 0) return { produtos, frete, total: produtos + frete };
  }
  const frete = Number(p.frete) || 0;
  const total = Number(p.total) || 0;
  return { produtos: Math.max(0, total - frete), frete, total };
}

export const comissaoDe = (p, cfg) => {
  const v = valoresPedido(p);
  return ((cfg.base === 'produtos' ? v.produtos : v.total) * (Number(cfg.comissao) || 0)) / 100;
};

// Data em que o pedido fechou (1ª vez que foi para "fechado" ou "contrato")
export const dataFechamento = (p) => (p.history || []).find((h) => ['fechado', 'contrato'].includes(h.stage))?.date || null;
