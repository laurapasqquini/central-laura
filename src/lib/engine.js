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
  project: t.projectId ? projects.find((p) => p.id === t.projectId)?.name : t.iniciativaId ? `🎯 ${state?.plano?.iniciativas?.find((i) => i.id === t.iniciativaId)?.titulo || 'Plano'}` : null,
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
  routines.push(...contasDoDia(state, date));
  for (const x of routines) if (/^Planejar a próxima semana/.test(x.title)) x.acao = 'revisao';
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
      if (r.who === 'lolis' || r.tipo === 'lolis-lista') continue; // rotina da Lolis se repete: não vira atraso
      if (r.freq !== 'daily' && occursOn(state, r, date) && !state.routineDone[`${r.id}:${date}`]) routines.push(fromRoutine(r, date, state.routineDone));
    }
    // postagens dos melhores da rodada que ficaram pra trás (últimos 7 dias)
    if (d <= 7) routines.push(...calRoutines(state, date).filter((x) => !x.done));
    routines.push(...contasDoDia(state, date).filter((x) => !x.done).map((x) => ({ ...x, urgent: true })));
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
  const temConfra = state.projects.some((p) => p.templateId === 'confra') || [...state.tasks, ...state.marcos].some((t) => /confra.*(festa|dia da)|dia da confra/i.test(t.title) && (t.due || t.date));
  if (!temConfra) {
    out.push({ tone: 'amber', icon: '🎉', text: 'A confraternização ainda não tem data. As etapas terminam em 13/12 e 20/12, e o anúncio precisa sair 30 dias antes da festa. Quando decidir, anote "Dia da confra" com a data.' });
  }

  for (let d = 1; d <= 3; d++) {
    const date = addDays(ref, d);
    for (const c of contasDoDia(state, date).filter((x) => !x.done)) out.push({ tone: 'violet', icon: '💸', text: `${c.title.replace('💸 Pagar ', '')} vence ${relativo(date, ref)} (${fmtCurto(date)}).` });
  }

  for (const p of pedidosParados(state, ref)) out.push({ tone: 'sky', icon: '🐦', text: `${p.cliente}: parado há ${p.dias} dias em "${p.etapa}". Cobrar ou marcar como perdido?` });

  for (const p of state.projects) {
    const pts = state.tasks.filter((t) => t.projectId === p.id);
    const late = pts.filter((t) => !t.done && t.due < ref).length;
    if (late >= 2) out.push({ tone: 'red', icon: '🚧', text: `O projeto "${p.name}" tem ${late} etapas atrasadas. O prazo final continua o mesmo?` });
  }

  const weekPersonal = state.tasks.some((t) => t.area === 'pessoal' && !t.done && t.due && diffDays(t.due, ref) >= 0 && diffDays(t.due, ref) <= 7) || Array.from({ length: 8 }, (_, i) => addDays(ref, i)).some((d) => contasDoDia(state, d).length);
  if (!weekPersonal) out.push({ tone: 'violet', icon: '💜', text: 'Nada pessoal agendado nesta semana. Contas, saúde, treino, família: tem algo pra colocar aqui?' });

  if (!state.tasks.some((t) => t.area === 'gralha' && !t.done)) out.push({ tone: 'sky', icon: '🐦', text: 'Nenhum pedido da Gralha em aberto. Algum orçamento esperando resposta no WhatsApp?' });

  return out.slice(0, 6);
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
          (() => {
            const n = dia.filter((x) => x.mensagem && !x.done).length;
            return n ? `💬 ${n} ${n === 1 ? 'mensagem pronta' : 'mensagens prontas'} para copiar` : '';
          })(),
          lista([...new Map(destaque.map((x) => [x.key, x])).values()]),
        ]
          .filter(Boolean)
          .join('\n'),
      };
    }

    const pendentesFortes = [...atrasadas, ...urgentes];
    // tarde (13h30): a Lolis está chegando: lembrete da lista dela + o que segue pendente
    const lolis = dia.find((x) => x.id === 'lolis-dia' && !x.done);
    if (cfg.tarde && !fimDeSemana && (lolis || pendentesFortes.length)) {
      slots.tarde = lolis
        ? {
            title: '🙋 A Lolis está chegando: mande a lista dela',
            body: ['A mensagem já está pronta na central (💬 Mensagem → Copiar).', pendentesFortes.length ? `⏰ Ainda pendente com você: ${pendentesFortes.length}` : ''].filter(Boolean).join('\n'),
          }
        : { title: `⏰ Ainda pendente: ${pendentesFortes.length} ${pendentesFortes.length === 1 ? 'item' : 'itens'}`, body: lista(pendentesFortes) };
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
    ...sorteioNaMensagem(state, date),
    '\n' + FIM_LOLIS,
  ].filter((x, i) => x !== '' || i === 0).join('\n');
}

