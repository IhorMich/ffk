-- Auto-notify FCM when a chat message is inserted (app fully closed).
-- Requires extension pg_net and vault secret chat_push_hook_secret.

create extension if not exists pg_net with schema extensions;

create or replace function public.enqueue_chat_push()
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
      'message_id', NEW.id,
      'source', 'db_trigger'
    ),
    timeout_milliseconds := 5000
  ) into req_id;

  return NEW;
exception when others then
  -- Never block chat insert if push wake fails.
  return NEW;
end;
$$;

drop trigger if exists trg_player_chat_push on public.player_chat_messages;
create trigger trg_player_chat_push
after insert on public.player_chat_messages
for each row
execute function public.enqueue_chat_push();
