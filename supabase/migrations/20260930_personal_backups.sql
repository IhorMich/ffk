-- Pro personal device backup (auto-sync across phones).
-- Apply after cross-device foundation.

create table if not exists public.personal_backups (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.personal_backups enable row level security;

drop policy if exists personal_backups_owner_all on public.personal_backups;
create policy personal_backups_owner_all on public.personal_backups
  for all using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
