# Matchcard Coach

Personal Free/Pro stays on-device. Coach can run **local** or **Supabase cloud**.

## Local (always works)

Academy → teams → roster → matches → parent invites → ratings → inbox cards.

## Cloud (Phase 1.1)

1. Create a project at supabase.com
2. Run `supabase/schema.sql` in the SQL editor
3. Put URL + anon key into `js/coach-config.js`
4. In Coach settings → **Sync now**

Auth uses Supabase when keys are set; otherwise email/password stays on-device.

## Assistants (up to 2)

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
| Assistants | 2 |
