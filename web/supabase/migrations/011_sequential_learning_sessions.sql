-- Migration 011: Strict Sequential Learning Sessions & Deterministic Stage Progression
-- Separates Initial Learning (strict Stage 1 -> 2 -> 3 -> 4 per word) from Spaced Repetition Reviews.
-- Follows Supabase Postgres Best Practices:
-- - All foreign keys indexed
-- - All RLS policies use (select auth.uid()) for single-evaluation caching
-- - All SECURITY DEFINER RPCs pin search_path = public and revoke public/anon execute

-- ---------------------------------------------------------------------------
-- 1. Extend public.words with explicit initial learning completion & stage answers
-- ---------------------------------------------------------------------------
alter table public.words
  add column if not exists initial_learning_completed boolean not null default false,
  add column if not exists stage_answers              jsonb not null default '{}'::jsonb;

-- Backfill: words that already completed all 3 core stages or reached review/mastered
update public.words
set initial_learning_completed = true
where initial_learning_completed = false
  and (
    learning_status in ('review', 'mastered')
    or box >= 2
    or (completed_stages @> array[1, 2, 3]::smallint[])
  );

create index if not exists words_user_initial_learning_idx
  on public.words (user_id, initial_learning_completed, created_at, id);

-- ---------------------------------------------------------------------------
-- 2. Persistent Learning Sessions (Independent per user, separated by session_type)
-- ---------------------------------------------------------------------------
create table if not exists public.learning_sessions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_type       text not null check (session_type in ('initial_learning', 'spaced_repetition')),
  lang_filter        text not null default 'all',
  word_ids           uuid[] not null,
  completed_word_ids uuid[] not null default '{}',
  current_word_index integer not null default 0 check (current_word_index >= 0),
  current_word_id    uuid references public.words (id) on delete set null,
  current_stage      smallint not null default 1 check (current_stage between 1 and 4),
  status             text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  xp_earned          integer not null default 0 check (xp_earned >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  completed_at       timestamptz
);

-- Fast lookups + FK index
create index if not exists learning_sessions_user_active_idx
  on public.learning_sessions (user_id, session_type, status, updated_at desc);

create index if not exists learning_sessions_current_word_idx
  on public.learning_sessions (current_word_id)
  where current_word_id is not null;

-- Prevent duplicate active sessions of the same type/language per user (eliminates race conditions)
create unique index if not exists learning_sessions_one_active_per_user_idx
  on public.learning_sessions (user_id, session_type, lang_filter)
  where status = 'in_progress';

alter table public.learning_sessions enable row level security;

