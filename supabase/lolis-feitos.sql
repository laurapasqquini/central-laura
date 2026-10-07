-- O que a Lolis marca como feito na página dela: a central da Laura lê e dá baixa sozinha.
-- Colar no SQL Editor do Supabase e clicar em Run (uma vez só, depois do lolis.sql).

create table if not exists public.lolis_feitos (
  token text not null references public.lolis_pagina(token) on delete cascade,
  dia text not null,
  chave text not null,
  em timestamptz not null default now(),
  primary key (token, dia, chave)
);
alter table public.lolis_feitos enable row level security;
-- a Laura lê os feitos do link dela; a Lolis só mexe pelas funções abaixo (com o link)
create policy "dona le feitos" on public.lolis_feitos for select
  using (exists (select 1 from public.lolis_pagina p where p.token = lolis_feitos.token and p.user_id = auth.uid()));

create or replace function public.lolis_marcar(p_token text, p_dia text, p_chave text, p_feito boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from lolis_pagina where token = p_token) then raise exception 'link inválido'; end if;
  if p_feito then
    insert into lolis_feitos (token, dia, chave) values (p_token, p_dia, p_chave) on conflict do nothing;
  else
    delete from lolis_feitos where token = p_token and dia = p_dia and chave = p_chave;
  end if;
end $$;

create or replace function public.lolis_feitos_do_dia(p_token text, p_dia text)
returns setof text language sql security definer set search_path = public as $$
  select chave from lolis_feitos where token = p_token and dia = p_dia
$$;

revoke all on function public.lolis_marcar(text, text, text, boolean) from public;
revoke all on function public.lolis_feitos_do_dia(text, text) from public;
grant execute on function public.lolis_marcar(text, text, text, boolean) to anon, authenticated;
grant execute on function public.lolis_feitos_do_dia(text, text) to anon, authenticated;
alter publication supabase_realtime add table public.lolis_feitos;
