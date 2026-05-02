# NBA Playoff Database — Setup

## Step 1: Process the CSVs (local, one-time)

```bash
python3 scripts/process_data.py \
  --players "NBA_Playoff_Data_-_Player_Games.csv" \
  --teams   "NBA_Playoff_Data_-_Team_Games.csv" \
  --out     ./output
```
Outputs `output/player_games.csv` (91k rows) and `output/team_games.csv` (9k rows).

## Step 2: Create Supabase project

1. https://supabase.com → New Project
2. Dashboard → **SQL Editor** → paste and run `schema.sql`
   - Creates both tables, all 3 views, indexes, RLS policies

## Step 3: Import CSVs

1. Table Editor → `team_games` → Import data from CSV → `output/team_games.csv`
2. Table Editor → `player_games` → Import data from CSV → `output/player_games.csv`

> If the web importer times out for the 91k-row player file, use psql directly:
> `psql "postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres" -c "\copy player_games FROM 'output/player_games.csv' CSV HEADER"`

## Step 4: Add unique constraints (required for Upload tab)

Run in SQL Editor:
```sql
ALTER TABLE player_games ADD CONSTRAINT uq_player_date UNIQUE (player, date);
ALTER TABLE team_games   ADD CONSTRAINT uq_team_date   UNIQUE (team, date);
```

## Step 5: Get API keys

Settings → API → copy:
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- service_role secret → `SUPABASE_SERVICE_ROLE_KEY`

## Step 6: Local dev

```bash
cp .env.local.example .env.local   # fill in your keys
npm install
npm run dev
```
→ http://localhost:3000

## Step 7: Deploy to Vercel

```bash
vercel
```
Add the 3 env vars in Vercel Dashboard → Project → Settings → Environment Variables, then `vercel --prod`.

## Upload tab (in-season updates)

Export fresh CSVs from Stathead, upload both files together. The API re-derives series context and upserts. Always upload both files so series context stays accurate.

---

## File map

```
scripts/process_data.py   — one-time CSV processor
schema.sql                — Supabase schema (run once)
output/                   — processed CSVs ready for import
lib/scoring.ts            — GOAT engine (calcMult, buildLeaderboard)
lib/franchise.ts          — historical abbrev mapping
app/database/             — Game Log tab
app/aggregate/            — Career Leaders tab
app/goat/                 — GOAT Index tab
app/upload/               — Batch Upload tab
app/api/upload/           — Server-side CSV processor
```
