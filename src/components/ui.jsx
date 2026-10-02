import { useState } from 'react';
import { useStore } from '../lib/store';
import { AREAS } from '../lib/engine';
import { parseQuick } from '../lib/parse';
import { fmtCurto, relativo, today } from '../lib/dates';

export const HUB_URL = 'https://ranken-financeiro.vercel.app/';

export const Pill = ({ className = '', children }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${className}`}>{children}</span>
);

export const AreaPill = ({ area }) => <Pill className={AREAS[area].soft}>{AREAS[area].label}</Pill>;

export function Check({ done, onClick, area }) {
  return (
    <button
      onClick={onClick}
      aria-label={done ? 'Desmarcar' : 'Concluir'}
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${
        done ? `${AREAS[area].bar} border-transparent pop` : 'border-slate-300 hover:border-slate-500 bg-white'
      }`}
    >
      {done && (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M4 10l4 4 8-8" />
        </svg>
      )}
    </button>
  );
}

export function ItemRow({ item, showDate = false, onEdit }) {
  const { toggleTask, toggleRoutine, postpone } = useStore();

  if (item.kind === 'marco') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 px-3 py-2.5">
        <span className="grid h-6 w-6 place-items-center text-base">📌</span>
        <div className="min-w-0 flex-1 text-sm font-semibold text-indigo-900">{item.title}</div>
        {showDate && <span className="text-xs font-medium text-indigo-500">{fmtCurto(item.date)}</span>}
      </div>
    );
  }

  const toggle = () => (item.kind === 'task' ? toggleTask(item.id) : toggleRoutine(item.id, item.date));
  const late = !item.done && item.date && item.date < today();

  return (
    <div className={`group flex items-start gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/70 transition hover:ring-slate-300 ${item.done ? 'opacity-55' : ''}`}>
      <span className={`mt-0.5 h-6 w-1 shrink-0 rounded-full ${AREAS[item.area].bar}`} />
      <Check done={item.done} onClick={toggle} area={item.area} />
      <button onClick={() => item.kind === 'task' && onEdit?.(item.id)} className="min-w-0 flex-1 text-left">
        <div className={`text-[15px] leading-snug font-medium ${item.done ? 'line-through text-slate-500' : 'text-slate-800'}`}>{item.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {item.urgent && !item.done && <Pill className="bg-red-50 text-red-600 ring-red-200">urgente</Pill>}
          {item.who === 'lolis' && <Pill className="bg-amber-50 text-amber-700 ring-amber-200">🙋 Lolis</Pill>}
          {item.kind === 'routine' && <Pill className="bg-slate-50 text-slate-500 ring-slate-200">↻ rotina</Pill>}
          {item.project && <Pill className="bg-indigo-50 text-indigo-600 ring-indigo-200">{item.project}</Pill>}
          {(showDate || late) && item.date && (
            <span className={`text-xs font-medium ${late ? 'text-red-500' : 'text-slate-400'}`}>
              {late ? `venceu ${relativo(item.date)}` : fmtCurto(item.date)}
            </span>
          )}
          {item.notes && <span className="text-xs text-slate-400">📝</span>}
        </div>
      </button>
      {item.hub && !item.done && (
        <a href={HUB_URL} target="_blank" rel="noreferrer" title="Abrir o RANKEN Hub" className="mt-0.5 shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700">
          🔗 Hub
        </a>
      )}
      {item.kind === 'task' && !item.done && (
        <button
          onClick={() => postpone(item.id, 1)}
          title="Adiar 1 dia"
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100"
        >
          +1d
        </button>
      )}
    </div>
  );
}

