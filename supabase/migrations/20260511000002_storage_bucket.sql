-- Add image storage so users can access their vault images from any device.
-- Bucket is PRIVATE (public=false). The API generates time-limited signed URLs
-- on demand using the service-role key. Client-side code never talks to
-- Storage directly. Per-user isolation is enforced in the API layer using the
-- Clerk user_id (this app does not use Supabase Auth).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vault-images',
  'vault-images',
  false,
  10 * 1024 * 1024,           -- 10 MB hard cap per image
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Track the storage path on each post so we can render images cross-device.
alter table public.posts
  add column if not exists image_path text;
