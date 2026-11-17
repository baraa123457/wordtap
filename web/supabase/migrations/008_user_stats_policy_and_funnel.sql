-- Migration 008: Add user_stats RLS write policies, atomic streak synchronization RPC,
-- and aggregated privacy-preserving funnel analytics RPC for the admin dashboard.

-- 1. Explicit RLS Update and Insert policies for user_stats (adhering to Supabase RLS security checklist)
drop policy if exists "stats: update own" on public.user_stats;
create policy "stats: update own" on public.user_stats
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "stats: insert own" on public.user_stats;
create policy "stats: insert own" on public.user_stats
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- 2. Atomic Security Definer RPC to synchronize reconciled streak without RLS or concurrency edge cases
create or replace function public.sync_user_streak(
  p_streak integer,
  p_best_streak integer,
  p_last_practice_date date default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.user_stats (user_id, streak, best_streak, last_practice_date)
  values (v_uid, greatest(coalesce(p_streak, 0), 0), greatest(coalesce(p_best_streak, 0), 0), p_last_practice_date)
  on conflict (user_id)
  do update set
    streak = greatest(excluded.streak, public.user_stats.streak),
    best_streak = greatest(excluded.best_streak, public.user_stats.best_streak),
    last_practice_date = coalesce(excluded.last_practice_date, public.user_stats.last_practice_date),
    updated_at = now();
end;
$$;

revoke all on function public.sync_user_streak(integer, integer, date) from public, anon;
grant execute on function public.sync_user_streak(integer, integer, date) to authenticated;

-- 3. Aggregated Funnel Analytics RPC
-- Computes aggregated funnel counts across all events without exposing individual user IDs or event logs.
create or replace function public.get_funnel_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_res jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
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
