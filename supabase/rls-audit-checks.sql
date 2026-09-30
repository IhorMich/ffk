-- Manual negative checks (run in SQL editor as anon / authenticated).
-- Expected: helpers fail for anon; personal_backups empty for other users.

-- As anon (via Dashboard → SQL with role switch, or PostgREST without JWT):
-- select public.is_team_coach('nope');           -- should fail permission
-- select public.is_academy_coach('nope');        -- should fail permission
-- select public.parent_of_player('nope');        -- should fail permission
-- select * from public.personal_backups;         -- should return 0 rows
-- select * from public.team_players;             -- should return 0 rows

-- As authenticated user A:
-- select * from public.personal_backups where owner_user_id <> auth.uid(); -- 0 rows
-- insert into public.personal_backups(owner_user_id, payload)
--   values ('00000000-0000-0000-0000-000000000000', '{}'::jsonb); -- should fail

-- Invite resolve still works without session (anon):
-- select public.resolve_parent_invite_by_code('ZZZZ'); -- may return null, but EXECUTE ok
