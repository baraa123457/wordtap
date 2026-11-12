-- Migration 006: Wire dedicated sentence column into save_word, add atomic in-place update RPC,
-- and support optional recall grade (Again/Hard/Good/Easy) in review_word.

alter table public.words add column if not exists sentence text not null default '';

-- 1. Update save_word to persist dedicated sentence context cleanly while remaining
--    backward-compatible with callers that omit p_sentence.
create or replace function public.save_word(
  p_text          text,
  p_translation   text,
  p_src_lang      text default 'auto',
  p_target_lang   text default 'ar',
  p_source_title  text default '',
  p_source_url    text default '',
  p_times         integer default 1,
  p_sentence      text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_times integer := greatest(coalesce(p_times, 1), 1);
  v_src   text := lower(coalesce(nullif(btrim(p_src_lang), ''), 'auto'));
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if btrim(coalesce(p_text, '')) = '' or btrim(coalesce(p_translation, '')) = '' then
    raise exception 'text and translation are required' using errcode = '22023';
  end if;

  insert into public.words as w
    (user_id, text, translation, src_lang, target_lang, source_title, source_url, times_seen, sentence)
  values
    (v_uid,
     left(btrim(p_text), 200),
     left(btrim(p_translation), 500),
     v_src,
     p_target_lang,
     left(coalesce(p_source_title, ''), 300),
     left(coalesce(p_source_url, ''), 1000),
     v_times,
     left(coalesce(p_sentence, ''), 600))
  on conflict (user_id, lower(text), target_lang, src_lang)
  do update set
    translation  = excluded.translation,
    times_seen   = w.times_seen + v_times,
    source_title = case when excluded.source_title <> '' then excluded.source_title else w.source_title end,
    source_url   = case when excluded.source_url   <> '' then excluded.source_url   else w.source_url   end,
    sentence     = case when excluded.sentence     <> '' then excluded.sentence     else w.sentence     end,
    updated_at   = now()
  returning w.id into v_id;

  return v_id;
end;
$$;

-- 2. In-place word edit RPC so changing word/translation/language preserves SRS progress
--    (box, next_review, correct_count, wrong_count) cleanly.
create or replace function public.update_word_details(
  p_word_id     uuid,
  p_text        text default null,
  p_translation text default null,
  p_src_lang    text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_updated boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.words
     set text        = case when p_text is not null and btrim(p_text) <> '' then left(btrim(p_text), 200) else text end,
         translation = case when p_translation is not null and btrim(p_translation) <> '' then left(btrim(p_translation), 500) else translation end,
         src_lang    = case when p_src_lang is not null and btrim(p_src_lang) <> '' then lower(btrim(p_src_lang)) else src_lang end,
         updated_at  = now()
   where id = p_word_id and user_id = v_uid;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- 3. Optional 4-level recall grade on review_word while keeping (p_word_id, p_correct) compatible.
--    p_grade: 0 = Again, 1 = Hard (keep box, 12h), 2 = Good (+1 box), 3 = Easy (+2 boxes).
create or replace function public.review_word(
  p_word_id uuid,
  p_correct boolean,
  p_grade   smallint default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_box       smallint;
  v_intervals integer[] := array[0, 1, 3, 7, 14, 30];
  v_grade     smallint := coalesce(p_grade, case when p_correct then 2 else 0 end);
  v_next      timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select box into v_box
    from public.words
   where id = p_word_id and user_id = v_uid
     for update;
  if not found then
    raise exception 'word not found' using errcode = 'P0002';
  end if;

  if v_grade <= 0 then
    v_box := greatest(v_box - 1, 0);
    v_next := now();
  elsif v_grade = 1 then
    v_next := now() + interval '12 hours';
  elsif v_grade >= 3 then
    v_box := least(v_box + 2, 5);
    v_next := now() + make_interval(days => v_intervals[v_box + 1]);
  else
    v_box := least(v_box + 1, 5);
    v_next := now() + make_interval(days => v_intervals[v_box + 1]);
  end if;

  update public.words
     set box            = v_box,
         next_review    = v_next,
         correct_count  = correct_count + case when v_grade > 0 then 1 else 0 end,
         wrong_count    = wrong_count   + case when v_grade <= 0 then 1 else 0 end,
         last_practiced = now(),
         updated_at     = now()
   where id = p_word_id and user_id = v_uid;
end;
$$;

revoke all on function public.save_word(text, text, text, text, text, text, integer, text) from public, anon;
grant execute on function public.save_word(text, text, text, text, text, text, integer, text) to authenticated;

revoke all on function public.update_word_details(uuid, text, text, text) from public, anon;
grant execute on function public.update_word_details(uuid, text, text, text) to authenticated;

revoke all on function public.review_word(uuid, boolean, smallint) from public, anon;
grant execute on function public.review_word(uuid, boolean, smallint) to authenticated;
