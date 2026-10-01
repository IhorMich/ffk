# send-chat-push

Sends Firebase Cloud Messaging (FCM HTTP v1) when a chat message is created,
so the other phone gets a notification even if Matchcard is fully closed.

## Secrets (Dashboard → Edge Functions → Secrets)

| Name | Value |
|------|--------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Entire JSON of a Firebase **service account** key |

### How to get the service account JSON

1. [Firebase Console](https://console.firebase.google.com/) → project **Matchcard**
2. ⚙️ Project settings → **Service accounts**
3. **Generate new private key** → download JSON
4. Paste the whole file contents as the secret (one line is fine)

CLI:

```bash
npx supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON="$(cat ~/Downloads/matchcard-*.json)" --project-ref iuvggtoamklqhuaswfmi
```

Also enable **Cloud Messaging API** in Google Cloud for project `matchcard-c337e` if not already.

## Deploy

```bash
npx supabase functions deploy send-chat-push --project-ref iuvggtoamklqhuaswfmi
```

## Client

The app calls this after uploading a new chat message (`ParentCloud.notifyChatPush`).
Both sides need Push enabled so their FCM token is in `device_tokens`.
