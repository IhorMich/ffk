-- Parent yes/no for a training. Coach can read the team's answers.
-- training_id is text: one-off ids and virtual occ_<rule>_<date> are both allowed.

create table if not exists public.training_rsvps (
  id text primary key,
  team_id text not null references public.teams(id) on delete cascade,
  training_id text not null,
  team_player_id text not null references public.team_players(id) on delete cascade,
  date date not null,
  rsvp text not null check (rsvp in ('accepted','declined')),
  rsvp_at timestamptz not null default now()
);

create index if not exists training_rsvps_team_date_idx
  on public.training_rsvps(team_id, date);

alter table public.training_rsvps enable row level security;

drop policy if exists training_rsvps_select on public.training_rsvps;
create policy training_rsvps_select on public.training_rsvps
  for select to authenticated
  using (public.is_team_coach(team_id) or public.parent_of_player(team_player_id));

drop policy if exists training_rsvps_insert on public.training_rsvps;
create policy training_rsvps_insert on public.training_rsvps
  for insert to authenticated
  with check (
    public.parent_of_player(team_player_id)
    and exists (
      select 1 from public.team_players tp
      where tp.id = training_rsvps.team_player_id
        and tp.team_id = training_rsvps.team_id
    )
  );

drop policy if exists training_rsvps_update on public.training_rsvps;
create policy training_rsvps_update on public.training_rsvps
  for update to authenticated
  using (public.parent_of_player(team_player_id))
  with check (
    public.parent_of_player(team_player_id)
    and exists (
      select 1 from public.team_players tp
      where tp.id = training_rsvps.team_player_id
        and tp.team_id = training_rsvps.team_id
    )
  );
