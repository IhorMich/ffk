-- Allow parents to resolve open invites by the short MC display code (cross-device).
-- Same 30-day window as resolve_parent_invite(token). Prefer the newest open invite.

create or replace function public.resolve_parent_invite_by_code(invite_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select pi.payload
  from public.parent_invites pi
  where upper(regexp_replace(coalesce(pi.code, ''), '[^A-Za-z0-9]', '', 'g'))
      = upper(regexp_replace(coalesce(invite_code, ''), '[^A-Za-z0-9]', '', 'g'))
    and length(upper(regexp_replace(coalesce(invite_code, ''), '[^A-Za-z0-9]', '', 'g'))) between 4 and 8
    and pi.status = 'open'
    and pi.created_at > now() - interval '30 days'
  order by pi.created_at desc
  limit 1;
$$;

revoke all on function public.resolve_parent_invite_by_code(text) from public;
grant execute on function public.resolve_parent_invite_by_code(text) to anon, authenticated;
