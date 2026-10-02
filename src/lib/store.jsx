import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { today, addDays } from './dates';
import { seedRoutines, seedTasks, seedMarcos, TEMPLATES } from './seed';

// Os dados ficam no Supabase (nuvem) e com uma cópia no navegador (localStorage).
// Tudo é salvo como um único documento por usuária, sincronizado entre PC e iPhone.

const KEY = 'central-laura:v1';
const uid = () => crypto.randomUUID().slice(0, 8);

function initial() {
  const hoje = today();
  return {
    version: 1,
    createdAt: hoje,
    tasks: seedTasks(hoje).map((t) => ({ done: false, createdAt: hoje, postponed: 0, notes: '', ...t })),
    routines: seedRoutines().map((r) => ({ ...r, createdAt: hoje })),
    routineDone: {},
    projects: [],
    marcos: seedMarcos(),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* sem armazenamento: começa do zero */
  }
  return initial();
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
        lastJson.current = JSON.stringify(data.data);
        setState(data.data);
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
          setState(p.new.data);
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

      replaceAll: (next) => setState(next),
    };
  }, []);

  return <Ctx.Provider value={{ state, sync, user, ...actions }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
