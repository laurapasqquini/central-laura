// Relatórios: o que a Laura fez (sai do que foi marcado como feito) e o que a Lolis fez (texto colado).
import { buildDay, dadosPaginaLolis, isWorkday } from './engine';
import { addDays, weekday, fmtCurto, fromStr, toStr } from './dates';
import { CALENDARIOS } from '../data/calendarios';
import { TIPOS } from '../data/campanhas';

const semHora = (t) => t.replace(/^\d{1,2}h(\d{2})? · /, '');

// Períodos prontos (semana de segunda a domingo)
export function periodo(tipo, ref) {
  const seg = addDays(ref, -((weekday(ref) + 6) % 7));
  const d = fromStr(ref);
  if (tipo === 'hoje') return [ref, ref];
  if (tipo === 'semana') return [seg, addDays(seg, 6)];
  if (tipo === 'semana-passada') return [addDays(seg, -7), addDays(seg, -1)];
  if (tipo === 'mes') return [toStr(new Date(d.getFullYear(), d.getMonth(), 1)), toStr(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  if (tipo === 'mes-passado') return [toStr(new Date(d.getFullYear(), d.getMonth() - 1, 1)), toStr(new Date(d.getFullYear(), d.getMonth(), 0))];
  return [ref, ref];
}

const nomeCampanha = (id) => {
  const [calId, rod, tipo] = id.split(':');
  const c = CALENDARIOS.find((x) => x.id === calId);
  return `Campanha agendada: ${c ? `${c.cidade} ${c.curto}` : calId} ${rod} (${TIPOS[tipo]?.nome || tipo})`;
};

// Título limpo para o relatório: sem emoji, telefone nem rótulo interno do Hub
const SEM_EMOJI = /[\p{Extended_Pictographic}️‍]/gu;
export function tituloLimpo(t) {
  let s = t.replace(SEM_EMOJI, '').replace(/\s*·\s*\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g, '').replace(/\s+/g, ' ').trim();
  let m;
  if ((m = s.match(/^Bot do WhatsApp — (.+?)(?: \((.+)\))?$/))) return { grupo: 'Atendimentos do WhatsApp', item: m[2] ? `${m[1]} (${m[2].replace(/\s*\(insistiu\)/, '')})` : m[1] };
  if ((m = s.match(/^Recado do WhatsApp d[oa] \S+ — (.+)$/))) return { grupo: 'Recados do WhatsApp', item: m[1] };
  if ((m = s.match(/^Cobrar (?:mensalidade|renova[cç][aã]o) Pix — (.+?) \((.+?)\)/i))) return { grupo: 'Cobranças Pix', item: `${m[1]} (${m[2]})` };
  if ((m = s.match(/^\[Expansão (.+?)\] (.+)$/))) return { grupo: `Expansão ${m[1]}`, item: m[2] };
  if ((m = s.match(/^Melhores da rodada · (.+)$/))) return { grupo: 'Melhores da rodada', item: m[1].replace(/\s*\(Instagram d[oa] \w+\)/, '') };
  return { grupo: null, item: s };
}

// Junta os itens do mesmo tipo numa linha só ("Cobranças Pix (3): Ana, Beto, Caio")
export function agrupar(titulos) {
  const grupos = new Map();
  const soltos = [];
  for (const t of titulos) {
    const { grupo, item } = tituloLimpo(t);
    if (!grupo) soltos.push(item);
    else grupos.set(grupo, [...(grupos.get(grupo) || []), item]);
  }
  return [...[...grupos].map(([g, its]) => (its.length > 1 ? `${g} (${its.length}): ${its.join('; ')}` : `${g}: ${its[0]}`)), ...soltos];
}

// Itens marcados como feitos num dia, por pessoa e área.
// Fica de fora o que a central fechou sozinha (saiu do Hub sem você marcar) e o pedido feito ao Thales.
const naoContaNoRelatorio = (t) => /Saiu de "em aberto" no Hub/.test(t.notes || '') || /^Pedido do HUB ·/i.test(t.title);
export function feitosDoDia(state, date, who, area) {
  const okArea = (a) => area === 'all' || a === area;
  const out = [];
  for (const t of state.tasks) if (t.done && t.doneAt === date && t.who === who && okArea(t.area) && !naoContaNoRelatorio(t)) out.push(t.title);
  for (const x of buildDay(state, date, { area, who })) if (x.kind === 'routine' && x.done) out.push(semHora(x.title));
  if (who === 'laura' && okArea('ranken'))
    for (const [id, v] of Object.entries(state.campanhas || {})) if (v.status === 'agendada' && v.em === date) out.push(nomeCampanha(id));
  return [...new Set(out)];
}

// Dias do período (do mais recente para o mais antigo) que têm algo
// O que a Lolis escreveu ao marcar (e o que ela não conseguiu), com o nome de cada item
function notasLolis(state, d) {
  const notas = (state.lolisNotas || {})[d];
  if (!notas || !isWorkday(state, d)) return [];
  const dia = dadosPaginaLolis(state, d).dias.find((x) => x.date === d);
  const nomes = Object.fromEntries([
    ...(dia?.tarefas || []).map((t) => [t.key, t.titulo]),
    ...(dia?.posts || []).map((p) => [`sorteio:${p.grupo}`, `Sorteio diário · ${p.grupo}`]),
    ...(dia?.brindes || []).map((b) => [b.key, b.linha]),
  ]);
  return Object.entries(notas)
    .filter(([, n]) => n.status === 'nao' || n.nota)
    .map(([k, n]) => `${n.status === 'nao' ? '✕ Não conseguiu' : '📝'} ${nomes[k] || 'tarefa'}${n.nota ? `: ${n.nota}` : ''}`);
}

export function montarRelatorio(state, [de, ate], area) {
  const dias = [];
  for (let d = ate; d >= de; d = addDays(d, -1)) {
    const eu = feitosDoDia(state, d, 'laura', area);
    const lolisFeitos = feitosDoDia(state, d, 'lolis', area);
    const notaEu = (state.relatosLaura || {})[d] || '';
    const lolis = [(state.relatosLolis || {})[d] || '', ...notasLolis(state, d)].filter(Boolean).join('\n');
    if (eu.length || lolisFeitos.length || notaEu || lolis) dias.push({ date: d, eu: agrupar(eu), notaEu, lolis, lolisFeitos: agrupar(lolisFeitos), nEu: eu.length, nLolis: lolisFeitos.length });
  }
  return dias;
}

// Totais do período, para o topo do relatório
export const totais = (dias) => ({ eu: dias.reduce((s, d) => s + d.nEu, 0), lolis: dias.reduce((s, d) => s + d.nLolis, 0) });
const linhaTotais = (dias, inclui) => {
  const t = totais(dias);
  return [inclui.eu && `Laura: ${t.eu} ${t.eu === 1 ? 'item concluído' : 'itens concluídos'}`, inclui.lolis && `Lolis: ${t.lolis} ${t.lolis === 1 ? 'item concluído' : 'itens concluídos'}`].filter(Boolean).join(' · ');
};

const AREA_NOME = { all: 'Geral', ranken: 'RANKEN', gralha: 'Gralha Azul', pessoal: 'Pessoal' };
const br = (s) => s.split('-').reverse().slice(0, 2).join('/');
export const tituloRelatorio = ([de, ate], area) => `Relatório ${AREA_NOME[area]} · ${de === ate ? br(de) : `${br(de)} a ${br(ate)}`}`;

// Texto para colar no WhatsApp (negrito com *)
export function textoRelatorio(dias, per, area, inclui) {
  const linhas = [`*${tituloRelatorio(per, area).toUpperCase()}*`, linhaTotais(dias, inclui)];
  for (const d of [...dias].reverse()) {
    const bloco = [];
    if (inclui.eu && (d.eu.length || d.notaEu)) {
      bloco.push('_Laura_');
      bloco.push(...d.eu.map((t) => `• ${t}`));
      if (d.notaEu) bloco.push(d.notaEu);
    }
    if (inclui.lolis && (d.lolis || d.lolisFeitos.length)) {
      bloco.push('_Lolis_');
      bloco.push(...d.lolisFeitos.map((t) => `• ${t}`));
      if (d.lolis) bloco.push(d.lolis);
    }
    if (bloco.length) linhas.push('', `*${fmtCurto(d.date)}*`, ...bloco);
  }
  return linhas.join('\n');
}

export async function baixarPdf(dias, per, area, inclui) {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
  pdfMake.addVirtualFileSystem(vfs);
  pdfMake.setUrlAccessPolicy(() => false);
  const titulo = tituloRelatorio(per, area);
  const content = [
    { text: titulo, fontSize: 16, bold: true, color: '#1e1b4b', margin: [0, 0, 0, 2] },
    { text: linhaTotais(dias, inclui), color: '#64748b', margin: [0, 0, 0, 12] },
  ];
  const quem = (nome, itens, texto) => {
    const out = [{ text: nome, bold: true, color: '#475569', margin: [0, 4, 0, 2] }];
    if (itens.length) out.push({ ul: [...itens], margin: [0, 0, 0, 3] });
    if (texto) out.push({ text: texto, margin: [0, 0, 0, 3] });
    return out;
  };
  for (const d of [...dias].reverse()) {
    const bloco = [];
    if (inclui.eu && (d.eu.length || d.notaEu)) bloco.push(...quem('Laura', d.eu, d.notaEu));
    if (inclui.lolis && (d.lolis || d.lolisFeitos.length)) bloco.push(...quem('Lolis', d.lolisFeitos, d.lolis));
    if (bloco.length) content.push({ text: fmtCurto(d.date), fontSize: 12, bold: true, color: '#4f46e5', margin: [0, 10, 0, 2] }, ...bloco);
  }
  if (content.length === 2) content.push({ text: 'Nada registrado neste período.', color: '#94a3b8' });
  const blob = await pdfMake.createPdf({ content, defaultStyle: { fontSize: 10, lineHeight: 1.2 }, pageMargins: [40, 40, 40, 40] }).getBlob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${titulo.replace(/[^\wÀ-ú]+/g, '_')}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
