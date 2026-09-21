-- Matchcard cross-device foundation.
-- Run after supabase/schema.sql in the Supabase SQL editor.

create table if not exists public.personal_players (
  id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 40),
  last_name text not null default '' check (char_length(last_name) <= 40),
  birth_date text not null default '' check (char_length(birth_date) <= 10),
  photo_path text not null default '' check (char_length(photo_path) <= 240),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.parent_player_links (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  personal_player_id text not null references public.personal_players(id) on delete cascade,
  team_player_id text not null references public.team_players(id) on delete cascade,
  invite_id text references public.parent_invites(id) on delete set null,
  status text not null default 'active' check (status in ('active','pending_leave','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parent_user_id, personal_player_id, team_player_id)
);

create table if not exists public.parent_matches (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  personal_player_id text not null references public.personal_players(id) on delete cascade,
  team_player_id text not null references public.team_players(id) on delete cascade,
  local_match_id text not null,
  match_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(parent_user_id, personal_player_id, local_match_id)
);

create table if not exists public.player_chat_messages (
  id text primary key,
  team_player_id text not null references public.team_players(id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('coach','parent')),
  body text not null check (char_length(trim(body)) between 1 and 500),
  read_by_parent boolean not null default false,
  read_by_coach boolean not null default false,
  deleted_by_parent boolean not null default false,
  deleted_by_coach boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.player_chat_messages
  add column if not exists deleted_by_parent boolean not null default false,
  add column if not exists deleted_by_coach boolean not null default false;

create index if not exists personal_players_owner_idx on public.personal_players(owner_user_id);
create index if not exists parent_links_parent_idx on public.parent_player_links(parent_user_id);
create index if not exists parent_links_team_player_idx on public.parent_player_links(team_player_id);
create index if not exists parent_matches_team_player_idx on public.parent_matches(team_player_id);
create index if not exists player_chat_team_player_idx on public.player_chat_messages(team_player_id, created_at);

alter table public.personal_players enable row level security;
alter table public.parent_player_links enable row level security;
alter table public.parent_matches enable row level security;
alter table public.player_chat_messages enable row level security;

create policy personal_players_owner_all on public.personal_players
  for all using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
create policy personal_players_coach_select on public.personal_players
  for select using (
    exists (
      select 1
      from public.parent_player_links l
      join public.team_players tp on tp.id = l.team_player_id
      where l.personal_player_id = personal_players.id
        and l.status <> 'revoked'
        and public.is_team_coach(tp.team_id)
    )
  );

create policy parent_links_participants_select on public.parent_player_links
  for select using (
    parent_user_id = auth.uid()
    or exists (
      select 1 from public.team_players tp
      where tp.id = parent_player_links.team_player_id
        and public.is_team_coach(tp.team_id)
    )
  );
create policy parent_links_parent_update on public.parent_player_links
  for update using (parent_user_id = auth.uid())
  with check (parent_user_id = auth.uid());

create policy parent_matches_participants_select on public.parent_matches
  for select using (
    parent_user_id = auth.uid()
    or exists (
      select 1 from public.team_players tp
      where tp.id = parent_matches.team_player_id
        and public.is_team_coach(tp.team_id)
    )
  );
create policy parent_matches_parent_insert on public.parent_matches
  for insert with check (
    parent_user_id = auth.uid()
    and exists (
      select 1 from public.parent_player_links l
      where l.parent_user_id = auth.uid()
        and l.personal_player_id = parent_matches.personal_player_id
        and l.team_player_id = parent_matches.team_player_id
        and l.status <> 'revoked'
    )
  );
create policy parent_matches_parent_update on public.parent_matches
  for update using (parent_user_id = auth.uid())
  with check (
    parent_user_id = auth.uid()
    and exists (
      select 1 from public.parent_player_links l
      where l.parent_user_id = auth.uid()
        and l.personal_player_id = parent_matches.personal_player_id
        and l.team_player_id = parent_matches.team_player_id
        and l.status <> 'revoked'
    )
  );
create policy parent_matches_parent_delete on public.parent_matches
  for delete using (parent_user_id = auth.uid());

create policy player_chat_participants_select on public.player_chat_messages
  for select using (
    (parent_user_id = auth.uid() and not deleted_by_parent)
    or (
      not deleted_by_coach
      and exists (
        select 1 from public.team_players tp
        where tp.id = player_chat_messages.team_player_id
          and public.is_team_coach(tp.team_id)
      )
    )
  );
create policy player_chat_participants_insert on public.player_chat_messages
  for insert with check (
    sender_user_id = auth.uid()
    and (
      (
        sender_role = 'parent'
        and parent_user_id = auth.uid()
        and exists (
          select 1 from public.parent_player_links l
          where l.parent_user_id = auth.uid()
            and l.team_player_id = player_chat_messages.team_player_id
            and l.status <> 'revoked'
        )
      )
      or (
        sender_role = 'coach'
        and exists (
          select 1
          from public.parent_player_links l
          join public.team_players tp on tp.id = l.team_player_id
          where l.parent_user_id = player_chat_messages.parent_user_id
            and l.team_player_id = player_chat_messages.team_player_id
            and l.status <> 'revoked'
            and public.is_team_coach(tp.team_id)
        )
      )
    )
  );
-- A long random token is safe to resolve publicly. The six-character display
-- code remains local/test-only and is deliberately not exposed by this RPC.
create or replace function public.resolve_parent_invite(invite_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select pi.payload
  from public.parent_invites pi
  where pi.token = invite_token
    and pi.status = 'open'
    and pi.created_at > now() - interval '30 days'
  limit 1;
$$;

create or replace function public.claim_parent_invite(
  invite_token text,
  personal_id text,
  personal_first_name text default '',
  personal_last_name text default '',
  personal_birth_date text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.parent_invites%rowtype;
  link_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into inv
  from public.parent_invites
  where token = invite_token
    and status = 'open'
    and created_at > now() - interval '30 days'
  for update;

  if inv.id is null then
    raise exception 'invite not found or expired';
  end if;

  insert into public.personal_players(
    id, owner_user_id, first_name, last_name, birth_date, updated_at
  ) values (
    personal_id, auth.uid(), left(personal_first_name, 40),
    left(personal_last_name, 40), left(personal_birth_date, 10), now()
  )
  on conflict(id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    birth_date = excluded.birth_date,
    updated_at = now()
  where personal_players.owner_user_id = auth.uid();

  if not exists (
    select 1 from public.personal_players
    where id = personal_id and owner_user_id = auth.uid()
  ) then
    raise exception 'personal profile id already belongs to another account';
  end if;

  insert into public.parent_player_links(
    parent_user_id, personal_player_id, team_player_id, invite_id
  ) values (
    auth.uid(), personal_id, inv.team_player_id, inv.id
  )
  on conflict(parent_user_id, personal_player_id, team_player_id)
  do update set status = 'active', updated_at = now()
  returning id into link_id;

  insert into public.memberships(
    id, user_id, team_id, team_player_id, role, invite_code, status
  ) values (
    'pmem_' || replace(link_id::text, '-', ''),
    auth.uid(), inv.team_id, inv.team_player_id, 'parent', inv.code, 'active'
  )
  on conflict(user_id, team_player_id) where team_player_id is not null
  do update set status = 'active', invite_code = excluded.invite_code;

  update public.parent_invites
  set status = 'claimed', updated_at = now()
  where id = inv.id;

  return inv.payload;
end;
$$;

revoke all on function public.resolve_parent_invite(text) from public;
revoke all on function public.claim_parent_invite(text,text,text,text,text) from public;
grant execute on function public.resolve_parent_invite(text) to anon, authenticated;
grant execute on function public.claim_parent_invite(text,text,text,text,text) to authenticated;

create or replace function public.mark_player_chat_read(message_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.player_chat_messages m
  set
    read_by_parent = case when m.parent_user_id = auth.uid() then true else m.read_by_parent end,
    read_by_coach = case
      when exists (
        select 1 from public.team_players tp
        where tp.id = m.team_player_id and public.is_team_coach(tp.team_id)
      ) then true
      else m.read_by_coach
    end
  where m.id = message_id
    and (
      m.parent_user_id = auth.uid()
      or exists (
        select 1 from public.team_players tp
        where tp.id = m.team_player_id and public.is_team_coach(tp.team_id)
      )
    );
end;
$$;

revoke all on function public.mark_player_chat_read(text) from public;
grant execute on function public.mark_player_chat_read(text) to authenticated;

create or replace function public.delete_player_chat_message(message_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.player_chat_messages m
  set
    deleted_by_parent = case when m.parent_user_id = auth.uid() then true else m.deleted_by_parent end,
    deleted_by_coach = case
      when exists (
        select 1 from public.team_players tp
        where tp.id = m.team_player_id and public.is_team_coach(tp.team_id)
      ) then true
      else m.deleted_by_coach
    end
  where m.id = message_id
    and (
      m.parent_user_id = auth.uid()
      or exists (
        select 1 from public.team_players tp
        where tp.id = m.team_player_id and public.is_team_coach(tp.team_id)
      )
    );
end;
$$;

revoke all on function public.delete_player_chat_message(text) from public;
grant execute on function public.delete_player_chat_message(text) to authenticated;

insert into storage.buckets(id, name, public)
values ('player-media', 'player-media', false)
on conflict(id) do update set public = false;

create policy player_media_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'player-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy player_media_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'player-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy player_media_participants_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'player-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.parent_player_links l
        join public.team_players tp on tp.id = l.team_player_id
        where l.personal_player_id = (storage.foldername(name))[2]
          and l.status <> 'revoked'
          and public.is_team_coach(tp.team_id)
      )
    )
  );
