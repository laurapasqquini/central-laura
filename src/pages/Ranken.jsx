// RANKEN: tudo da liga num lugar só. Tarefas (com as do Hub), Etapas, Plano, Lolis e Relatórios.
import ListaDoDia from '../components/ListaDoDia';
import Etapas from './Etapas';
import Plano from './Plano';
import Lolis from './Lolis';
import Relatorios from './Relatorios';

export const SUBABAS_RANKEN = [
  { id: 'tarefas', label: '📝 Tarefas' },
  { id: 'etapas', label: '🏆 Etapas' },
  { id: 'plano', label: '🎯 Plano' },
  { id: 'lolis', label: '🙋 Lolis' },
  { id: 'relatorios', label: '📊 Relatórios' },
];

export default function Ranken({ sub = 'tarefas', setSub, go }) {
  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          <span className="mr-2 inline-block h-3 w-3 rounded-full bg-emerald-500 align-middle" />
          RANKEN
        </h1>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {SUBABAS_RANKEN.map((s) => (
            <button
              key={s.id}
              onClick={() => setSub(s.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset transition ${sub === s.id ? 'bg-emerald-600 text-white ring-transparent' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>
      {sub === 'tarefas' && <ListaDoDia area="ranken" />}
      {sub === 'etapas' && <Etapas go={go} />}
      {sub === 'plano' && <Plano go={go} />}
      {sub === 'lolis' && <Lolis go={go} />}
      {sub === 'relatorios' && <Relatorios go={go} />}
    </div>
  );
}
