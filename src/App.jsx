import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import { StoreProvider, useStore } from './lib/store';
import { buildOverdue } from './lib/engine';
import Home from './pages/Home';
import Routines from './pages/Routines';
import Lolis from './pages/Lolis';
import Gralha from './pages/Gralha';
import Etapas from './pages/Etapas';
import Relatorios from './pages/Relatorios';
import Plano from './pages/Plano';
import { Revisao } from './components/Revisao';

const TABS = [
  { id: 'home', label: 'Início', icon: '☀️', C: Home },
  { id: 'plano', label: 'Plano', icon: '🎯', C: Plano },
  { id: 'etapas', label: 'Etapas', icon: '🎾', C: Etapas },
  { id: 'gralha', label: 'Gralha', icon: '🐦', C: Gralha },
  { id: 'lolis', label: 'Lolis', icon: '🙋', C: Lolis },
  { id: 'relatorios', label: 'Relatórios', icon: '📊', C: Relatorios },
  { id: 'routines', label: 'Rotinas', icon: '↻', C: Routines },
];

function Shell() {
  const { state, sync, user } = useStore();
  const [tab, setTab] = useState('home');
  const [revisao, setRevisao] = useState(null);

  // revisão de sexta (aberta pelo botão da rotina) e clique na notificação (volta para o Início)
  useEffect(() => {
    const abrir = (e) => setRevisao(e.detail || {});
    const sw = (e) => e.data?.tipo === 'abrir-inicio' && setTab('home');
    window.addEventListener('abrir-revisao', abrir);
    navigator.serviceWorker?.addEventListener('message', sw);
    return () => {
      window.removeEventListener('abrir-revisao', abrir);
      navigator.serviceWorker?.removeEventListener('message', sw);
    };
  }, []);
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
          <SyncDot sync={sync} />
          <button onClick={() => supabase.auth.signOut()} title={user.email} className="mb-3 block text-indigo-400 hover:text-white">Sair</button>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" />RANKEN</div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-400" />Gralha Azul</div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-violet-400" />Pessoal</div>
        </div>
      </aside>

      <main className="mx-auto w-full min-w-0 max-w-5xl px-4 pt-6 pb-28 sm:px-8 sm:pt-10 sm:pb-12">
        <div className="mb-3 flex justify-end sm:hidden"><SyncDot sync={sync} dark /></div>
        <Page go={setTab} />
        {revisao && <Revisao item={revisao.id ? revisao : null} go={setTab} onClose={() => setRevisao(null)} />}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-slate-200 bg-white/95 pt-1.5 backdrop-blur sm:hidden">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex min-w-0 flex-col items-center gap-0.5 py-1 text-[10px] font-semibold ${tab === t.id ? 'text-ink' : 'text-slate-400'}`}>
            <span className="text-xl leading-none">{t.icon}</span>
            {t.label}
            {badge(t.id) && <span className="absolute top-0 right-1/4 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{badge(t.id)}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

const SYNC = {
  loading: ['bg-slate-400', 'carregando…'],
  saving: ['bg-amber-400', 'salvando…'],
  ok: ['bg-emerald-400', 'salvo na nuvem'],
  offline: ['bg-red-400', 'sem conexão: salvo só aqui'],
};

function SyncDot({ sync, dark }) {
  const [cls, label] = SYNC[sync];
  return (
    <div className={`flex items-center gap-2 ${dark ? 'text-[11px] text-slate-400' : 'pb-2'}`}>
      <span className={`h-2 w-2 rounded-full ${cls}`} />
      {label}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Só no computador de desenvolvimento: localhost:5190/#demo abre sem login, para testes.
  if (import.meta.env.DEV && location.hash === '#demo')
    return (
      <StoreProvider user={{ id: '00000000-0000-0000-0000-000000000000', email: 'demo' }}>
        <Shell />
      </StoreProvider>
    );
  if (session === undefined) return <div className="min-h-screen bg-ink" />;
  if (!session) return <Login />;
  return (
    <StoreProvider key={session.user.id} user={session.user}>
      <Shell />
    </StoreProvider>
  );
}