// ── Brindes do sorteio diário: prazo de 7 dias para solicitar ──
// 3º dia depois do sorteio: lembrar o prazo · dia útil seguinte: perguntar se deu certo.
const PRAZO_BRINDE = 7;
const diaNome = (d) => DIA_NOME[weekday(d)].toLowerCase();
const capitaliza = (s) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s);
// Patrocinadores do sorteio em que a pessoa ganhou (Programação do Hub, pelo dia da semana, cidade e esporte)
function programacaoDoGanhador(state, g) {
  const local = semAcento(g.local || '');
  const p = Object.values(state.programacao || {}).find((x) => local.includes(semAcento(x.cidade)) && local.includes(semAcento(x.esporte).split(' ')[0]));
  const pats = p?.dias?.[DIA_NOME[weekday(g.data)]]?.patrocinadores;
  // só confia se o patrocinador que aparece no Hub está no dia
  return pats?.length && pats.some((x) => semAcento(x.nome) === semAcento(g.patrocinador || '')) ? pats : null;
}

export function brindesDoDia(state, date) {
  const out = [];
  for (const [id, g] of Object.entries(state.ganhadores || {})) {
    const acao = proximoDiaUtil(state, g.data);
    const lembrete = proximoDiaUtil(state, addDays(g.data, 3));
    const conferir = proximoDiaUtil(state, addDays(lembrete, 1));
    if (date !== lembrete && date !== conferir && date !== acao) continue;
    const prazo = addDays(g.data, PRAZO_BRINDE);
    const nome = capitaliza((g.nome || '').trim().split(/\s+/)[0]);
    // a lista de ganhadores do Hub só mostra o 1º prêmio ("+1" esconde o resto):
    // o prêmio completo vem da Programação daquele dia, na cidade e esporte do ganhador
    const doDia = programacaoDoGanhador(state, g);
    const varios = (doDia?.length || 0) > 1 || !!g.extra;
    const premio = doDia
      ? doDia.map((x) => premioComNome(x)).join(' + ')
      : [g.premio, g.patrocinador && `(${g.patrocinador})`, g.extra ? '+ outro prêmio (confira no Hub)' : ''].filter(Boolean).join(' ');
    const linha = [g.nome, g.local, premio].filter(Boolean).join(' · ');
    // no dia do sorteio: o que cada patrocinador precisa (avisar o dono, voucher no Canva...)
    if (date === acao) {
      const regra = regraPatrocinador(g.patrocinador);
      const extra = g.extra ? 'Tem mais um prêmio (+1): confira no Hub de qual patrocinador é e se ele tem alguma regra.' : '';
      if (regra || extra) out.push({ key: `g:${id}:a`, tipo: 'acao', title: `Brinde: ${g.patrocinador} · ${g.nome}`, linha, texto: [regra, extra].filter(Boolean).join(' ') });
    }
    if (date === lembrete)
      out.push({
        key: `g:${id}:l`,
        tipo: 'lembrete',
        sorteio: g.data,
        prazo,
        telefone: g.telefone || '',
        title: `Lembrete de brinde: ${g.nome}`,
        linha,
        texto: `Oi, ${nome}! Tudo bem? 😊 Passando pra lembrar que ${varios ? 'os brindes' : 'o brinde'} que você ganhou no sorteio diário da RANKEN de ${diaNome(g.data)} (${ddmm(g.data)}), ${premio}, ${varios ? 'podem ser solicitados' : 'pode ser solicitado'} até ${diaNome(prazo)}, ${ddmm(prazo)}. Não deixa passar! 🎁`,
      });
    else if (date === conferir)
      out.push({
        key: `g:${id}:c`,
        tipo: 'conferir',
        sorteio: g.data,
        prazo,
        telefone: g.telefone || '',
        title: `Conferir brinde: ${g.nome}`,
        linha,
        texto: `Oi, ${nome}! E aí, conseguiu retirar ${varios ? 'os seus brindes' : 'o seu brinde'} do sorteio diário (${premio})? Deu tudo certo? 😊`,
      });
  }
  return out.sort((a, b) => a.linha.localeCompare(b.linha));
}

