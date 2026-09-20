-- Matchcard Coach — full local+cloud schema (text ids match on-device CoachStore).
-- Apply in Supabase SQL editor when the project is ready.
-- Personal Free/Pro stays in localStorage. This cloud tree is separate.

create extension if not exists "pgcrypto";

create table if not exists public.academies (
  id text primary key,
  name text not null check (char_length(trim(name)) between 1 and 80),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id text primary key,
  academy_id text not null references public.academies(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  age_group text not null default '' check (char_length(age_group) <= 24),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.team_players (
  id text primary key,
  team_id text not null references public.teams(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) between 1 and 40),
  last_name text not null default '' check (char_length(last_name) <= 40),
  number text not null default '' check (char_length(number) <= 4),
  position text not null default '' check (char_length(position) <= 8),
  birth_date text not null default '' check (char_length(birth_date) <= 10),
  contact text not null default '' check (char_length(contact) <= 80),
  -- Private staff notes: visible only to owner/assistant via RLS (never sent to parents).
  coach_notes text not null default '' check (char_length(coach_notes) <= 2000),
  created_at timestamptz not null default now()
);

-- Existing projects: run once
-- alter table public.team_players
--   add column if not exists coach_notes text not null default '';
-- alter table public.team_players
--   drop constraint if exists team_players_coach_notes_check;
-- alter table public.team_players
--   add constraint team_players_coach_notes_check check (char_length(coach_notes) <= 2000);

-- role: owner | assistant | parent
create table if not exists public.memberships (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  academy_id text references public.academies(id) on delete cascade,
  team_id text references public.teams(id) on delete cascade,
  team_player_id text references public.team_players(id) on delete cascade,
  role text not null check (role in ('owner','assistant','parent')),
  email text not null default '',
  invite_code text not null default '',
  status text not null default 'active' check (status in ('pending','active','revoked')),
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

create or replace function public.is_academy_coach(aid text)
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
      and m.status = 'active'
  );
$$;

create or replace function public.is_team_coach(tid text)
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
      and m.status = 'active'
      and (m.team_id = tid or m.academy_id = t.academy_id)
  );
$$;

create or replace function public.parent_of_player(pid text)
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
      and m.status = 'active'
  );
$$;

create policy academies_select on public.academies
  for select using (public.is_academy_coach(id) or owner_user_id = auth.uid());
create policy academies_insert on public.academies
  for insert with check (owner_user_id = auth.uid());
create policy academies_update on public.academies
  for update using (owner_user_id = auth.uid());
create policy academies_delete on public.academies
  for delete using (owner_user_id = auth.uid());

create policy teams_select on public.teams
  for select using (public.is_academy_coach(academy_id));
create policy teams_insert on public.teams
  for insert with check (public.is_academy_coach(academy_id));
create policy teams_update on public.teams
  for update using (public.is_academy_coach(academy_id));
create policy teams_delete on public.teams
  for delete using (public.is_academy_coach(academy_id));

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

create policy memberships_select on public.memberships
  for select using (user_id = auth.uid() or public.is_academy_coach(academy_id));
create policy memberships_insert on public.memberships
  for insert with check (
    user_id = auth.uid()
    or public.is_academy_coach(academy_id)
  );
create policy memberships_update on public.memberships
  for update using (
    user_id = auth.uid()
    or exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.academy_id = memberships.academy_id
        and m.role = 'owner'
        and m.status = 'active'
    )
  );
create policy memberships_delete on public.memberships
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.academy_id = memberships.academy_id
        and m.role = 'owner'
        and m.status = 'active'
    )
  );

create table if not exists public.team_matches (
  id text primary key,
  team_id text not null references public.teams(id) on delete cascade,
  date date not null,
  opponent text not null check (char_length(trim(opponent)) between 1 and 48),
  address text not null default '' check (char_length(address) <= 120),
  score text not null default '' check (char_length(score) <= 16),
  venue text not null default 'home' check (venue in ('home','away')),
  kind text not null default 'league' check (kind in ('league','friendly','cup','tournament')),
  status text not null default 'upcoming' check (status in ('upcoming','played')),
  squad jsonb not null default '[]'::jsonb,
  kickoff text not null default '' check (char_length(kickoff) <= 8),
  tournament text not null default '' check (char_length(tournament) <= 48),
  event_id text not null default '' check (char_length(event_id) <= 40),
  comment text not null default '' check (char_length(comment) <= 400),
  created_at timestamptz not null default now()
);

