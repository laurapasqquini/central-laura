-- Ponto da Lolis: ela marca "Cheguei" e "Saí" na página dela (pelo link, sem login);
-- a Laura acompanha na central (Ranken › Lolis › Ponto) e pode corrigir ou marcar falta/folga.
-- Colar no SQL Editor do Supabase e clicar em Run (uma vez só, depois do lolis.sql).
-- O histórico fica com a dona (user_id), não com o link: trocar o link não apaga o ponto.

create table if not exists public.lolis_ponto (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dia date not null,
  tipo text not null check (tipo in ('entrada', 'saida', 'falta', 'folga')),
  em timestamptz,
  origem text not null default 'lolis',
  obs text,
  primary key (user_id, dia, tipo)
);
alter table public.lolis_ponto enable row level security;
create policy "dona le ponto" on public.lolis_ponto for select using (auth.uid() = user_id);
create policy "dona cria ponto" on public.lolis_ponto for insert with check (auth.uid() = user_id);
create policy "dona altera ponto" on public.lolis_ponto for update using (auth.uid() = user_id);
create policy "dona apaga ponto" on public.lolis_ponto for delete using (auth.uid() = user_id);

-- A Lolis bate o ponto pelo link. Entrada: vale a primeira do dia. Saída: vale a última.
create or replace function public.lolis_ponto_bater(p_token text, p_tipo text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare dona uuid; hoje date := (now() at time zone 'America/Sao_Paulo')::date; quando timestamptz;
begin
  select user_id into dona from lolis_pagina where token = p_token and length(p_token) >= 20;
  if dona is null then raise exception 'link inválido'; end if;
  if p_tipo not in ('entrada', 'saida') then raise exception 'tipo não permitido'; end if;
  if p_tipo = 'entrada' then
    insert into lolis_ponto (user_id, dia, tipo, em) values (dona, hoje, 'entrada', now()) on conflict do nothing;
  else
    insert into lolis_ponto (user_id, dia, tipo, em) values (dona, hoje, 'saida', now())
    on conflict (user_id, dia, tipo) do update set em = now(), origem = 'lolis';
  end if;
  select em into quando from lolis_ponto where user_id = dona and dia = hoje and tipo = p_tipo;
  return quando;
end $$;

-- O ponto de hoje, para a página dela mostrar
create or replace function public.lolis_ponto_hoje(p_token text)
returns table (tipo text, em timestamptz) language sql security definer set search_path = public as $$
  select p.tipo, p.em from lolis_ponto p join lolis_pagina l on l.user_id = p.user_id
  where l.token = p_token and length(p_token) >= 20 and p.dia = (now() at time zone 'America/Sao_Paulo')::date
$$;

revoke all on function public.lolis_ponto_bater(text, text) from public;
revoke all on function public.lolis_ponto_hoje(text) from public;
grant execute on function public.lolis_ponto_bater(text, text) to anon, authenticated;
grant execute on function public.lolis_ponto_hoje(text) to anon, authenticated;
alter publication supabase_realtime add table public.lolis_ponto;
