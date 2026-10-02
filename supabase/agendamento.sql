-- Passo 3 das notificações: colar no SQL Editor do Supabase e clicar em Run.
-- Cria a senha do agendamento dentro do banco (ninguém precisa copiar) e agenda os 3 horários.
-- Horários em UTC: 10:30 = 7h30, 16:30 = 13h30, 21:00 = 18h (Brasília).

create table if not exists public.central_config (chave text primary key, valor text not null);
alter table public.central_config enable row level security; -- sem políticas: só o servidor lê
insert into public.central_config (chave, valor)
values ('cron_secret', md5(random()::text) || md5(random()::text))
on conflict (chave) do nothing;

select cron.schedule('central-manha', '30 10 * * *', $$
  select net.http_post(
    url := 'https://qkjqngddavxoqhnhbame.supabase.co/functions/v1/notificar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select valor from public.central_config where chave = 'cron_secret')),
    body := '{"slot":"manha"}'::jsonb
  );
$$);

select cron.schedule('central-tarde', '30 16 * * *', $$
  select net.http_post(
    url := 'https://qkjqngddavxoqhnhbame.supabase.co/functions/v1/notificar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select valor from public.central_config where chave = 'cron_secret')),
    body := '{"slot":"tarde"}'::jsonb
  );
$$);

select cron.schedule('central-noite', '0 21 * * *', $$
  select net.http_post(
    url := 'https://qkjqngddavxoqhnhbame.supabase.co/functions/v1/notificar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select valor from public.central_config where chave = 'cron_secret')),
    body := '{"slot":"noite"}'::jsonb
  );
$$);
