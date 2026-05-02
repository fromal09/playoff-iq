import type { GoatWeights, GoatGameRow } from './types'

export const ABS_MAX = 16

export const FORMATS: Record<string, { label: string; rounds: number[] }> = {
  modern:   { label:'2003+ · 4 rounds, all BO7',        rounds:[7,7,7,7] },
  bo5first: { label:'1984–2002 · R1 BO5, rest BO7',     rounds:[5,7,7,7] },
  bo3first: { label:'1975–1983 · R1 BO3, rest BO7',     rounds:[3,7,7,7] },
  three7:   { label:'3 rounds · all BO7',                rounds:[7,7,7]   },
  three577: { label:'3 rounds · R1 BO5, rest BO7',       rounds:[5,7,7]   },
  two7:     { label:'2 rounds · both BO7',               rounds:[7,7]     },
  two57:    { label:'2 rounds · BO5 then BO7',           rounds:[5,7]     },
  two55:    { label:'2 rounds · both BO5',               rounds:[5,5]     },
  two35:    { label:'2 rounds · BO3 then BO5',           rounds:[3,5]     },
}

export function getFormatInfo(key: string) {
  const rounds = FORMATS[key]?.rounds ?? FORMATS.modern.rounds
  const winsPerRound = rounds.map(r => Math.ceil((r + 1) / 2))
  return {
    rounds,
    winsPerRound,
    maxWins: winsPerRound.reduce((a, b) => a + b, 0),
    numRounds: rounds.length,
  }
}

export interface MultResult {
  mult: number
  normD: number
  normE: number
  normR: number
  winsNeeded: number
}

export function calcMult(
  round: number,
  myWins: number,
  oppWins: number,
  w: GoatWeights,
): MultResult {
  const fmt = getFormatInfo(w.format)
  const ri = round - 1
  const seriesWins = fmt.winsPerRound[ri] ?? 4

  // normD — absolute title proximity (ABS_MAX=16 as fixed scale)
  const winsToClose = seriesWins - myWins
  const futureWins  = fmt.winsPerRound.slice(round).reduce((a, b) => a + b, 0)
  const winsNeeded  = winsToClose + futureWins
  const normD = Math.max(0, Math.min(1, (ABS_MAX - winsNeeded) / (ABS_MAX - 1)))

  // normE — series tension, symmetric, scaled to series length
  const l = Math.max(myWins, oppWins)
  const t = Math.min(myWins, oppWins)
  const normE = seriesWins <= 1
    ? 1
    : Math.max(0, Math.min(1,
        0.5 * (l / (seriesWins - 1)) +
        0.5 * ((l + t) / (2 * (seriesWins - 1)))
      ))

  // normR — round prestige bonus
  const normR = round === fmt.numRounds
    ? w.fB / 100
    : (round === fmt.numRounds - 1 && fmt.numRounds >= 3)
      ? w.cB / 100
      : 0

  const totalW = w.wT + w.wE + w.wR
  if (totalW === 0 || w.maxX === 0) return { mult: 1, normD, normE, normR, winsNeeded }

  const comp = (w.wT * normD + w.wE * normE + w.wR * normR) / totalW
  return {
    mult: 1 + (w.maxX / 100) * comp,
    normD, normE, normR, winsNeeded,
  }
}

export const DEFAULT_WEIGHTS: GoatWeights = {
  wT: 35, wE: 35, wR: 30,
  fB: 25, cB: 12, maxX: 80,
  format: 'modern',
}

export const PRESETS: Record<string, { label: string } & GoatWeights> = {
  raw:          { label:'Raw GmSc',          wT:0,  wE:0,  wR:0,  fB:0,  cB:0,  maxX:0,   format:'modern' },
  balanced:     { label:'Balanced',           wT:35, wE:35, wR:30, fB:25, cB:12, maxX:80,  format:'modern' },
  championship: { label:'Championship DNA',   wT:60, wE:20, wR:20, fB:50, cB:20, maxX:100, format:'modern' },
  clutch:       { label:'Clutch Moments',     wT:20, wE:60, wR:20, fB:25, cB:15, maxX:120, format:'modern' },
  prestige:     { label:'Finals Prestige',    wT:25, wE:25, wR:50, fB:80, cB:40, maxX:100, format:'modern' },
}

// Compute adjusted GmSc for a single game row
export function adjScore(row: GoatGameRow, weights: GoatWeights): number {
  const { mult } = calcMult(row.round, row.series_my_wins, row.series_opp_wins, weights)
  return row.gmsc_computed * mult
}

// Aggregate career stats from pre-loaded GOAT rows
export interface CareerRow {
  player: string
  games: number
  adjSum: number
  adjAvg: number
  gmscSum: number
  gmscAvg: number
  ptsAvg: number
  firstSeason: number
  lastSeason: number
  deepestRound: number
  wins: number
}

export function buildLeaderboard(rows: GoatGameRow[], weights: GoatWeights): CareerRow[] {
  const map = new Map<string, {
    adjSum:number; gmscSum:number; pts:number; games:number
    firstSeason:number; lastSeason:number; deepestRound:number; wins:number
  }>()

  for (const row of rows) {
    const adj = adjScore(row, weights)
    const cur = map.get(row.player)
    if (!cur) {
      map.set(row.player, {
        adjSum: adj, gmscSum: row.gmsc_computed,
        pts: row.pts ?? 0, games: 1,
        firstSeason: row.season, lastSeason: row.season,
        deepestRound: row.round,
        wins: row.result === 'W' ? 1 : 0,
      })
    } else {
      cur.adjSum      += adj
      cur.gmscSum     += row.gmsc_computed
      cur.pts         += row.pts ?? 0
      cur.games       += 1
      cur.firstSeason  = Math.min(cur.firstSeason, row.season)
      cur.lastSeason   = Math.max(cur.lastSeason, row.season)
      cur.deepestRound = Math.max(cur.deepestRound, row.round)
      cur.wins        += row.result === 'W' ? 1 : 0
    }
  }

  return Array.from(map.entries()).map(([player, d]) => ({
    player,
    games:        d.games,
    adjSum:       d.adjSum,
    adjAvg:       d.adjSum / d.games,
    gmscSum:      d.gmscSum,
    gmscAvg:      d.gmscSum / d.games,
    ptsAvg:       d.pts / d.games,
    firstSeason:  d.firstSeason,
    lastSeason:   d.lastSeason,
    deepestRound: d.deepestRound,
    wins:         d.wins,
  }))
}
