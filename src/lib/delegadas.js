// Ranken › Lolis › Delegadas: o caderno do que a Laura passou para a Lolis, pelo dia em que delegou,
// com a situação de cada tarefa (feita, não conseguiu, atrasada, em aberto). Só tarefas avulsas:
// as rotinas fixas dela ficam no Acompanhamento.
import { addDays, weekday } from './dates.js';

const segundaDe = (d) => addDays(d, -((weekday(d) + 6) % 7));
export function diaUtilAnterior(ref, ehUtil) {
  let d = addDays(ref, -1);
  for (let i = 0; i < 15 && !ehUtil(d); i++) d = addDays(d, -1);
  return d;
}

// períodos pelo dia em que delegou: [de, até] (inclusive)
export function periodos(ref, ehUtil) {
  const seg = segundaDe(ref);
  const ontem = diaUtilAnterior(ref, ehUtil);
  return {
    hoje: { rotulo: 'Hoje', de: ref, ate: ref },
    ontem: { rotulo: ontem === addDays(ref, -1) ? 'Ontem' : 'Último dia útil', de: ontem, ate: ontem },
    semana: { rotulo: 'Esta semana', de: seg, ate: ref },
    passada: { rotulo: 'Semana passada', de: addDays(seg, -7), ate: addDays(seg, -1) },
    tudo: { rotulo: 'Tudo', de: '', ate: '9999' },
  };
}

// o que ela marcou na página dela sobre a tarefa (o mais recente): { dia, status, nota }
function marcaDela(notas = {}, key) {
  let ult = null;
  for (const dia of Object.keys(notas).sort()) if (notas[dia]?.[key]) ult = { dia, ...notas[dia][key] };
  return ult;
}

// ctx = { ref, ehUtil(d), prazoDe(t) (data efetiva do prazo), notas (state.lolisNotas) }
export function situacao(t, ctx) {
  const m = marcaDela(ctx.notas, `t:${t.id}`);
  const prazo = t.due ? ctx.prazoDe(t) : null;
  if (t.done) return { tipo: 'feita', em: t.doneAt || m?.dia || null, nota: m?.status === 'feito' ? m.nota || '' : '', prazo };
  if (m?.status === 'nao') return { tipo: 'nao', em: m.dia, nota: m.nota || '', prazo };
  if (prazo && prazo < ctx.ref) {
    let dias = 0;
    for (let d = addDays(prazo, 1); d <= ctx.ref; d = addDays(d, 1)) if (ctx.ehUtil(d)) dias++;
    return { tipo: 'atrasada', dias, prazo, nota: m?.nota || '' };
  }
  return { tipo: 'aberto', prazo, nota: m?.nota || '' };
}

const ORDEM = { atrasada: 0, nao: 1, aberto: 2, feita: 3 };
const semAcento = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// lista do período (ou busca em tudo), com a contagem por situação
export function delegadas(tasks, ctx, { de = '', ate = '9999', busca = '' } = {}) {
  const q = semAcento(busca.trim());
  const itens = tasks
    .filter((t) => t.who === 'lolis' && !t.whats)
    // com busca, procura em tudo; em "Tudo" (de vazio) entram também as antigas sem data de criação
    .filter((t) => (q ? semAcento(`${t.title} ${t.notes || ''}`).includes(q) : !de || (t.createdAt && t.createdAt >= de && t.createdAt <= ate)))
    .map((t) => ({ id: t.id, titulo: t.title, notas: t.notes || '', delegadaEm: t.createdAt || null, origem: t.hubLolis ? 'Hub' : 'Central', ...situacao(t, ctx) }))
    .sort((a, b) => (b.delegadaEm || '').localeCompare(a.delegadaEm || '') || ORDEM[a.tipo] - ORDEM[b.tipo] || a.titulo.localeCompare(b.titulo));
  const conta = { total: itens.length, feita: 0, nao: 0, aberto: 0, atrasada: 0 };
  for (const x of itens) conta[x.tipo]++;
  return { itens, conta };
}
