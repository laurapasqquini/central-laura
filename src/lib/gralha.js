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

export function search(produtos, q, aba) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  return produtos.filter((p) => {
    if (aba && p.aba !== aba) return false;
    const hay = norm([p.nome, p.tecido, p.personalizacao, p.tamanho, p.aba].join(' '));
    return terms.every((t) => hay.includes(t));
  });
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
