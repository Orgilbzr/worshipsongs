-- Create profiles from auth.users for NEW clients only.
-- Backward compatible: the trigger acts only when the client sends the deployment
-- marker profile_trigger_v1 = true. Old clients (no marker) keep inserting their
-- own profile. The marker is NOT authorization; it only selects who creates the row.
-- Only approved fields are read from raw_user_meta_data; "role" is never copied
-- and keeps its database default ('viewer').

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if (m->>'profile_trigger_v1') is distinct from 'true' then
    return new;
  end if;

  insert into public.profiles (
    id, full_name, phone,
    lead, vocal, acoustic, electric, piano, bass, drum, sound, visual, live
  ) values (
    new.id,
    left(nullif(btrim(m->>'full_name'), ''), 200),
    left(nullif(btrim(m->>'phone'), ''), 50),
    coalesce((m->>'lead') = 'true', false),
    coalesce((m->>'vocal') = 'true', false),
    coalesce((m->>'acoustic') = 'true', false),
    coalesce((m->>'electric') = 'true', false),
    coalesce((m->>'piano') = 'true', false),
    coalesce((m->>'bass') = 'true', false),
    coalesce((m->>'drum') = 'true', false),
    coalesce((m->>'sound') = 'true', false),
    coalesce((m->>'visual') = 'true', false),
    coalesce((m->>'live') = 'true', false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
