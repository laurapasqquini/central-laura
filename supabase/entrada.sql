-- Caixa de entrada do WhatsApp: a extensão do Chrome grava aqui, a central vira tarefa e apaga.
-- Colar no SQL Editor do Supabase e clicar em Run (uma vez só).

create table if not exists public.entrada (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conta text not null default 'ranken',
  contato text,
  texto text not null,
  hora text,
  created_at timestamptz not null default now()
);
alter table public.entrada enable row level security;
create policy "dona le entrada" on public.entrada for select using (auth.uid() = user_id);
create policy "dona cria entrada" on public.entrada for insert with check (auth.uid() = user_id);
create policy "dona apaga entrada" on public.entrada for delete using (auth.uid() = user_id);
alter publication supabase_realtime add table public.entrada;
