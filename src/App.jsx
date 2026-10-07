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
import LolisPublica from './pages/LolisPublica';
import { Revisao } from './components/Revisao';
import { House, Target, Trophy, ShoppingBag, Users, BarChart3, Repeat, PanelLeftClose, PanelLeftOpen, LogOut } from 'lucide-react';

const TABS = [
  { id: 'home', label: 'Início', Icon: House, C: Home },
  { id: 'plano', label: 'Plano', Icon: Target, C: Plano },
  { id: 'etapas', label: 'Etapas', Icon: Trophy, C: Etapas },
  { id: 'gralha', label: 'Gralha', Icon: ShoppingBag, C: Gralha },
  { id: 'lolis', label: 'Lolis', Icon: Users, C: Lolis },
  { id: 'relatorios', label: 'Relatórios', Icon: BarChart3, C: Relatorios },
  { id: 'routines', label: 'Rotinas', Icon: Repeat, C: Routines },
];

// menu lateral recolhido ou aberto (lembra a escolha neste aparelho)
const lerMenu = () => {
  try {
    return localStorage.getItem('central-menu') === 'fechado';
  } catch {
    return false;
  }
};

function Shell() {
  const { state, sync, user } = useStore();
  const [tab, setTab] = useState('home');
  const [revisao, setRevisao] = useState(null);
  const [fechado, setFechado] = useState(lerMenu);

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
  const alternarMenu = () => {
    setFechado((f) => {
      try {
        localStorage.setItem('central-menu', f ? 'aberto' : 'fechado');
      } catch {
        /* ignora */
      }
      return !f;
    });
  };
  const Page = TABS.find((t) => t.id === tab).C;
  const late = buildOverdue(state, { area: 'all', who: 'all' }).length;

  const badge = (id) => (id === 'home' && late > 0 ? late : null);

  return (
    <div className="min-h-screen sm:flex">
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-ink py-4 text-white transition-[width] duration-200 sm:flex ${fechado ? 'w-[68px] px-2.5' : 'w-60 px-4'}`}>
        <div className={`mb-8 flex items-center pt-2 ${fechado ? 'flex-col gap-3' : 'gap-3 px-2'}`}>
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-9 w-9 shrink-0" />
          {!fechado && (
            <div className="min-w-0 flex-1">
              <div className="font-bold leading-tight">Central</div>
              <div className="text-xs text-indigo-300">da Laura</div>
            </div>
          )}
          <button onClick={alternarMenu} title={fechado ? 'Abrir menu' : 'Recolher menu'} className="rounded-lg p-1.5 text-indigo-300 hover:bg-white/10 hover:text-white">
            {fechado ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav className="space-y-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              title={fechado ? label : undefined}
              className={`relative flex w-full items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition ${fechado ? 'justify-center px-0' : 'px-3'} ${tab === id ? 'bg-white/15 text-white' : 'text-indigo-200 hover:bg-white/5 hover:text-white'}`}
            >
              <Icon size={18} strokeWidth={1.9} className="shrink-0" />
              {!fechado && label}
              {badge(id) &&
                (fechado ? (
                  <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-red-500" />
                ) : (
                  <span className="ml-auto rounded-full bg-red-500 px-2 text-xs font-semibold">{badge(id)}</span>
                ))}
            </button>
          ))}
        </nav>
        <div className={`mt-auto space-y-1.5 text-xs text-indigo-300 ${fechado ? 'flex flex-col items-center' : 'px-2'}`}>
          {fechado ? (
            <span title={SYNC[sync][1]} className={`mb-2 h-2 w-2 rounded-full ${SYNC[sync][0]}`} />
          ) : (
            <SyncDot sync={sync} />
          )}
          <button onClick={() => supabase.auth.signOut()} title={`Sair (${user.email})`} className="mb-3 flex items-center gap-1.5 text-indigo-400 hover:text-white">
            <LogOut size={14} />
            {!fechado && 'Sair'}
          </button>
          {!fechado && (
            <>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" />RANKEN</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-400" />Gralha Azul</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-violet-400" />Pessoal</div>
            </>
          )}
        </div>
      </aside>

      <main className={`mx-auto w-full min-w-0 px-4 pt-6 pb-28 sm:px-8 sm:pt-10 sm:pb-12 ${fechado ? 'max-w-6xl' : 'max-w-5xl'}`}>
        <div className="mb-3 flex justify-end sm:hidden"><SyncDot sync={sync} dark /></div>
        <Page go={setTab} />
        {revisao && <Revisao item={revisao.id ? revisao : null} go={setTab} onClose={() => setRevisao(null)} />}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-slate-200 bg-white/95 pt-1.5 backdrop-blur sm:hidden">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={`relative flex min-w-0 flex-col items-center gap-1 py-1 text-[10px] font-medium ${tab === id ? 'text-ink' : 'text-slate-400'}`}>
            <Icon size={20} strokeWidth={tab === id ? 2.2 : 1.8} />
            {label}
            {badge(id) && <span className="absolute top-0 right-1/4 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{badge(id)}</span>}
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

  // Página da Lolis: link secreto, sem login (…/#lolis=TOKEN)
  const tokenLolis = (location.hash.match(/^#lolis=([a-f0-9]{20,})/) || [])[1];
  if (tokenLolis) return <LolisPublica token={tokenLolis} />;

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
