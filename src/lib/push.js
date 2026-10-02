import { supabase } from './supabase';
import { VAPID_PUBLIC_KEY } from './vapid-public';

const FUNCTION_URL = 'https://qkjqngddavxoqhnhbame.supabase.co/functions/v1/notificar';
const ANON_KEY = 'sb_publishable_FHjECY55Hpu0apsz2y-PHw_aBm6O4FJ';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const toBytes = (b64) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

// Assinatura deste aparelho (ou null)
export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

// Pede permissão, assina este aparelho e guarda no Supabase
export async function enablePush(userId) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('permissao');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON();
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: j.endpoint, user_id: userId, p256dh: j.keys.p256dh, auth: j.keys.auth, device: navigator.userAgent.slice(0, 140) }, { onConflict: 'endpoint' });
  if (error) throw error;
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

// Pede ao Supabase para mandar uma notificação de teste para os aparelhos da usuária
export async function sendTest() {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${data.session?.access_token}` },
    body: JSON.stringify({ test: true }),
  });
  if (!res.ok) throw new Error(`servidor ${res.status}`);
  return res.json();
}
