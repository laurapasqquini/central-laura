import { useState } from 'react';
import { StoreProvider, useStore } from './lib/store';
import { buildOverdue } from './lib/engine';
import Home from './pages/Home';
import Projects from './pages/Projects';
import Routines from './pages/Routines';
import Lolis from './pages/Lolis';

const TABS = [
  { id: 'home', label: 'Início', icon: '☀️', C: Home },
  { id: 'projects', label: 'Projetos', icon: '🗺️', C: Projects },
  { id: 'lolis', label: 'Lolis', icon: '🙋', C: Lolis },
  { id: 'routines', label: 'Rotinas', icon: '↻', C: Routines },
];

function Shell() {
  const { state } = useStore();
  const [tab, setTab] = useState('home');
  const Page = TABS.find((t) => t.id === tab).C;
  const late = buildOverdue(state, { area: 'all', who: 'all' }).length;

  const badge = (id) => (id === 'home' && late > 0 ? late : null);

  return (
    <div className="min-h-screen sm:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-ink p-4 text-white sm:flex">
        <div className="mb-8 flex items-center gap-3 px-2 pt-2">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-9 w-9" />
          <div>
            <div className="font-extrabold leading-tight">Central</div>
            <div className="text-xs text-indigo-300">da Laura</div>
          </div>
        </div>
        <nav className="space-y-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${tab === t.id ? 'bg-white/15 text-white' : 'text-indigo-200 hover:bg-white/5'}`}
            >
              <span className="w-5 text-center">{t.icon}</span>
              {t.label}
              {badge(t.id) && <span className="ml-auto rounded-full bg-red-500 px-2 text-xs font-bold">{badge(t.id)}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-1.5 px-2 text-xs text-indigo-300">
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" />RANKEN</div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-400" />Gralha Azul</div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-violet-400" />Pessoal</div>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-28 sm:px-8 sm:pt-10 sm:pb-12">
        <Page />
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white/95 pt-1.5 backdrop-blur sm:hidden">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold ${tab === t.id ? 'text-ink' : 'text-slate-400'}`}>
            <span className="text-xl leading-none">{t.icon}</span>
            {t.label}
            {badge(t.id) && <span className="absolute top-0 right-1/4 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{badge(t.id)}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
