-- Storage policies for the experiment-photos bucket.
--
-- The bucket was created with two policies and no others:
--
--   "Authenticated users can upload"  INSERT  with check (auth.role() = 'authenticated')
--   "Anyone can view images"          SELECT  using (bucket_id = 'experiment-photos')
--
-- Three problems with that.
--
-- 1. There is no DELETE policy at all, so the app has never actually been able
--    to remove a photo. `supabase.storage.remove()` is denied by RLS and the
--    result is discarded, so the bin's 30-day purge silently leaves every image
--    behind, and replacing a photo leaks the old one. As of this migration the
--    bucket holds 24 objects, 9 of which nothing references any more.
--
-- 2. The upload policy checks only that the caller is signed in — not which
--    bucket, and not which path. Any authenticated account could write objects
--    into any other user's `<uid>/` prefix.
--
-- 3. The bucket has no file_size_limit and no allowed_mime_types, so the only
--    thing stopping a 500 MB upload of an arbitrary file type is
--    validateImage() in the client, which anyone talking to the API directly
--    can skip.
--
-- Every object in the bucket is already stored under `<auth.uid()>/<uuid>.<ext>`
-- (see uploadImage in src/lib/utils/image.ts), so scoping by the first path
-- segment locks nothing existing out.
--
-- Reads stay public: the bucket is public and the app stores getPublicUrl()
-- results in the database, which the PDF export and every <img> then load
-- without a session.
--
-- Idempotent and wrapped in a transaction: safe to run once, safe to re-run.
-- Run in the Supabase SQL editor.
--------------------------------------------------------------------------------

begin;

-- ── 1. Server-side counterpart to validateImage() ────────────────────────────
update storage.buckets
set file_size_limit   = 10485760,  -- 10 MB, matching MAX_IMAGE_BYTES
    allowed_mime_types = array['image/jpeg', 'image/png']
where id = 'experiment-photos';

-- ── 2. Replace the two original policies ─────────────────────────────────────
drop policy if exists "Authenticated users can upload" on storage.objects;
drop policy if exists "Anyone can view images" on storage.objects;

drop policy if exists "experiment-photos: public read" on storage.objects;
create policy "experiment-photos: public read" on storage.objects
  for select using (bucket_id = 'experiment-photos');

drop policy if exists "experiment-photos: insert own" on storage.objects;
create policy "experiment-photos: insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'experiment-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "experiment-photos: update own" on storage.objects;
create policy "experiment-photos: update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'experiment-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'experiment-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- The one that was missing. Without it removeUnreferencedImages() is a no-op.
drop policy if exists "experiment-photos: delete own" on storage.objects;
create policy "experiment-photos: delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'experiment-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
