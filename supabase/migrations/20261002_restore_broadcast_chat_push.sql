-- Re-enable per-row FCM wake for all chat inserts (including broadcasts).
-- Dedupe for team broadcasts is handled in send-chat-push via chat_broadcast_pushes
-- (one wake per parent_user_id + broadcast_id).
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
  return NEW;
end;
$$;
