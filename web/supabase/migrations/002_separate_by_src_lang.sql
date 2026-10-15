-- Migration 002: Completely separate words by language so identical words in different languages
-- (e.g. English "was" = "كان" and German "was" = "ماذا") both coexist independently.

-- 1. Dynamically drop any old unique constraints and indexes on words (regardless of name)
do $$
declare
  r record;
begin
  -- Drop all unique constraints on words (except pkey)
  for r in (
    select conname
    from pg_constraint
    where conrelid = 'public.words'::regclass
      and contype = 'u'
  ) loop
    execute 'alter table public.words drop constraint if exists ' || quote_ident(r.conname) || ' cascade';
  end loop;

  -- Drop all non-pkey indexes on words
  for r in (
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'words'
      and indexname not like '%pkey%'
  ) loop
    execute 'drop index if exists public.' || quote_ident(r.indexname) || ' cascade';
  end loop;
end $$;

-- 2. Create the new unique index that strictly includes src_lang
create unique index if not exists words_user_text_lang_src_idx
  on public.words (user_id, lower(text), target_lang, src_lang);

create index if not exists words_user_due_idx
  on public.words (user_id, next_review);

-- 3. Update policy for web app
drop policy if exists "words: update own" on public.words;
create policy "words: update own" on public.words
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4. Install updated save_word function
create or replace function public.save_word(
  p_text          text,
  p_translation   text,
  p_src_lang      text default 'auto',
  p_target_lang   text default 'ar',
  p_source_title  text default '',
  p_source_url    text default '',
  p_times         integer default 1
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
    (user_id, text, translation, src_lang, target_lang, source_title, source_url, times_seen)
  values
    (v_uid,
     left(btrim(p_text), 200),
     left(btrim(p_translation), 500),
     v_src,
     p_target_lang,
     left(coalesce(p_source_title, ''), 300),
     left(coalesce(p_source_url, ''), 1000),
     v_times)
  on conflict (user_id, lower(text), target_lang, src_lang)
  do update set
    translation  = excluded.translation,
    times_seen   = w.times_seen + v_times,
    source_title = case when excluded.source_title <> '' then excluded.source_title else w.source_title end,
    source_url   = case when excluded.source_url   <> '' then excluded.source_url   else w.source_url   end,
    updated_at   = now()
  returning w.id into v_id;

  return v_id;
end;
$$;

-- 5. Automatically restore English "was" so both German "was" and English "was" exist immediately!
insert into public.words (user_id, text, translation, src_lang, target_lang)
select user_id, 'was', 'كان', 'en', target_lang
from public.words
where lower(text) = 'was' and src_lang = 'de'
on conflict do nothing;
