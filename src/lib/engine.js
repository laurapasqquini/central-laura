import { marcosDoDia, rotinasDoDia } from '../data/calendarios';
import { gerarCampanhas } from '../data/campanhas';
import { FERIADOS } from '../data/feriados';
import { today, addDays, weekday, fromStr, lastDayOfMonth, diffDays, fmtCurto, relativo } from './dates';

export const AREAS = {
  ranken: { label: 'RANKEN', dot: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-500', text: 'text-emerald-600' },
  gralha: { label: 'Gralha Azul', dot: 'bg-sky-500', soft: 'bg-sky-50 text-sky-700 ring-sky-200', bar: 'bg-sky-500', text: 'text-sky-600' },
  pessoal: { label: 'Pessoal', dot: 'bg-violet-500', soft: 'bg-violet-50 text-violet-700 ring-violet-200', bar: 'bg-violet-500', text: 'text-violet-600' },
};

export const FREQ_LABEL = { daily: 'Todo dia útil', weekly: 'Toda semana', monthly: 'Todo mês' };

// ---- Dias úteis: a Laura não trabalha sábado, domingo, feriados e folgas.
// O que cairia num dia de folga vai para o próximo dia útil (prazos de projeto vão para o anterior).
export function folgaDe(state, date) {
  if ((state.folgas || {})[date]) return state.folgas[date];
  if (FERIADOS[date] && !(state.feriadosIgnorados || []).includes(date)) return FERIADOS[date];
  return null;
}
export const isWorkday = (state, date) => ![0, 6].includes(weekday(date)) && !folgaDe(state, date);
export function proximoDiaUtil(state, date, dir = 1) {
  let d = date;
  while (!isWorkday(state, d)) d = addDays(d, dir);
  return d;
}
// Data efetiva de uma tarefa: prazos de projeto antecipam, o resto vai para o próximo dia útil
export const dataEfetiva = (state, t) => (t.due ? proximoDiaUtil(state, t.due, t.projectId ? -1 : 1) : null);
// Datas "nominais" que caem neste dia útil: ele mesmo + os dias de folga logo antes
function nominaisDe(state, date) {
  if (!isWorkday(state, date)) return [];
  const out = [date];
  for (let d = addDays(date, -1); !isWorkday(state, d); d = addDays(d, -1)) out.push(d);
  return out;
}
// Limite de "N dias úteis à frente" (para avisos que precisam de antecedência)
export function limiteDiasUteis(state, ref, n) {
  let d = ref;
  for (let c = 0; c < n; ) {
    d = addDays(d, 1);
    if (isWorkday(state, d)) c++;
  }
  return d;
}

function caiNoDia(r, date) {
  const wd = weekday(date);
  if (r.freq === 'daily') return true;
  if (r.freq === 'weekly') return wd === r.weekday;
  if (r.freq === 'monthly') return fromStr(date).getDate() === Math.min(r.monthday, lastDayOfMonth(date));
  return false;
}

export function occursOn(state, r, date) {
  if (!r.active) return false;
  if (r.createdAt && date < r.createdAt) return false;
  if (r.hora) return caiNoDia(r, date) && (r.freq !== 'daily' || isWorkday(state, date)); // compromisso: não muda de dia
  if (r.freq === 'daily') return isWorkday(state, date);
  return nominaisDe(state, date).some((d) => caiNoDia(r, d));
}

// Uma lista única de "itens" para as telas: tarefas, rotinas do dia e marcos.
const fromTask = (t, projects, state) => ({
  key: `t:${t.id}`,
  kind: 'task',
  id: t.id,
  title: t.title,
  area: t.area,
  who: t.who,
  urgent: t.urgent,
  date: state ? dataEfetiva(state, t) : t.due,
  movedFrom: state && t.due && dataEfetiva(state, t) !== t.due ? t.due : null,
  done: t.done,
  postponed: t.postponed || 0,
  project: t.projectId ? projects.find((p) => p.id === t.projectId)?.name : null,
  phase: t.phase,
  notes: t.notes,
  hub: !!t.hub,
});

const fromRoutine = (r, date, routineDone) => ({
  key: `r:${r.id}:${date}`,
  kind: 'routine',
  id: r.id,
  title: r.hora ? `${r.hora.replace(':00', 'h').replace(':', 'h')} · ${r.title}` : r.title,
  hora: r.hora || null,
  area: r.area,
  who: r.who,
  urgent: false,
  date,
  done: !!routineDone[`${r.id}:${date}`],
  freq: r.freq,
});

const calRoutines = (state, date) =>
  nominaisDe(state, date).flatMap((d) => rotinasDoDia(d, addDays)).map((r) => ({
    key: `r:${r.id}:${date}`,
    kind: 'routine',
    id: r.id,
    title: r.title,
    area: 'ranken',
    who: r.who || state.melhoresWho || 'laura',
    urgent: false,
    date,
    done: !!state.routineDone[`${r.id}:${date}`],
    freq: 'calendario',
    hub: !!r.hubPath,
    hubPath: r.hubPath,
    mensagem: r.mensagem,
  }));

const sortItems = (a, b) =>
  Number(a.done) - Number(b.done) ||
  Number(b.urgent) - Number(a.urgent) ||
  (a.kind === 'marco' ? -1 : 0) - (b.kind === 'marco' ? -1 : 0) ||
  (a.kind === 'routine' ? 1 : 0) - (b.kind === 'routine' ? 1 : 0) ||
  a.title.localeCompare(b.title);

export function buildDay(state, date, filter) {
  const ok = (x) => (filter.area === 'all' || x.area === filter.area) && (filter.who === 'all' || x.who === filter.who);
  const tasks = state.tasks.filter((t) => t.due && dataEfetiva(state, t) === date).map((t) => fromTask(t, state.projects, state));
  const routines = state.routines.filter((r) => r.tipo !== 'lolis-lista' && occursOn(state, r, date)).map((r) => fromRoutine(r, date, state.routineDone)).concat(calRoutines(state, date));
  // "mandar a lista pra Lolis" já leva a mensagem do dia
  if (filter.who !== 'lolis') {
    const it = itemLolis(state, date);
    if (it) routines.push(it);
  }
  const marcos = state.marcos
    .filter((m) => m.date === date)
    .map((m) => ({ key: `m:${m.id}`, kind: 'marco', id: m.id, title: m.title, area: m.area, who: 'all', date: m.date }))
    .concat(marcosDoDia(date).map((m) => ({ ...m, kind: 'marco', who: 'all' })));
  return [...marcos, ...tasks, ...routines].filter((x) => x.kind === 'marco' ? filter.area === 'all' || x.area === filter.area : ok(x)).sort(sortItems);
}

// Atrasados: tarefas vencidas + rotinas semanais/mensais dos últimos 14 dias que ficaram pra trás.
// (Rotina diária não acumula: amanhã ela aparece de novo.)
export function buildOverdue(state, filter, ref = today()) {
  const ok = (x) => (filter.area === 'all' || x.area === filter.area) && (filter.who === 'all' || x.who === filter.who);
  const tasks = state.tasks.filter((t) => !t.done && t.due && dataEfetiva(state, t) < ref).map((t) => fromTask(t, state.projects, state));
  const routines = [];
  for (let d = 1; d <= 14; d++) {
    const date = addDays(ref, -d);
    for (const r of state.routines) {
      if (r.freq !== 'daily' && occursOn(state, r, date) && !state.routineDone[`${r.id}:${date}`]) routines.push(fromRoutine(r, date, state.routineDone));
    }
    // postagens dos melhores da rodada que ficaram pra trás (últimos 7 dias)
    if (d <= 7) routines.push(...calRoutines(state, date).filter((x) => !x.done));
  }
  return [...tasks, ...routines].filter(ok).sort((a, b) => a.date.localeCompare(b.date) || sortItems(a, b));
}

export const noDate = (state, filter) =>
  state.tasks
    .filter((t) => !t.done && !t.due && (filter.area === 'all' || t.area === filter.area) && (filter.who === 'all' || t.who === filter.who))
    .map((t) => fromTask(t, state.projects, state));

// Campanhas push dos próximos dias que ainda não foram agendadas no backoffice
export function campanhasPendentes(state, ref = today(), dias = 3) {
  const ov = state.campanhas || {};
  const limite = limiteDiasUteis(state, ref, dias);
  return gerarCampanhas(ref).filter((c) => c.data <= limite && !(ov[c.id]?.status && ov[c.id].status !== 'pendente'));
}

// Sugestões: regras simples que olham para os seus dados e apontam gargalos.
export function suggestions(state, ref = today()) {
  const all = { area: 'all', who: 'all' };
  const out = [];
  const overdue = buildOverdue(state, all, ref);
  const hoje = buildDay(state, ref, all).filter((x) => x.kind !== 'marco' && !x.done);

  const camp = campanhasPendentes(state, ref);
  if (camp.length) out.push({ tone: 'red', icon: '📣', text: `${camp.length} ${camp.length === 1 ? 'campanha push dos próximos 3 dias úteis ainda não foi agendada' : 'campanhas push dos próximos 3 dias úteis ainda não foram agendadas'}. Veja em Etapas → Campanhas.` });

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

  // Prazos do calendário das etapas (último dia de encaixes, fim de etapa)
  for (let d = 0; d <= 21; d++) {
    const date = addDays(ref, d);
    for (const m of marcosDoDia(date).filter((x) => /^cal:[ef]:/.test(x.key))) {
      out.push({ tone: d <= 7 ? 'red' : 'sky', icon: '📅', text: d === 0 ? `${m.title}: é hoje!` : `${m.title}: faltam ${d} dias (${fmtCurto(date)}).` });
    }
  }

  // Confraternização: o regulamento exige anunciar 30 dias antes, com os valores
  if (!state.projects.some((p) => p.templateId === 'confra')) {
    out.push({ tone: 'amber', icon: '🎉', text: 'A confraternização ainda não tem data. As etapas terminam em 13/12 e 20/12, e o anúncio precisa sair 30 dias antes da festa. Crie o projeto em Projetos → Confraternização.' });
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

// Horários padrão das notificações (a Laura muda em Rotinas → Notificações)
export const HORARIOS_PADRAO = { manha: '09:00', tarde: '13:30', noite: '18:00' };

// Textos das notificações dos próximos 14 dias + os horários escolhidos.
// O Supabase olha o relógio a cada 15 min e envia cada aviso no horário da Laura.
// manha: resumo do dia · tarde: só se houver urgente/atrasado · noite: o que falta + amanhã
export function buildAgenda(state, ref = today()) {
  const all = { area: 'all', who: 'all' };
  const cfg = { manha: true, tarde: true, noite: true, ...(state.notif || {}) };
  const horarios = { ...HORARIOS_PADRAO, ...(cfg.horarios || {}) };
  const corta = (s, n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const lista = (xs, n = 3) => xs.slice(0, n).map((x) => `• ${corta(x.title)}`).join('\n');
  const agenda = { horarios };

  for (let i = 0; i < 14; i++) {
    const date = addDays(ref, i);
    if (!isWorkday(state, date)) continue; // sábado, domingo, feriado e folga: sem notificação
    const fimDeSemana = false;
    const dia = buildDay(state, date, all);
    const proxUtil = proximoDiaUtil(state, addDays(date, 1));
    // 📌 dos dias de folga até o próximo dia útil (ex.: sorteio de domingo aparece na sexta)
    const marcosFolga = [];
    for (let d = addDays(date, 1); d < proxUtil; d = addDays(d, 1)) {
      for (const m of buildDay(state, d, all).filter((x) => x.kind === 'marco')) marcosFolga.push({ ...m, title: `${fmtCurto(d).slice(0, 3)}: ${m.title}` });
    }
    const marcos = [...dia.filter((x) => x.kind === 'marco'), ...marcosFolga];
    const minhas = dia.filter((x) => x.kind !== 'marco' && x.who === 'laura' && !x.done);
    const atrasadas = buildOverdue(state, all, date).filter((x) => x.who === 'laura');
    const urgentes = minhas.filter((x) => x.urgent);
    const slots = {};

    if (cfg.manha && (minhas.length || atrasadas.length || marcos.length)) {
      const partes = minhas.length ? [`${minhas.length} ${minhas.length === 1 ? 'tarefa' : 'tarefas'} hoje`] : [];
      if (urgentes.length) partes.push(`${urgentes.length} ${urgentes.length === 1 ? 'urgente' : 'urgentes'}`);
      if (atrasadas.length) partes.push(`${atrasadas.length} ${atrasadas.length === 1 ? 'atrasada' : 'atrasadas'}`);
      const destaque = [...atrasadas, ...urgentes, ...minhas.filter((x) => x.kind === 'task')];
      slots.manha = {
        title: ['☀️ Bom dia, Laura', ...partes].join(' · '),
        body: [
          ...marcos.map((m) => `📌 ${corta(m.title, 70)}`),
          (() => {
            const n = campanhasPendentes(state, date).length;
            return n ? `📣 ${n} ${n === 1 ? 'campanha' : 'campanhas'} para agendar` : '';
          })(),
          lista([...new Map(destaque.map((x) => [x.key, x])).values()]),
        ]
          .filter(Boolean)
          .join('\n'),
      };
    }

    const pendentesFortes = [...atrasadas, ...urgentes];
    if (cfg.tarde && !fimDeSemana && pendentesFortes.length) {
      slots.tarde = { title: `⏰ Ainda pendente: ${pendentesFortes.length} ${pendentesFortes.length === 1 ? 'item' : 'itens'}`, body: lista(pendentesFortes) };
    }

    if (cfg.noite && !fimDeSemana && minhas.length) {
      const amanha = buildDay(state, proxUtil, all).filter((x) => x.kind === 'task' && x.who === 'laura');
      const quando = proxUtil === addDays(date, 1) ? 'Amanhã' : `Próximo dia útil (${fmtCurto(proxUtil)})`;
      slots.noite = {
        title: `🌙 Antes de encerrar: ${minhas.length} de hoje sem marcar`,
        body: [lista(minhas), amanha.length ? `${quando}: ${amanha.length} ${amanha.length === 1 ? 'tarefa' : 'tarefas'}` : ''].filter(Boolean).join('\n'),
      };
    }

    if (Object.keys(slots).length) agenda[date] = slots;
  }
  return agenda;
}

// Texto do dia para mandar no WhatsApp da Lolis (ela não acessa a central)
export function mensagemLolis(state, ref = today()) {
  const f = { area: 'all', who: 'lolis' };
  const late = buildOverdue(state, f, ref);
  const hoje = buildDay(state, ref, f).filter((x) => x.kind !== 'marco' && !x.done);
  const semData = noDate(state, f);
  const semana = Array.from({ length: 6 }, (_, i) => addDays(ref, i + 1)).flatMap((d) => buildDay(state, d, f).filter((x) => x.kind === 'task'));
  // sugestões: rotinas semanais/mensais dela dos próximos 3 dias úteis, que dá pra adiantar
  const adiantar = [];
  for (let d = ref, n = 0; n < 3; ) {
    d = addDays(d, 1);
    if (!isWorkday(state, d)) continue;
    n++;
    for (const x of buildDay(state, d, f)) if (x.kind === 'routine' && x.freq !== 'daily' && !x.done && !adiantar.includes(x.title)) adiantar.push(x.title);
  }
  return [
    `Oi Lolis! Lista de hoje (${fmtCurto(ref)}):`,
    late.length ? '\n*Atrasadas (prioridade):*' : '',
    ...late.map((x) => `⚠️ ${x.title} (era ${relativo(x.date, ref)})`),
    '\n*Hoje:*',
    ...(hoje.length ? hoje.map((x) => `• ${x.title}`) : ['• Nada fixo hoje']),
    semana.length ? '\n*Próximos dias:*' : '',
    ...semana.map((x) => `• ${fmtCurto(x.date)}: ${x.title}`),
    semData.length ? '\n*Em andamento:*' : '',
    ...semData.map((x) => `• ${x.title}`),
    adiantar.length ? '\n*Se sobrar tempo, já pode adiantar:*' : '',
    ...adiantar.map((t) => `• ${t}`),
    '\nO que for financeiro ou que você não conseguir resolver, me manda 💚',
  ].filter(Boolean).join('\n');
}

// ── Mensagens para a Lolis (ela não acessa a central) ──
// Segunda (ou 1º dia útil da semana): a semana inteira. Outros dias: só o que foge da rotina.
// Se aparecer pedido novo depois de mandar, a tarefa volta só com o que é novo.
const FIM_LOLIS = 'Me manda no fim do dia o que você fez 💚';
const ddmm = (s) => s.slice(8, 10) + '/' + s.slice(5, 7);
const DIA_NOME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function primeiroDiaUtilDaSemana(state, date) {
  const seg = addDays(date, -((weekday(date) + 6) % 7));
  for (let d = seg; d <= addDays(seg, 4); d = addDays(d, 1)) if (isWorkday(state, d)) return d;
  return null;
}

const listaAtrasadas = (late, ref) => (late.length ? ['\n*Atrasadas (prioridade):*', ...late.map((x) => `⚠️ ${x.title} (era ${relativo(x.date, ref)})`)] : []);

function mensagemSemanaLolis(state, date, late) {
  const f = { area: 'all', who: 'lolis' };
  const sexta = addDays(date, 5 - weekday(date));
  const diarias = state.routines.filter((r) => r.active !== false && r.who === 'lolis' && r.freq === 'daily' && !r.hora).map((r) => r.title);
  const dias = [];
  for (let d = date; d <= sexta; d = addDays(d, 1)) {
    if (!isWorkday(state, d)) continue;
    const itens = buildDay(state, d, f).filter((x) => x.kind !== 'marco' && !x.done && x.freq !== 'daily');
    if (itens.length) dias.push(`*${DIA_NOME[weekday(d)]}:* ${itens.map((x) => x.title).join(' · ')}`);
  }
  const andamento = noDate(state, f);
  return [
    `Oi Lolis! Sua semana (${ddmm(date)} a ${ddmm(sexta)}):`,
    ...listaAtrasadas(late, date),
    diarias.length ? '\n*Todo dia:*' : '',
    ...diarias.map((t) => `• ${t}`),
    ...dias.map((x, i) => (i ? x : '\n' + x)),
    andamento.length ? '\n*Em andamento:* ' + andamento.map((x) => x.title).join(' · ') : '',
    '\n' + FIM_LOLIS,
  ].filter((x, i) => x !== '' || i === 0).join('\n');
}

function mensagemDiaLolis(date, late, hoje) {
  return [
    `Oi Lolis! Hoje (${fmtCurto(date)}), além da rotina de sempre:`,
    ...listaAtrasadas(late, date),
    ...(hoje.length ? ['\n*Hoje:*', ...hoje.map((x) => `• ${x.title}`)] : []),
    '\n' + FIM_LOLIS,
  ].join('\n');
}

const mensagemNovosLolis = (novos) =>
  [`Lolis, ${novos.length === 1 ? 'mais uma coisa' : 'mais algumas coisas'} pra hoje:`, ...novos.map((x) => `• ${x.title}`), '\nValeu 💚'].join('\n');

export function itemLolis(state, date) {
  if (!isWorkday(state, date)) return null;
  const f = { area: 'all', who: 'lolis' };
  const semana = primeiroDiaUtilDaSemana(state, date) === date;
  const late = buildOverdue(state, f, date).filter((x) => x.kind === 'task'); // rotina dela se repete: só pedido avulso acumula
  const hoje = buildDay(state, date, f).filter((x) => x.kind !== 'marco' && !x.done && x.freq !== 'daily');
  const pontuais = [...late, ...hoje];
  const keys = pontuais.map((x) => x.key);
  const env = state.routineDone['lolis-dia:' + date];
  if (!env && !semana && !pontuais.length) return null; // nada além da rotina: nem aparece
  const enviados = Array.isArray(env) ? env : env ? keys : [];
  const novos = env ? pontuais.filter((x) => !enviados.includes(x.key)) : [];
  const done = !!env && !novos.length;
  const base = semana ? 'Mandar a semana pra Lolis' : 'Mandar pra Lolis o que tem hoje';
  return {
    key: 'r:lolis-dia:' + date,
    kind: 'routine',
    id: 'lolis-dia',
    title: novos.length ? `Mandar pra Lolis: ${novos.length} ${novos.length === 1 ? 'pedido novo' : 'pedidos novos'}` : base,
    area: 'ranken',
    who: 'laura',
    urgent: false,
    date,
    done,
    freq: 'calendario',
    mensagem: done ? undefined : novos.length ? mensagemNovosLolis(novos) : semana ? mensagemSemanaLolis(state, date, late) : mensagemDiaLolis(date, late, hoje),
    doneValue: done ? null : [...new Set([...enviados, ...keys])],
  };
}
