-- Anexos das tarefas (imagens coladas com Ctrl+V): ficam num espaço privado do Supabase Storage.
-- Cada arquivo fica na pasta da dona (user_id/tarefa/arquivo.jpg) e só ela lê e grava.
-- A página da Lolis recebe links temporários (assinados) que a central gera ao publicar.
-- Colar no SQL Editor do Supabase e clicar em Run (uma vez só).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anexos', 'anexos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "dona sobe anexos" on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "dona le anexos" on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "dona apaga anexos" on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text);