// ── Posts do sorteio diário (anúncio e parabéns), no formato que a RANKEN já usa ──
// Vêm da Programação do Hub (marca do dia + patrocinadores) e do ganhador do dia, se já estiver lá.
const semAcento = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tituloBonito = (s = '') =>
  s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && ['da', 'de', 'do', 'das', 'dos', 'e'].includes(w) ? w : w.length <= 3 && !/[aeiouáéíóú]/.test(w) ? w.toUpperCase() : w[0]?.toUpperCase() + w.slice(1)))
    .join(' ');
const juntar = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs.at(-1)}`);

// 150,00 → R$ 150,00
const comReais = (s = '') => s.trim().replace(/(^|\s)(?<!R\$\s)(\d+,\d{2})\b/g, '$1R$ $2');
// Prêmio com o nome do patrocinador (sem repetir quando o prêmio já traz o nome)
const premioComNome = (x) => {
  const nome = tituloBonito(x.nome);
  const p = comReais(x.premio);
  return semAcento(p).includes(semAcento(x.nome).split(' ')[0]) ? p : `${p} ${nome}`;
};
const EMOJIS = [
  [/agua|hidrat/, '💦'],
  [/chopp|cerveja/, '🍺'],
  [/cafe/, '☕🥐'],
  [/hamburg|burg/, '🍔'],
  [/pizza/, '🍕'],
  [/granola|natura/, '🥣'],
  [/joia|peca|look/, '💎✨'],
  [/fisio|sessao|massag|psico|saude/, '💆'],
  [/sache|vamo|energ/, '⚡'],
  [/almoco|prato|parmegian|jantar|consuma|grill/, '🍽️'],
];
const emojiPremio = (s) => EMOJIS.find(([re]) => re.test(semAcento(s)))?.[1] || '🎁';

// Frase do parabéns: a que a Laura definiu para o dia, ou uma montada pelo tipo de prêmio
export const chaveFrase = (p, dia) => `${p.cidade}|${p.esporte}|${dia}`;
export function fraseAutomatica(pats) {
  const t = semAcento(pats.map((x) => `${x.premio} ${x.nome}`).join(' '));
  if (/joia|peca|look/.test(t)) return 'Um mimo especial pra quem está com os jogos em dia ✨';
  if (/fisio|sessao|massag|psico|saude/.test(t)) return 'Cuidar do corpo também faz parte do jogo: recuperação em dia pra voltar ainda mais forte 💪';
  if (/almoco|prato|parmegian|hamburg|pizza|cafe|consuma|grill|granola/.test(t)) return 'Depois de dar tudo na quadra, nada melhor que repor as energias com um prêmio desses 🍽️🔥';
  if (/agua|chopp|sache|bebida/.test(t)) return 'Depois de gastar energia na partida, uma hidratação caprichada cai muito bem 💦';
  return 'Um prêmio especial pra quem está com os jogos em dia 🎁';
}
const fraseSorteio = (state, p, dia) => (state.frasesSorteio || {})[chaveFrase(p, dia)] || fraseAutomatica(p.dias[dia].patrocinadores);

export function postsSorteio(state, date) {
  const dia = DIA_NOME[weekday(date)];
  const out = [];
  for (const p of Object.values(state.programacao || {})) {
    const d = p.dias?.[dia];
    if (!d || !d.patrocinadores?.length) continue;
    const pats = d.patrocinadores;
    const nomes = pats.map((x) => x.nome);
    const premios = pats.map((x) => `${comReais(x.premio)} (${tituloBonito(x.nome)})`).join(' + ');
    const casa = pats.some((x) => /casa|contato|endere/i.test(x.local));
    const ganhador = Object.values(state.ganhadores || {}).find(
      (g) => g.data === date && semAcento(g.local).includes(semAcento(p.cidade)) && semAcento(g.local).includes(semAcento(p.esporte).split(' ')[0]),
    );
    const anuncio = [
      `🎁 *${d.titulo || `${dia.toUpperCase()} RANKEN`}*`,
      `🏆 1 sorteado ganha: ${premios} 🔥`,
      casa ? '📩 Informações sobre entrega e retirada no privado' : '📩 Retirada/consumo em até 7 dias',
      `🤝 ${pats.length > 1 ? 'Patrocinadores' : 'Patrocinador'}: ${nomes.map((n) => `*${n}*`).join(' & ')}`,
      '',
      '_*sorteio destinado pra atletas ranken que estão com jogos em dia_',
    ].join('\n');
    const delas = /delas/i.test(d.titulo || '');
    const premioLinha = pats.map((x) => `*${premioComNome(x)}* ${emojiPremio(x.premio + ' ' + x.nome)}`).join(' + ');
    const parabens = [
      `🎾🔥 *${pats.length > 1 ? 'APOIADORES' : 'APOIADOR'} RANKEN → ${juntar(nomes)}* 🔥🎾`,
      '',
      `Parabéns ${delas ? 'à ganhadora' : 'ao(à) ganhador(a)'} da ${tituloBonito(d.titulo || dia)}! 👏🎉`,
      '👉 @[marque o ganhador]', // a marcação só vale escolhendo a pessoa no grupo (pelo @)
      '',
      fraseSorteio(state, p, dia),
      '',
      pats.length > 1 ? `Hoje o prêmio veio completo: ${premioLinha}` : `O prêmio de hoje: ${premioLinha}`,
      ...(pats.some((x) => x.insta) ? ['', '*Sigam:*', ...pats.filter((x) => x.insta).map((x) => `👉 https://www.instagram.com/${x.insta}/`)] : []),
      '',
      `🤝 Obrigado ${pats.length > 1 ? 'aos' : 'ao'} *${juntar(nomes.map(tituloBonito))}* por ${pats.length > 1 ? 'fortalecerem' : 'fortalecer'} o Ranken e nossos atletas! 💚🎾`,
    ].join('\n');
    out.push({
      grupo: `${p.esporte} ${p.cidade}`,
      anuncio,
      parabens,
      ganhador: ganhador?.nome || null,
      telefoneGanhador: ganhador?.telefone || '',
      // para as mensagens no privado (ganhador e apoiador), montadas na página da Lolis com o nome do ganhador
      titulo: tituloBonito(d.titulo || dia),
      prazo: addDays(date, PRAZO_BRINDE),
      patrocinadores: pats.map((x) => ({
        nome: tituloBonito(x.nome),
        premio: premioComNome(x),
        local: regraDe(x.nome).local || x.local || '',
        contatoAtleta: !!regraDe(x.nome).contatoAtleta,
        instrucao: regraDe(x.nome).instrucao || '',
        pedeVoucher: !!regraDe(x.nome).pedeVoucher,
        apelido: regraDe(x.nome).apelido || '',
        contato: x.contato || '',
        telefone: x.telefone || '',
        regra: regraPatrocinador(x.nome),
        avisar: avisarPatrocinador(x.nome),
        canva: canvaPara(state, x.nome),
      })),
    });
  }
  return out;
}

