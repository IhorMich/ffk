-- Distinguish team-wide coach broadcasts from 1:1 chat threads.
alter table public.player_chat_messages
  add column if not exists broadcast_id text not null default '';

create index if not exists player_chat_broadcast_idx
  on public.player_chat_messages(broadcast_id)
  where broadcast_id <> '';
