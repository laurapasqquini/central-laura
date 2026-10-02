-- Passo 1 das notificações: colar no SQL Editor do Supabase e clicar em Run.

-- Textos das notificações (o app escreve, a função lê)
alter table public.central_state add column if not exists agenda jsonb;

-- Aparelhos que recebem notificação (cada usuária só vê os seus)
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "dona le aparelhos" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "dona cria aparelhos" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "dona altera aparelhos" on public.push_subscriptions for update using (auth.uid() = user_id);
create policy "dona apaga aparelhos" on public.push_subscriptions for delete using (auth.uid() = user_id);

-- Relógio (pg_cron) e chamadas para a função (pg_net)
create extension if not exists pg_cron;
create extension if not exists pg_net;
