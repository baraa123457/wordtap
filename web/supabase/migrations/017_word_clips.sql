-- Migration 017: Cached YouTube word clips for Stage 2 contextual learning
-- Caches verified <=12s YouTube clips in public.word_clips so repeat lookups
-- avoid YouTube Data API and Supadata transcript quota.

create table if not exists public.word_clips (
  id         uuid primary key default gen_random_uuid(),
  word       text not null,
  video_id   text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  start_sec  integer not null check (start_sec >= 0),
  end_sec    integer not null check (end_sec > start_sec and end_sec - start_sec <= 15),
  sentence   text not null check (char_length(sentence) > 0),
  source     text not null default 'youtube_supadata',
  created_at timestamptz not null default now()
);

-- Deduplicate exact clip timestamps per word
create unique index if not exists word_clips_unique_word_video_start_idx
  on public.word_clips (word, video_id, start_sec);

-- Fast case-insensitive word lookup
create index if not exists word_clips_lower_word_idx
  on public.word_clips (lower(word));

alter table public.word_clips enable row level security;

-- Public read access for cached clips; writes restricted to server service_role only
drop policy if exists "word_clips_public_read" on public.word_clips;
create policy "word_clips_public_read"
  on public.word_clips
  for select
  using (true);
