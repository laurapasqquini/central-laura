import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { pushSupported, isIOS, isInstalled, currentSubscription, enablePush, disablePush, sendTest } from '../lib/push';

const SLOTS = [
  ['manha', '☀️ 7h30', 'Resumo do dia'],
  ['tarde', '⏰ 13h30', 'Só se tiver urgente ou atrasado'],
  ['noite', '🌙 18h', 'O que falta de hoje + amanhã'],
];

// Estado deste aparelho: 'carregando' | 'sem-suporte' | 'instalar' | 'bloqueado' | 'desligado' | 'ligado'
function useDeviceState() {
  const [st, setSt] = useState('carregando');
  const refresh = async () => {
    if (isIOS() && !isInstalled()) return setSt('instalar');
    if (!pushSupported()) return setSt('sem-suporte');
    if (Notification.permission === 'denied') return setSt('bloqueado');
    setSt((await currentSubscription()) ? 'ligado' : 'desligado');
  };
  useEffect(() => {
    refresh();
  }, []);
  return [st, refresh];
}

export function NotifCard() {
  const { state, user, setNotif } = useStore();
  const [st, refresh] = useDeviceState();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const cfg = { manha: true, tarde: true, noite: true, ...(state.notif || {}) };

  const run = async (fn, ok) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      setMsg(ok);
    } catch (e) {
      setMsg(e.message === 'permissao' ? 'Você não permitiu as notificações.' : `Não deu certo: ${e.message}`);
    }
    setBusy(false);
    refresh();
  };

  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-ink">🔔 Notificações</div>
          <p className="text-sm text-slate-500">A Central te cutuca sozinha, mesmo com o app fechado.</p>
        </div>
        {st === 'ligado' && <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">✓ ativas aqui</span>}
      </div>

      {st === 'instalar' && (
        <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          No iPhone, as notificações só funcionam com a Central instalada: no <b>Safari</b>, toque em <b>Compartilhar</b> → <b>Adicionar à Tela de Início</b>, e abra pelo ícone.
        </div>
      )}
      {st === 'sem-suporte' && <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">Este navegador não aceita notificações. Use Chrome ou Edge no computador, ou a Central instalada no iPhone.</div>}
      {st === 'bloqueado' && (
        <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800">
          As notificações foram bloqueadas neste aparelho. Libere nas configurações do navegador (cadeado ao lado do endereço) ou, no iPhone, em Ajustes → Notificações → Central.
        </div>
      )}

      {st === 'desligado' && (
        <button disabled={busy} onClick={() => run(() => enablePush(user.id), 'Pronto! Toque em "Enviar teste" para conferir.')} className="w-full rounded-xl bg-ink py-3 text-sm font-bold text-white disabled:opacity-50">
          Ativar neste aparelho
        </button>
      )}

      {st === 'ligado' && (
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => run(sendTest, 'Teste enviado. Deve chegar em alguns segundos.')} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            Enviar teste
          </button>
          <button disabled={busy} onClick={() => run(disablePush, 'Desativadas neste aparelho.')} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
            Desativar aqui
          </button>
        </div>
      )}
      {msg && <p className="text-sm font-medium text-slate-600">{msg}</p>}

      <div className="space-y-2 border-t border-slate-100 pt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Horários (valem para todos os aparelhos)</div>
        {SLOTS.map(([k, hora, desc]) => (
          <label key={k} className="flex items-center justify-between gap-3">
            <span className="text-sm">
              <b className="text-slate-800">{hora}</b> <span className="text-slate-500">· {desc}</span>
            </span>
            <input type="checkbox" checked={cfg[k]} onChange={(e) => setNotif({ [k]: e.target.checked })} className="h-5 w-5 accent-emerald-600" />
          </label>
        ))}
      </div>
    </div>
  );
}

// Faixa na tela inicial enquanto este aparelho não estiver com notificações ligadas
export function NotifBanner({ onOpen }) {
  const [st] = useDeviceState();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('central:notif-banner') === 'off';
    } catch {
      return false;
    }
  });
  if (hidden || !['desligado', 'instalar'].includes(st)) return null;
  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem('central:notif-banner', 'off');
    } catch {
      /* ignora */
    }
  };
  return (
    <div className="flex items-center gap-3 rounded-xl bg-indigo-600 px-4 py-3 text-sm text-white shadow-sm">
      <span className="text-lg">🔔</span>
      <span className="flex-1">Quer que a Central te cutuque? Ative as notificações neste aparelho.</span>
      <button onClick={onOpen} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-indigo-700">Ativar</button>
      <button onClick={close} className="text-lg leading-none text-indigo-200" aria-label="Fechar">×</button>
    </div>
  );
}
