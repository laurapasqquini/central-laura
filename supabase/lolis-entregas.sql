-- Entregas (ex.: troféus entregues na casa dos atletas): a Lolis preenche o endereço de cada atleta
-- na página dela (pelo link, sem login) e a Laura acompanha na central.
-- Colar no SQL Editor do Supabase e clicar em Run (uma vez só, depois do lolis.sql).
-- A lista de atletas NÃO fica neste arquivo (o código é público): ela entra por um SQL à parte.

create table if not exists public.lolis_entregas (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lista text not null,
  ordem int not null default 0,
  grupo text,
  classe text,
  colocacao int,
  nome text not null,
  telefone text,
  endereco text,
  bairro text,
  obs text,
  entregue date,
  atualizado_em timestamptz not null default now()
);
alter table public.lolis_entregas enable row level security;
create policy "dona le entregas" on public.lolis_entregas for select using (auth.uid() = user_id);
create policy "dona cria entregas" on public.lolis_entregas for insert with check (auth.uid() = user_id);
create policy "dona altera entregas" on public.lolis_entregas for update using (auth.uid() = user_id);
create policy "dona apaga entregas" on public.lolis_entregas for delete using (auth.uid() = user_id);

-- A Lolis lê as entregas pelo link da página dela
create or replace function public.lolis_entregas_ler(p_token text)
returns setof public.lolis_entregas language sql security definer set search_path = public as $$
  select e.* from lolis_entregas e join lolis_pagina l on l.user_id = e.user_id
  where l.token = p_token and length(p_token) >= 20
  order by e.lista, e.ordem, e.id
$$;

-- e grava o endereço, o bairro, a observação e se já foi entregue
create or replace function public.lolis_entregas_salvar(p_token text, p_id bigint, p_endereco text, p_bairro text, p_obs text, p_entregue date)
returns void language plpgsql security definer set search_path = public as $$
declare dona uuid;
begin
  select user_id into dona from lolis_pagina where token = p_token and length(p_token) >= 20;
  if dona is null then raise exception 'link inválido'; end if;
  update lolis_entregas set endereco = p_endereco, bairro = p_bairro, obs = p_obs, entregue = p_entregue, atualizado_em = now()
  where id = p_id and user_id = dona;
end $$;

revoke all on function public.lolis_entregas_ler(text) from public;
revoke all on function public.lolis_entregas_salvar(text, bigint, text, text, text, date) from public;
grant execute on function public.lolis_entregas_ler(text) to anon, authenticated;
grant execute on function public.lolis_entregas_salvar(text, bigint, text, text, text, date) to anon, authenticated;
alter publication supabase_realtime add table public.lolis_entregas;
