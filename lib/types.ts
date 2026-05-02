export interface PlayerGame {
  id: number; player: string; date: string; season: number
  team: string; franchise: string; home_away: 'H'|'A'|'N'
  opp: string; opp_franchise: string; result: 'W'|'L'
  team_score: number|null; opp_score: number|null; ot_periods: number
  mp: number|null
  fg: number|null; fga: number|null; fg_pct: number|null
  two_p: number|null; two_pa: number|null; two_p_pct: number|null
  three_p: number|null; three_pa: number|null; three_p_pct: number|null
  ft: number|null; fta: number|null; ft_pct: number|null; ts_pct: number|null
  orb: number|null; drb: number|null; trb: number|null
  ast: number|null; stl: number|null; blk: number|null
  tov: number|null; pf: number|null; pts: number|null
  gmsc_br: number|null; bpm: number|null; plus_minus: number|null
  era: 'pre74'|'mid'|'modern'; gmsc_computed: number
  round: number; series_my_wins: number; series_opp_wins: number
}

export interface PlayerSeasonStats {
  player: string; season: number; franchise: string
  games: number; wins: number; losses: number; win_pct: number
  pts_avg: number; ast_avg: number; trb_avg: number
  orb_avg: number; drb_avg: number; stl_avg: number; blk_avg: number
  tov_avg: number; pf_avg: number; mp_avg: number
  fg_pct_avg: number; three_p_pct_avg: number; ft_pct_avg: number
  ts_pct_avg: number; bpm_avg: number
  pts_total: number; ast_total: number; trb_total: number
  stl_total: number; blk_total: number
  gmsc_avg: number; gmsc_sum: number
  deepest_round: number
  finals_appearance: boolean
  won_championship: boolean
}

export interface CareerRow {
  player: string; games: number; wins: number; win_pct: number
  pts_avg: number; ast_avg: number; trb_avg: number
  stl_avg: number; blk_avg: number; tov_avg: number
  fg_pct: number; three_p_pct: number; ft_pct: number; ts_pct: number
  mp_avg: number; bpm_avg: number
  gmsc_avg: number; gmsc_sum: number; pts_total: number
  first_season: number; last_season: number; deepest_round: number
  finals_appearances: number; championships: number
}

export interface GoatGameRow {
  player: string; season: number; date: string; team: string; opp: string
  result: 'W'|'L'; pts: number|null; gmsc_computed: number
  round: number; series_my_wins: number; series_opp_wins: number; era: string
}

export interface GoatWeights {
  wT: number; wE: number; wR: number
  fB: number; cB: number; maxX: number; format: string
}

export interface FilterState {
  search: string; franchise: string; seasonMin: number; seasonMax: number
  round: string; result: string; homeAway: string
  ptsMin: string; ptsMax: string; astMin: string; astMax: string
  trbMin: string; trbMax: string; stlMin: string; stlMax: string
  blkMin: string; blkMax: string; tovMax: string; gmscMin: string
  sortCol: string; sortDir: 'asc'|'desc'
}
