import { today, addDays, weekday, fromStr, lastDayOfMonth, diffDays, fmtCurto } from './dates';

export const AREAS = {
  ranken: { label: 'RANKEN', dot: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-500', text: 'text-emerald-600' },
  gralha: { label: 'Gralha Azul', dot: 'bg-sky-500', soft: 'bg-sky-50 text-sky-700 ring-sky-200', bar: 'bg-sky-500', text: 'text-sky-600' },
  pessoal: { label: 'Pessoal', dot: 'bg-violet-500', soft: 'bg-violet-50 text-violet-700 ring-violet-200', bar: 'bg-violet-500', text: 'text-violet-600' },
};

export const FREQ_LABEL = { daily: 'Todo dia útil', weekly: 'Toda semana', monthly: 'Todo mês' };

export function occursOn(r, date) {
  if (!r.active) return false;
  if (r.createdAt && date < r.createdAt) return false;
  const wd = weekday(date);
  if (r.freq === 'daily') return wd >= 1 && wd <= 5;
  if (r.freq === 'weekly') return wd === r.weekday;
  if (r.freq === 'monthly') {
    const d = fromStr(date).getDate();
    return d === Math.min(r.monthday, lastDayOfMonth(date));
  }
  return false;
}

// Uma lista única de "itens" para as telas: tarefas, rotinas do dia e marcos.
const fromTask = (t, projects) => ({
  key: `t:${t.id}`,
  kind: 'task',
  id: t.id,
  title: t.title,
  area: t.area,
  who: t.who,
  urgent: t.urgent,
  date: t.due,
  done: t.done,
  postponed: t.postponed || 0,
  project: t.projectId ? projects.find((p) => p.id === t.projectId)?.name : null,
  phase: t.phase,
  notes: t.notes,
});

const fromRoutine = (r, date, routineDone) => ({
  key: `r:${r.id}:${date}`,
  kind: 'routine',
  id: r.id,
  title: r.title,
  area: r.area,
  who: r.who,
  urgent: false,
  date,
  done: !!routineDone[`${r.id}:${date}`],
  freq: r.freq,
});

const sortItems = (a, b) =>
  Number(a.done) - Number(b.done) ||
  Number(b.urgent) - Number(a.urgent) ||
  (a.kind === 'marco' ? -1 : 0) - (b.kind === 'marco' ? -1 : 0) ||
  (a.kind === 'routine' ? 1 : 0) - (b.kind === 'routine' ? 1 : 0) ||
  a.title.localeCompare(b.title);

export function buildDay(state, date, filter) {
  const ok = (x) => (filter.area === 'all' || x.area === filter.area) && (filter.who === 'all' || x.who === filter.who);
  const tasks = state.tasks.filter((t) => t.due === date).map((t) => fromTask(t, state.projects));
  const routines = state.routines.filter((r) => occursOn(r, date)).map((r) => fromRoutine(r, date, state.routineDone));
  const marcos = state.marcos
    .filter((m) => m.date === date)
    .map((m) => ({ key: `m:${m.id}`, kind: 'marco', id: m.id, title: m.title, area: m.area, who: 'all', date: m.date }));
  return [...marcos, ...tasks, ...routines].filter((x) => x.kind === 'marco' ? filter.area === 'all' || x.area === filter.area : ok(x)).sort(sortItems);
}

// Atrasados: tarefas vencidas + rotinas semanais/mensais dos últimos 14 dias que ficaram pra trás.
// (Rotina diária não acumula: amanhã ela aparece de novo.)
export function buildOverdue(state, filter, ref = today()) {
  const ok = (x) => (filter.area === 'all' || x.area === filter.area) && (filter.who === 'all' || x.who === filter.who);
  const tasks = state.tasks.filter((t) => !t.done && t.due && t.due < ref).map((t) => fromTask(t, state.projects));
  const routines = [];
  for (let d = 1; d <= 14; d++) {
    const date = addDays(ref, -d);
    for (const r of state.routines) {
      if (r.freq !== 'daily' && occursOn(r, date) && !state.routineDone[`${r.id}:${date}`]) routines.push(fromRoutine(r, date, state.routineDone));
    }
  }
  return [...tasks, ...routines].filter(ok).sort((a, b) => a.date.localeCompare(b.date) || sortItems(a, b));
}

export const noDate = (state, filter) =>
  state.tasks
    .filter((t) => !t.done && !t.due && (filter.area === 'all' || t.area === filter.area) && (filter.who === 'all' || t.who === filter.who))
    .map((t) => fromTask(t, state.projects));

// Sugestões: regras simples que olham para os seus dados e apontam gargalos.
export function suggestions(state, ref = today()) {
  const all = { area: 'all', who: 'all' };
  const out = [];
  const overdue = buildOverdue(state, all, ref);
  const hoje = buildDay(state, ref, all).filter((x) => x.kind !== 'marco' && !x.done);

  const lolisLate = overdue.filter((x) => x.who === 'lolis');
  if (lolisLate.length) out.push({ tone: 'amber', icon: '🙋', text: `${lolisLate.length} ${lolisLate.length > 1 ? 'tarefas da Lolis passaram' : 'tarefa da Lolis passou'} do prazo. Vale cobrar o retorno dela.` });

  const myLate = overdue.filter((x) => x.who === 'laura');
  if (myLate.length >= 3) out.push({ tone: 'red', icon: '⏰', text: `Você tem ${myLate.length} itens atrasados. Resolva, delegue ou adie de propósito: atraso parado vira gargalo.` });

  const mineToday = hoje.filter((x) => x.who === 'laura');
  if (mineToday.length > 10) out.push({ tone: 'amber', icon: '📦', text: `Dia cheio: ${mineToday.length} itens com você hoje. Tem algo que a Lolis pode fazer?` });

  for (const t of state.tasks) {
    if (!t.done && (t.postponed || 0) >= 3) out.push({ tone: 'violet', icon: '🔁', text: `Você já adiou "${t.title}" ${t.postponed} vezes. Quebrar em partes menores, delegar ou apagar?` });
  }

  for (const m of state.marcos) {
    const d = diffDays(m.date, ref);
    if (d >= 0 && d <= 35 && /prazo|anunciar|último/i.test(m.title)) out.push({ tone: d <= 10 ? 'red' : 'sky', icon: '📅', text: d === 0 ? `${m.title}: é hoje!` : `${m.title}: faltam ${d} dias (${fmtCurto(m.date)}).` });
  }

  for (const p of state.projects) {
    const pts = state.tasks.filter((t) => t.projectId === p.id);
    const late = pts.filter((t) => !t.done && t.due < ref).length;
    if (late >= 2) out.push({ tone: 'red', icon: '🚧', text: `O projeto "${p.name}" tem ${late} etapas atrasadas. O prazo final continua o mesmo?` });
  }

  const weekPersonal = state.tasks.some((t) => t.area === 'pessoal' && !t.done && t.due && diffDays(t.due, ref) >= 0 && diffDays(t.due, ref) <= 7);
  if (!weekPersonal) out.push({ tone: 'violet', icon: '💜', text: 'Nada pessoal agendado nesta semana. Contas, saúde, treino, família: tem algo pra colocar aqui?' });

  if (!state.tasks.some((t) => t.area === 'gralha' && !t.done)) out.push({ tone: 'sky', icon: '🐦', text: 'Nenhum pedido da Gralha em aberto. Algum orçamento esperando resposta no WhatsApp?' });

  return out.slice(0, 5);
}

export function projectProgress(state, pid) {
  const ts = state.tasks.filter((t) => t.projectId === pid);
  const done = ts.filter((t) => t.done).length;
  return { total: ts.length, done, pct: ts.length ? Math.round((done / ts.length) * 100) : 0, next: ts.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due))[0] };
}