// Na mensagem de WhatsApp: se a Lolis tem a página, vai só o link (os textos ficam na aba Sorteio diário dela)
function sorteioNaMensagem(state, date) {
  const tem = postsSorteio(state, date).length || brindesDoDia(state, date).length;
  if (!tem) return [];
  if (state.lolisToken && typeof location !== 'undefined')
    return [`\n🎾 *Sorteio diário* (posts e brindes): aba Sorteio diário da sua página 👉 ${location.origin}${import.meta.env.BASE_URL}#lolis=${state.lolisToken}`];
  return [...blocoPosts(state, date), ...blocoBrindes(brindesDoDia(state, date))];
}

function blocoPosts(state, date) {
  const posts = postsSorteio(state, date);
  if (!posts.length) return [];
  return [
    '\n*📣 Sorteio diário de hoje* (anúncio antes do sorteio, parabéns depois)',
    ...posts.flatMap((p) => [`\n— *${p.grupo}* · anúncio:`, p.anuncio, `\n— *${p.grupo}* · parabéns (no grupo, troque [marque o ganhador] digitando @ e escolhendo a pessoa${p.ganhador ? `: ${p.ganhador}` : ''}):`, p.parabens]),
  ];
}

// O que fazer com cada patrocinador quando sai o ganhador (combinado pela Laura)
// Regras de cada patrocinador (combinadas com a Laura em 08/10):
// regra = o que a Lolis faz · avisar = a Lolis manda mensagem ao patrocinador · contatoAtleta = o ganhador recebe o contato dele
// local = onde retirar (sobrepõe o texto do Hub) · laura = quem avisa é a Laura (Primor: o Leo gera o voucher)
const REGRAS_PATROCINADOR = [
  { re: /primor/i, regra: 'Mandar para o Leo o nome do ganhador: ele gera o voucher.', avisar: true, pedeVoucher: true, apelido: 'Leo', local: 'o voucher chega por aqui em breve' },
  { re: /bonna/i, regra: 'Encaminhar no privado do dono da Bonna Pizza quem ganhou.', avisar: true, contatoAtleta: true, instrucao: 'para combinar a retirada da sua pizza' },
  { re: /olaia/i, regra: 'Avisar a Olaia Grill no privado quem ganhou.', avisar: true, contatoAtleta: true, instrucao: 'para fazer o pedido da sua marmita' },
  { re: /burgo|jacar[eé]/i, regra: 'Fazer o voucher e mandar no privado do ganhador.' },
  { re: /vamo|cristal|enara/i, local: 'Retirada no QG da RANKEN' },
];
const regraDe = (p = '') => REGRAS_PATROCINADOR.find((r) => r.re.test(p)) || {};
const avisarPatrocinador = (p) => !!regraDe(p).avisar;
const regraPatrocinador = (p) => regraDe(p).regra || '';