export function Section({ title, count, tone = 'slate', children, right }) {
  const tones = { red: 'text-red-600', slate: 'text-slate-700', indigo: 'text-indigo-700' };
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className={`text-sm font-bold uppercase tracking-wide ${tones[tone]}`}>
          {title} {count != null && <span className="ml-1 font-semibold text-slate-400">{count}</span>}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export const Empty = ({ children }) => <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">{children}</div>;

export function QuickAdd({ defaultArea }) {
  const { addTask } = useStore();
  const [text, setText] = useState('');
  const preview = text.trim() ? parseQuick(text, { area: defaultArea }) : null;

  const submit = (e) => {
    e.preventDefault();
    if (!preview?.title) return;
    addTask(preview);
    setText('');
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        <span className="pl-2 text-lg">✨</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Anotar… ex.: pedir pra @lolis contar estoque sexta !urgente"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-slate-400"
        />
        <button className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-30" disabled={!preview?.title}>
          Criar
        </button>
      </div>
      {preview?.title && (
        <div className="flex flex-wrap items-center gap-1.5 px-2 pt-1 pb-1 text-xs text-slate-500">
          <span>vai criar:</span>
          <b className="text-slate-700">{preview.title}</b>
          <AreaPill area={preview.area} />
          <Pill className="bg-slate-50 text-slate-600 ring-slate-200">{preview.due ? fmtCurto(preview.due) : 'sem data'}</Pill>
          {preview.who === 'lolis' && <Pill className="bg-amber-50 text-amber-700 ring-amber-200">🙋 Lolis</Pill>}
          {preview.urgent && <Pill className="bg-red-50 text-red-600 ring-red-200">urgente</Pill>}
          {preview.hub && <Pill className="bg-emerald-600 text-white ring-transparent">🔗 fazer no Hub</Pill>}
        </div>
      )}
      {!text && (
        <div className="px-2 pb-1 text-[11px] text-slate-400">
          <b>#ranken #gralha #pessoal</b> escolhe a área · <b>#hub</b> = fazer no Hub · <b>@lolis</b> delega · <b>!urgente</b> · datas: hoje, amanhã, sexta, 15/10, em 3 dias
        </div>
      )}
    </form>
  );
}

const Field = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>
);
export const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[15px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';

export function Segmented({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label, cls]) => (
        <button
          type="button"
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset transition ${
            value === v ? cls || 'bg-ink text-white ring-ink' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export const areaOptions = Object.entries(AREAS).map(([k, a]) => [k, a.label, `${a.bar} text-white ring-transparent`]);

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-ink">{title}</h3>
          <button onClick={onClose} className="rounded-full px-2 text-2xl leading-none text-slate-400 hover:text-slate-700">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TaskModal({ id, onClose }) {
  const { state, updateTask, deleteTask } = useStore();
  const t = state.tasks.find((x) => x.id === id);
  const [form, setForm] = useState(() => ({ ...t }));
  if (!t) return null;
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    updateTask(id, { title: form.title, area: form.area, who: form.who, due: form.due || null, urgent: form.urgent, hub: !!form.hub, notes: form.notes });
    onClose();
  };

  return (
    <Modal title="Editar tarefa" onClose={onClose}>
      <div className="space-y-4">
        <Field label="O quê">
          <input className={inputCls} value={form.title} onChange={(e) => set('title')(e.target.value)} />
        </Field>
        <Field label="Área">
          <Segmented value={form.area} onChange={set('area')} options={areaOptions} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quando">
            <input type="date" className={inputCls} value={form.due || ''} onChange={(e) => set('due')(e.target.value)} />
          </Field>
          <Field label="Quem faz">
            <Segmented value={form.who} onChange={set('who')} options={[['laura', 'Eu'], ['lolis', '🙋 Lolis', 'bg-amber-500 text-white ring-transparent']]} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={!!form.urgent} onChange={(e) => set('urgent')(e.target.checked)} className="h-4 w-4 accent-red-500" /> Urgente
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={!!form.hub} onChange={(e) => set('hub')(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Fazer no RANKEN Hub
        </label>
        <Field label="Notas">
          <textarea rows={3} className={inputCls} value={form.notes || ''} onChange={(e) => set('notes')(e.target.value)} placeholder="Detalhes, contato, link…" />
        </Field>
        {t.phase && <p className="text-xs text-slate-400">Etapa do projeto: {t.phase}</p>}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => {
              if (confirm('Excluir esta tarefa?')) {
                deleteTask(id);
                onClose();
              }
            }}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50"
          >
            Excluir
          </button>
          <button onClick={save} className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white">Salvar</button>
        </div>
      </div>
    </Modal>
  );
}
