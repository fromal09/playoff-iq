-- Run this in Supabase SQL Editor to fix championship detection
-- Two fixes:
-- 1. finals_round = 4 for all seasons 1984+ (prevents in-progress 2026 from using round 1 as "Finals")
-- 2. series_my_wins = 3 exactly (BO7 clinch only — prevents overcounting)

DROP VIEW IF EXISTS goat_game_rows;
DROP VIEW IF EXISTS player_career_stats;
DROP VIEW IF EXISTS player_season_stats;

CREATE VIEW player_season_stats AS
WITH season_max AS (
  SELECT season,
    CASE WHEN season >= 1984 THEN 4 ELSE MAX(round) END AS finals_round
  FROM player_games GROUP BY season
)
SELECT
  pg.player, pg.season, pg.franchise,
  COUNT(*) AS games,
  ROUND(AVG(pg.pts)::numeric,1) AS pts_avg,
  ROUND(AVG(pg.ast)::numeric,1) AS ast_avg,
  ROUND(AVG(pg.trb)::numeric,1) AS trb_avg,
  ROUND(AVG(pg.orb)::numeric,1) AS orb_avg,
  ROUND(AVG(pg.drb)::numeric,1) AS drb_avg,
  ROUND(AVG(pg.stl)::numeric,1) AS stl_avg,
  ROUND(AVG(pg.blk)::numeric,1) AS blk_avg,
  ROUND(AVG(pg.tov)::numeric,1) AS tov_avg,
  ROUND(AVG(pg.pf)::numeric,1)  AS pf_avg,
  ROUND(AVG(pg.mp)::numeric,1)  AS mp_avg,
  ROUND(AVG(pg.fg_pct)::numeric,3)       AS fg_pct_avg,
  ROUND(AVG(pg.three_p_pct)::numeric,3)  AS three_p_pct_avg,
  ROUND(AVG(pg.ft_pct)::numeric,3)       AS ft_pct_avg,
  ROUND(AVG(pg.ts_pct)::numeric,3)       AS ts_pct_avg,
  ROUND(AVG(pg.bpm)::numeric,1)          AS bpm_avg,
  SUM(pg.pts)  AS pts_total,
  SUM(pg.ast)  AS ast_total,
  SUM(pg.trb)  AS trb_total,
  SUM(pg.stl)  AS stl_total,
  SUM(pg.blk)  AS blk_total,
  ROUND(AVG(pg.gmsc_computed)::numeric,2) AS gmsc_avg,
  ROUND(SUM(pg.gmsc_computed)::numeric,2) AS gmsc_sum,
  MAX(pg.round) AS deepest_round,
  SUM(CASE WHEN pg.result='W' THEN 1 ELSE 0 END) AS wins,
  SUM(CASE WHEN pg.result='L' THEN 1 ELSE 0 END) AS losses,
  ROUND(SUM(CASE WHEN pg.result='W' THEN 1.0 ELSE 0 END) / NULLIF(COUNT(*),0) * 100, 1) AS win_pct,
  -- Finals appearance: played in the actual Finals round for that season's format
  BOOL_OR(pg.round = sm.finals_round) AS finals_appearance,
  -- Championship: won the BO7 clinching game in the Finals
  -- series_my_wins = 3 means going in with 3 wins; winning = 4th win = series over
  BOOL_OR(pg.round = sm.finals_round AND pg.result = 'W' AND pg.series_my_wins = 3) AS won_championship
FROM player_games pg
JOIN season_max sm ON pg.season = sm.season
GROUP BY pg.player, pg.season, pg.franchise
ORDER BY pg.player, pg.season;

CREATE VIEW player_career_stats AS
WITH season_max AS (
  SELECT season,
    CASE WHEN season >= 1984 THEN 4 ELSE MAX(round) END AS finals_round
  FROM player_games GROUP BY season
)
SELECT
  pg.player,
  COUNT(*) AS games,
  ROUND(AVG(pg.pts)::numeric,1)          AS pts_avg,
  ROUND(AVG(pg.ast)::numeric,1)          AS ast_avg,
  ROUND(AVG(pg.trb)::numeric,1)          AS trb_avg,
  ROUND(AVG(pg.stl)::numeric,1)          AS stl_avg,
  ROUND(AVG(pg.blk)::numeric,1)          AS blk_avg,
  ROUND(AVG(pg.tov)::numeric,1)          AS tov_avg,
  ROUND(AVG(pg.mp)::numeric,1)           AS mp_avg,
  ROUND(AVG(pg.bpm)::numeric,1)          AS bpm_avg,
  ROUND(AVG(pg.fg_pct)::numeric,3)       AS fg_pct,
  ROUND(AVG(pg.three_p_pct)::numeric,3)  AS three_p_pct,
  ROUND(AVG(pg.ft_pct)::numeric,3)       AS ft_pct,
  ROUND(AVG(pg.ts_pct)::numeric,3)       AS ts_pct,
  ROUND(AVG(pg.gmsc_computed)::numeric,2) AS gmsc_avg,
  ROUND(SUM(pg.gmsc_computed)::numeric,2) AS gmsc_sum,
  SUM(pg.pts) AS pts_total,
  MIN(pg.season) AS first_season,
  MAX(pg.season) AS last_season,
  MAX(pg.round)  AS deepest_round,
  SUM(CASE WHEN pg.result='W' THEN 1 ELSE 0 END) AS wins,
  ROUND(SUM(CASE WHEN pg.result='W' THEN 1.0 ELSE 0 END) / NULLIF(COUNT(*),0) * 100, 1) AS win_pct,
  COUNT(DISTINCT CASE WHEN pg.round = sm.finals_round THEN pg.season END) AS finals_appearances,
  COUNT(DISTINCT CASE WHEN pg.round = sm.finals_round AND pg.result = 'W' AND pg.series_my_wins = 3 THEN pg.season END) AS championships
FROM player_games pg
JOIN season_max sm ON pg.season = sm.season
GROUP BY pg.player
ORDER BY gmsc_sum DESC;

CREATE VIEW goat_game_rows AS
SELECT player, season, date, team, opp, result, pts, gmsc_computed,
       round, series_my_wins, series_opp_wins, era
FROM player_games ORDER BY date;
