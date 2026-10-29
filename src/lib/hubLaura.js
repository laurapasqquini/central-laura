// Junta na central a leitura das Atividades da Laura no Hub (conta 'hub-laura' da extensão).
// Fica fora do store para poder ser testada sozinha (npm test).
import { addDays } from './dates.js';

export const PIX_HUB = /^Cobrar (mensalidade|renova[cç][aã]o) Pix/i;
export const RODAPE_HUB_LAURA = 'Veio do Hub (Atividades › Laura)';
const SAIU = /\n?Saiu de "em aberto" no Hub em \d{2}\/\d{2}\/\d{4}/;

// s = estado da central; d = { dia, abertas: [{ titulo, prazo, urgente, descricao, telefone, criadoEm }] }
export function aplicarHubLaura(s, d, { hoje, uid }) {
  if (!Array.isArray(d?.abertas) || !d.abertas.length) return s;
  // o que a Laura deu como feito aqui e o Hub já fechou sai da fila de "concluir no Hub"
  // (a extensão conclui lá; depois de 7 dias desiste)
  if (s.hubConcluir?.length) {
    const noHub = d.abertas.map((a) => a.titulo.trim());
    const seteDias = addDays(hoje, -7);
    s = {
      ...s,
      hubConcluir: s.hubConcluir.filter(
        // as da Lolis são conferidas na leitura da equipe (hub-lolis), não aqui
        (h) => h.lolis || (h.em >= seteDias && (h.pix ? noHub.some((t) => PIX_HUB.test(t) && t.toLowerCase().includes(`— ${h.pix.toLowerCase()} (`)) : noHub.includes(h.titulo.trim()))),
      ),
    };
  }
  if (s.pixCobrar) d = { ...d, abertas: d.abertas.filter((a) => !PIX_HUB.test(a.titulo)) };
  const chave = (titulo, prazo) => `${titulo.trim().toLowerCase()}|${prazo || ''}`;
  const abertas = new Map(d.abertas.map((a) => [chave(a.titulo, a.prazo), a]));
  const dia = d.dia || hoje;
  const naFila = new Set((s.hubConcluir || []).map((h) => h.titulo?.trim()));
  const voltarFila = [];
  let tasks = s.tasks.map((t) => {
    if (!t.hubLaura) return t;
    // pelo título + prazo; se o prazo mudou (ou a leitura antiga deduzia "Ontem"/"Hoje"), só pelo título
    let k = chave(t.title, t.hubPrazo);
    if (!abertas.has(k)) k = [...abertas.keys()].find((x) => x.startsWith(`${t.title.trim().toLowerCase()}|`)) || k;
    const a = abertas.get(k);
    if (a) {
      abertas.delete(k);
      if ((a.prazo || null) !== (t.hubPrazo || null)) t = { ...t, hubPrazo: a.prazo || null };
      // dada como "saiu" por uma leitura errada e ainda em aberto no Hub: volta para a lista
      if (t.done && SAIU.test(t.notes || '')) t = { ...t, done: false, doneAt: null, notes: t.notes.replace(SAIU, '').trim() };
      // feita aqui e ainda em aberto lá, mas fora da fila (a fila foi apagada): entra de novo para concluir no Hub
      else if (t.done && t.doneAt >= addDays(hoje, -7) && !naFila.has(t.title.trim())) voltarFila.push({ titulo: t.title, em: t.doneAt });
      const notas = a.descricao ? `${a.descricao}\n\n${RODAPE_HUB_LAURA}` : t.notes;
      const muda = notas !== t.notes || (!t.done && !!a.urgente !== !!t.urgent) || (a.telefone && a.telefone !== t.telefone) || (a.criadoEm && a.criadoEm !== t.hubCriadoEm);
      return muda ? { ...t, notes: notas, urgent: t.done ? t.urgent : !!a.urgente, ...(a.telefone ? { telefone: a.telefone } : {}), ...(a.criadoEm ? { hubCriadoEm: a.criadoEm } : {}) } : t;
    }
    return t.done ? t : { ...t, done: true, doneAt: dia, notes: `${t.notes ? `${t.notes}\n` : ''}Saiu de "em aberto" no Hub em ${dia.split('-').reverse().join('/')}` };
  });
  const novas = [...abertas.values()].map((a) => ({
    id: uid(),
    title: a.titulo,
    area: 'ranken',
    who: 'laura',
    urgent: !!a.urgente,
    due: a.prazo || null,
    hub: true,
    hubPath: 'atividades',
    hubLaura: true,
    hubPrazo: a.prazo || null,
    ...(a.criadoEm ? { hubCriadoEm: a.criadoEm } : {}), // hora em que entrou no Hub
    ...(a.telefone ? { telefone: a.telefone } : {}),
    done: false,
    createdAt: dia,
    postponed: 0,
    notes: `${a.descricao ? `${a.descricao}\n\n` : ''}${RODAPE_HUB_LAURA}`,
  }));
  tasks = [...novas, ...tasks];
  return { ...s, tasks, hubLauraEm: dia, ...(voltarFila.length ? { hubConcluir: [...(s.hubConcluir || []), ...voltarFila] } : {}) };
}
