-- Migration 010: Interactive 4-Stage Vocabulary Learning System
-- Stages: 1. Understanding, 2. Contextual Learning (YouGlish-style videos),
--         3. Creating Your Own Sentence, 4. Spaced Repetition (FSRS)
-- Follows Supabase Postgres Best Practices:
-- - All foreign keys indexed
-- - All RLS policies use (select auth.uid()) for single-evaluation caching
-- - All SECURITY DEFINER RPCs pin search_path = public and revoke public/anon execute

-- ---------------------------------------------------------------------------
-- 1. Extend public.words with vocabulary metadata, stage tracking & FSRS state
-- ---------------------------------------------------------------------------
alter table public.words
  add column if not exists definition        text not null default '',
  add column if not exists pronunciation     text not null default '',
  add column if not exists part_of_speech    text not null default '',
  add column if not exists learning_status   text not null default 'new',
  add column if not exists current_stage     smallint not null default 1,
  add column if not exists completed_stages  smallint[] not null default '{}',
  add column if not exists attempts_count    integer not null default 0,
  add column if not exists fsrs_stability    double precision not null default 0,
  add column if not exists fsrs_difficulty   double precision not null default 5.0,
  add column if not exists fsrs_reps         integer not null default 0,
  add column if not exists fsrs_lapses       integer not null default 0,
  add column if not exists interval_days     double precision not null default 0,
  add column if not exists last_rating       smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'words_learning_status_check'
  ) then
    alter table public.words
      add constraint words_learning_status_check
      check (learning_status in ('new', 'learning', 'review', 'mastered'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'words_current_stage_check'
  ) then
    alter table public.words
      add constraint words_current_stage_check
      check (current_stage between 1 and 4);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'words_last_rating_check'
  ) then
    alter table public.words
      add constraint words_last_rating_check
      check (last_rating is null or last_rating between 1 and 4);
  end if;
end $$;

-- Backfill learning_status & FSRS defaults cleanly from existing Leitner progress
update public.words
set
  learning_status = case
    when box >= 4 then 'mastered'
    when box >= 2 then 'review'
    when correct_count + wrong_count > 0 then 'learning'
    else 'new'
  end,
  attempts_count = greatest(attempts_count, correct_count + wrong_count),
  fsrs_reps = greatest(fsrs_reps, correct_count),
  fsrs_lapses = greatest(fsrs_lapses, wrong_count),
  fsrs_stability = case
    when fsrs_stability > 0 then fsrs_stability
    when box >= 5 then 30.0
    when box = 4 then 14.0
    when box = 3 then 7.0
    when box = 2 then 3.0
    when box = 1 then 1.0
    else 0.0
  end
where learning_status = 'new' and (box > 0 or correct_count > 0 or wrong_count > 0);

create index if not exists words_user_status_due_idx
  on public.words (user_id, learning_status, next_review);

-- ---------------------------------------------------------------------------
-- 2. Extend public.user_stats with Daily Learning Session targets
-- ---------------------------------------------------------------------------
alter table public.user_stats
  add column if not exists daily_new_words_goal integer not null default 5,
  add column if not exists daily_reviews_goal   integer not null default 20;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_stats_daily_new_words_goal_check'
  ) then
    alter table public.user_stats
      add constraint user_stats_daily_new_words_goal_check
      check (daily_new_words_goal between 1 and 50);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_stats_daily_reviews_goal_check'
  ) then
    alter table public.user_stats
      add constraint user_stats_daily_reviews_goal_check
      check (daily_reviews_goal between 5 and 200);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Verified Video Examples Cache (Stage 2: YouGlish-style Contextual Learning)