function blocoBrindes(itens) {
  const acoes = itens.filter((x) => x.tipo === 'acao');
  const lembrar = itens.filter((x) => x.tipo === 'lembrete');
  const conferir = itens.filter((x) => x.tipo === 'conferir');
  if (!itens.length) return [];
  const secao = (titulo, xs) => (xs.length ? ['\n' + titulo, ...xs.flatMap((x, i) => [`${i + 1}) _${x.linha}_`, x.texto])] : []);
  return [
    '\n*Brindes do sorteio diário* (no privado; o telefone está no Hub › Sorteio Diário › Ganhadores do dia, clicando no nome)',
    ...secao('*🤝 Patrocinador (ganhadores de hoje):*', acoes),
    ...secao('*🎁 Lembrar o prazo de 7 dias:*', lembrar),
    ...secao('*✅ Perguntar se deu certo:*', conferir),
  ];
}

// Lista completa do dia (a Lolis entra 13h30): pedidos avulsos primeiro, depois as rotinas
function mensagemDiaLolis(state, date, late) {
  const f = { area: 'all', who: 'lolis' };
  const ordem = (x) => (x.kind === 'task' ? 0 : x.freq === 'daily' ? 2 : 1);
  const hoje = buildDay(state, date, f).filter((x) => x.kind !== 'marco' && !x.done).sort((a, b) => ordem(a) - ordem(b));
  const andamento = noDate(state, f);
  return [
    `Oi Lolis! Sua lista de hoje (${fmtCurto(date)}):`,
    ...listaAtrasadas(late, date),
    ...(hoje.length ? ['\n*Hoje:*', ...hoje.map((x) => `• ${x.title}`)] : []),
    ...(andamento.length ? ['\n*Em andamento:*', ...andamento.map((x) => `• ${x.title}`)] : []),
    ...sorteioNaMensagem(state, date),
    '\n' + FIM_LOLIS,
  ].join('\n');
}

