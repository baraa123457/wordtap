-- Migration 004: Add dedicated sentence column for context-grounded learning
-- Adds full subtitle sentence column to public.words table to allow rich practice cards and cloze exercises.

alter table public.words add column if not exists sentence text default '';

comment on column public.words.sentence is 'Full context sentence or subtitle line from which the word was saved.';
