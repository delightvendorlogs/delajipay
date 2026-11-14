alter table public.support_messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime text;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('support-attachments','support-attachments',false,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "Support participants can upload chat images" on storage.objects;
create policy "Support participants can upload chat images"
on storage.objects for insert to authenticated
with check (
  bucket_id='support-attachments'
  and cardinality(storage.foldername(name))=2
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and exists (
    select 1 from public.support_conversations c
    where c.id=((storage.foldername(name))[1])::uuid
      and ((c.user_id=(select auth.uid()) and c.status='open')
        or (select auth.jwt()->'app_metadata'->>'role')='admin')
  )
);

drop policy if exists "Support participants can view chat images" on storage.objects;
create policy "Support participants can view chat images"
on storage.objects for select to authenticated
using (
  bucket_id='support-attachments'
  and cardinality(storage.foldername(name))=2
  and exists (
    select 1 from public.support_conversations c
    where c.id=((storage.foldername(name))[1])::uuid
      and (c.user_id=(select auth.uid())
        or (select auth.jwt()->'app_metadata'->>'role')='admin')
  )
);