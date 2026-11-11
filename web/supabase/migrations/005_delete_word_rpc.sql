-- Migration 005: Security Definer RPCs for guaranteed word deletion
-- Ensures atomic, reliable deletion directly from Postgres regardless of RLS edge cases.

create or replace function public.delete_word(p_word_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_deleted boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  delete from public.words
  where id = p_word_id and user_id = v_uid;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.delete_word_by_text(p_text text, p_src_lang text default 'auto')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_deleted boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  delete from public.words
  where user_id = v_uid
    and lower(text) = lower(btrim(p_text))
    and (p_src_lang = 'auto' or src_lang = p_src_lang);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.delete_word(uuid) is 'Safely deletes a word owned by the authenticated user by word ID.';
comment on function public.delete_word_by_text(text, text) is 'Safely deletes a word owned by the authenticated user by word text and source language.';
