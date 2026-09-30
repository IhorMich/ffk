-- Harden SECURITY DEFINER privileges + search_path.
-- Keep invite resolve callable by anon (pre-login invite preview).
-- Helper predicates used by RLS stay available to authenticated only.

-- Mutable search_path on trigger/helper function
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'protect_claimed_parent_invite'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    execute 'alter function public.protect_claimed_parent_invite() set search_path = public';
  end if;
end $$;

-- RLS helper predicates: not for anon RPC probing
revoke all on function public.is_academy_coach(text) from public;
revoke all on function public.is_academy_coach(text) from anon;
grant execute on function public.is_academy_coach(text) to authenticated;

revoke all on function public.is_team_coach(text) from public;
revoke all on function public.is_team_coach(text) from anon;
grant execute on function public.is_team_coach(text) to authenticated;

revoke all on function public.parent_of_player(text) from public;
revoke all on function public.parent_of_player(text) from anon;
grant execute on function public.parent_of_player(text) to authenticated;

revoke all on function public.parent_of_team(text) from public;
revoke all on function public.parent_of_team(text) from anon;
grant execute on function public.parent_of_team(text) to authenticated;

-- Chat mutations: authenticated only
revoke all on function public.delete_player_chat_message(text) from public;
revoke all on function public.delete_player_chat_message(text) from anon;
grant execute on function public.delete_player_chat_message(text) to authenticated;

revoke all on function public.mark_player_chat_read(text) from public;
revoke all on function public.mark_player_chat_read(text) from anon;
grant execute on function public.mark_player_chat_read(text) to authenticated;

-- Claim already authenticated-only; restate
revoke all on function public.claim_parent_invite(text, text, text, text, text) from public;
revoke all on function public.claim_parent_invite(text, text, text, text, text) from anon;
grant execute on function public.claim_parent_invite(text, text, text, text, text) to authenticated;

-- Invite resolve: allow anon + authenticated (landing before login)
revoke all on function public.resolve_parent_invite(text) from public;
grant execute on function public.resolve_parent_invite(text) to anon, authenticated;

revoke all on function public.resolve_parent_invite_by_code(text) from public;
grant execute on function public.resolve_parent_invite_by_code(text) to anon, authenticated;
