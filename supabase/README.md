# Matchcard Coach

Personal Free/Pro stays on-device. Coach can run **local** or **Supabase cloud**.

## Local (always works)

Academy → teams → roster → matches → parent invites → ratings → inbox cards.

## Cloud (cross-device foundation)

1. Create a project at supabase.com
2. Run `supabase/schema.sql` in the SQL editor
3. Run `supabase/migrations/20260921_cross_device.sql`
4. Run `supabase/migrations/20260921_message_deletion.sql`
5. Run `supabase/migrations/20260930_resolve_invite_by_code.sql`
6. In Authentication, keep the **Email** provider enabled. **Anonymous sign-ins** are
   optional: when the project does not offer them, the app asks the family for an
   email and password the first time it links a player.
7. Put URL + anon key into `js/coach-config.js` (never use `service_role` in the app)
8. Run `npm run cap:sync`, rebuild the app, then Coach settings → **Sync now**

All SQL files are safe to run again: policies are dropped before they are
recreated, so re-running never fails with “policy already exists”.

Auth uses Supabase when keys are set; otherwise email/password stays on-device.

The cross-device migration adds:

- secure long-token parent invitations;
- short `MC-XXXXXX` codes resolvable across devices (after `20260930_resolve_invite_by_code.sql`);
- permanent parent profile ↔ team player links by ID;
- parent match/stat synchronization;
- private player photo storage;
- per-player coach/family chat with separate read state.

Cross-device email / QR links can use either the long token (`open.html?token=…`)
or the short code (`open.html?code=…` / `MC-XXXXXX`).

## Assistants (up to 5)

Owner invites by email in Coach settings. Invitee signs in and enters code `MC-XXXXXX`.

## Billing

Test unlock **Enable Coach (test)** in Settings (same pattern as Pro). Store IAP later.

## Push

Coach / Player settings → **Enable push**.

1. Device registers an FCM token into `device_tokens` (needs `android/app/google-services.json`).
2. On each new chat upload the app calls Edge Function **`send-chat-push`**, which delivers
   FCM to the other user's tokens — works even when Matchcard is fully closed.
3. Set secret `FIREBASE_SERVICE_ACCOUNT_JSON` (see `supabase/functions/send-chat-push/README.md`).

Without the secret, in-app / minimized delivery still works via local polling; only
fully-killed delivery needs FCM.

## Limits

| | |
|---|---|
| Academies | 1 |
| Teams / academy | 10 |
| Players / team | 50 |
| Assistants | 5 |
