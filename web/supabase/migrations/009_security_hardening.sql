-- Migration 009: Security Hardening & Principle of Least Privilege
-- 1. Explicit RLS policy for words insertion & optimized UID subquery caching
-- 2. Revoke execute privileges from PUBLIC and anon on all SECURITY DEFINER functions
-- 3. Strict Admin Role Verification on analytics RPC to prevent BOLA / broken access control

-- ---------------------------------------------------------------------------
-- 1. Words RLS Hardening
-- ---------------------------------------------------------------------------
drop policy if exists "words: insert own" on public.words;
create policy "words: insert own" on public.words
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "words: read own" on public.words;
create policy "words: read own" on public.words
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "words: update own" on public.words;
create policy "words: update own" on public.words
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "words: delete own" on public.words;
create policy "words: delete own" on public.words
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Ensure user_stats has strict role-scoped select policy
drop policy if exists "stats: read own" on public.user_stats;
create policy "stats: read own" on public.user_stats
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 2. Revoke Public / Anon Execute Privileges on all Security Definer Functions
-- ---------------------------------------------------------------------------
revoke all on function public.delete_user_account() from public, anon;
grant execute on function public.delete_user_account() to authenticated;

revoke all on function public.delete_word(uuid) from public, anon;
grant execute on function public.delete_word(uuid) to authenticated;

revoke all on function public.delete_word_by_text(text, text) from public, anon;
grant execute on function public.delete_word_by_text(text, text) to authenticated;

revoke all on function public.save_word(text, text, text, text, text, text, integer) from public, anon;
grant execute on function public.save_word(text, text, text, text, text, text, integer) to authenticated;

revoke all on function public.review_word(uuid, boolean) from public, anon;
grant execute on function public.review_word(uuid, boolean) to authenticated;

revoke all on function public.record_practice(integer, date) from public, anon;
grant execute on function public.record_practice(integer, date) to authenticated;

revoke all on function public.set_daily_goal(integer) from public, anon;
grant execute on function public.set_daily_goal(integer) to authenticated;

revoke all on function public.sync_user_streak(integer, integer, date) from public, anon;
grant execute on function public.sync_user_streak(integer, integer, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Hardened Admin Analytics Function
-- Checks auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' (tamper-proof claims)
-- ---------------------------------------------------------------------------
create or replace function public.get_funnel_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_res jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Verify admin role via server-controlled app_metadata (cannot be modified by end users via user_metadata)
  v_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  if v_role <> 'admin' then
    raise exception 'access denied: admin privileges required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'signups', count(*) filter (where event_name = 'signup'),
    'extensionConnected', count(*) filter (where event_name = 'extension_connected'),
    'firstWordSaved', count(*) filter (where event_name = 'first_word_saved'),
    'firstPracticeCompleted', count(*) filter (where event_name = 'first_practice_completed'),
    'day2Return', count(*) filter (where event_name = 'day2_return'),
    'day7Return', count(*) filter (where event_name = 'day7_return'),
    'activePracticers3Days', coalesce((
      select count(distinct user_id)
      from (
        select user_id, count(distinct date(created_at)) as practice_days
        from public.analytics_events
        where event_name in ('first_practice_completed', 'day2_return', 'day7_return')
        group by user_id
        having count(distinct date(created_at)) >= 3
      ) sub
    ), 0)
  ) into v_res
  from public.analytics_events;

  return v_res;
end;
$$;

revoke all on function public.get_funnel_analytics() from public, anon;
grant execute on function public.get_funnel_analytics() to authenticated;
