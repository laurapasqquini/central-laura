import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { inputCls } from '../components/ui';

const MSG = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'User already registered': 'Esse e-mail já tem conta. Use "Entrar".',
  'Signups not allowed for this instance': 'Cadastro fechado. Use "Entrar".',
  'Email not confirmed': 'Confirme o e-mail (ou desligue "Confirm email" no Supabase).',
};

export default function Login() {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const fn = mode === 'in' ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { data, error } = await fn.call(supabase.auth, { email, password: pass });
    setBusy(false);
    if (error) return setErr(MSG[error.message] || error.message);
    if (mode === 'up' && !data.session) setErr('Conta criada. Confirme pelo link no e-mail e depois entre.');
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ink px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl bg-paper p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-11 w-11" />
          <div>
            <h1 className="text-xl font-bold text-ink">Central da Laura</h1>
            <p className="text-xs text-slate-500">RANKEN · Gralha Azul · Pessoal</p>
          </div>
        </div>
        <input className={inputCls} type="email" required autoComplete="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className={inputCls}
          type="password"
          required
          minLength={6}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          placeholder="Senha"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-ink py-3 text-sm font-bold text-white disabled:opacity-50">
          {busy ? '…' : mode === 'in' ? 'Entrar' : 'Criar minha conta'}
        </button>
        <button type="button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')} className="w-full text-center text-sm font-semibold text-indigo-600">
          {mode === 'in' ? 'Primeira vez? Criar conta' : 'Já tenho conta: entrar'}
        </button>
      </form>
    </div>
  );
}
