# Matchcard Coach

Personal Free/Pro stays on-device (`localStorage`). Coach is a **separate tree**.

## Phase 1 (local)

1. Coach account (email + password, this device)
2. Create **1 academy**
3. Add up to **10 teams**
4. Add up to **50 `team_players`** per team
5. Team invite code generated (parents later)

Data key: `ffk_coach_v1` — never mixed with personal roster/matches.

## Phase 2 (local) — current

1. Create **team matches**
2. Rate each `team_player` via the live Matchcard UI (writes to Coach only)
3. Team analytics (matches / ratings / averages)

## Skipped / owed: Phase 1.1 cloud

Remind when asked “what’s left”:

1. Create Supabase project
2. Run `supabase/schema.sql`
3. Put URL + anon key into `js/coach-config.js`
4. Wire `CoachStore` to Supabase auth + sync

## Connect Supabase later

1. Create a project at supabase.com
2. Run `supabase/schema.sql` in the SQL editor
3. Put URL + anon key into `js/coach-config.js`
4. Phase 1.1 swaps `CoachStore` writes to the API (same UI)

## Limits

| | |
|---|---|
| Academies | 1 |
| Teams / academy | 10 |
| Players / team | 50 |
| Assistants | 2 (later) |
