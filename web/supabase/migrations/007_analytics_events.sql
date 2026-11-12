-- 007_analytics_events.sql
-- Lightweight, privacy-respecting funnel analytics table.
-- Tracks only: signup, extension_connected, first_word_saved, first_practice_completed, day2_return, day7_return

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_name text not null check (
    event_name in (
      'signup',
      'extension_connected',
      'first_word_saved',
      'first_practice_completed',
      'day2_return',
      'day7_return'
    )
  ),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.analytics_events enable row level security;

-- Logged in users can insert their own events
create policy "Users can insert their own analytics events"
  on public.analytics_events for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Only authenticated users can read their own events (Admin views query via service role or elevated role)
create policy "Users can read their own analytics events"
  on public.analytics_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists idx_analytics_events_name_user on public.analytics_events(event_name, user_id);
create index if not exists idx_analytics_events_created_at on public.analytics_events(created_at);