-- ---------------------------------------------------------------------------
create table if not exists public.vocabulary_video_examples (
  id                   uuid primary key default gen_random_uuid(),
  word_normalized      text not null check (char_length(word_normalized) between 1 and 120),
  youtube_video_id     text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  video_title          text not null default '',
  channel_name         text not null default '',
  source               text not null default 'youtube' check (
                         source in ('youtube_supadata', 'youtube_filmot', 'user_subtitle', 'user_contributed')
                       ),
  timestamp_seconds    integer not null default 0 check (timestamp_seconds >= 0),
  verified_transcript  text not null check (char_length(verified_transcript) between 1 and 2000),
  context_sentence     text not null check (char_length(context_sentence) between 1 and 600),
  target_word_position integer not null default 0 check (target_word_position >= 0),
  caption_available    boolean not null default true,
  video_available      boolean not null default true,
  contributed_by       uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index if not exists vocab_video_examples_unique_clip_idx
  on public.vocabulary_video_examples (word_normalized, youtube_video_id, timestamp_seconds);

create index if not exists vocab_video_examples_word_avail_idx
  on public.vocabulary_video_examples (word_normalized, video_available)
  where video_available = true;

create index if not exists vocab_video_examples_contributed_by_idx
  on public.vocabulary_video_examples (contributed_by)
  where contributed_by is not null;

alter table public.vocabulary_video_examples enable row level security;

drop policy if exists "video_examples: read verified" on public.vocabulary_video_examples;
create policy "video_examples: read verified" on public.vocabulary_video_examples
  for select
  to authenticated
  using (video_available = true);

drop policy if exists "video_examples: insert own contribution" on public.vocabulary_video_examples;
create policy "video_examples: insert own contribution" on public.vocabulary_video_examples
  for insert
  to authenticated
  with check (contributed_by = (select auth.uid()));

drop policy if exists "video_examples: update own contribution" on public.vocabulary_video_examples;
create policy "video_examples: update own contribution" on public.vocabulary_video_examples
  for update
  to authenticated
  using (contributed_by = (select auth.uid()))
  with check (contributed_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. User Sentences & AI Evaluation Feedback (Stage 3)
-- ---------------------------------------------------------------------------
create table if not exists public.user_sentences (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  word_id              uuid not null references public.words (id) on delete cascade,
  word_text            text not null check (char_length(word_text) between 1 and 200),
  original_sentence    text not null check (char_length(original_sentence) between 1 and 600),
  is_correct           boolean not null default false,
  grammar_score        smallint not null default 0 check (grammar_score between 0 and 100),
  naturalness_feedback text not null default '',
  ai_feedback          jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

create index if not exists user_sentences_user_created_idx
  on public.user_sentences (user_id, created_at desc);

create index if not exists user_sentences_word_id_idx
  on public.user_sentences (word_id);

alter table public.user_sentences enable row level security;

drop policy if exists "user_sentences: read own" on public.user_sentences;
create policy "user_sentences: read own" on public.user_sentences
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_sentences: insert own" on public.user_sentences;
create policy "user_sentences: insert own" on public.user_sentences
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_sentences: delete own" on public.user_sentences;
create policy "user_sentences: delete own" on public.user_sentences
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 5. Review History (Stage 4 Spaced Repetition + Analytics)
-- ---------------------------------------------------------------------------
create table if not exists public.review_history (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  word_id               uuid not null references public.words (id) on delete cascade,
  review_date           timestamptz not null default now(),
  exercise_type         text not null check (
                          exercise_type in ('understanding', 'contextual_video', 'create_sentence', 'spaced_repetition')
                        ),
  answer                text not null default '',
  result                boolean not null,
  difficulty_rating     smallint check (difficulty_rating is null or difficulty_rating between 1 and 4),
  interval_days         double precision not null default 0,
  next_scheduled_review timestamptz
);

create index if not exists review_history_user_date_idx
  on public.review_history (user_id, review_date desc);

create index if not exists review_history_word_id_idx
  on public.review_history (word_id);

alter table public.review_history enable row level security;

drop policy if exists "review_history: read own" on public.review_history;
create policy "review_history: read own" on public.review_history
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "review_history: insert own" on public.review_history;
create policy "review_history: insert own" on public.review_history
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 6. Atomic RPCs for 4-Stage Progress Persistence & Daily Goals
-- ---------------------------------------------------------------------------
create or replace function public.record_learning_review(
  p_word_id           uuid,
  p_exercise_type     text,
  p_answer            text default '',
  p_result            boolean default true,
  p_rating            smallint default 3,
  p_learning_status   text default 'learning',
  p_current_stage     smallint default 4,
  p_completed_stages  smallint[] default array[1, 2, 3, 4]::smallint[],
  p_fsrs_stability    double precision default 1.0,
  p_fsrs_difficulty   double precision default 5.0,
  p_fsrs_reps         integer default 1,
  p_fsrs_lapses       integer default 0,
  p_interval_days     double precision default 1.0,
  p_next_review       timestamptz default now() + interval '1 day',
  p_box               smallint default 1,
  p_definition        text default null,
  p_pronunciation     text default null,
  p_part_of_speech    text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text := case
    when p_learning_status in ('new', 'learning', 'review', 'mastered') then p_learning_status
    else 'learning'
  end;
  v_stage smallint := least(greatest(coalesce(p_current_stage, 1), 1), 4);
  v_rating smallint := case when p_rating between 1 and 4 then p_rating else null end;
  v_box smallint := least(greatest(coalesce(p_box, 0), 0), 5);
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_exercise_type not in ('understanding', 'contextual_video', 'create_sentence', 'spaced_repetition') then
    raise exception 'invalid exercise_type' using errcode = '22023';
  end if;

  -- Lock & verify ownership
  perform 1 from public.words where id = p_word_id and user_id = v_uid for update;
  if not found then
    raise exception 'word not found' using errcode = 'P0002';
  end if;

  update public.words
     set learning_status  = v_status,
         current_stage    = v_stage,
         completed_stages = coalesce(p_completed_stages, completed_stages),
         attempts_count   = attempts_count + 1,
         correct_count    = correct_count + case when p_result then 1 else 0 end,
         wrong_count      = wrong_count + case when p_result then 0 else 1 end,
         fsrs_stability   = greatest(coalesce(p_fsrs_stability, 0), 0),
         fsrs_difficulty  = least(greatest(coalesce(p_fsrs_difficulty, 5.0), 1.0), 10.0),
         fsrs_reps        = greatest(coalesce(p_fsrs_reps, 0), 0),
         fsrs_lapses      = greatest(coalesce(p_fsrs_lapses, 0), 0),
         interval_days    = greatest(coalesce(p_interval_days, 0), 0),
         last_rating      = coalesce(v_rating, last_rating),
         box              = v_box,
         next_review      = coalesce(p_next_review, next_review),
         definition       = case when p_definition is not null and btrim(p_definition) <> '' then left(btrim(p_definition), 600) else definition end,
         pronunciation    = case when p_pronunciation is not null and btrim(p_pronunciation) <> '' then left(btrim(p_pronunciation), 120) else pronunciation end,
         part_of_speech   = case when p_part_of_speech is not null and btrim(p_part_of_speech) <> '' then left(btrim(p_part_of_speech), 60) else part_of_speech end,
         last_practiced   = now(),
         updated_at       = now()
   where id = p_word_id and user_id = v_uid;

  insert into public.review_history (
    user_id,
    word_id,
    exercise_type,
    answer,
    result,
    difficulty_rating,
    interval_days,
    next_scheduled_review
  ) values (
    v_uid,
    p_word_id,
    p_exercise_type,
    left(coalesce(p_answer, ''), 600),
    p_result,
    v_rating,
    greatest(coalesce(p_interval_days, 0), 0),
    p_next_review
  );
end;
$$;

create or replace function public.set_daily_learning_goals(
  p_new_words integer,
  p_reviews   integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new integer := least(greatest(coalesce(p_new_words, 5), 1), 50);
  v_rev integer := least(greatest(coalesce(p_reviews, 20), 5), 200);
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.user_stats (user_id, daily_new_words_goal, daily_reviews_goal)
  values (v_uid, v_new, v_rev)
  on conflict (user_id)
  do update set
    daily_new_words_goal = excluded.daily_new_words_goal,
    daily_reviews_goal   = excluded.daily_reviews_goal,
    updated_at           = now();
end;
$$;

revoke all on function public.record_learning_review(
  uuid, text, text, boolean, smallint, text, smallint, smallint[],
  double precision, double precision, integer, integer, double precision,
  timestamptz, smallint, text, text, text
) from public, anon;

grant execute on function public.record_learning_review(
  uuid, text, text, boolean, smallint, text, smallint, smallint[],
  double precision, double precision, integer, integer, double precision,
  timestamptz, smallint, text, text, text
) to authenticated;

revoke all on function public.set_daily_learning_goals(integer, integer) from public, anon;
grant execute on function public.set_daily_learning_goals(integer, integer) to authenticated;
