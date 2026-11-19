-- Migration 013: Global Exercise Cache and WordTap Pro Subscriptions
-- Enables zero-cost persistent question caching and freemium subscription gating.
-- Follows Supabase Postgres Best Practices:
-- - All foreign keys indexed
-- - RLS policies using (select auth.uid())
-- - SECURITY DEFINER RPCs pin search_path = public and revoke public/anon execute

-- ---------------------------------------------------------------------------
-- 1. Global Shared Word Exercise Cache (Caches Stage 1 & Stage 3 responses)
-- ---------------------------------------------------------------------------
create table if not exists public.cached_word_exercises (
  id                     uuid primary key default gen_random_uuid(),
  word                   text not null,
  target_lang            text not null default 'ar',
  understanding_question jsonb,
  sentence_examples      jsonb not null default '[]'::jsonb,
  meanings               text[] not null default '{}',
  definition             text not null default '',
  part_of_speech         text not null default '',
  hits_count             integer not null default 1,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint uq_cached_word_lang unique (word, target_lang)
);

create index if not exists idx_cached_word_exercises_lookup
  on public.cached_word_exercises (lower(word), target_lang);

alter table public.cached_word_exercises enable row level security;

-- All users (authenticated and anonymous) can read the cached educational exercises
drop policy if exists "Anyone can read cached exercises" on public.cached_word_exercises;
create policy "Anyone can read cached exercises"
  on public.cached_word_exercises
  for select
  using (true);

-- Authenticated users or backend service can insert/update cache entries
drop policy if exists "Authenticated users can insert cached exercises" on public.cached_word_exercises;
create policy "Authenticated users can insert cached exercises"
  on public.cached_word_exercises
  for insert
  with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can update cached exercises" on public.cached_word_exercises;
create policy "Authenticated users can update cached exercises"
  on public.cached_word_exercises
  for update
  using ((select auth.uid()) is not null);

-- ---------------------------------------------------------------------------
-- 2. User Subscriptions & Daily Usage Quotas (WordTap Fluency Pass)
-- ---------------------------------------------------------------------------
create table if not exists public.user_subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade unique,
  tier                 text not null default 'free' check (tier in ('free', 'pro', 'team')),
  status               text not null default 'active' check (status in ('active', 'canceled', 'past_due', 'trialing')),
  currency             text not null default 'USD',
  billing_interval     text not null default 'monthly' check (billing_interval in ('monthly', 'yearly', 'lifetime')),
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  daily_captures_count integer not null default 0,
  daily_reviews_count  integer not null default 0,
  last_activity_date   date not null default current_date,
  payment_provider     text default 'paddle',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_user_subscriptions_user_id
  on public.user_subscriptions (user_id);

alter table public.user_subscriptions enable row level security;

-- Users can read their own subscription record
drop policy if exists "Users can read own subscription" on public.user_subscriptions;
create policy "Users can read own subscription"
  on public.user_subscriptions
  for select
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 3. RPC: get_or_create_user_subscription
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_user_subscription(p_user_id uuid)
returns setof public.user_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
begin
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
-- 4. RPC: check_and_record_usage
-- Returns JSON with allowed flag, current tier, count, and daily limits
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
  v_sub public.user_subscriptions%rowtype;
  v_today date := current_date;
  v_limit integer;
  v_current integer;
  v_allowed boolean;
begin
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
