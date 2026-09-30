-- Coach trainings: one-off sessions + weekly recurring rules.
-- Parents linked to a player on the team can read the schedule.

create or replace function public.parent_of_team(tid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.parent_player_links l
    join public.team_players tp on tp.id = l.team_player_id
    where l.parent_user_id = auth.uid()
      and l.status <> 'revoked'
      and tp.team_id = tid
  )
  or exists (
    select 1
    from public.memberships m
    join public.team_players tp on tp.id = m.team_player_id
    where m.user_id = auth.uid()
      and m.role = 'parent'
      and m.status = 'active'
      and tp.team_id = tid
  );
$$;

create table if not exists public.training_rules (
  id text primary key,
  team_id text not null references public.teams(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 48),
  weekdays jsonb not null default '[]'::jsonb,
  start_time text not null default '' check (char_length(start_time) <= 8),
  end_time text not null default '' check (char_length(end_time) <= 8),
  address text not null default '' check (char_length(address) <= 120),
  notify_minutes int not null default 60 check (notify_minutes >= 0 and notify_minutes <= 24 * 60),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_trainings (
  id text primary key,
  team_id text not null references public.teams(id) on delete cascade,
  rule_id text references public.training_rules(id) on delete set null,
  date date not null,
  title text not null default '' check (char_length(title) <= 48),
  start_time text not null default '' check (char_length(start_time) <= 8),
  end_time text not null default '' check (char_length(end_time) <= 8),
  address text not null default '' check (char_length(address) <= 120),
  notify_minutes int not null default 60 check (notify_minutes >= 0 and notify_minutes <= 24 * 60),
  status text not null default 'scheduled' check (status in ('scheduled','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_rules_team_idx on public.training_rules(team_id);
create index if not exists team_trainings_team_date_idx on public.team_trainings(team_id, date);

alter table public.training_rules enable row level security;
alter table public.team_trainings enable row level security;

drop policy if exists training_rules_select on public.training_rules;
create policy training_rules_select on public.training_rules
  for select using (public.is_team_coach(team_id) or public.parent_of_team(team_id));
drop policy if exists training_rules_insert on public.training_rules;
create policy training_rules_insert on public.training_rules
  for insert with check (public.is_team_coach(team_id));
drop policy if exists training_rules_update on public.training_rules;
create policy training_rules_update on public.training_rules
  for update using (public.is_team_coach(team_id));
drop policy if exists training_rules_delete on public.training_rules;
create policy training_rules_delete on public.training_rules
  for delete using (public.is_team_coach(team_id));

drop policy if exists team_trainings_select on public.team_trainings;
create policy team_trainings_select on public.team_trainings
  for select using (public.is_team_coach(team_id) or public.parent_of_team(team_id));
drop policy if exists team_trainings_insert on public.team_trainings;
create policy team_trainings_insert on public.team_trainings
  for insert with check (public.is_team_coach(team_id));
drop policy if exists team_trainings_update on public.team_trainings;
create policy team_trainings_update on public.team_trainings
  for update using (public.is_team_coach(team_id));
drop policy if exists team_trainings_delete on public.team_trainings;
create policy team_trainings_delete on public.team_trainings
  for delete using (public.is_team_coach(team_id));
