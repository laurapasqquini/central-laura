-- Agendamento das notificações: um relógio a cada 15 minutos.
-- Os horários de cada aviso são escolhidos no app (Rotinas → Notificações).

create table if not exists public.central_config (chave text primary key, valor text not null);
alter table public.central_config enable row level security; -- sem políticas: só o servidor lê
insert into public.central_config (chave, valor)
values ('cron_secret', md5(random()::text) || md5(random()::text))
on conflict (chave) do nothing;

select cron.schedule('central-auto', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://qkjqngddavxoqhnhbame.supabase.co/functions/v1/notificar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select valor from public.central_config where chave = 'cron_secret')),
    body := '{"auto":true}'::jsonb
  );
$$);