drop policy if exists "learning_sessions: read own" on public.learning_sessions;
create policy "learning_sessions: read own" on public.learning_sessions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "learning_sessions: insert own" on public.learning_sessions;
create policy "learning_sessions: insert own" on public.learning_sessions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "learning_sessions: update own" on public.learning_sessions;
create policy "learning_sessions: update own" on public.learning_sessions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "learning_sessions: delete own" on public.learning_sessions;
create policy "learning_sessions: delete own" on public.learning_sessions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 3. Transactional RPC: Advance Stage within Initial Learning (1->2, 2->3, 3->4)
--    Enforces strict sequential order — impossible to skip stages or advance another word.
-- ---------------------------------------------------------------------------
create or replace function public.advance_initial_learning_stage(
  p_session_id      uuid,
  p_word_id         uuid,
  p_completed_stage smallint,
  p_answer          text default '',
  p_passed          boolean default true,
  p_stage_payload   jsonb default '{}'::jsonb,
  p_xp_delta        integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_sess       public.learning_sessions;
  v_word       public.words;
  v_next_stage smallint;
  v_stages     smallint[];
  v_ex_type    text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_completed_stage not in (1, 2, 3) then
    raise exception 'advance_initial_learning_stage only accepts stages 1, 2, or 3' using errcode = '22023';
  end if;

  select * into v_sess
    from public.learning_sessions
   where id = p_session_id and user_id = v_uid
     for update;

  if not found then
    raise exception 'learning session not found' using errcode = 'P0002';
  end if;

  if v_sess.session_type <> 'initial_learning' or v_sess.status <> 'in_progress' then
    raise exception 'session is not an active initial learning session' using errcode = '22023';
  end if;

  if v_sess.current_word_id <> p_word_id then
    raise exception 'strict sequence violation: cannot advance a different word before completing the current word' using errcode = '22023';
  end if;

  if v_sess.current_stage <> p_completed_stage then
    raise exception 'strict sequence violation: expected stage %, received stage %', v_sess.current_stage, p_completed_stage using errcode = '22023';
  end if;

  select * into v_word
    from public.words
   where id = p_word_id and user_id = v_uid
     for update;

  if not found then
    raise exception 'word not found' using errcode = 'P0002';
  end if;

  v_next_stage := p_completed_stage + 1;

  -- Monotonically add completed stage without losing previously completed stages
  v_stages := coalesce(v_word.completed_stages, '{}'::smallint[]);
  if not (p_completed_stage = any(v_stages)) then
    v_stages := array_append(v_stages, p_completed_stage);
  end if;

  update public.words
     set current_stage    = greatest(current_stage, v_next_stage),
         completed_stages = v_stages,
         learning_status  = case when learning_status = 'new' then 'learning' else learning_status end,
         attempts_count   = attempts_count + 1,
         stage_answers    = coalesce(stage_answers, '{}'::jsonb) || jsonb_build_object(
                              'stage_' || p_completed_stage::text,
                              coalesce(p_stage_payload, '{}'::jsonb) || jsonb_build_object(
                                'answer', left(coalesce(p_answer, ''), 600),
                                'passed', p_passed,
                                'completedAt', now()
                              )
                            ),
         definition       = case when coalesce(p_stage_payload ->> 'definition', '') <> '' then left(btrim(p_stage_payload ->> 'definition'), 600) else definition end,
         pronunciation    = case when coalesce(p_stage_payload ->> 'pronunciation', '') <> '' then left(btrim(p_stage_payload ->> 'pronunciation'), 120) else pronunciation end,
         part_of_speech   = case when coalesce(p_stage_payload ->> 'partOfSpeech', '') <> '' then left(btrim(p_stage_payload ->> 'partOfSpeech'), 60) else part_of_speech end,
         updated_at       = now()
   where id = p_word_id and user_id = v_uid;

  update public.learning_sessions
     set current_stage = v_next_stage,
         xp_earned     = xp_earned + greatest(coalesce(p_xp_delta, 0), 0),
         updated_at    = now()
   where id = p_session_id and user_id = v_uid;

  v_ex_type := case p_completed_stage
    when 1 then 'understanding'
    when 2 then 'contextual_video'
    else 'create_sentence'
  end;

  insert into public.review_history (
    user_id, word_id, exercise_type, answer, result
  ) values (
    v_uid, p_word_id, v_ex_type, left(coalesce(p_answer, ''), 600), p_passed
  );

  return jsonb_build_object(
    'sessionId', p_session_id,
    'wordId', p_word_id,
    'currentStage', v_next_stage,
    'completedStages', v_stages
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Transactional RPC: Complete Initial Learning Word (Stage 4) & Move to Next Word Stage 1
--    Verifies Stages 1, 2, and 3 are ALL completed before marking word done!
-- ---------------------------------------------------------------------------
create or replace function public.complete_initial_learning_word(
  p_session_id       uuid,
  p_word_id          uuid,
  p_rating           smallint default 3,
  p_fsrs_stability   double precision default 3.0,
  p_fsrs_difficulty  double precision default 5.0,
  p_fsrs_reps        integer default 1,
  p_fsrs_lapses      integer default 0,
  p_interval_days    double precision default 3.0,
  p_next_review      timestamptz default now() + interval '3 days',
  p_box              smallint default 1,
  p_learning_status  text default 'learning',
  p_xp_delta         integer default 5
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid              uuid := auth.uid();
  v_sess             public.learning_sessions;
  v_word             public.words;
  v_stages           smallint[];
  v_completed_words  uuid[];
  v_next_index       integer;
  v_next_word_id     uuid := null;
  v_next_status      text := 'in_progress';
  v_rating           smallint := least(greatest(coalesce(p_rating, 3), 1), 4);
  v_box              smallint := least(greatest(coalesce(p_box, 1), 0), 5);
  v_status           text := case when p_learning_status in ('learning', 'review', 'mastered') then p_learning_status else 'learning' end;
  i                  integer;
  v_cand             uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_sess
    from public.learning_sessions
   where id = p_session_id and user_id = v_uid
     for update;

  if not found then
    raise exception 'learning session not found' using errcode = 'P0002';
  end if;

  if v_sess.session_type <> 'initial_learning' or v_sess.status <> 'in_progress' then
    raise exception 'session is not an active initial learning session' using errcode = '22023';
  end if;

  if v_sess.current_word_id <> p_word_id or v_sess.current_stage <> 4 then
    raise exception 'strict sequence violation: word must finish Stages 1, 2, and 3 before Stage 4 completion' using errcode = '22023';
  end if;

  select * into v_word
    from public.words
   where id = p_word_id and user_id = v_uid
     for update;

  if not found then
    raise exception 'word not found' using errcode = 'P0002';
  end if;

  v_stages := coalesce(v_word.completed_stages, '{}'::smallint[]);
  if not (v_stages @> array[1, 2, 3]::smallint[]) then
    raise exception 'cannot complete word before validating Stages 1, 2, and 3' using errcode = '22023';
  end if;

  if not (4 = any(v_stages)) then
    v_stages := array_append(v_stages, 4::smallint);
  end if;

  update public.words
     set initial_learning_completed = true,
         current_stage              = 4,
         completed_stages           = v_stages,
         learning_status            = v_status,
         fsrs_stability             = greatest(coalesce(p_fsrs_stability, 1.0), 0),
         fsrs_difficulty            = least(greatest(coalesce(p_fsrs_difficulty, 5.0), 1.0), 10.0),
         fsrs_reps                  = greatest(coalesce(p_fsrs_reps, 1), 0),
         fsrs_lapses                = greatest(coalesce(p_fsrs_lapses, 0), 0),
         interval_days              = greatest(coalesce(p_interval_days, 0), 0),
         last_rating                = v_rating,
         box                        = v_box,
         next_review                = coalesce(p_next_review, now() + interval '1 day'),
         correct_count              = correct_count + case when v_rating > 1 then 1 else 0 end,
         wrong_count                = wrong_count + case when v_rating <= 1 then 1 else 0 end,
         last_practiced             = now(),
         updated_at                 = now()
   where id = p_word_id and user_id = v_uid;

  insert into public.review_history (
    user_id, word_id, exercise_type, answer, result, difficulty_rating, interval_days, next_scheduled_review
  ) values (
    v_uid, p_word_id, 'spaced_repetition', 'initial_learning_complete', v_rating > 1, v_rating,
    greatest(coalesce(p_interval_days, 0), 0), p_next_review
  );

  v_completed_words := coalesce(v_sess.completed_word_ids, '{}'::uuid[]);
  if not (p_word_id = any(v_completed_words)) then
    v_completed_words := array_append(v_completed_words, p_word_id);
  end if;

  -- Find the next uncompleted word strictly in session order (always starts at Stage 1!)
  v_next_index := coalesce(array_length(v_sess.word_ids, 1), 0);
  for i in 1..coalesce(array_length(v_sess.word_ids, 1), 0) loop
    v_cand := v_sess.word_ids[i];
    if not (v_cand = any(v_completed_words)) then
      v_next_index := i - 1; -- 0-based index
      v_next_word_id := v_cand;
      exit;
    end if;
  end loop;

  if v_next_word_id is null then
    v_next_status := 'completed';
  end if;

  update public.learning_sessions
     set completed_word_ids = v_completed_words,
         current_word_index = v_next_index,
         current_word_id    = v_next_word_id,
         current_stage      = 1,
         status             = v_next_status,
         xp_earned          = xp_earned + greatest(coalesce(p_xp_delta, 0), 0),
         completed_at       = case when v_next_status = 'completed' then now() else completed_at end,
         updated_at         = now()
   where id = p_session_id and user_id = v_uid;

  return jsonb_build_object(
    'sessionId', p_session_id,
    'status', v_next_status,
    'currentWordIndex', v_next_index,
    'currentWordId', v_next_word_id,
    'currentStage', 1,
    'completedWordIds', v_completed_words
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Separate Transactional RPC: Spaced Repetition Review
--    NEVER modifies initial_learning_completed, current_stage, or completed_stages!
-- ---------------------------------------------------------------------------
create or replace function public.record_spaced_repetition_review(
  p_word_id          uuid,
  p_exercise_type    text,
  p_answer           text default '',
  p_result           boolean default true,
  p_rating           smallint default 3,
  p_learning_status  text default 'review',
  p_fsrs_stability   double precision default 3.0,
  p_fsrs_difficulty  double precision default 5.0,
  p_fsrs_reps        integer default 1,
  p_fsrs_lapses      integer default 0,
  p_interval_days    double precision default 3.0,
  p_next_review      timestamptz default now() + interval '3 days',
  p_box              smallint default 2
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_rating smallint := least(greatest(coalesce(p_rating, 3), 1), 4);
  v_box    smallint := least(greatest(coalesce(p_box, 0), 0), 5);
  v_status text := case when p_learning_status in ('learning', 'review', 'mastered') then p_learning_status else 'review' end;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_exercise_type not in ('understanding', 'contextual_video', 'create_sentence', 'spaced_repetition') then
    raise exception 'invalid exercise_type' using errcode = '22023';
  end if;

  perform 1 from public.words where id = p_word_id and user_id = v_uid for update;
  if not found then
    raise exception 'word not found' using errcode = 'P0002';
  end if;

  -- Strictly update ONLY spaced repetition schedule & stats; NEVER touch initial learning stage/progress!
  update public.words
     set learning_status  = v_status,
         attempts_count   = attempts_count + 1,
         correct_count    = correct_count + case when p_result then 1 else 0 end,
         wrong_count      = wrong_count + case when p_result then 0 else 1 end,
         fsrs_stability   = greatest(coalesce(p_fsrs_stability, 0), 0),
         fsrs_difficulty  = least(greatest(coalesce(p_fsrs_difficulty, 5.0), 1.0), 10.0),
         fsrs_reps        = greatest(coalesce(p_fsrs_reps, 0), 0),
         fsrs_lapses      = greatest(coalesce(p_fsrs_lapses, 0), 0),
         interval_days    = greatest(coalesce(p_interval_days, 0), 0),
         last_rating      = v_rating,
         box              = v_box,
         next_review      = coalesce(p_next_review, next_review),
         last_practiced   = now(),
         updated_at       = now()
   where id = p_word_id and user_id = v_uid;

  insert into public.review_history (
    user_id, word_id, exercise_type, answer, result, difficulty_rating, interval_days, next_scheduled_review
  ) values (
    v_uid, p_word_id, p_exercise_type, left(coalesce(p_answer, ''), 600), p_result, v_rating,
    greatest(coalesce(p_interval_days, 0), 0), p_next_review
  );
end;
$$;

revoke all on function public.advance_initial_learning_stage(uuid, uuid, smallint, text, boolean, jsonb, integer) from public, anon;
grant execute on function public.advance_initial_learning_stage(uuid, uuid, smallint, text, boolean, jsonb, integer) to authenticated;

revoke all on function public.complete_initial_learning_word(uuid, uuid, smallint, double precision, double precision, integer, integer, double precision, timestamptz, smallint, text, integer) from public, anon;
grant execute on function public.complete_initial_learning_word(uuid, uuid, smallint, double precision, double precision, integer, integer, double precision, timestamptz, smallint, text, integer) to authenticated;

revoke all on function public.record_spaced_repetition_review(uuid, text, text, boolean, smallint, text, double precision, double precision, integer, integer, double precision, timestamptz, smallint) from public, anon;
grant execute on function public.record_spaced_repetition_review(uuid, text, text, boolean, smallint, text, double precision, double precision, integer, integer, double precision, timestamptz, smallint) to authenticated;