-- Existing projects: run once
-- alter table public.team_matches add column if not exists kickoff text not null default '';
-- alter table public.team_matches add column if not exists tournament text not null default '';
-- alter table public.team_matches add column if not exists event_id text not null default '';
-- alter table public.team_matches add column if not exists comment text not null default '';

create table if not exists public.ratings (
  id text primary key,
  match_id text not null references public.team_matches(id) on delete cascade,
  team_id text not null references public.teams(id) on delete cascade,
  team_player_id text not null references public.team_players(id) on delete cascade,
  player_name text not null default '',
  pitch_pos text not null default '',
  position text not null default 'fwd',
  minutes int not null default 60,
  format text not null default '2x30',
  match_len int not null default 60,
  role text not null default 'start',
  comment text not null default '',
  counts jsonb not null default '{}'::jsonb,
  behaviors jsonb not null default '{}'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  action_rating numeric not null default 6,
  effort_rating numeric not null default 6,
  rating numeric not null default 6,
  updated_at timestamptz not null default now(),
  unique (match_id, team_player_id)
);

create index if not exists team_matches_team_idx on public.team_matches(team_id);
create index if not exists ratings_match_idx on public.ratings(match_id);
create index if not exists ratings_player_idx on public.ratings(team_player_id);

alter table public.team_matches enable row level security;
alter table public.ratings enable row level security;

create policy team_matches_select on public.team_matches
  for select using (public.is_team_coach(team_id));
create policy team_matches_insert on public.team_matches
  for insert with check (public.is_team_coach(team_id));
create policy team_matches_update on public.team_matches
  for update using (public.is_team_coach(team_id));
create policy team_matches_delete on public.team_matches
  for delete using (public.is_team_coach(team_id));

create policy ratings_select on public.ratings
  for select using (
    public.is_team_coach(team_id)
    or public.parent_of_player(team_player_id)
  );
create policy ratings_insert on public.ratings
  for insert with check (public.is_team_coach(team_id));
create policy ratings_update on public.ratings
  for update using (public.is_team_coach(team_id));
create policy ratings_delete on public.ratings
  for delete using (public.is_team_coach(team_id));

create table if not exists public.parent_invites (
  id text primary key,
  token text not null unique,
  code text not null,
  team_id text not null references public.teams(id) on delete cascade,
  team_player_id text not null references public.team_players(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','claimed','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists parent_invites_player_idx on public.parent_invites(team_player_id);
create index if not exists parent_invites_code_idx on public.parent_invites(code);

alter table public.parent_invites enable row level security;
create policy parent_invites_select on public.parent_invites
  for select using (public.is_team_coach(team_id));
create policy parent_invites_insert on public.parent_invites
  for insert with check (public.is_team_coach(team_id));
create policy parent_invites_update on public.parent_invites
  for update using (public.is_team_coach(team_id));
create policy parent_invites_delete on public.parent_invites
  for delete using (public.is_team_coach(team_id));

-- Push device tokens (FCM / APNs via Capacitor)
create table if not exists public.device_tokens (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'unknown',
  updated_at timestamptz not null default now()
);
create index if not exists device_tokens_user_idx on public.device_tokens(user_id);
alter table public.device_tokens enable row level security;
create policy device_tokens_own on public.device_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Coach subscription mirror (Store billing later; test flag syncs here)
create table if not exists public.coach_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'coach_month' check (plan in ('coach_month','coach_year','test')),
  status text not null default 'active' check (status in ('active','canceled','expired')),
  updated_at timestamptz not null default now()
);
alter table public.coach_subscriptions enable row level security;
create policy coach_subscriptions_own on public.coach_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
