-- Migration 018: Dedicated Leitner Spaced Repetition Review & Easy-Word columns on public.words
-- Additive alongside existing FSRS/box columns so the 4-stage flow remains unaffected.

alter table public.words
  add column if not exists review_box integer not null default 0,
  add column if not exists next_review_at timestamptz not null default now(),
  add column if not exists correct_streak integer not null default 0,
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists lapses integer not null default 0,
  add column if not exists is_easy boolean not null default false;

create index if not exists words_user_next_review_at_idx
  on public.words (user_id, next_review_at);

create index if not exists words_user_is_easy_idx
  on public.words (user_id, is_easy)
  where is_easy = true;
