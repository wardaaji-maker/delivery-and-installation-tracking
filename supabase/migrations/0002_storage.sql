-- Storage bucket for installation/delivery photo reports.
-- Run after 0001_init.sql.

insert into storage.buckets (id, name, public)
values ('photo-reports', 'photo-reports', true)
on conflict (id) do nothing;

-- Any authenticated driver/admin can upload into their own folder: {auth.uid()}/...
create policy "photo-reports: authenticated upload"
  on storage.objects for insert
  with check (
    bucket_id = 'photo-reports'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read (bucket is public) — needed so <img> tags and the gallery work without signed URLs.
create policy "photo-reports: public read"
  on storage.objects for select
  using (bucket_id = 'photo-reports');

create policy "photo-reports: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'photo-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
