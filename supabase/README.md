# Matchcard Coach

Personal Free/Pro stays on-device. Coach can run **local** or **Supabase cloud**.

## Local (always works)

Academy → teams → roster → matches → parent invites → ratings → inbox cards.

## Cloud (cross-device foundation)

1. Create a project at supabase.com
2. Run `supabase/schema.sql` in the SQL editor
3. Run `supabase/migrations/20260921_cross_device.sql`
4. Run `supabase/migrations/20260921_message_deletion.sql`
5. In Authentication, keep the **Email** provider enabled. **Anonymous sign-ins** are
   optional: when the project does not offer them, the app asks the family for an
   email and password the first time it links a player.
6. Put URL + anon key into `js/coach-config.js` (never use `service_role` in the app)
7. Run `npm run cap:sync`, rebuild the app, then Coach settings → **Sync now**

All three SQL files are safe to run again: policies are dropped before they are
recreated, so re-running never fails with “policy already exists”.

Auth uses Supabase when keys are set; otherwise email/password stays on-device.

The cross-device migration adds:

- secure long-token parent invitations;
- permanent parent profile ↔ team player links by ID;
- parent match/stat synchronization;
- private player photo storage;
- per-player coach/family chat with separate read state.

Short six-character codes remain same-device test mode. Cross-device email links
use the long random token but show only a short HTTPS URL.

## Assistants (up to 5)

Owner invites by email in Coach settings. Invitee signs in and enters code `MC-XXXXXX`.

## Billing

Test unlock **Enable Coach (test)** in Settings (same pattern as Pro). Store IAP later.

## Push

Coach settings → Enable push. Uses Capacitor Push Notifications on device.
Cloud delivery of remote pushes needs FCM/APNs + a Supabase Edge Function (token table is ready: `device_tokens`).

## Limits

| | |
|---|---|
| Academies | 1 |
| Teams / academy | 10 |
| Players / team | 50 |
| Assistants | 5 |
