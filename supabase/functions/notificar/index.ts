// Envia as notificações da Central da Laura.
// - Agendado (pg_cron): POST {"slot":"manha"|"tarde"|"noite"} com o cabeçalho x-cron-secret.
//   Lê a coluna "agenda" de cada usuária (escrita pelo próprio app) e manda o texto do dia/horário.
// - Teste pelo app: POST {"test":true} com o login da usuária (Authorization: Bearer <token>).
// Segredos (Edge Functions > Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY. A senha do agendamento fica na tabela central_config.
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
const agoraBR = () => new Date(Date.now() - 3 * 3600_000).toISOString(); // Brasília (UTC-3)
const hojeBR = () => agoraBR().slice(0, 10);
// Hora atual arredondada para o quarto de hora: "09:07" -> "09:00"
const quartoBR = () => {
  const hm = agoraBR().slice(11, 16);
  return `${hm.slice(0, 3)}${String(Math.floor(Number(hm.slice(3)) / 15) * 15).padStart(2, '0')}`;
};
const PADRAO: Record<string, string> = { manha: '09:00', tarde: '13:30', noite: '18:00' };

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

  // A senha do agendamento fica no próprio banco (tabela central_config, só o servidor lê)
  const { data: cfg } = await admin.from('central_config').select('valor').eq('chave', 'cron_secret').maybeSingle();
  if (!cfg?.valor || (req.headers.get('x-cron-secret') ?? '').trim() !== cfg.valor) return json({ erro: 'proibido' }, 403);
  const date = hojeBR();
  const quarto = quartoBR();
  const { data: rows } = await admin.from('central_state').select('user_id, agenda');
  let total = 0;
  for (const r of rows ?? []) {
    // auto: chamado a cada 15 min; manda os avisos cujo horário escolhido é agora
    const horarios = { ...PADRAO, ...(r.agenda?.horarios ?? {}) };
    const slots = body.auto ? Object.keys(PADRAO).filter((s) => horarios[s] === quarto) : [String(body.slot ?? '')];
    for (const slot of slots) {
      const msg = r.agenda?.[date]?.[slot];
      if (msg) total += await enviar(r.user_id, { ...msg, tag: `${date}-${slot}` });
    }
  }
  return json({ date, quarto, total });
});
