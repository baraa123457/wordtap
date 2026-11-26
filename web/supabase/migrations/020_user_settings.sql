-- Migration 020: Cross-device account settings sync (Desktop Player, Extension, Web)

create table if not exists public.user_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
  on public.user_settings for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
  on public.user_settings for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
  on public.user_settings for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.upsert_user_settings(
  p_settings jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_merged jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.user_settings (user_id, settings, updated_at)
  values (v_uid, coalesce(p_settings, '{}'::jsonb), now())
  on conflict (user_id)
  do update set
    settings   = coalesce(public.user_settings.settings, '{}'::jsonb) || coalesce(excluded.settings, '{}'::jsonb),
    updated_at = now()
  returning settings into v_merged;

  return v_merged;
end;
$$;

revoke all on function public.upsert_user_settings(jsonb) from public, anon;
grant execute on function public.upsert_user_settings(jsonb) to authenticated;
