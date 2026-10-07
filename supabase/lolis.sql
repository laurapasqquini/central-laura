-- Página da Lolis: a central publica aqui o dia dela; a página lê pelo link secreto (sem login).
-- Colar no SQL Editor do Supabase e clicar em Run (uma vez só).

create table if not exists public.lolis_pagina (
  token text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dados jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.lolis_pagina enable row level security;
create policy "dona le pagina" on public.lolis_pagina for select using (auth.uid() = user_id);
create policy "dona cria pagina" on public.lolis_pagina for insert with check (auth.uid() = user_id);
create policy "dona altera pagina" on public.lolis_pagina for update using (auth.uid() = user_id);
create policy "dona apaga pagina" on public.lolis_pagina for delete using (auth.uid() = user_id);

-- Quem tem o link lê só a página daquele link (e nada mais da central)
create or replace function public.pagina_lolis(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select dados from public.lolis_pagina where token = p_token and length(p_token) >= 20
$$;
revoke all on function public.pagina_lolis(text) from public;
grant execute on function public.pagina_lolis(text) to anon, authenticated;