const mensagemNovosLolis = (novos) => {
  const comuns = novos.filter((x) => !x.tipo);
  return [
    `Lolis, ${novos.length === 1 ? 'mais uma coisa' : 'mais algumas coisas'} pra hoje:`,
    ...comuns.map((x) => `• ${x.title}`),
    ...blocoBrindes(novos.filter((x) => x.tipo)),
    '\nValeu 💚',
  ].join('\n');
};

export function itemLolis(state, date) {
  if (!isWorkday(state, date)) return null;
  const f = { area: 'all', who: 'lolis' };
  const semana = primeiroDiaUtilDaSemana(state, date) === date;
  const late = buildOverdue(state, f, date).filter((x) => x.kind === 'task'); // rotina dela se repete: só pedido avulso acumula
  const hoje = buildDay(state, date, f).filter((x) => x.kind !== 'marco' && !x.done && x.freq !== 'daily');
  const pontuais = [...late, ...hoje, ...brindesDoDia(state, date)];
  const keys = pontuais.map((x) => x.key);
  const env = state.routineDone['lolis-dia:' + date];
  if (!env && !pontuais.length && !buildDay(state, date, f).some((x) => x.kind !== 'marco')) return null; // nada pra ela hoje
  const enviados = Array.isArray(env) ? env : env ? keys : [];
  const novos = env ? pontuais.filter((x) => !enviados.includes(x.key)) : [];
  const done = !!env && !novos.length;
  // os ganhadores chegam quando o Hub é aberto no Chrome da Laura (a extensão atualiza uma vez por dia)
  const dica = state.ganhadoresEm === date ? '' : ' (abra o Hub antes, para atualizar os brindes)';
  const base = (semana ? '13h30 · Mandar a semana pra Lolis' : '13h30 · Mandar a lista do dia pra Lolis') + dica;
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
    mensagem: done ? undefined : novos.length ? mensagemNovosLolis(novos) : semana ? mensagemSemanaLolis(state, date, late) : mensagemDiaLolis(state, date, late),
    doneValue: done ? null : [...new Set([...enviados, ...keys])],
  };
}

// ── Contas fixas pessoais: aparecem no dia do vencimento (fim de semana/feriado: no dia útil anterior) ──
const brlConta = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function vencimentoConta(state, c, mes) {
  const [y, m] = mes.split('-').map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  const nominal = `${mes}-${String(Math.min(c.dia, ultimo)).padStart(2, '0')}`;
  return proximoDiaUtil(state, nominal, -1);
}
export function contasDoDia(state, date) {
  const out = [];
  const [y, m] = date.split('-').map(Number);
  const meses = [date.slice(0, 7), `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`];
  for (const c of state.contas || []) {
    if (c.ativo === false) continue;
    for (const mes of meses) {
      if (vencimentoConta(state, c, mes) !== date) continue;
      out.push({
        key: `r:conta:${c.id}:${date}`,
        kind: 'routine',
        id: `conta:${c.id}`,
        title: `💸 Pagar ${c.nome}${c.valor ? ` · ${brlConta(c.valor)}` : ''}`,
        area: 'pessoal',
        who: 'laura',
        urgent: false,
        date,
        done: !!state.routineDone[`conta:${c.id}:${date}`],
        freq: 'calendario',
      });
    }
  }
  return out;
}

// ── Gralha: pedidos sem andar há muitos dias ──
const PARADO = { enviado: ['Orçamento enviado', 5], arte: ['Arte com o marketing', 4], aprovacao: ['Arte em aprovação', 4], fechado: ['Fechado (falta contrato)', 2] };
export function pedidosParados(state, ref = today()) {
  return (state.pedidos || [])
    .filter((p) => PARADO[p.stage])
    .map((p) => {
      const desde = (p.history || []).at(-1)?.date || p.createdAt;
      return { id: p.id, cliente: p.cliente, etapa: PARADO[p.stage][0], dias: diffDays(ref, desde), limite: PARADO[p.stage][1] };
    })
    .filter((p) => p.dias >= p.limite)
    .sort((a, b) => b.dias - a.dias);
}

