-- Migration 014: Security Remediation & Access Control Hardening
-- Resolves SEC-01 (IDOR on subscription RPCs) and SEC-04 (Cache Defacement / Poisoning)
-- 1. Enforce strict auth.uid() = p_user_id authorization on check_and_record_usage and get_or_create_user_subscription
-- 2. Lock down public.cached_word_exercises by dropping permissive RLS policies and providing safe SECURITY DEFINER RPCs

-- ---------------------------------------------------------------------------
-- 1. Hardened RPC: check_and_record_usage
-- ---------------------------------------------------------------------------
create or replace function public.check_and_record_usage(
  p_user_id uuid,
  p_action text -- 'capture' or 'review'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_uid uuid := auth.uid();
  v_caller_role text := auth.role();
  v_sub public.user_subscriptions%rowtype;
  v_today date := current_date;
  v_limit integer;
  v_current integer;
  v_allowed boolean;
begin
  if v_caller_uid is null and v_caller_role <> 'service_role' then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Enforce authorization: only the authenticated user themselves or service_role can access or increment usage
  if v_caller_role <> 'service_role' and v_caller_uid <> p_user_id then
    raise exception 'unauthorized: cannot access or modify another user subscription' using errcode = '42501';
  end if;

  -- Fetch or create subscription record
  select * into v_sub from public.get_or_create_user_subscription(p_user_id);

  if v_sub.tier = 'pro' or v_sub.tier = 'team' then
    -- Pro users have unlimited access
    if p_action = 'capture' then
      update public.user_subscriptions
      set daily_captures_count = daily_captures_count + 1, updated_at = now()
      where user_id = p_user_id;
    else
      update public.user_subscriptions
      set daily_reviews_count = daily_reviews_count + 1, updated_at = now()
      where user_id = p_user_id;
    end if;

    return jsonb_build_object(
      'allowed', true,
      'tier', v_sub.tier,
      'limit', -1,
      'used', case when p_action = 'capture' then v_sub.daily_captures_count + 1 else v_sub.daily_reviews_count + 1 end
    );
  end if;

  -- Free Tier Daily Limits
  if p_action = 'capture' then
    v_limit := 5; -- 5 subtitle word captures per day
    v_current := v_sub.daily_captures_count;
  else
    v_limit := 15; -- 15 reviews per day
    v_current := v_sub.daily_reviews_count;
  end if;

  if v_current >= v_limit then
    v_allowed := false;
  else
    v_allowed := true;
    if p_action = 'capture' then
      update public.user_subscriptions
      set daily_captures_count = daily_captures_count + 1, updated_at = now()
      where user_id = p_user_id;
    else
      update public.user_subscriptions
      set daily_reviews_count = daily_reviews_count + 1, updated_at = now()
      where user_id = p_user_id;
    end if;
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'tier', 'free',
    'limit', v_limit,
    'used', case when v_allowed then v_current + 1 else v_current end
  );
end;
$$;

revoke all on function public.check_and_record_usage(uuid, text) from public;
grant execute on function public.check_and_record_usage(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Hardened RPC: get_or_create_user_subscription
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_user_subscription(p_user_id uuid)
returns setof public.user_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_uid uuid := auth.uid();
  v_caller_role text := auth.role();
  v_today date := current_date;
begin
  if v_caller_uid is null and v_caller_role <> 'service_role' then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Enforce authorization: only the authenticated user themselves or service_role can access subscription records
  if v_caller_role <> 'service_role' and v_caller_uid <> p_user_id then
    raise exception 'unauthorized: cannot access or create another user subscription' using errcode = '42501';
  end if;

  -- Auto-reset daily counters if last activity was on a previous calendar day
  update public.user_subscriptions
  set
    daily_captures_count = 0,
    daily_reviews_count = 0,
    last_activity_date = v_today,
    updated_at = now()
  where user_id = p_user_id
    and last_activity_date < v_today;

  -- Ensure record exists
  insert into public.user_subscriptions (user_id, tier, status, last_activity_date)
  values (p_user_id, 'free', 'active', v_today)
  on conflict (user_id) do nothing;

  return query
  select * from public.user_subscriptions
  where user_id = p_user_id;
end;
$$;

revoke all on function public.get_or_create_user_subscription(uuid) from public;
grant execute on function public.get_or_create_user_subscription(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Cache Hardening: Revoke Direct Public/Authenticated Mutation on cached_word_exercises
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can update cached exercises" on public.cached_word_exercises;
drop policy if exists "Authenticated users can insert cached exercises" on public.cached_word_exercises;

-- Only authenticated users or service role can mutate via safe validated RPC
create or replace function public.save_cached_word_exercise(
  p_word text,
  p_target_lang text default 'ar',
  p_understanding_question jsonb default null,
  p_sentence_examples jsonb default '[]'::jsonb,
  p_meanings text[] default '{}',
  p_definition text default '',
  p_part_of_speech text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_word text := lower(btrim(coalesce(p_word, '')));
  v_clean_lang text := lower(btrim(coalesce(p_target_lang, 'ar')));
begin
  if v_clean_word = '' or char_length(v_clean_word) > 120 then
    raise exception 'invalid word parameter' using errcode = '22023';
  end if;

  insert into public.cached_word_exercises (
    word,
    target_lang,
    understanding_question,
    sentence_examples,
    meanings,
    definition,
    part_of_speech,
    updated_at
  ) values (
    v_clean_word,
    v_clean_lang,
    p_understanding_question,
    coalesce(p_sentence_examples, '[]'::jsonb),
    coalesce(p_meanings, '{}'),
    left(coalesce(p_definition, ''), 600),
    left(coalesce(p_part_of_speech, ''), 60),
    now()
  )
  on conflict (word, target_lang)
  do update set
    understanding_question = coalesce(excluded.understanding_question, public.cached_word_exercises.understanding_question),
    sentence_examples      = case when jsonb_array_length(excluded.sentence_examples) > 0 then excluded.sentence_examples else public.cached_word_exercises.sentence_examples end,
    meanings               = case when array_length(excluded.meanings, 1) > 0 then excluded.meanings else public.cached_word_exercises.meanings end,
    definition             = case when excluded.definition <> '' then excluded.definition else public.cached_word_exercises.definition end,
    part_of_speech         = case when excluded.part_of_speech <> '' then excluded.part_of_speech else public.cached_word_exercises.part_of_speech end,
    updated_at             = now();
end;
$$;

create or replace function public.increment_cached_word_hits(
  p_word text,
  p_target_lang text default 'ar'
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cached_word_exercises
     set hits_count = hits_count + 1,
         updated_at = now()
   where word = lower(btrim(p_word))
     and target_lang = lower(btrim(p_target_lang));
end;
$$;

revoke all on function public.save_cached_word_exercise(text, text, jsonb, jsonb, text[], text, text) from public;
grant execute on function public.save_cached_word_exercise(text, text, jsonb, jsonb, text[], text, text) to authenticated, service_role;

revoke all on function public.increment_cached_word_hits(text, text) from public;
grant execute on function public.increment_cached_word_hits(text, text) to authenticated, service_role;
