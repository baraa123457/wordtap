-- Migration 012: Custom Stage 2 Persistent Video Library
-- Extends public.vocabulary_video_examples for WordTap's custom YouTube contextual player.
-- Stores ONLY verified metadata, timestamps, and permitted caption excerpts (never video files).
-- Follows Supabase Postgres Best Practices:
-- - All foreign keys indexed
-- - All RLS policies use (select auth.uid())
-- - SECURITY DEFINER RPCs pin search_path = public and revoke public/anon execute

-- ---------------------------------------------------------------------------
-- 1. Extend public.vocabulary_video_examples with complete video metadata
-- ---------------------------------------------------------------------------
alter table public.vocabulary_video_examples
  add column if not exists word_id             uuid references public.words (id) on delete set null,
  add column if not exists youtube_url         text not null default '',
  add column if not exists caption_cues        jsonb not null default '[]'::jsonb,
  add column if not exists transcript_verified boolean not null default true,
  add column if not exists discovered_at       timestamptz not null default now();

-- Backfill canonical YouTube URL for any pre-existing rows
update public.vocabulary_video_examples
set youtube_url = 'https://www.youtube.com/watch?v=' || youtube_video_id || '&t=' || timestamp_seconds || 's'
where youtube_url = '';

-- Expand allowed discovery sources
alter table public.vocabulary_video_examples
  drop constraint if exists vocabulary_video_examples_source_check;

alter table public.vocabulary_video_examples
  add constraint vocabulary_video_examples_source_check
  check (
    source in (
      'youglish_rest',
      'youtube_filmot',
      'youtube_supadata',
      'youtube_transcriptapi',
      'user_subtitle',
      'user_contributed'
    )
  );

-- Index FK word_id (Supabase Postgres best practice)
create index if not exists vocab_video_examples_word_id_idx
  on public.vocabulary_video_examples (word_id)
  where word_id is not null;

-- Prevent duplicate videos per word + timestamp
create unique index if not exists vocab_video_examples_unique_clip_idx
  on public.vocabulary_video_examples (word_normalized, youtube_video_id, timestamp_seconds);

-- ---------------------------------------------------------------------------
-- 2. Atomic RPC: Persist Verified Video Example (Deduplicated)
-- ---------------------------------------------------------------------------
create or replace function public.save_verified_video_example(
  p_word_id              uuid default null,
  p_word_normalized      text default '',
  p_youtube_video_id     text default '',
  p_video_title          text default '',
  p_channel_name         text default '',
  p_source               text default 'youglish_rest',
  p_timestamp_seconds    integer default 0,
  p_verified_transcript  text default '',
  p_context_sentence     text default '',
  p_target_word_position integer default 0,
  p_caption_cues         jsonb default '[]'::jsonb,
  p_transcript_verified  boolean default true
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_word     text := lower(left(btrim(coalesce(p_word_normalized, '')), 120));
  v_vid      text := btrim(coalesce(p_youtube_video_id, ''));
  v_ts       integer := greatest(coalesce(p_timestamp_seconds, 0), 0);
  v_url      text;
  v_word_ref uuid := null;
  v_id       uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if v_word = '' or v_vid !~ '^[A-Za-z0-9_-]{11}$' then
    raise exception 'valid word and 11-char YouTube video ID are required' using errcode = '22023';
  end if;

  if p_source not in (
    'youglish_rest',
    'youtube_filmot',
    'youtube_supadata',
    'youtube_transcriptapi',
    'user_subtitle',
    'user_contributed'
  ) then
    raise exception 'invalid discovery source' using errcode = '22023';
  end if;

  if btrim(coalesce(p_context_sentence, '')) = '' then
    raise exception 'verified context sentence is required' using errcode = '22023';
  end if;

  -- Link word_id only if it belongs to the authenticated user
  if p_word_id is not null then
    select id into v_word_ref
      from public.words
     where id = p_word_id and user_id = v_uid;
  end if;

  v_url := 'https://www.youtube.com/watch?v=' || v_vid || '&t=' || v_ts::text || 's';

  insert into public.vocabulary_video_examples (
    word_id,
    word_normalized,
    youtube_video_id,
    youtube_url,
    video_title,
    channel_name,
    source,
    timestamp_seconds,
    verified_transcript,
    caption_cues,
    context_sentence,
    target_word_position,
    transcript_verified,
    caption_available,
    video_available,
    contributed_by,
    discovered_at,
    updated_at
  ) values (
    v_word_ref,
    v_word,
    v_vid,
    v_url,
    left(coalesce(p_video_title, 'YouTube Video'), 300),
    left(coalesce(p_channel_name, 'YouTube'), 160),
    p_source,
    v_ts,
    left(btrim(coalesce(nullif(p_verified_transcript, ''), p_context_sentence)), 2000),
    coalesce(p_caption_cues, '[]'::jsonb),
    left(btrim(p_context_sentence), 600),
    greatest(coalesce(p_target_word_position, 0), 0),
    coalesce(p_transcript_verified, true),
    true,
    true,
    v_uid,
    now(),
    now()
  )
  on conflict (word_normalized, youtube_video_id, timestamp_seconds)
  do update set
    word_id             = coalesce(public.vocabulary_video_examples.word_id, excluded.word_id),
    video_title         = case when excluded.video_title <> '' then excluded.video_title else public.vocabulary_video_examples.video_title end,
    channel_name        = case when excluded.channel_name <> '' then excluded.channel_name else public.vocabulary_video_examples.channel_name end,
    caption_cues        = case when jsonb_array_length(excluded.caption_cues) > 0 then excluded.caption_cues else public.vocabulary_video_examples.caption_cues end,
    transcript_verified = public.vocabulary_video_examples.transcript_verified or excluded.transcript_verified,
    video_available     = true,
    updated_at          = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Safe RPC: Mark Video Unavailable When Embed/Playback Fails
-- ---------------------------------------------------------------------------
create or replace function public.mark_video_unavailable(p_youtube_video_id text)
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

  update public.vocabulary_video_examples
     set video_available = false,
         updated_at      = now()
   where youtube_video_id = p_youtube_video_id;
end;
$$;

revoke all on function public.save_verified_video_example(uuid, text, text, text, text, text, integer, text, text, integer, jsonb, boolean) from public, anon;
grant execute on function public.save_verified_video_example(uuid, text, text, text, text, text, integer, text, text, integer, jsonb, boolean) to authenticated;

revoke all on function public.mark_video_unavailable(text) from public, anon;
grant execute on function public.mark_video_unavailable(text) to authenticated;
