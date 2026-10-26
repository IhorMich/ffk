-- Let a signed-in user delete only their own auth account.
-- Public data already cascades from auth.users. Photos in player-media
-- must go first: storage ownership blocks the auth delete.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create or replace function private.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  delete from storage.objects
  where bucket_id = 'player-media'
    and split_part(name, '/', 1) = uid::text;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'objects'
      and column_name = 'owner'
  ) then
    execute 'delete from storage.objects where owner = $1' using uid;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'objects'
      and column_name = 'owner_id'
  ) then
    execute 'delete from storage.objects where owner_id = $1' using uid::text;
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function private.delete_own_account() from public, anon, authenticated;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  perform private.delete_own_account();
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
