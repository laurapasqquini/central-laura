import { useState } from 'react';
import { useStore } from '../lib/store';
import { vencimentoConta } from '../lib/engine';
import { today, fmtCurto } from '../lib/dates';
import { inputCls } from './ui';

const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = (s) => Number(String(s).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) || 0;

// Contas fixas pessoais: aparecem como tarefa no dia do vencimento e avisam 3 dias antes.
export function ContasCard() {
  const { state, addConta, updateConta, deleteConta, toggleRoutine } = useStore();
  const contas = state.contas || [];
  const [nova, setNova] = useState({ nome: '', valor: '', dia: '' });
  const mes = today().slice(0, 7);

  const linhas = contas.map((c) => {
    const venc = vencimentoConta(state, c, mes);
    return { c, venc, pago: !!state.routineDone[`conta:${c.id}:${venc}`] };
  });
  const ativas = linhas.filter((l) => l.c.ativo !== false);
  const total = ativas.reduce((s, l) => s + Number(l.c.valor || 0), 0);
  const pago = ativas.filter((l) => l.pago).reduce((s, l) => s + Number(l.c.valor || 0), 0);

  const adicionar = (e) => {
    e.preventDefault();
    const dia = Math.min(31, Math.max(1, parseInt(nova.dia, 10) || 0));
    if (!nova.nome.trim() || !dia) return;
    addConta({ nome: nova.nome.trim(), valor: numero(nova.valor), dia });
    setNova({ nome: '', valor: '', dia: '' });
  };

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-violet-700">💸 Contas fixas</h2>
        {ativas.length > 0 && (
          <span className="text-sm text-slate-500">
            Este mês: <b className="text-emerald-600">{brl(pago)}</b> pago de <b className="text-slate-700">{brl(total)}</b>
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500">Cada conta vira tarefa no dia do vencimento (se cair em fim de semana ou feriado, no dia útil antes) e aparece em 💡 Atenção 3 dias antes.</p>

      <div className="space-y-1.5">
        {linhas.map(({ c, venc, pago: ok }) => (
          <div key={c.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ring-slate-200/70 ${c.ativo === false ? 'opacity-45' : ''}`}>
            <button
              onClick={() => toggleRoutine(`conta:${c.id}`, venc)}
              title={ok ? 'Desmarcar' : 'Marcar como paga'}
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-xs text-white ${ok ? 'border-transparent bg-violet-500' : 'border-slate-300'}`}
            >
              {ok && '✓'}
            </button>
            <input className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-slate-800 outline-none" value={c.nome} onChange={(e) => updateConta(c.id, { nome: e.target.value })} />
            <input className="w-24 rounded-lg bg-slate-50 px-2 py-1 text-right text-sm outline-none" defaultValue={c.valor ? String(c.valor).replace('.', ',') : ''} placeholder="R$" onBlur={(e) => updateConta(c.id, { valor: numero(e.target.value) })} />
            <label className="flex items-center gap-1 text-xs text-slate-500">
              dia
              <input type="number" min="1" max="31" className="w-12 rounded-lg bg-slate-50 px-1.5 py-1 text-sm outline-none" value={c.dia} onChange={(e) => updateConta(c.id, { dia: Math.min(31, Math.max(1, +e.target.value || 1)) })} />
            </label>
            <span className={`hidden w-20 text-right text-xs sm:block ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>{ok ? 'paga ✓' : fmtCurto(venc)}</span>
            <button onClick={() => confirm(`Apagar a conta ${c.nome}?`) && deleteConta(c.id)} title="Apagar" className="px-1 text-slate-300 hover:text-red-500">
              ✕
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={adicionar} className="flex flex-wrap gap-2">
        <input className={`${inputCls} min-w-0 flex-1`} placeholder="Conta (ex.: Aula de tênis)" value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} />
        <input className={`${inputCls} w-28`} placeholder="Valor" inputMode="decimal" value={nova.valor} onChange={(e) => setNova({ ...nova, valor: e.target.value })} />
        <input className={`${inputCls} w-24`} placeholder="Dia" type="number" min="1" max="31" value={nova.dia} onChange={(e) => setNova({ ...nova, dia: e.target.value })} />
        <button className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white">+ Conta</button>
      </form>
    </section>
  );
}
