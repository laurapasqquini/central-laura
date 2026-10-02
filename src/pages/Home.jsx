import { useState } from 'react';
import { useStore } from '../lib/store';
import { buildDay, buildOverdue, noDate, suggestions, AREAS } from '../lib/engine';
import { today, addDays, fmtLongo, fmtCurto, relativo } from '../lib/dates';
import { ItemRow, Section, Empty, QuickAdd, TaskModal, Segmented } from '../components/ui';

const TONES = {
  red: 'bg-red-50 ring-red-100 text-red-800',
  amber: 'bg-amber-50 ring-amber-100 text-amber-800',
  violet: 'bg-violet-50 ring-violet-100 text-violet-800',
  sky: 'bg-sky-50 ring-sky-100 text-sky-800',
};

function Ring({ pct }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
      <circle cx="22" cy="22" r={r} fill="none" stroke="url(#g)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-all duration-500" />
      <defs>
        <linearGradient id="g">
          <stop offset="0" stopColor="#10b981" />
          <stop offset=".5" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Home() {
  const { state } = useStore();
  const [filter, setFilter] = useState({ area: 'all', who: 'all' });
  const [editing, setEditing] = useState(null);
  const ref = today();

  const overdue = buildOverdue(state, filter, ref);
  const hoje = buildDay(state, ref, filter);
  const doable = hoje.filter((x) => x.kind !== 'marco');
  const pct = doable.length ? Math.round((doable.filter((x) => x.done).length / doable.length) * 100) : 0;
  const next = Array.from({ length: 7 }, (_, i) => addDays(ref, i + 1)).map((d) => ({ d, items: buildDay(state, d, filter) }));
  const semData = noDate(state, filter);
  const tips = suggestions(state, ref);
  const hora = new Date().getHours();
  const saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500 first-letter:uppercase">{fmtLongo(ref)}</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{saud}, Laura</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-2xl font-extrabold text-ink">{pct}%</div>
            <div className="text-[11px] font-medium text-slate-400">do dia feito</div>
          </div>
          <Ring pct={pct} />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={filter.area}
          onChange={(area) => setFilter((f) => ({ ...f, area }))}
          options={[['all', 'Tudo'], ...Object.entries(AREAS).map(([k, a]) => [k, a.label, `${a.bar} text-white ring-transparent`])]}
        />
        <span className="hidden h-5 w-px bg-slate-200 sm:block" />
        <Segmented
          value={filter.who}
          onChange={(who) => setFilter((f) => ({ ...f, who }))}
          options={[['all', 'Todos'], ['laura', 'Só eu'], ['lolis', '🙋 Lolis', 'bg-amber-500 text-white ring-transparent']]}
        />
      </div>

      <QuickAdd defaultArea={filter.area === 'all' ? 'ranken' : filter.area} />

      {tips.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {tips.map((t, i) => (
            <div key={i} className={`flex gap-2.5 rounded-xl px-3.5 py-3 text-sm font-medium ring-1 ${TONES[t.tone]}`}>
              <span>{t.icon}</span>
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          {overdue.length > 0 && (
            <Section title="Atrasados" count={overdue.length} tone="red">
              <div className="space-y-1.5 rounded-2xl bg-red-50/60 p-2 ring-1 ring-red-100">
                {overdue.map((x) => <ItemRow key={x.key} item={x} onEdit={setEditing} />)}
              </div>
            </Section>
          )}
          <Section title="Hoje" count={doable.filter((x) => !x.done).length}>
            <div className="space-y-1.5">
              {hoje.length ? hoje.map((x) => <ItemRow key={x.key} item={x} onEdit={setEditing} />) : <Empty>Nada para hoje. Aproveite ✨</Empty>}
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Próximos 7 dias" tone="indigo">
            <div className="space-y-4">
              {next.map(({ d, items }) => (
                <div key={d} className="space-y-1.5">
                  <div className="flex items-baseline gap-2 px-1">
                    <span className="text-sm font-bold capitalize text-slate-700">{relativo(d, ref)}</span>
                    <span className="text-xs text-slate-400">{fmtCurto(d)}</span>
                    {items.length > 0 && <span className="text-xs text-slate-400">· {items.filter((x) => x.kind !== 'marco').length} itens</span>}
                  </div>
                  {items.length ? (
                    <Collapsible items={items} onEdit={setEditing} />
                  ) : (
                    <div className="px-1 text-xs text-slate-300">livre</div>
                  )}
                </div>
              ))}
            </div>
          </Section>
          {semData.length > 0 && (
            <Section title="Sem data" count={semData.length}>
              <div className="space-y-1.5">{semData.map((x) => <ItemRow key={x.key} item={x} onEdit={setEditing} />)}</div>
            </Section>
          )}
        </div>
      </div>

      {editing && <TaskModal id={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// Nos próximos dias, rotinas ficam recolhidas para não poluir.
function Collapsible({ items, onEdit }) {
  const [open, setOpen] = useState(false);
  const main = items.filter((x) => x.kind !== 'routine');
  const routines = items.filter((x) => x.kind === 'routine');
  return (
    <div className="space-y-1.5">
      {main.map((x) => <ItemRow key={x.key} item={x} onEdit={onEdit} />)}
      {routines.length > 0 &&
        (open ? (
          routines.map((x) => <ItemRow key={x.key} item={x} onEdit={onEdit} />)
        ) : (
          <button onClick={() => setOpen(true)} className="w-full rounded-xl px-3 py-1.5 text-left text-xs font-semibold text-slate-400 hover:bg-white">
            ↻ {routines.length} rotinas · mostrar
          </button>
        ))}
    </div>
  );
}
