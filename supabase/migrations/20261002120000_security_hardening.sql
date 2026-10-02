-- Security hardening (local-first; review before applying anywhere else).
-- Scope is limited to changes that do not alter current app behavior.

-- 1. setlists / setlist_songs: RLS was disabled, so anyone with the public anon key
--    could read/write/delete. The app has no role/ownership model (all signed-in
--    users are treated equally), so writes are limited to authenticated users.
--    Anonymous reads are kept because the setlist service view
--    (/setlists/[id]/service) does not require login. The old editor/admin policies were inactive and would
--    block every user (roles default to 'viewer' and the app never sets them).
drop policy if exists "setlists read" on public.setlists;
drop policy if exists "setlists update by owner or admin" on public.setlists;
drop policy if exists "setlists write by editor" on public.setlists;
drop policy if exists "setlist_items read" on public.setlist_songs;
drop policy if exists "setlist_items write by editor" on public.setlist_songs;

alter table public.setlists enable row level security;
alter table public.setlist_songs enable row level security;

create policy setlists_public_read on public.setlists
  for select to anon, authenticated using (true);
create policy setlists_authenticated_write on public.setlists
  for all to authenticated using (true) with check (true);
create policy setlist_songs_public_read on public.setlist_songs
  for select to anon, authenticated using (true);
create policy setlist_songs_authenticated_write on public.setlist_songs
  for all to authenticated using (true) with check (true);

-- 2. profiles: the insert/update policies let a client set its own "role" column
--    (e.g. role = 'admin'). Restrict writable columns so role can only be changed
--    by privileged database roles. Columns used by the signup form stay writable.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, full_name, phone, display_name, lead, vocal, acoustic, electric,
              piano, bass, drum, sound, visual, live)
  on public.profiles to anon, authenticated;
grant update (full_name, phone, display_name, lead, vocal, acoustic, electric,
              piano, bass, drum, sound, visual, live)
  on public.profiles to authenticated;
