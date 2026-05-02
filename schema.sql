-- NBA Playoff Database — run in Supabase SQL editor before importing CSVs
CREATE TABLE player_games (
  id BIGSERIAL PRIMARY KEY, player TEXT NOT NULL, date DATE NOT NULL,
  season SMALLINT NOT NULL, team TEXT NOT NULL, franchise TEXT NOT NULL,
  home_away CHAR(1) NOT NULL DEFAULT 'H', opp TEXT NOT NULL, opp_franchise TEXT NOT NULL,
  result CHAR(1) NOT NULL, team_score SMALLINT, opp_score SMALLINT, ot_periods SMALLINT NOT NULL DEFAULT 0,
  mp NUMERIC(5,1), fg SMALLINT, fga SMALLINT, fg_pct NUMERIC(5,3),
  two_p SMALLINT, two_pa SMALLINT, two_p_pct NUMERIC(5,3),
  three_p SMALLINT, three_pa SMALLINT, three_p_pct NUMERIC(5,3),
  ft SMALLINT, fta SMALLINT, ft_pct NUMERIC(5,3), ts_pct NUMERIC(5,3),
  orb SMALLINT, drb SMALLINT, trb SMALLINT,
  ast SMALLINT, stl SMALLINT, blk SMALLINT, tov SMALLINT, pf SMALLINT, pts SMALLINT,
  gmsc_br NUMERIC(6,1), bpm NUMERIC(6,1), plus_minus SMALLINT,
  era TEXT NOT NULL, gmsc_computed NUMERIC(7,2) NOT NULL DEFAULT 0,
  round SMALLINT NOT NULL DEFAULT 1, series_my_wins SMALLINT NOT NULL DEFAULT 0,
  series_opp_wins SMALLINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE team_games (
  id BIGSERIAL PRIMARY KEY, team TEXT NOT NULL, franchise TEXT NOT NULL,
  date DATE NOT NULL, season SMALLINT NOT NULL, home_away CHAR(1) NOT NULL DEFAULT 'H',
  opp TEXT NOT NULL, opp_franchise TEXT NOT NULL, result CHAR(1) NOT NULL,
  team_score SMALLINT, opp_score SMALLINT, ot_periods SMALLINT NOT NULL DEFAULT 0,
  fg SMALLINT, fga SMALLINT, fg_pct NUMERIC(5,3), two_p SMALLINT, two_pa SMALLINT, two_p_pct NUMERIC(5,3),
  three_p SMALLINT, three_pa SMALLINT, three_p_pct NUMERIC(5,3),
  ft SMALLINT, fta SMALLINT, ft_pct NUMERIC(5,3),
  opp_fg SMALLINT, opp_fga SMALLINT, opp_fg_pct NUMERIC(5,3),
  opp_two_p SMALLINT, opp_two_pa SMALLINT, opp_two_p_pct NUMERIC(5,3),
  opp_three_p SMALLINT, opp_three_pa SMALLINT, opp_three_p_pct NUMERIC(5,3),
  opp_ft SMALLINT, opp_fta SMALLINT, opp_ft_pct NUMERIC(5,3),
  round SMALLINT, series_my_wins SMALLINT, series_opp_wins SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Indexes
CREATE INDEX idx_pg_player ON player_games(lower(player));
CREATE INDEX idx_pg_season ON player_games(season);
CREATE INDEX idx_pg_date ON player_games(date);
CREATE INDEX idx_pg_franchise ON player_games(franchise);
CREATE INDEX idx_pg_round ON player_games(round);
CREATE INDEX idx_pg_result ON player_games(result);
CREATE INDEX idx_pg_pts ON player_games(pts);
CREATE INDEX idx_pg_gmsc ON player_games(gmsc_computed);
CREATE INDEX idx_tg_team ON team_games(team);
CREATE INDEX idx_tg_season ON team_games(season);
-- Player season aggregates view
CREATE VIEW player_season_stats AS
SELECT player, season, franchise,
  COUNT(*) AS games,
  ROUND(AVG(pts)::numeric,1) AS pts_avg, ROUND(AVG(ast)::numeric,1) AS ast_avg,
  ROUND(AVG(trb)::numeric,1) AS trb_avg, ROUND(AVG(orb)::numeric,1) AS orb_avg,
  ROUND(AVG(drb)::numeric,1) AS drb_avg, ROUND(AVG(stl)::numeric,1) AS stl_avg,
  ROUND(AVG(blk)::numeric,1) AS blk_avg, ROUND(AVG(tov)::numeric,1) AS tov_avg,
  ROUND(AVG(pf)::numeric,1) AS pf_avg, ROUND(AVG(mp)::numeric,1) AS mp_avg,
  ROUND(AVG(fg_pct)::numeric,3) AS fg_pct_avg,
  ROUND(AVG(three_p_pct)::numeric,3) AS three_p_pct_avg,
  ROUND(AVG(ft_pct)::numeric,3) AS ft_pct_avg,
  ROUND(AVG(ts_pct)::numeric,3) AS ts_pct_avg,
  ROUND(AVG(bpm)::numeric,1) AS bpm_avg,
  SUM(pts) AS pts_total, SUM(ast) AS ast_total, SUM(trb) AS trb_total,
  SUM(stl) AS stl_total, SUM(blk) AS blk_total,
  ROUND(AVG(gmsc_computed)::numeric,2) AS gmsc_avg,
  ROUND(SUM(gmsc_computed)::numeric,2) AS gmsc_sum,
  MAX(round) AS deepest_round,
  SUM(CASE WHEN result='W' THEN 1 ELSE 0 END) AS wins,
  SUM(CASE WHEN result='L' THEN 1 ELSE 0 END) AS losses
FROM player_games GROUP BY player, season, franchise ORDER BY player, season;
-- Player career totals view
CREATE VIEW player_career_stats AS
SELECT player,
  COUNT(*) AS games, ROUND(AVG(pts)::numeric,1) AS pts_avg, ROUND(AVG(ast)::numeric,1) AS ast_avg,
  ROUND(AVG(trb)::numeric,1) AS trb_avg, ROUND(AVG(stl)::numeric,1) AS stl_avg,
  ROUND(AVG(blk)::numeric,1) AS blk_avg, ROUND(AVG(tov)::numeric,1) AS tov_avg,
  ROUND(AVG(mp)::numeric,1) AS mp_avg, ROUND(AVG(bpm)::numeric,1) AS bpm_avg,
  ROUND(AVG(fg_pct)::numeric,3) AS fg_pct, ROUND(AVG(three_p_pct)::numeric,3) AS three_p_pct,
  ROUND(AVG(ft_pct)::numeric,3) AS ft_pct, ROUND(AVG(ts_pct)::numeric,3) AS ts_pct,
  ROUND(AVG(gmsc_computed)::numeric,2) AS gmsc_avg, ROUND(SUM(gmsc_computed)::numeric,2) AS gmsc_sum,
  SUM(pts) AS pts_total, MIN(season) AS first_season, MAX(season) AS last_season,
  MAX(round) AS deepest_round, SUM(CASE WHEN result='W' THEN 1 ELSE 0 END) AS wins
FROM player_games GROUP BY player ORDER BY gmsc_sum DESC;
-- GOAT scoring lightweight view (for client-side multiplier computation)
CREATE VIEW goat_game_rows AS
SELECT player, season, date, team, opp, result, pts, gmsc_computed, round, series_my_wins, series_opp_wins, era
FROM player_games ORDER BY date;
-- RLS: public read only
ALTER TABLE player_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_games   ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read player_games" ON player_games FOR SELECT USING (true);
CREATE POLICY "Public read team_games"   ON team_games   FOR SELECT USING (true);
