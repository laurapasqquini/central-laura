import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { today, addDays } from './dates';
import { seedRoutines, seedTasks, seedMarcos, TEMPLATES } from './seed';

// Por enquanto os dados ficam no navegador (localStorage).
// Quando o Supabase estiver ligado, o mesmo estado é sincronizado na nuvem.

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

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignora */
    }
  }, [state]);

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

  return <Ctx.Provider value={{ state, ...actions }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
