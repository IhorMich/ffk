-- Apply after 20260921_cross_device.sql on existing projects.

alter table public.player_chat_messages
  add column if not exists deleted_by_parent boolean not null default false,
  add column if not exists deleted_by_coach boolean not null default false,
  add column if not exists edited_at timestamptz;

drop policy if exists player_chat_sender_update on public.player_chat_messages;
create policy player_chat_sender_update on public.player_chat_messages
  for update using (sender_user_id = auth.uid())
  with check (sender_user_id = auth.uid());

drop policy if exists player_chat_participants_select on public.player_chat_messages;
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
