import { useState } from 'react';
import { useStore } from '../lib/store';
import { dataEfetiva, isWorkday } from '../lib/engine';
import { today, fmtCurto } from '../lib/dates';
import { delegadas, periodos, recadoAtrasada } from '../lib/delegadas.js';
import { Copiar } from './AcompanhamentoLolis';
import { desfazerMarcaLolis } from '../lib/lolisDesfazer';
import { Empty, inputCls } from './ui';

// Ranken › Lolis › Delegadas: tudo o que a Laura passou para a Lolis, pelo dia em que delegou,
// com o que já foi feito, o que ela não conseguiu e o que está em aberto ou atrasado.
const SIT = {
  feita: ['Feita', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  nao: ['Não conseguiu', 'bg-red-50 text-red-700 ring-red-200'],
  atrasada: ['Atrasada', 'bg-amber-50 text-amber-800 ring-amber-200'],
  aberto: ['Em aberto', 'bg-slate-50 text-slate-600 ring-slate-200'],
};
const dm = (d) => (d ? fmtCurto(d) : '');

export default function DelegadasLolis({ onEdit }) {
  const { state, toggleTask } = useStore();
  const ref = today();
  const ehUtil = (d) => isWorkday(state, d);
  const per = periodos(ref, ehUtil);
  const [vista, setVista] = useState('ontem');
  const [busca, setBusca] = useState('');
  const ctx = { ref, ehUtil, prazoDe: (t) => dataEfetiva(state, t), notas: state.lolisNotas || {} };
  const p = per[vista];
  const { itens, conta } = delegadas(state.tasks, ctx, { de: p.de, ate: p.ate, busca });

  const desfazer = async (x) => {
    if (!confirm(`Desfazer "${x.titulo}"? Volta a ficar em aberto para a Lolis.`)) return;
    await desfazerMarcaLolis(state.lolisToken, [`t:${x.id}`], ref);
    toggleTask(x.id);
  };

  // agrupa pelo dia em que delegou
  const grupos = [];
  for (const x of itens) {
    const g = grupos.at(-1);
    if (g && g.dia === x.delegadaEm) g.itens.push(x);
    else grupos.push({ dia: x.delegadaEm, itens: [x] });
  }
  const quando = busca.trim() ? `com "${busca.trim()}"` : vista === 'tudo' ? 'no total' : vista === 'hoje' ? 'hoje' : vista === 'ontem' ? `em ${dm(p.de)}` : `${p.rotulo.toLowerCase()}`;

  return (
    <section className="space-y-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="space-y-1">
        <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700">Delegadas</h2>
        <p className="text-xs text-slate-500">Tudo o que você passou para a Lolis (com @lolis na anotação rápida ou pelo Hub), pelo dia em que delegou. As rotinas fixas dela ficam no Acompanhamento.</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {Object.entries(per).map(([k, x]) => (
          <button
            key={k}
            onClick={() => {
              setVista(k);
              setBusca('');
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${vista === k && !busca.trim() ? 'bg-amber-500 text-white ring-transparent' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}
          >
            {x.rotulo}
          </button>
        ))}
        <input className={`${inputCls} sm:ml-auto sm:max-w-56`} placeholder="Buscar (ex.: arena)" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
        {conta.total ? (
          <>
            {busca.trim() ? 'Achei' : 'Você delegou'} <b>{conta.total}</b> {quando}:{' '}
            {[
              conta.feita && <b key="f" className="text-emerald-700">{conta.feita} feita{conta.feita > 1 ? 's' : ''}</b>,
              conta.nao && <b key="n" className="text-red-700">{conta.nao} não conseguiu</b>,
              conta.atrasada && <b key="a" className="text-amber-800">{conta.atrasada} atrasada{conta.atrasada > 1 ? 's' : ''}</b>,
              conta.aberto && <b key="o" className="text-slate-700">{conta.aberto} em aberto</b>,
            ]
              .filter(Boolean)
              .reduce((acc, el, i) => (i ? [...acc, ', ', el] : [el]), [])}
          </>
        ) : busca.trim() ? (
          'Nada encontrado com essa palavra.'
        ) : (
          `Nada delegado ${quando}.`
        )}
      </div>

      {itens.length === 0 ? (
        <Empty>{busca.trim() ? 'Tente outra palavra.' : 'Escolha outro período acima.'}</Empty>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <div key={g.dia || 'sem'} className="space-y-1.5">
              {(vista !== 'ontem' && vista !== 'hoje') || busca.trim() ? <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{g.dia ? `Delegadas ${dm(g.dia)}` : 'Sem data'}</div> : null}
              {g.itens.map((x) => (
                <Linha key={x.id} x={x} recado={x.tipo === 'atrasada' ? recadoAtrasada(x, ref, ehUtil, state.lolisModelos) : null} onEdit={() => onEdit(x.id)} onDesfazer={() => desfazer(x)} />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Linha({ x, recado, onEdit, onDesfazer }) {
  const [nome, cor] = SIT[x.tipo];
  const detalhe =
    x.tipo === 'feita' ? (x.em ? `feita ${dm(x.em)}` : 'feita') : x.tipo === 'nao' ? `marcou ${dm(x.em)}` : x.tipo === 'atrasada' ? `prazo ${dm(x.prazo)} · há ${x.dias} dia${x.dias === 1 ? '' : 's'} út${x.dias === 1 ? 'il' : 'eis'}` : x.prazo ? `prazo ${dm(x.prazo)}` : 'sem prazo';
  return (
    <div className="space-y-2 rounded-lg px-2 py-2 ring-1 ring-slate-100 hover:bg-slate-50">
    <div className="flex items-start gap-2">
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className={`block text-sm ${x.tipo === 'feita' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{x.titulo}</span>
        <span className="block text-[11px] text-slate-400">
          {detalhe} · {x.origem === 'Hub' ? 'veio do Hub' : 'pela central'}
        </span>
        {x.nota && <span className={`block text-xs ${x.tipo === 'nao' ? 'text-red-600' : 'text-slate-500'}`}>"{x.nota}"</span>}
        {x.tipo === 'nao' && !x.nota && <span className="block text-xs text-red-600">sem explicar o porquê</span>}
      </button>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${cor}`}>{nome}</span>
      {x.tipo === 'feita' && (
        <button onClick={onDesfazer} className="shrink-0 text-[11px] font-semibold text-slate-400 hover:text-amber-700" title="Ela marcou sem ter feito? Volta para em aberto">
          desfazer
        </button>
      )}
    </div>
    {recado && (
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 rounded-lg bg-[#e7ffdb] px-3 py-2 text-sm text-slate-700">{recado}</p>
        <Copiar texto={recado} />
      </div>
    )}
    </div>
  );
}
