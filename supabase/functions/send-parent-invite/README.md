# send-parent-invite

Sends parent invite emails via Resend.

## Secrets (Dashboard → Edge Functions → Secrets)

- `RESEND_API_KEY` — required ([API keys](https://resend.com/api-keys))
- `RESEND_FROM` — optional, e.g. `Matchcard <invite@yourdomain.com>`

Without a verified domain Resend only allows `onboarding@resend.dev` and can send only to your Resend account email.

## CLI

```bash
npx supabase secrets set RESEND_API_KEY=re_xxx --project-ref iuvggtoamklqhuaswfmi
npx supabase secrets set RESEND_FROM="Matchcard <invite@yourdomain.com>" --project-ref iuvggtoamklqhuaswfmi
```
