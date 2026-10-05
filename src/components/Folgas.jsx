import { useState } from 'react';
import { useStore } from '../lib/store';
import { FERIADOS } from '../data/feriados';
import { today, addDays, fmtCurto } from '../lib/dates';
import { inputCls } from './ui';

// Feriados (liga/desliga) e folgas extras (férias, recesso, emenda)
export function FolgasCard() {
  const { state, toggleFeriado, addFolga, removeFolga } = useStore();
  const [data, setData] = useState('');
  const [ate, setAte] = useState('');
  const [nome, setNome] = useState('');
  const ref = today();
  const ignorados = state.feriadosIgnorados || [];
  const proximos = Object.entries(FERIADOS)
    .filter(([d]) => d >= ref)
    .slice(0, 8);
  const folgas = Object.entries(state.folgas || {})
    .filter(([d]) => d >= ref)
    .sort(([a], [b]) => a.localeCompare(b));

  const adicionar = (e) => {
    e.preventDefault();
    if (!data) return;
    // de "data" até "ate" (inclusive), um dia por vez
    for (let d = data; d <= (ate || data); d = addDays(d, 1)) addFolga(d, nome.trim() || 'Folga');
    setData('');
    setAte('');
    setNome('');
  };

  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div>
        <div className="font-bold text-ink">🌴 Feriados e folgas</div>
        <p className="text-sm text-slate-500">
          Sábado, domingo, feriado e folga não recebem tarefa nem notificação: o que cairia neles vai para o próximo dia útil.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Próximos feriados</div>
        {proximos.map(([d, n]) => {
          const folga = !ignorados.includes(d);
          return (
            <label key={d} className="flex items-center justify-between gap-3 text-sm">
              <span className={folga ? 'text-slate-800' : 'text-slate-400 line-through'}>
                <b>{fmtCurto(d)}</b> · {n}
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                {folga ? 'não trabalho' : 'trabalho'}
                <input type="checkbox" checked={folga} onChange={() => toggleFeriado(d)} className="h-5 w-5 accent-violet-600" />
              </span>
            </label>
          );
        })}
      </div>

      <form onSubmit={adicionar} className="space-y-2 border-t border-slate-100 pt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acrescentar folga (férias, recesso, emenda)</div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" required className={inputCls} value={data} onChange={(e) => setData(e.target.value)} />
          <input type="date" className={inputCls} value={ate} min={data} onChange={(e) => setAte(e.target.value)} title="Até (opcional)" />
        </div>
        <div className="flex gap-2">
          <input className={inputCls} placeholder="Motivo (ex.: Férias)" value={nome} onChange={(e) => setNome(e.target.value)} />
          <button className="shrink-0 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white">Adicionar</button>
        </div>
        <p className="text-xs text-slate-400">A segunda data é opcional, para marcar vários dias seguidos.</p>
      </form>

      {folgas.length > 0 && (
        <div className="space-y-1">
          {folgas.map(([d, n]) => (
            <div key={d} className="flex items-center justify-between text-sm">
              <span>
                <b>{fmtCurto(d)}</b> · {n}
              </span>
              <button onClick={() => removeFolga(d)} className="text-xs font-semibold text-red-500">
                remover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
