-- Notas da Lolis ao marcar uma tarefa: feito / não consegui + o que aconteceu.
-- Colar no SQL Editor do Supabase e clicar em Run (uma vez só, depois do lolis-feitos.sql).

alter table public.lolis_feitos add column if not exists status text not null default 'feito';
alter table public.lolis_feitos add column if not exists nota text;

-- grava (ou atualiza) o status e a nota de um item
create or replace function public.lolis_anotar(p_token text, p_dia text, p_chave text, p_status text, p_nota text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from lolis_pagina where token = p_token) then raise exception 'link inválido'; end if;
  insert into lolis_feitos (token, dia, chave, status, nota) values (p_token, p_dia, p_chave, coalesce(p_status, 'feito'), p_nota)
  on conflict (token, dia, chave) do update set status = excluded.status, nota = excluded.nota, em = now();
end $$;

-- tudo o que ela marcou no dia, com status e nota
create or replace function public.lolis_marcados_do_dia(p_token text, p_dia text)
returns table (chave text, status text, nota text) language sql security definer set search_path = public as $$
  select chave, status, nota from lolis_feitos where token = p_token and dia = p_dia
$$;

revoke all on function public.lolis_anotar(text, text, text, text, text) from public;
revoke all on function public.lolis_marcados_do_dia(text, text) from public;
grant execute on function public.lolis_anotar(text, text, text, text, text) to anon, authenticated;
grant execute on function public.lolis_marcados_do_dia(text, text) to anon, authenticated;

-- Extensão no computador da Lolis (sem a senha da Laura): manda só ganhadores e programação do Hub,
-- usando o link da página dela. Cai na caixa de entrada da Laura, que a central processa.
create or replace function public.lolis_enviar(p_token text, p_conta text, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
declare dona uuid;
begin
  select user_id into dona from lolis_pagina where token = p_token;
  if dona is null then raise exception 'link inválido'; end if;
  if p_conta not in ('ganhadores', 'programacao') then raise exception 'tipo não permitido'; end if;
  insert into entrada (user_id, conta, contato, texto) values (dona, p_conta, 'Extensão da Lolis', p_texto);
end $$;
revoke all on function public.lolis_enviar(text, text, text) from public;
grant execute on function public.lolis_enviar(text, text, text) to anon, authenticated;
