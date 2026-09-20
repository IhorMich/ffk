# Matchcard Coach

Personal Free/Pro stays on-device (`localStorage`). Coach is a **separate tree**.

## Phase 1 (this build)

Works **locally on the phone** without Supabase:

1. Coach account (email + password, this device)
2. Create **1 academy**
3. Add up to **10 teams**
4. Add up to **30 `team_players`** per team
5. Team invite code generated (parents later)

Data key: `ffk_coach_v1` — never mixed with personal roster/matches.

## Connect Supabase later

1. Create a project at supabase.com
2. Run `supabase/schema.sql` in the SQL editor
3. Put URL + anon key into `js/coach-config.js`
4. Phase 1.1 will swap `CoachStore` writes to the API (same UI)

## Limits

| | |
|---|---|
| Academies | 1 |
| Teams / academy | 10 |
| Players / team | 30 |
| Assistants | 2 (Phase 2+) |
