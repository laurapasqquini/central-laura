// Envia as notificações da Central da Laura.
// - Agendado (pg_cron): POST {"slot":"manha"|"tarde"|"noite"} com o cabeçalho x-cron-secret.
//   Lê a coluna "agenda" de cada usuária (escrita pelo próprio app) e manda o texto do dia/horário.
// - Teste pelo app: POST {"test":true} com o login da usuária (Authorization: Bearer <token>).
// Segredos (Edge Functions > Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const APP_URL = 'https://laurapasqquini.github.io/central-laura/';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// .trim(): segredos colados no painel às vezes vêm com quebra de linha/espaço no fim
const env = (k: string) => (Deno.env.get(k) ?? '').trim();
webpush.setVapidDetails('mailto:contato@thbsistemas.com.br', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// Data de hoje no horário de Brasília (UTC-3, sem horário de verão)
const hojeBR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

async function enviar(userId: string, payload: Record<string, unknown>) {
  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', userId);
  let ok = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ url: APP_URL, ...payload }), { TTL: 3 * 3600 });
      ok++;
    } catch (e) {
      // aparelho desinstalou ou revogou: tira da lista
      if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      else console.error('push falhou', e?.statusCode, e?.body);
    }
  }
  return ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const body = await req.json().catch(() => ({}));

  if (body.test) {
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data } = await admin.auth.getUser(jwt);
    if (!data?.user) return json({ erro: 'sem login' }, 401);
    const n = await enviar(data.user.id, { title: '🔔 Notificações ligadas!', body: 'É assim que a Central vai te cutucar. 💚', tag: 'teste' });
    return json({ enviadas: n });
  }

  if ((req.headers.get('x-cron-secret') ?? '').trim() !== env('CRON_SECRET')) return json({ erro: 'proibido' }, 403);
  const slot = String(body.slot ?? '');
  const date = hojeBR();
  const { data: rows } = await admin.from('central_state').select('user_id, agenda');
  let total = 0;
  for (const r of rows ?? []) {
    const msg = r.agenda?.[date]?.[slot];
    if (msg) total += await enviar(r.user_id, { ...msg, tag: `${date}-${slot}` });
  }
  return json({ slot, date, total });
});
