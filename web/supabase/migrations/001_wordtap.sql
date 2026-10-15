-- WordTap schema: saved words, practice progress, XP and streak.
-- Run once in the Supabase SQL editor (or with the Supabase CLI).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.words (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text            text not null check (char_length(text) between 1 and 200),
  translation     text not null check (char_length(translation) between 1 and 500),
  src_lang        text not null default 'auto',
  target_lang     text not null,
  source_title    text not null default '',
  source_url      text not null default '',
  times_seen      integer not null default 1 check (times_seen >= 1),
  -- Leitner box 0..5. Higher box = better known = longer wait before the next review.
  box             smallint not null default 0 check (box between 0 and 5),
  next_review     timestamptz not null default now(),
  correct_count   integer not null default 0,
  wrong_count     integer not null default 0,
  last_practiced  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One row per word per source language per target language per user (case-insensitive).
create unique index if not exists words_user_text_lang_idx
  on public.words (user_id, lower(text), target_lang, src_lang);
create index if not exists words_user_due_idx
  on public.words (user_id, next_review);

create table if not exists public.user_stats (
  user_id            uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  xp                 integer not null default 0,
  streak             integer not null default 0,
  best_streak        integer not null default 0,
  last_practice_date date,
  today_xp           integer not null default 0,
  daily_goal         integer not null default 20 check (daily_goal between 10 and 500),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security: every row belongs to exactly one user.
-- Writes go through the functions below, so only read/delete are exposed directly.
-- ---------------------------------------------------------------------------

alter table public.words enable row level security;
alter table public.user_stats enable row level security;

drop policy if exists "words: read own" on public.words;
create policy "words: read own" on public.words
  for select using (user_id = auth.uid());

drop policy if exists "words: delete own" on public.words;
create policy "words: delete own" on public.words
  for delete using (user_id = auth.uid());

drop policy if exists "words: update own" on public.words;
create policy "words: update own" on public.words
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "stats: read own" on public.user_stats;
create policy "stats: read own" on public.user_stats
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Called by the browser extension (and anything else) to save a translated word.
-- Saving a word that already exists bumps its counter instead of duplicating it.
create or replace function public.save_word(
  p_text          text,
  p_translation   text,
  p_src_lang      text default 'auto',
  p_target_lang   text default 'ar',
  p_source_title  text default '',
  p_source_url    text default '',
  p_times         integer default 1
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_times integer := greatest(coalesce(p_times, 1), 1);
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if btrim(coalesce(p_text, '')) = '' or btrim(coalesce(p_translation, '')) = '' then
    raise exception 'text and translation are required' using errcode = '22023';
  end if;

  insert into public.words as w
    (user_id, text, translation, src_lang, target_lang, source_title, source_url, times_seen)
  values
    (v_uid,
     left(btrim(p_text), 200),
     left(btrim(p_translation), 500),
     coalesce(nullif(btrim(p_src_lang), ''), 'auto'),
     p_target_lang,
     left(coalesce(p_source_title, ''), 300),
     left(coalesce(p_source_url, ''), 1000),
     v_times)
  on conflict (user_id, lower(text), target_lang, src_lang)
  do update set
    translation  = excluded.translation,
    times_seen   = w.times_seen + v_times,
    source_title = case when excluded.source_title <> '' then excluded.source_title else w.source_title end,
    source_url   = case when excluded.source_url   <> '' then excluded.source_url   else w.source_url   end,
    updated_at   = now()
  returning w.id into v_id;

  return v_id;
end;
$$;

-- Records one practice answer (first attempt in a session) and schedules the next review.
-- Wrong answer: drop one box and make the word due again right away.
-- Right answer: move up one box and wait 1, 3, 7, 14 or 30 days.
create or replace function public.review_word(p_word_id uuid, p_correct boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_box       smallint;
  v_intervals integer[] := array[0, 1, 3, 7, 14, 30];
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select box into v_box
    from public.words
   where id = p_word_id and user_id = v_uid
     for update;
  if not found then
    raise exception 'word not found' using errcode = 'P0002';
  end if;

  if p_correct then
    v_box := least(v_box + 1, 5);
  else
    v_box := greatest(v_box - 1, 0);
  end if;

  update public.words
     set box            = v_box,
         next_review    = case when p_correct
                               then now() + make_interval(days => v_intervals[v_box + 1])
                               else now() end,
         correct_count  = correct_count + case when p_correct then 1 else 0 end,
         wrong_count    = wrong_count   + case when p_correct then 0 else 1 end,
         last_practiced = now(),
         updated_at     = now()
   where id = p_word_id and user_id = v_uid;
end;
$$;

-- Adds XP and keeps the daily streak. The client passes its own local date so the
-- streak follows the learner's day, not the server's.
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
    s.today_xp := s.today_xp + v_xp;
  elsif s.last_practice_date = p_today - 1 then
    s.streak := s.streak + 1;
    s.today_xp := v_xp;
  else
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

create or replace function public.set_daily_goal(p_goal integer)
returns void
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

  insert into public.user_stats (user_id, daily_goal)
  values (v_uid, least(greatest(p_goal, 10), 500))
  on conflict (user_id)
  do update set daily_goal = excluded.daily_goal, updated_at = now();
end;
$$;

-- Only signed-in users may call the functions.
revoke all on function public.save_word(text, text, text, text, text, text, integer) from public, anon;
revoke all on function public.review_word(uuid, boolean) from public, anon;
revoke all on function public.record_practice(integer, date) from public, anon;
revoke all on function public.set_daily_goal(integer) from public, anon;
grant execute on function public.save_word(text, text, text, text, text, text, integer) to authenticated;
grant execute on function public.review_word(uuid, boolean) to authenticated;
grant execute on function public.record_practice(integer, date) to authenticated;
grant execute on function public.set_daily_goal(integer) to authenticated;
