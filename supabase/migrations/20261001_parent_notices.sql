-- Match invites / updates / results for remote parents (closed-app FCM + inbox sync).

create table if not exists public.parent_notices (
  id text primary key,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  team_player_id text not null,
  notice_type text not null
    check (notice_type in (
      'match_invite',
      'match_updated',
      'match_recalled',
      'match_cancelled',
      'match_result'
    )),
  title text not null default '',
  body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists parent_notices_parent_idx
  on public.parent_notices(parent_user_id, created_at desc);
create index if not exists parent_notices_player_idx
  on public.parent_notices(team_player_id);

alter table public.parent_notices enable row level security;

drop policy if exists parent_notices_select on public.parent_notices;
create policy parent_notices_select on public.parent_notices
  for select to authenticated
  using (parent_user_id = auth.uid());

drop policy if exists parent_notices_insert_coach on public.parent_notices;
create policy parent_notices_insert_coach on public.parent_notices
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.team_players tp
      join public.teams t on t.id = tp.team_id
      join public.academies a on a.id = t.academy_id
      where tp.id = parent_notices.team_player_id
        and (
          a.owner_user_id = auth.uid()
          or exists (
            select 1 from public.memberships m
            where m.status = 'active'
              and m.user_id = auth.uid()
              and m.role in ('owner', 'assistant')
              and (
                m.academy_id = a.id
                or m.team_id = t.id
              )
          )
        )
    )
  );

drop policy if exists parent_notices_update_parent on public.parent_notices;
create policy parent_notices_update_parent on public.parent_notices
  for update to authenticated
  using (parent_user_id = auth.uid())
  with check (parent_user_id = auth.uid());

drop policy if exists parent_notices_update_coach on public.parent_notices;
create policy parent_notices_update_coach on public.parent_notices
  for update to authenticated
  using (
    exists (
      select 1
      from public.team_players tp
      join public.teams t on t.id = tp.team_id
      join public.academies a on a.id = t.academy_id
      where tp.id = parent_notices.team_player_id
        and (
          a.owner_user_id = auth.uid()
          or exists (
            select 1 from public.memberships m
            where m.status = 'active'
              and m.user_id = auth.uid()
              and m.role in ('owner', 'assistant')
              and (
                m.academy_id = a.id
                or m.team_id = t.id
              )
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.team_players tp
      join public.teams t on t.id = tp.team_id
      join public.academies a on a.id = t.academy_id
      where tp.id = parent_notices.team_player_id
        and (
          a.owner_user_id = auth.uid()
          or exists (
            select 1 from public.memberships m
            where m.status = 'active'
              and m.user_id = auth.uid()
              and m.role in ('owner', 'assistant')
              and (
                m.academy_id = a.id
                or m.team_id = t.id
              )
          )
        )
    )
  );

-- FCM wake when a notice is inserted (same secret as chat push).
create or replace function public.enqueue_parent_notice_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  hook_secret text;
  req_id bigint;
begin
  select ds.decrypted_secret into hook_secret
  from vault.decrypted_secrets ds
  where ds.name = 'chat_push_hook_secret'
  limit 1;

  if hook_secret is null or length(trim(hook_secret)) = 0 then
    return NEW;
  end if;

  select net.http_post(
    url := 'https://iuvggtoamklqhuaswfmi.supabase.co/functions/v1/send-chat-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-matchcard-push-secret', hook_secret
    ),
    body := jsonb_build_object(
      'notice_id', NEW.id,
      'source', 'db_trigger'
    ),
    timeout_milliseconds := 5000
  ) into req_id;

  return NEW;
exception when others then
  return NEW;
end;
$$;

drop trigger if exists trg_parent_notice_push on public.parent_notices;
create trigger trg_parent_notice_push
after insert on public.parent_notices
for each row
execute function public.enqueue_parent_notice_push();
