-- Matchcard Coach — Phase 1 schema
-- Personal Free/Pro stays in localStorage. This cloud tree is separate.
-- Apply in Supabase SQL editor when the project is ready.

create extension if not exists "pgcrypto";

create table if not exists public.academies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  age_group text not null default '' check (char_length(age_group) <= 24),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) between 1 and 40),
  last_name text not null default '' check (char_length(last_name) <= 40),
  number text not null default '' check (char_length(number) <= 4),
  position text not null default '' check (char_length(position) <= 8),
  birth_date text not null default '' check (char_length(birth_date) <= 10),
  created_at timestamptz not null default now()
);

-- role: owner | assistant | parent
-- parent membership MUST set team_player_id; coaches leave it null
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  academy_id uuid references public.academies(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  team_player_id uuid references public.team_players(id) on delete cascade,
  role text not null check (role in ('owner','assistant','parent')),
  created_at timestamptz not null default now(),
  constraint memberships_parent_needs_player
    check (role <> 'parent' or team_player_id is not null),
  constraint memberships_coach_needs_scope
    check (role = 'parent' or academy_id is not null or team_id is not null)
);

create unique index if not exists memberships_user_player_uq
  on public.memberships(user_id, team_player_id)
  where team_player_id is not null;

create index if not exists teams_academy_idx on public.teams(academy_id);
create index if not exists team_players_team_idx on public.team_players(team_id);
create index if not exists memberships_user_idx on public.memberships(user_id);
create index if not exists memberships_academy_idx on public.memberships(academy_id);

alter table public.academies enable row level security;
alter table public.teams enable row level security;
alter table public.team_players enable row level security;
alter table public.memberships enable row level security;

-- Helpers
create or replace function public.is_academy_coach(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.academy_id = aid
      and m.role in ('owner','assistant')
  );
$$;

create or replace function public.is_team_coach(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    join public.teams t on t.id = tid
    where m.user_id = auth.uid()
      and m.role in ('owner','assistant')
      and (m.team_id = tid or m.academy_id = t.academy_id)
  );
$$;

create or replace function public.parent_of_player(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.role = 'parent'
      and m.team_player_id = pid
  );
$$;

-- Academies: coaches of that academy
create policy academies_select on public.academies
  for select using (public.is_academy_coach(id) or owner_user_id = auth.uid());
create policy academies_insert on public.academies
  for insert with check (owner_user_id = auth.uid());
create policy academies_update on public.academies
  for update using (owner_user_id = auth.uid());
create policy academies_delete on public.academies
  for delete using (owner_user_id = auth.uid());

-- Teams: academy coaches
create policy teams_select on public.teams
  for select using (public.is_academy_coach(academy_id));
create policy teams_insert on public.teams
  for insert with check (public.is_academy_coach(academy_id));
create policy teams_update on public.teams
  for update using (public.is_academy_coach(academy_id));
create policy teams_delete on public.teams
  for delete using (public.is_academy_coach(academy_id));

-- team_players: coaches of team; parents ONLY their linked player
create policy team_players_select on public.team_players
  for select using (
    public.is_team_coach(team_id)
    or public.parent_of_player(id)
  );
create policy team_players_insert on public.team_players
  for insert with check (public.is_team_coach(team_id));
create policy team_players_update on public.team_players
  for update using (public.is_team_coach(team_id));
create policy team_players_delete on public.team_players
  for delete using (public.is_team_coach(team_id));

-- memberships: see own rows; owners manage academy memberships
create policy memberships_select on public.memberships
  for select using (user_id = auth.uid() or public.is_academy_coach(academy_id));
create policy memberships_insert on public.memberships
  for insert with check (
    user_id = auth.uid()
    or public.is_academy_coach(academy_id)
  );
create policy memberships_delete on public.memberships
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.academy_id = memberships.academy_id
        and m.role = 'owner'
    )
  );
