import { useState } from 'react';
import { useStore } from '../lib/store';
import { AREAS, FREQ_LABEL } from '../lib/engine';
import { DIAS } from '../lib/dates';
import { Modal, Segmented, areaOptions, inputCls, inputBase, Pill } from '../components/ui';
import { NotifCard } from '../components/Notif';
import { FolgasCard } from '../components/Folgas';
import { ContasCard } from '../components/Contas';

const when = (r) => (r.freq === 'daily' ? 'seg a sex' : r.freq === 'weekly' ? `toda ${DIAS[r.weekday]}` : `dia ${r.monthday}`) + (r.hora ? ` às ${r.hora}` : '');

export default function Routines() {
  const { state, updateRoutine, setMelhoresWho } = useStore();
  const [editing, setEditing] = useState(null);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Rotinas e avisos</h1>
          <p className="text-sm text-slate-500">Aparecem sozinhas no dia certo. Desligue as que não fizerem sentido.</p>
        </div>
        <button onClick={() => setEditing('new')} className="shrink-0 rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white">+ Rotina</button>
      </header>

      <div id="notificacoes">
        <NotifCard />
      </div>

      <ContasCard />

      <FolgasCard />

      {['daily', 'weekly', 'monthly'].map((f) => {
        const list = state.routines.filter((r) => r.freq === f).sort((a, b) => (a.weekday ?? a.monthday ?? 0) - (b.weekday ?? b.monthday ?? 0));
        return (
          <section key={f} className="space-y-2">
            <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-700">{FREQ_LABEL[f]}</h2>
            <div className="space-y-1.5">
              {list.map((r) => (
                <div key={r.id} className={`flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/70 ${r.active ? '' : 'opacity-45'}`}>
                  <span className={`h-6 w-1 shrink-0 rounded-full ${AREAS[r.area].bar}`} />
                  <button onClick={() => setEditing(r.id)} className="min-w-0 flex-1 text-left">
                    <div className="text-[15px] font-medium text-slate-800">{r.title}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Pill className="bg-slate-50 text-slate-500 ring-slate-200">{when(r)}</Pill>
                      {r.who === 'lolis' && <Pill className="bg-amber-50 text-amber-700 ring-amber-200">🙋 Lolis</Pill>}
                    </div>
                  </button>
                  <button
                    onClick={() => updateRoutine(r.id, { active: !r.active })}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${r.active ? AREAS[r.area].bar : 'bg-slate-300'}`}
                    aria-label={r.active ? 'Desligar' : 'Ligar'}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${r.active ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-700">Pelo calendário das etapas</h2>
        <div className="space-y-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/70">
          <div className="text-[15px] font-medium text-slate-800">Postar os melhores da rodada</div>
          <p className="text-sm text-slate-500">
            Aparece sozinho na segunda depois do sorteio (tênis e beach, cada um no seu Instagram), com o botão que abre o Ranking no Hub.
          </p>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">Quem posta:</span>
            <Segmented
              value={state.melhoresWho || 'laura'}
              onChange={setMelhoresWho}
              options={[['laura', 'Eu'], ['lolis', '🙋 Lolis', 'bg-amber-500 text-white ring-transparent']]}
            />
          </div>
        </div>
      </section>

      {editing && <RoutineModal id={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RoutineModal({ id, onClose }) {
  const { state, addRoutine, updateRoutine, deleteRoutine } = useStore();
  const existing = state.routines.find((r) => r.id === id);
  const [f, setF] = useState(existing || { title: '', area: 'ranken', who: 'laura', freq: 'weekly', weekday: 1, monthday: 1 });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal title={existing ? 'Editar rotina' : 'Nova rotina'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.title.trim()) return;
          const data = { title: f.title.trim(), area: f.area, who: f.who, freq: f.freq, weekday: +f.weekday, monthday: +f.monthday, hora: f.hora || null };
          existing ? updateRoutine(id, data) : addRoutine(data);
          onClose();
        }}
      >
        <input autoFocus className={inputCls} value={f.title} onChange={(e) => set('title')(e.target.value)} placeholder="O que fazer" />
        <Segmented value={f.area} onChange={set('area')} options={areaOptions} />
        <Segmented value={f.who} onChange={set('who')} options={[['laura', 'Eu'], ['lolis', '🙋 Lolis', 'bg-amber-500 text-white ring-transparent']]} />
        <Segmented value={f.freq} onChange={set('freq')} options={[['daily', 'Todo dia útil'], ['weekly', 'Semanal'], ['monthly', 'Mensal']]} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Horário (opcional, para compromissos)
          <input type="time" className={`${inputBase} w-32`} value={f.hora || ''} onChange={(e) => set('hora')(e.target.value)} />
        </label>
        {f.freq === 'weekly' && (
          <select className={inputCls} value={f.weekday} onChange={(e) => set('weekday')(e.target.value)}>
            {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        )}
        {f.freq === 'monthly' && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Todo dia
            <input type="number" min="1" max="31" className={`${inputBase} w-20`} value={f.monthday} onChange={(e) => set('monthday')(e.target.value)} />
            do mês
          </label>
        )}
        <div className="flex items-center justify-between pt-2">
          {existing ? (
            <button type="button" onClick={() => confirm('Excluir esta rotina?') && (deleteRoutine(id), onClose())} className="text-sm font-semibold text-red-500">
              Excluir
            </button>
          ) : <span />}
          <button className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white">Salvar</button>
        </div>
      </form>
    </Modal>
  );
}
