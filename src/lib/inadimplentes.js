// Histórico de cada inadimplente: os "episódios" (cada vez que a pessoa entrou na lista do Hub) e os contatos
// feitos em cada um. Daqui sai qual mensagem usar: 1º contato, follow-up ou "inadimplente de novo".
// state.inadHist = { [chave]: { visto: 'AAAA-MM-DD', episodios: [{ inicio, fim, contatos: ['AAAA-MM-DD', …] }] } }
import { addDays, diffDays } from './dates.js';

const SUMIU_DIAS = 3; // fora da lista por 3 dias ou mais = resolveu; se voltar depois, é outro episódio

// a mesma pessoa em qualquer cobrança: o cliente do Stripe (se não vier, o id da cobrança)
export const chaveInad = (x) => x.stripeCliente || `id:${x.id}`;

const episodioAtual = (h) => {
  const ep = h?.episodios?.at(-1);
  return ep && !ep.fim ? ep : null;
};

// junta a lista nova do Hub ao histórico. legado = o "falei hoje" antigo ({ id da cobrança: data })
export function atualizarHistorico(hist = {}, itens = [], dia, legado = {}) {
  const novo = { ...hist };
  for (const x of itens) {
    const k = chaveInad(x);
    const h = novo[k] ? { ...novo[k], episodios: [...novo[k].episodios] } : { visto: null, episodios: [] };
    let ep = episodioAtual(h);
    // ficou fora das listas por uns dias e voltou: o episódio anterior acabou quando ela sumiu
    if (ep && h.fora && diffDays(dia, h.fora) >= SUMIU_DIAS) {
      h.episodios[h.episodios.length - 1] = { ...ep, fim: h.visto };
      ep = null;
    }
    delete h.fora;
    if (!ep) {
      ep = { inicio: dia, fim: null, contatos: [] };
      h.episodios.push(ep);
    }
    // contato marcado no formato antigo (antes do histórico): entra no episódio atual
    const antigo = legado[x.id];
    if (antigo && !ep.contatos.includes(antigo)) {
      ep = { ...ep, contatos: [...ep.contatos, antigo].sort() };
      h.episodios[h.episodios.length - 1] = ep;
    }
    h.visto = dia;
    novo[k] = h;
  }
  // quem não veio na lista: anota desde quando está fora e fecha o episódio quando passar do prazo
  // (pagou, resolveu ou cancelou). Dias sem leitura não contam; lista vazia é tratada como leitura falha.
  if (!itens.length) return novo;
  const naLista = new Set(itens.map(chaveInad));
  for (const [k, h] of Object.entries(novo)) {
    const ep = episodioAtual(h);
    if (!ep || naLista.has(k)) continue;
    const fora = h.fora || dia;
    novo[k] = diffDays(dia, fora) >= SUMIU_DIAS ? { ...h, fora, episodios: [...h.episodios.slice(0, -1), { ...ep, fim: h.visto }] } : { ...h, fora };
  }
  return novo;
}

// marca (dia) ou desmarca (null) um contato no episódio atual. Guarda o status do momento do contato
// (se a pessoa passar de "vai bloquear" para "bloqueado" depois, ela volta na hora para a lista)
export function marcarContato(hist = {}, x, dia, hoje) {
  const k = chaveInad(x);
  const h = hist[k] || { visto: hoje, episodios: [] };
  const eps = [...h.episodios];
  let ep = episodioAtual(h);
  if (!ep) {
    ep = { inicio: hoje, fim: null, contatos: [] };
    eps.push(ep);
  }
  const contatos = dia ? [...new Set([...ep.contatos, dia])].sort() : ep.contatos.filter((d) => d !== hoje);
  eps[eps.length - 1] = { ...ep, contatos, ...(dia ? { statusContato: x.status || null } : {}) };
  return { ...hist, [k]: { ...h, episodios: eps } };
}

// "não cobrar mais" (dia) ou voltar a cobrar (null): quem já avisou que não vai mais jogar.
// Vale só para este episódio: se a pessoa pagar e um dia voltar a dever, recomeça do zero.
export function marcarNaoCobrar(hist = {}, x, dia, hoje) {
  const k = chaveInad(x);
  const h = hist[k] || { visto: hoje, episodios: [] };
  const eps = [...h.episodios];
  let ep = episodioAtual(h);
  if (!ep) {
    ep = { inicio: hoje, fim: null, contatos: [] };
    eps.push(ep);
  }
  const { naoCobrar, ...resto } = ep;
  eps[eps.length - 1] = dia ? { ...resto, naoCobrar: dia } : resto;
  return { ...hist, [k]: { ...h, episodios: eps } };
}

// a frequência: 1ª mensagem quando aparece; a 2ª, 3 dias depois da 1ª; a 3ª, 7 dias depois da 2ª.
// Depois da 3ª, a central para de pedir mensagem: 7 dias sem pagar, vai para "Sem retorno" (decidir caso a caso).
export const PRAZOS = [3, 7]; // dias depois do 1º e do 2º contato
export const MAX_CONTATOS = 3;

// a situação de uma pessoa da lista: contatos do episódio, se já foi inadimplente antes, qual mensagem usar
// e se ela pede atenção agora
export function situacao(hist = {}, x, hoje) {
  const h = hist[chaveInad(x)];
  const eps = h?.episodios || [];
  const ep = episodioAtual(h) || { contatos: [] };
  const anteriores = eps.filter((e) => e.fim);
  const contatos = ep.contatos || [];
  const n = contatos.length;
  const ultimo = contatos.at(-1) || null;
  // a mensagem de agora conta os contatos de antes de hoje (o de hoje é o que está sendo feito)
  const antesDeHoje = contatos.filter((d) => d < hoje).length;
  const reincidente = anteriores.length > 0;
  const tipo = antesDeHoje >= 2 ? 'followup3' : antesDeHoje === 1 ? 'followup' : reincidente ? 'reincidente' : x.status === 'unpaid' ? 'bloqueado' : 'vai';
  // falou com ela quando ainda ia bloquear e agora está bloqueada: avisar já
  const virouBloqueado = n > 0 && ultimo < hoje && x.status === 'unpaid' && ep.statusContato && ep.statusContato !== 'unpaid';
  const proximoEm = n === 0 ? hoje : n < MAX_CONTATOS ? addDays(ultimo, PRAZOS[n - 1]) : null;
  const semRetorno = n >= MAX_CONTATOS && ultimo <= addDays(hoje, -PRAZOS.at(-1));
  if (ep.naoCobrar) return { contatos: n, ultimo, reincidente, ultimaVez: anteriores.at(-1)?.fim || null, tipo, virouBloqueado: false, proximoEm: null, semRetorno: false, naoCobrar: ep.naoCobrar, pedeAtencao: false };
  return {
    naoCobrar: null,
    contatos: n,
    ultimo,
    reincidente,
    ultimaVez: anteriores.at(-1)?.fim || null,
    tipo,
    virouBloqueado: !!virouBloqueado,
    proximoEm,
    semRetorno,
    pedeAtencao: n === 0 || (n < MAX_CONTATOS && proximoEm <= hoje) || (!!virouBloqueado && n < MAX_CONTATOS + 1),
  };
}
