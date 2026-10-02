import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { today, addDays, nextWorkday } from './dates';
import { seedRoutines, seedTasks, seedMarcos, TEMPLATES } from './seed';

// Os dados ficam no Supabase (nuvem) e com uma cópia no navegador (localStorage).
// Tudo é salvo como um único documento por usuária, sincronizado entre PC e iPhone.

const KEY = 'central-laura:v1';
const uid = () => crypto.randomUUID().slice(0, 8);

function initial() {
  const hoje = today();
  return {
    version: 5,
    createdAt: hoje,
    tasks: seedTasks(hoje).map((t) => ({ done: false, createdAt: hoje, postponed: 0, notes: '', ...t })),
    routines: seedRoutines().map((r) => ({ ...r, createdAt: hoje })),
    routineDone: {},
    projects: [],
    marcos: seedMarcos(),
  };
}

// Ajustes que chegam com novas versões da Central e precisam valer para dados já salvos.
const PIX = 'Cobrar mensalidades Pix de hoje e as atrasadas';
const PIX_LOLIS = 'Mandar a 1ª mensagem de cobrança Pix (vencimentos do dia)';
const MAPEAMENTO = 'Mapeamento de quadras de tênis no Brasil (em andamento)';

function migrate(s) {
  if (!s) return s;
  const hoje = today();
  const nova = (title, who, freq, extra) => ({ id: uid(), title, area: 'ranken', who, freq, active: true, createdAt: hoje, ...extra });
  const tarefa = (title, due, who = 'laura') => ({ id: uid(), title, area: 'ranken', who, due, urgent: false, done: false, createdAt: hoje, postponed: 0, notes: '' });

  // v2: boas-vindas passa para a Lolis, conferência semanal e preparação da delegação
  if ((s.version || 1) < 2) {
    s = {
      ...s,
      version: 2,
      routines: [
        ...s.routines.map((r) => (r.title === 'Conferir novas inscrições e mandar boas-vindas' ? { ...r, who: 'lolis' } : r)),
        nova('Conferência da semana com a Lolis (15 min)', 'laura', 'weekly', { weekday: 5 }),
      ],
      tasks: [
        tarefa('Escrever as mensagens padrão da Lolis (boas-vindas, 6x0, brindes, pendências, licenciamento)', nextWorkday(hoje)),
        tarefa('Confirmar os acessos da Lolis: Hub, grupos do WhatsApp e Instagram', nextWorkday(hoje)),
        ...s.tasks,
      ],
    };
  }

  // v3: Pix fica só com a Laura (sai do número da empresa dela); mapeamento de quadras com a Lolis
  if (s.version < 3) {
    s = {
      ...s,
      version: 3,
      routines: s.routines
        .filter((r) => r.title !== PIX_LOLIS)
        .map((r) => (r.title === 'Cobrar o Pix de quem não pagou após a 1ª mensagem' ? { ...r, title: PIX, who: 'laura' } : r)),
      tasks: [
        ...(s.tasks.some((t) => t.title === MAPEAMENTO) ? [] : [tarefa(MAPEAMENTO, null, 'lolis')]),
        ...s.tasks.map((t) => (t.title.startsWith('Escrever as mensagens padrão da Lolis (Pix, ') ? { ...t, title: t.title.replace('(Pix, ', '(') } : t)),
      ],
    };
  }
  // v4: boas-vindas é automática (número da RANKEN na Meta); a Lolis só confere o cadastro
  if (s.version < 4) {
    s = {
      ...s,
      version: 4,
      routines: s.routines.map((r) =>
        r.title === 'Conferir novas inscrições e mandar boas-vindas' ? { ...r, title: 'Conferir se o cadastro dos novos inscritos está completo (foto, Instagram)', who: 'lolis' } : r
      ),
      tasks: s.tasks.map((t) => (t.title.startsWith('Escrever as mensagens padrão da Lolis (boas-vindas, ') ? { ...t, title: t.title.replace('(boas-vindas, ', '(') } : t)),
    };
  }
  // v5: pendências encontradas no Hub em 02/10 (Cianorte, Cascavel e Maringá)
  if (s.version < 5) {
    const t = (title, due, extra = {}) => ({ ...tarefa(title, due), ...extra });
    const seg = nextWorkday(hoje);
    s = {
      ...s,
      version: 5,
      tasks: [
        t('Passar para a Lolis a pesquisa de Cascavel: telefones dos 18 locais, apoiadores e professores', hoje, { hub: true, urgent: true }),
        t('Passar para a Lolis a pesquisa de Cianorte: apoiadores, local dos kits e professores', hoje, { hub: true, urgent: true }),
        t('Maringá: mandar no grupo a reta final da rodada 5 (prazo, resultado no app, próximo sorteio)', hoje, { urgent: true }),
        t('Definir quem cuida dos itens sem responsável em Cianorte e Cascavel (donos, clubes, síndicos, apoiadores)', seg, { hub: true }),
        t('Colocar o banner da cidade no grupo do WhatsApp: Cianorte (prazo 04/10) e Cascavel (06/10)', seg),
        t('Maringá: avisar no grupo que saíram os jogos da rodada 6', seg),
        t('Maringá: marcar na rotina do projeto o que já foi feito nas rodadas 1 a 5', seg, { hub: true }),
        t('Avisar o Yorran: sorteio da rodada 9 de Maringá está depois do início da rodada (corrigir no app)', seg),
        t('Planejar as campanhas push de Maringá: data, público e texto de cada aviso por rodada', addDays(seg, 1)),
        ...s.tasks,
      ],
    };
  }
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch {
    /* sem armazenamento: começa do zero */
  }
  return initial();
}

