# Matchcard Coach

Personal Free/Pro stays on-device (`localStorage`). Coach is a **separate tree**.

## Done locally (Phases 1–3)

1. Coach account on this phone
2. Academy → teams → roster
3. Parent QR / invite link + in-app inbox
4. Team matches: invite squad → set score → rate + comment → send cards to parents
5. History / analytics for the active team

Data key: `ffk_coach_v1` — never mixed with personal roster/matches.

## Next when asked: Phase 1.1 cloud (Supabase)

1. Create Supabase project
2. Run `supabase/schema.sql`
3. Put URL + anon key into `js/coach-config.js`
4. Wire `CoachStore` / inbox to Supabase auth + sync

## Later (Phase 4 ideas)

- Assistants (up to 2)
- Billing / Coach subscription
- Push notifications for invites and match cards

## Limits

| | |
|---|---|
| Academies | 1 |
| Teams / academy | 10 |
| Players / team | 50 |
| Assistants | 2 (later) |
