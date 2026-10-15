-- Migration 003: Allow users to permanently delete their account and associated data
create or replace function public.delete_user_account()
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

  delete from public.words where user_id = v_uid;
  delete from public.user_stats where user_id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

grant execute on function public.delete_user_account() to authenticated;