export const STAGES = [
  { id: 'enviado', label: 'Orçamento enviado', task: (c) => `Follow-up do orçamento: ${c}`, days: 2 },
  { id: 'arte', label: 'Arte com o marketing', task: (c) => `Cobrar arte do marketing: ${c}`, days: 2 },
  { id: 'aprovacao', label: 'Arte em aprovação', task: (c) => `Cobrar aprovação da arte: ${c}`, days: 2 },
  { id: 'fechado', label: 'Fechado', task: (c) => `Gerar contrato: ${c}`, days: 0, urgent: true },
  { id: 'contrato', label: 'Contrato enviado', task: (c) => `Conferir pagamento dos 50%: ${c}`, days: 3 },
  { id: 'perdido', label: 'Perdido' },
];

function stageTask(pedidoId, cliente, stage) {
  const st = STAGES.find((x) => x.id === stage);
  if (!st?.task) return null;
  return {
    id: uid(),
    title: st.task(cliente),
    area: 'gralha',
    who: 'laura',
    urgent: !!st.urgent,
    due: addDays(today(), st.days),
    pedidoId,
    done: false,
    createdAt: today(),
    postponed: 0,
    notes: '',
  };
}

const Ctx = createContext(null);

export function StoreProvider({ user, children }) {
  const [state, setState] = useState(load);
  const [sync, setSync] = useState('loading'); // loading | ok | saving | offline
  const ready = useRef(false);
  const lastJson = useRef(null); // o que a nuvem tem: evita salvar de volta o que acabou de chegar

  // Cópia local: abre rápido e funciona sem internet.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignora */
    }
  }, [state]);

  // Ao entrar: puxa da nuvem. Se a nuvem estiver vazia, sobe o que está aqui.
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const { data, error } = await supabase.from('central_state').select('data').eq('user_id', user.id).maybeSingle();
      if (!alive) return;
      if (error) return setSync('offline');
      if (data) {
        const migrated = migrate(data.data);
        // se a migração mudou algo, lastJson fica com a versão antiga e o efeito de salvar sobe a nova
        lastJson.current = JSON.stringify(data.data);
        setState(migrated);
      } else {
        await supabase.from('central_state').upsert({ user_id: user.id, data: state, updated_at: new Date().toISOString() });
        lastJson.current = JSON.stringify(state);
      }
      ready.current = true;
      setSync('ok');
    };
    pull();

    // Outro aparelho mudou algo: atualiza aqui na hora.
    const ch = supabase
      .channel('central')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'central_state', filter: `user_id=eq.${user.id}` }, (p) => {
        const json = JSON.stringify(p.new?.data);
        if (p.new?.data && json !== lastJson.current) {
          lastJson.current = json;
          setState(migrate(p.new.data));
        }
      })
      .subscribe();

    // iPhone: ao voltar para o app, confere se tem novidade.
    const onVis = () => document.visibilityState === 'visible' && ready.current && pull();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      supabase.removeChannel(ch);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Cada mudança vai para a nuvem (agrupando cliques rápidos).
  useEffect(() => {
    if (!ready.current) return;
    const json = JSON.stringify(state);
    if (json === lastJson.current) return;
    setSync('saving');
    const t = setTimeout(async () => {
      const { error } = await supabase.from('central_state').upsert({ user_id: user.id, data: state, updated_at: new Date().toISOString() });
      if (error) return setSync('offline');
      lastJson.current = json;
      setSync('ok');
    }, 700);
    return () => clearTimeout(t);
  }, [state, user.id]);

  const actions = useMemo(() => {
    const patchTask = (id, fn) => setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...fn(t) } : t)) }));
    return {
      addTask: (t) =>
        setState((s) => ({
          ...s,
          tasks: [
            { id: uid(), done: false, createdAt: today(), postponed: 0, notes: '', who: 'laura', area: 'ranken', urgent: false, due: null, ...t },
            ...s.tasks,
          ],
        })),
      updateTask: (id, patch) => patchTask(id, () => patch),
      toggleTask: (id) => patchTask(id, (t) => ({ done: !t.done, doneAt: !t.done ? today() : null })),
      postpone: (id, days = 1) =>
        patchTask(id, (t) => ({ due: addDays(t.due && t.due > today() ? t.due : today(), days), postponed: (t.postponed || 0) + 1 })),
      deleteTask: (id) => setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })),

      toggleRoutine: (rid, date) =>
        setState((s) => {
          const k = `${rid}:${date}`;
          const routineDone = { ...s.routineDone };
          if (routineDone[k]) delete routineDone[k];
          else routineDone[k] = true;
          return { ...s, routineDone };
        }),
      addRoutine: (r) => setState((s) => ({ ...s, routines: [...s.routines, { id: uid(), active: true, createdAt: today(), ...r }] })),
      updateRoutine: (id, patch) => setState((s) => ({ ...s, routines: s.routines.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      deleteRoutine: (id) => setState((s) => ({ ...s, routines: s.routines.filter((r) => r.id !== id) })),

      createProject: ({ templateId, name, start, end, area }) =>
        setState((s) => {
          const tpl = TEMPLATES.find((t) => t.id === templateId);
          const pid = uid();
          const tasks = tpl.items
            .filter((it) => it.anchor === 'start' || end)
            .map((it) => ({
              id: uid(),
              title: it.title,
              area,
              who: it.who,
              urgent: it.urgent,
              phase: it.phase,
              projectId: pid,
              due: addDays(it.anchor === 'end' ? end : start, it.offset),
              done: false,
              createdAt: today(),
              postponed: 0,
              notes: '',
            }));
          return {
            ...s,
            projects: [{ id: pid, name, templateId, area, start, end: end || null, createdAt: today() }, ...s.projects],
            tasks: [...tasks, ...s.tasks],
          };
        }),
      deleteProject: (id) =>
        setState((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id), tasks: s.tasks.filter((t) => t.projectId !== id) })),

      addMarco: (m) => setState((s) => ({ ...s, marcos: [...s.marcos, { id: uid(), ...m }] })),
      deleteMarco: (id) => setState((s) => ({ ...s, marcos: s.marcos.filter((m) => m.id !== id) })),

      // Gralha: cada mudança de etapa do pedido fecha a cobrança anterior e cria a próxima.
      addPedido: (p) =>
        setState((s) => {
          const id = uid();
          return {
            ...s,
            pedidos: [{ id, stage: 'enviado', createdAt: today(), history: [{ stage: 'enviado', date: today() }], ...p }, ...(s.pedidos || [])],
            tasks: [stageTask(id, p.cliente, 'enviado'), ...s.tasks],
          };
        }),
      moveStage: (id, stage) =>
        setState((s) => {
          const ped = (s.pedidos || []).find((p) => p.id === id);
          const next = stageTask(id, ped.cliente, stage);
          return {
            ...s,
            pedidos: s.pedidos.map((p) => (p.id === id ? { ...p, stage, history: [...(p.history || []), { stage, date: today() }] } : p)),
            tasks: [
              ...(next ? [next] : []),
              ...s.tasks.map((t) => (t.pedidoId === id && !t.done ? { ...t, done: true, doneAt: today() } : t)),
            ],
          };
        }),
      updatePedido: (id, patch) => setState((s) => ({ ...s, pedidos: s.pedidos.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deletePedido: (id) =>
        setState((s) => ({ ...s, pedidos: s.pedidos.filter((p) => p.id !== id), tasks: s.tasks.filter((t) => t.pedidoId !== id || t.done) })),

      replaceAll: (next) => setState(next),
    };
  }, []);

  return <Ctx.Provider value={{ state, sync, user, ...actions }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
