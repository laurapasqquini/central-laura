import { useState } from 'react';
import { useStore } from '../lib/store';
import { TEMPLATES } from '../lib/seed';
import { AREAS, projectProgress } from '../lib/engine';
import { today, fmtCurto, addDays, relativo } from '../lib/dates';
import { Modal, Segmented, areaOptions, inputCls, Empty, Check, Pill, TaskModal } from '../components/ui';

export default function Projects() {
  const { state } = useStore();
  const [creating, setCreating] = useState(null);
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Projetos</h1>
        <p className="text-sm text-slate-500">Escolha um roteiro, informe a data e a Central monta todas as etapas com prazo.</p>
      </header>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-700">Começar um roteiro</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => setCreating(t)} className="group rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink">{t.name}</span>
                <span className="text-xs font-semibold text-slate-400">{t.items.length} etapas</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{t.desc}</p>
              <span className="mt-3 inline-block text-sm font-bold text-indigo-600 group-hover:underline">+ Criar</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-700">Em andamento</h2>
        {state.projects.length === 0 && <Empty>Nenhum projeto ainda. Que tal começar pelo Padel ou pela confraternização?</Empty>}
        {state.projects.map((p) => (
          <ProjectCard key={p.id} p={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} onEdit={setEditing} />
        ))}
      </section>

      {creating && <CreateModal tpl={creating} onClose={() => setCreating(null)} />}
      {editing && <TaskModal id={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ProjectCard({ p, open, onToggle, onEdit }) {
  const { state, toggleTask, deleteProject } = useStore();
  const prog = projectProgress(state, p.id);
  const tasks = state.tasks.filter((t) => t.projectId === p.id).sort((a, b) => a.due.localeCompare(b.due));
  const phases = [...new Set(tasks.map((t) => t.phase))];
  const late = tasks.filter((t) => !t.done && t.due < today()).length;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <button onClick={onToggle} className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${AREAS[p.area].dot}`} />
              <span className="font-bold text-ink">{p.name}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Início {fmtCurto(p.start)}
              {p.end && ` · fim ${fmtCurto(p.end)}`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-ink">{prog.pct}%</div>
            {late > 0 && <div className="text-xs font-bold text-red-500">{late} atrasadas</div>}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${AREAS[p.area].bar} transition-all`} style={{ width: `${prog.pct}%` }} />
        </div>
        {prog.next && (
          <p className="mt-2 text-sm text-slate-600">
            <b>Próximo:</b> {prog.next.title} <span className={prog.next.due < today() ? 'text-red-500' : 'text-slate-400'}>· {relativo(prog.next.due)}</span>
          </p>
        )}
      </button>
      {open && (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-4">
          {phases.map((ph) => (
            <div key={ph} className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{ph}</h4>
              {tasks
                .filter((t) => t.phase === ph)
                .map((t) => (
                  <div key={t.id} className={`flex items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70 ${t.done ? 'opacity-55' : ''}`}>
                    <Check done={t.done} area={p.area} onClick={() => toggleTask(t.id)} />
                    <button onClick={() => onEdit(t.id)} className={`min-w-0 flex-1 text-left text-sm font-medium ${t.done ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                      {t.title}
                    </button>
                    {t.who === 'lolis' && <Pill className="bg-amber-50 text-amber-700 ring-amber-200">🙋</Pill>}
                    <span className={`shrink-0 text-xs font-semibold ${!t.done && t.due < today() ? 'text-red-500' : 'text-slate-400'}`}>{fmtCurto(t.due)}</span>
                  </div>
                ))}
            </div>
          ))}
          <button
            onClick={() => confirm(`Excluir o projeto "${p.name}" e todas as tarefas dele?`) && deleteProject(p.id)}
            className="text-xs font-semibold text-red-500 hover:underline"
          >
            Excluir projeto
          </button>
        </div>
      )}
    </div>
  );
}

function CreateModal({ tpl, onClose }) {
  const { createProject } = useStore();
  const [name, setName] = useState(tpl.id === 'abrir-cidade' ? '' : tpl.name + ' ');
  const [start, setStart] = useState(addDays(today(), tpl.id === 'abrir-cidade' ? 45 : tpl.id === 'confra' ? 62 : 0));
  const [end, setEnd] = useState('');
  const [area, setArea] = useState(tpl.area);
  const hasEnd = tpl.items.some((i) => i.anchor === 'end');
  const first = tpl.items.filter((i) => i.anchor === 'start').reduce((m, i) => Math.min(m, i.offset), 0);
  const firstDate = addDays(start, first);

  return (
    <Modal title={tpl.name} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          createProject({ templateId: tpl.id, name: name.trim() || tpl.name, start, end: end || null, area });
          onClose();
        }}
      >
        <p className="text-sm text-slate-500">{tpl.desc}</p>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nome</span>
          <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Padel Maringá" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tpl.startLabel}</span>
            <input type="date" required className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          {hasEnd && (
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tpl.endLabel}</span>
              <input type="date" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          )}
        </div>
        <Segmented value={area} onChange={setArea} options={areaOptions} />
        <div className={`rounded-xl px-3 py-2 text-sm ${firstDate < today() ? 'bg-red-50 text-red-700' : 'bg-indigo-50 text-indigo-800'}`}>
          A primeira etapa começa em <b>{fmtCurto(firstDate)}</b> ({relativo(firstDate)}).
          {firstDate < today() && ' Já está atrasada: considere mudar a data de início.'}
          {hasEnd && !end && ' Sem data de fim, as etapas de encerramento ficam de fora (dá pra recriar depois).'}
        </div>
        <button className="w-full rounded-xl bg-ink py-3 text-sm font-bold text-white">Criar projeto com {tpl.items.filter((i) => i.anchor === 'start' || end).length} etapas</button>
      </form>
    </Modal>
  );
}
