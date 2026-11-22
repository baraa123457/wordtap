-- Migration 016: Always continue streak on cold practice return
-- When a user returns from a cold streak, do NOT reset streak to 1.
-- Preserve their hard-earned progress and advance the streak (+1).

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
  else
    -- Streak was cold or new day: continue and advance the streak (+1) instead of resetting to 1!
    s.streak := greatest(coalesce(s.streak, 0), coalesce(s.best_streak, 0), 0) + 1;
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

revoke all on function public.record_practice(integer, date) from public, anon;
grant execute on function public.record_practice(integer, date) to authenticated;
