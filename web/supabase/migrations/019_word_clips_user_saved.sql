-- Migration 019: Add report_count & user_id to public.word_clips for extension-captured user_saved clips

alter table public.word_clips
  add column if not exists report_count integer not null default 0,
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists word_clips_report_count_idx
  on public.word_clips (report_count)
  where report_count = 0;

-- Allow authenticated users to insert their own user_saved clips (writes for other users blocked by RLS)
drop policy if exists "word_clips_authenticated_insert_own" on public.word_clips;
create policy "word_clips_authenticated_insert_own"
  on public.word_clips
  for insert
  to authenticated
  with check (user_id = auth.uid() and source = 'user_saved');