// ── Baixa pelo relatório da Lolis: quais itens dela parecem citados no texto ──
const PARADAS = new Set('para pela pelo com sem dos das nos nas uma uns umas que como mais todo toda novo novos nova novas hoje até sobre quem tem fazer feito diario diaria semana'.split(' '));
const normal = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ');
const palavras = (s) => normal(s).split(/\s+/).filter((w) => (w.length >= 4 || /\d/.test(w)) && !PARADAS.has(w));
export function sugerirBaixas(state, date, texto) {
  const rel = new Set(palavras(texto).map((w) => w.slice(0, 5)));
  if (!rel.size) return [];
  const f = { area: 'all', who: 'lolis' };
  const itens = [...buildDay(state, date, f), ...buildOverdue(state, f, date).filter((x) => x.kind === 'task')].filter((x) => x.kind !== 'marco' && !x.done);
  const out = [];
  for (const x of itens) {
    const ws = [...new Set(palavras(x.title).map((w) => w.slice(0, 5)))];
    if (!ws.length) continue;
    const acertos = ws.filter((w) => rel.has(w)).length;
    if (acertos >= Math.max(1, Math.ceil(ws.length * 0.34)) && (acertos >= 2 || ws.length <= 2)) out.push({ ...x, score: acertos / ws.length });
  }
  return [...new Map(out.map((x) => [x.key, x])).values()].sort((a, b) => b.score - a.score);
}

// ── Página da Lolis (link sem login): o dia dela de hoje e do próximo dia útil ──
// Modelos do Canva que a Lolis usa (a Laura cola os links em Lolis › Modelos do Canva)
export const MODELOS_CANVA = [
  { id: '6x0', nome: 'Arte dos 6x0', re: /6\s*[x×]\s*0/i },
  { id: 'burgo', nome: 'Voucher Burgo', re: /burgo/i },
  { id: 'jacare', nome: 'Voucher Jacaré Vermelho', re: /jacar[eé]/i },
];
const canvaPara = (state, texto) => {
  const m = MODELOS_CANVA.find((x) => x.re.test(texto) && (state.canva || {})[x.id]);
  return m ? { nome: m.nome, url: state.canva[m.id] } : null;
};

// texto da tarefa para a Lolis (sem a linha de origem que a central acrescenta)
const detalheTarefa = (x) => (x.kind === 'task' && x.notes ? x.notes.replace(/\n*Veio do Hub \(Atividades › Minha equipe › Lolis\)$/, '').trim() : '');

export function dadosPaginaLolis(state, ref = today()) {
  const f = { area: 'all', who: 'lolis' };
  const dias = [];
  for (let d = ref, n = 0; n < 2 && dias.length < 2; d = addDays(d, 1)) {
    if (!isWorkday(state, d)) continue;
    n++;
    const ordem = (x) => (x.kind === 'task' ? 0 : x.freq === 'daily' ? 2 : 1);
    const tarefas = buildDay(state, d, f)
      .filter((x) => x.kind !== 'marco')
      .sort((a, b) => ordem(a) - ordem(b))
      .map((x) => ({ key: x.key, titulo: x.title, rotina: x.kind === 'routine', feito: !!x.done, canva: canvaPara(state, x.title), detalhe: detalheTarefa(x) }));
    const atrasadas = d === ref ? buildOverdue(state, f, d).filter((x) => x.kind === 'task').map((x) => ({ key: x.key, titulo: x.title, era: x.date, detalhe: detalheTarefa(x) })) : [];
    const brindes = brindesDoDia(state, d).map(({ key, tipo, linha, texto, sorteio, prazo, telefone }) => ({ key, tipo, linha, texto, sorteio, prazo, telefone, canva: tipo === 'acao' ? canvaPara(state, linha) : null }));
    const posts = postsSorteio(state, d);
    dias.push({ date: d, tarefas, atrasadas, brindes, posts });
  }
  return { geradoEm: new Date().toISOString(), dias, andamento: noDate(state, f).map((x) => x.title) };
}
