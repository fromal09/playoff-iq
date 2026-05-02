-- Add missing total columns to player_career_stats view
-- Run in Supabase SQL Editor

DROP VIEW IF EXISTS player_career_stats;

CREATE VIEW player_career_stats AS
WITH team_season_max AS (
  SELECT season, team, MAX(round) AS team_max_round
  FROM player_games GROUP BY season, team
),
clinch_games AS (
  SELECT DISTINCT pg.season, pg.team, pg.opp AS opponent, pg.date AS clinch_date
  FROM player_games pg
  JOIN team_season_max tsm
    ON pg.season = tsm.season AND pg.team = tsm.team AND pg.round = tsm.team_max_round
  WHERE pg.result = 'W'
    AND pg.series_my_wins = 3
    AND (pg.season < 1984 OR tsm.team_max_round = 4)
),
season_latest_clinch AS (
  SELECT season, MAX(clinch_date) AS champ_date FROM clinch_games GROUP BY season
),
champ_teams AS (
  SELECT DISTINCT cg.season, cg.team AS champ, cg.opponent AS runner_up
  FROM clinch_games cg
  JOIN season_latest_clinch slc ON cg.season = slc.season AND cg.clinch_date = slc.champ_date
),
finalist_teams AS (
  SELECT season, champ    AS team FROM champ_teams
  UNION
  SELECT season, runner_up AS team FROM champ_teams
)
SELECT
  pg.player,
  COUNT(*) AS games,
  ROUND(AVG(pg.pts)::numeric,1)           AS pts_avg,
  ROUND(AVG(pg.ast)::numeric,1)           AS ast_avg,
  ROUND(AVG(pg.trb)::numeric,1)           AS trb_avg,
  ROUND(AVG(pg.stl)::numeric,1)           AS stl_avg,
  ROUND(AVG(pg.blk)::numeric,1)           AS blk_avg,
  ROUND(AVG(pg.tov)::numeric,1)           AS tov_avg,
  ROUND(AVG(pg.mp)::numeric,1)            AS mp_avg,
  ROUND(AVG(pg.bpm)::numeric,1)           AS bpm_avg,
  ROUND(AVG(pg.fg_pct)::numeric,3)        AS fg_pct,
  ROUND(AVG(pg.three_p_pct)::numeric,3)   AS three_p_pct,
  ROUND(AVG(pg.ft_pct)::numeric,3)        AS ft_pct,
  ROUND(AVG(pg.ts_pct)::numeric,3)        AS ts_pct,
  ROUND(AVG(pg.gmsc_computed)::numeric,2) AS gmsc_avg,
  ROUND(SUM(pg.gmsc_computed)::numeric,2) AS gmsc_sum,
  SUM(pg.pts)  AS pts_total,
  SUM(pg.ast)  AS ast_total,
  SUM(pg.trb)  AS trb_total,
  SUM(pg.stl)  AS stl_total,
  SUM(pg.blk)  AS blk_total,
  MIN(pg.season) AS first_season,
  MAX(pg.season) AS last_season,
  MAX(pg.round)  AS deepest_round,
  SUM(CASE WHEN pg.result='W' THEN 1 ELSE 0 END) AS wins,
  ROUND(SUM(CASE WHEN pg.result='W' THEN 1.0 ELSE 0 END) / NULLIF(COUNT(*),0) * 100, 1) AS win_pct,
  COUNT(DISTINCT CASE WHEN pg.round = tsm.team_max_round AND ft.team IS NOT NULL
    THEN pg.season END) AS finals_appearances,
  COUNT(DISTINCT CASE WHEN ct.champ IS NOT NULL THEN pg.season END) AS championships
FROM player_games pg
JOIN  team_season_max tsm ON pg.season = tsm.season AND pg.team = tsm.team
LEFT JOIN champ_teams    ct ON pg.season = ct.season  AND pg.team = ct.champ
LEFT JOIN finalist_teams ft ON pg.season = ft.season  AND pg.team = ft.team
GROUP BY pg.player
ORDER BY gmsc_sum DESC;
