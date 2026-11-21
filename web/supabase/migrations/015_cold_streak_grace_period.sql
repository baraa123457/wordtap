-- Migration 015: 2-day cold streak grace period
-- Allows a stopped streak to remain cold for 2 days before breaking.
-- Practicing during the 2-day cold window restores and advances the streak.

create or replace function public.record_practice(p_xp integer, p_today date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_xp  integer := least(greatest(coalesce(p_xp, 0), 0), 500);
  s     public.user_stats;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.user_stats (user_id) values (v_uid)
  on conflict (user_id) do nothing;

  select * into s from public.user_stats where user_id = v_uid for update;

  if s.last_practice_date = p_today then
    -- Already practiced today: accumulate daily XP
    s.today_xp := s.today_xp + v_xp;
  elsif s.last_practice_date >= p_today - 3 then
    -- Practiced yesterday OR within 2 cold days (up to 3 days ago: p_today - 1, -2, -3):
    -- Cold streak is reignited and advanced!
    s.streak := coalesce(s.streak, 0) + 1;
    s.today_xp := v_xp;
  else
    -- More than 2 cold days passed without practice: restart streak at 1
    s.streak := 1;
    s.today_xp := v_xp;
  end if;

  update public.user_stats
     set xp                 = xp + v_xp,
         streak             = s.streak,
         best_streak        = greatest(best_streak, s.streak),
         last_practice_date = p_today,
         today_xp           = s.today_xp,
         updated_at         = now()
   where user_id = v_uid;
end;
$$;

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
    streak = excluded.streak,
    best_streak = greatest(excluded.best_streak, public.user_stats.best_streak),
    last_practice_date = coalesce(excluded.last_practice_date, public.user_stats.last_practice_date),
    updated_at = now();
end;
$$;

revoke all on function public.sync_user_streak(integer, integer, date) from public, anon;
grant execute on function public.sync_user_streak(integer, integer, date) to authenticated;
