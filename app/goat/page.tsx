'use client'
import GoatRange from './GoatRange'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  FORMATS, PRESETS, DEFAULT_WEIGHTS,
  calcMult, buildLeaderboard,
  ABS_MAX, getFormatInfo,
} from '@/lib/scoring'
import type { GoatWeights, GoatGameRow } from '@/lib/types'
import { ALL_FRANCHISES, ACTIVE_FRANCHISES, DEFUNCT_FRANCHISES, FRANCHISE_ROLLUP, FRANCHISE_NAMES } from '@/lib/franchise'
import type { CareerRow } from '@/lib/scoring'
import PlayerModal from '@/components/PlayerModal'

// ── Heat map ──────────────────────────────────────────────────────────────
const GROUPS = [
  {label:'G1',states:[{l:0,t:0,sub:'0–0'}]},
  {label:'G2',states:[{l:1,t:0,sub:'1–0'}]},
  {label:'G3',states:[{l:2,t:0,sub:'2–0'},{l:1,t:1,sub:'1–1'}]},
  {label:'G4',states:[{l:3,t:0,sub:'3–0'},{l:2,t:1,sub:'2–1'}]},
  {label:'G5',states:[{l:3,t:1,sub:'3–1'},{l:2,t:2,sub:'2–2'}]},
  {label:'G6',states:[{l:3,t:2,sub:'3–2'}]},
  {label:'G7',states:[{l:3,t:3,sub:'3–3'}]},
]
const FLAT = GROUPS.flatMap(g=>g.states)

function cellBg(v:number,mn:number,mx:number) {
  const t = mx===mn ? 0 : (v-mn)/(mx-mn)
  return `rgba(201,168,76,${(0.05+t*0.65).toFixed(2)})`
}

function HeatMap({ weights, persp }: { weights: GoatWeights; persp:'leading'|'trailing' }) {
  const fmt = getFormatInfo(weights.format)
  const grid = fmt.winsPerRound.map((w,ri)=>
    FLAT.map(({l,t})=>{
      if(l>=w||t>=w) return null
      const my=persp==='leading'?l:t, op=persp==='leading'?t:l
      if(my>=w||op>=w) return null
      return calcMult(ri+1,my,op,weights).mult
    })
  )
  const allV = grid.flat().filter(Boolean) as number[]
  const mn=allV.length?Math.min(...allV):1, mx=allV.length?Math.max(...allV):1
  const roundLabels = (n:number,i:number) =>
    i===n-1?'Finals':n>=3&&i===n-2?'Conf Finals':n===2&&i===0?'Semis':`Round ${i+1}`
  const headStart = ABS_MAX - fmt.maxWins

  return (
    <div>
      <div style={{fontSize:11,color:'var(--gold)',marginBottom:8}}>
        {headStart>0
          ? `${headStart}-win head start vs modern era · Round 1 opens at ${((ABS_MAX-fmt.maxWins)/(ABS_MAX-1)*100).toFixed(0)}% title proximity`
          : 'Modern format — Round 1 starts at 0% title proximity (full 16-win journey)'}
      </div>
      <div style={{overflowX:'auto'}}>
        <div style={{minWidth:520}}>
          {/* Group headers */}
          <div style={{display:'grid',gridTemplateColumns:'90px repeat(10,1fr)',gap:2,marginBottom:2}}>
            <div/>
            {GROUPS.map(g=>{
              const multi=g.states.length>1
              return(
                <div key={g.label} style={{gridColumn:`span ${g.states.length}`,textAlign:'center',paddingBottom:3,borderBottom:multi?'1.5px solid var(--gold)':'none'}}>
                  <span style={{fontSize:11,fontWeight:600,color:multi?'var(--gold)':'var(--text2)'}}>{g.label}</span>
                </div>
              )
            })}
          </div>
          {/* Sub-labels */}
          <div style={{display:'grid',gridTemplateColumns:'90px repeat(10,1fr)',gap:2,marginBottom:3}}>
            <div/>
            {FLAT.map((s,ci)=>{
              const isSec=GROUPS.some(g=>g.states.length>1&&g.states[1]===s)
              return(
                <div key={ci} style={{textAlign:'center',borderLeft:isSec?'1px solid var(--border)':'none'}}>
                  <span style={{fontSize:9,color:'var(--text3)'}}>{s.sub}</span>
                </div>
              )
            })}
          </div>
          {/* Data rows */}
          {grid.map((row,ri)=>{
            const bold=ri>=fmt.numRounds-2
            const startD = calcMult(ri+1,0,0,weights).normD
            return(
              <div key={ri} style={{display:'grid',gridTemplateColumns:'90px repeat(10,1fr)',gap:2,marginBottom:2}}>
                <div style={{display:'flex',flexDirection:'column',justifyContent:'center',paddingRight:6}}>
                  <span style={{fontSize:10,color:bold?'var(--text)':'var(--text2)',fontWeight:bold?600:400,lineHeight:1.2}}>
                    {roundLabels(fmt.numRounds,ri)}
                  </span>
                  <span style={{fontSize:9,color:'var(--gold)'}}>{(startD*100).toFixed(0)}% G1</span>
                </div>
                {row.map((v,ci)=>{
                  const isSec=GROUPS.some(g=>g.states.length>1&&g.states[1]===FLAT[ci])
                  return v==null?(
                    <div key={ci} className="hm-cell" style={{background:'var(--bg)',color:'var(--border)',borderLeft:isSec?'1px solid var(--border)':''}}>—</div>
                  ):(
                    <div key={ci} className="hm-cell" style={{background:cellBg(v,mn,mx),color:'var(--text)',borderLeft:isSec?'1px solid rgba(201,168,76,.2)':''}}>
                      {v.toFixed(2)}×
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Methodology text ───────────────────────────────────────────────────────
function Methodology() {
  return (
    <div style={{maxWidth:680,lineHeight:1.7,color:'var(--text2)'}}>
      <h2 style={{fontSize:22,color:'var(--gold)',marginBottom:16}}>HOW THE GOAT INDEX WORKS</h2>
      {[
        ['Base Score: Era-Adjusted Game Score',
          'Every game begins with a Game Score computed using the best available data for that era. Post-1980: the full Hollinger formula (PTS + 0.4·FGM − 0.7·FGA − 0.4·(FTA−FTM) + 0.7·ORB + 0.3·DRB + STL + 0.7·AST + 0.7·BLK − 0.4·PF − TOV). For 1974–1979, when ORB/DRB were tracked but not split: TRB×0.5 replaces the rebound split, STL/BLK/TOV remain. Pre-1974, those three categories vanish entirely: TRB×0.5, no turnover, no steal, no block penalty. The 0.5 TRB coefficient is a deliberate midpoint between DRB (0.3) and ORB (0.7) — not a scaling approximation.'],
        ['Importance Multiplier: Three Independent Components',
          'Each game\'s base score is multiplied by a factor between 1.0× and your chosen ceiling. The multiplier blends three normalized (0–1) components weighted by your sliders: Title Distance (normD), Elimination Pressure (normE), and Round Prestige (normR).'],
        ['Title Distance (normD)',
          'Measures how close a player\'s team was to a championship at tip-off, normalized against a fixed 16-win (modern 4×BO7) reference. A player needing 4 more wins to be champion scores the same normD regardless of era — 1965 Finals and 2016 Finals are both 4 wins from a title. Players in shorter-format eras start their playoffs at a higher baseline because they literally needed fewer total wins to win a championship. This is not a reward for easier competition; it is an accurate reflection of where they stood relative to a title.'],
        ['Elimination Pressure (normE)',
          'Symmetric series tension: it\'s the same for both teams, and it scales to the series format. A Game 3 of a best-of-5 at 2–0 maxes the same normE as Game 5 of a best-of-7 at 3–2. The formula blends the leader\'s win count (proximity to closing) with total games played (depth of series). A 3–3 Game 7 always scores 100%.'],
        ['Round Prestige (normR)',
          'A direct boost for stage of competition. You control Finals Boost (fB) and Conference Finals Boost (cB) as percentages of the component\'s contribution. First and second round games score 0 on this component — they pick up importance through normD and normE alone.'],
        ['Aggregation',
          'Career totals sum every adjusted game score across a player\'s entire playoff history. Career average divides by games played. Both are available as sort keys. No minimum games floor is imposed — filter by your own threshold. Players with two playoff appearances score above zero. A 12-game postseason career filled with G7s in the Finals will outscore a 100-game career of forgettable first-round losses, which is exactly the intent.'],
      ].map(([title, body]) => (
        <div key={title as string} style={{marginBottom:20}}>
          <h3 style={{fontSize:14,color:'var(--text)',fontFamily:'var(--font-head)',letterSpacing:'0.04em',marginBottom:6}}>{title}</h3>
          <p style={{fontSize:13}}>{body}</p>
        </div>
      ))}
    </div>
  )
}

// ── Main GOAT page ────────────────────────────────────────────────────────
const GOAT_PAGE = 50



export default function GoatPage() {
  const [tab, setTab]         = useState<'methodology'|'heatmap'|'allgames'|'leaderboard'|'franchise'|'range'>('leaderboard')
  const [weights, setWeights] = useState<GoatWeights>(DEFAULT_WEIGHTS)
  const [preset, setPreset]   = useState('balanced')
  const [persp, setPersp]     = useState<'leading'|'trailing'>('leading')
  const [aggMode, setAggMode] = useState<'sum'|'avg'>('sum')
  const [minGames, setMinGames] = useState('')
  const [franchiseFilter, setFranchiseFilter] = useState('')
  const [gameSearch, setGameSearch] = useState('')
  const [goatData, setGoatData]   = useState<GoatGameRow[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [modal, setModal]     = useState<string|null>(null)
  const [showControls, setShowControls] = useState(true)
  const [careerMeta, setCareerMeta] = useState<Map<string,{championships:number;finals_appearances:number}>>(new Map())
  const [lbPage, setLbPage]   = useState(0)
  const [gmPage, setGmPage]   = useState(0)

  // Load lightweight GOAT data once
  useEffect(() => {
    async function loadGoatData() {
      setLoadingData(true)
      // Supabase caps at 1000 rows per request — batch through all 91k rows
      const BATCH = 1000
      const allRows: GoatGameRow[] = []
      let from = 0
      let tries = 0
      while (tries < 120) {  // safety cap: 120 * 1000 = 120k rows max
        const { data, error } = await supabase
          .from('goat_game_rows')
          .select('player,season,date,team,opp,result,pts,gmsc_computed,round,series_my_wins,series_opp_wins,era')
          .range(from, from + BATCH - 1)
        if (error || !data || data.length === 0) break
        allRows.push(...(data as GoatGameRow[]))
        if (data.length < BATCH) break
        from += BATCH
        tries++
      }
      setGoatData(allRows)
      setDataLoaded(true)
      setLoadingData(false)
      // Load championships/finals_appearances for all players
      const metaMap = new Map<string,{championships:number;finals_appearances:number}>()
      let mFrom = 0
      while(true){
        const {data} = await supabase.from('player_career_stats')
          .select('player,championships,finals_appearances')
          .range(mFrom, mFrom+999)
        if(!data||!data.length) break
        for(const r of data as {player:string;championships:number;finals_appearances:number}[])
          metaMap.set(r.player,{championships:r.championships??0,finals_appearances:r.finals_appearances??0})
        if(data.length<1000) break
        mFrom+=1000
        if(mFrom>5000) break
      }
      setCareerMeta(metaMap)
    }
    loadGoatData()
  }, [])

  function setW(key: keyof GoatWeights, val: number|string) {
    setWeights(w => ({...w, [key]: val}))
    setPreset('custom')
  }
  function applyPreset(key: string) {
    const p = PRESETS[key]
    if (!p) return
    setWeights({ wT:p.wT, wE:p.wE, wR:p.wR, fB:p.fB, cB:p.cB, maxX:p.maxX, format:p.format })
    setPreset(key)
  }

  // Leaderboard computation
  const leaderboard = useMemo(() => {
    if (!dataLoaded) return []
    const filteredData = franchiseFilter
      ? goatData.filter(r => FRANCHISE_ROLLUP[r.team] === franchiseFilter)
      : goatData
    let rows = buildLeaderboard(filteredData, weights)
    if (minGames) rows = rows.filter(r=>r.games >= Number(minGames))
    rows.sort((a,b) => aggMode==='sum' ? b.adjSum-a.adjSum : b.adjAvg-a.adjAvg)
    return rows
  }, [goatData, weights, minGames, aggMode, dataLoaded, franchiseFilter])

  // Per-franchise top-20 leaderboard
  const franchiseLeaders = useMemo(() => {
    if (!dataLoaded) return new Map<string, {player:string;goatScore:number;adjVal:number;games:number}[]>()
    const result = new Map<string, {player:string;goatScore:number;adjVal:number;games:number}[]>()
    for (const fr of ACTIVE_FRANCHISES) {
      const frRows = goatData.filter(r => FRANCHISE_ROLLUP[r.team] === fr.abbr)
      let lb = buildLeaderboard(frRows, weights)
      if (minGames) lb = lb.filter(r => r.games >= Number(minGames))
      const isAvg = aggMode === 'avg'
      lb.sort((a,b) => isAvg ? b.adjAvg-a.adjAvg : b.adjSum-a.adjSum)
      const top = lb.slice(0,20)
      // Normalize using the same metric we're ranking by
      const maxVal = isAvg ? (top[0]?.adjAvg ?? 1) : (top[0]?.adjSum ?? 1)
      result.set(fr.abbr, top.map(r => {
        const val = isAvg ? r.adjAvg : r.adjSum
        return {
          player: r.player,
          goatScore: maxVal > 0 ? Math.round(val / maxVal * 1000) / 10 : 0,
          adjVal: val,
          games: r.games,
        }
      }))
    }
    return result
  }, [goatData, weights, minGames, aggMode, dataLoaded])

  // All-games computation (sorted desc, search filtered)
  const allGames = useMemo(() => {
    if (!dataLoaded) return []
    const search = gameSearch.toLowerCase()
    const gd = franchiseFilter ? goatData.filter(r => FRANCHISE_ROLLUP[r.team] === franchiseFilter) : goatData
    return gd
      .filter(r => !search || r.player.toLowerCase().includes(search))
      .map(r => ({
        ...r,
        adjScore: r.gmsc_computed * calcMult(r.round, r.series_my_wins, r.series_opp_wins, weights).mult
      }))
      .sort((a,b) => b.adjScore - a.adjScore)
  }, [goatData, weights, gameSearch, dataLoaded, franchiseFilter])

  const lbTotalPages = Math.ceil(leaderboard.length / GOAT_PAGE)
  const gmTotalPages = Math.ceil(allGames.length / GOAT_PAGE)
  const lbSlice = leaderboard.slice(lbPage*GOAT_PAGE, (lbPage+1)*GOAT_PAGE)
  const gmSlice = allGames.slice(gmPage*GOAT_PAGE, (gmPage+1)*GOAT_PAGE)

  function Paginator({ page, totalPages, setPage }: { page:number; totalPages:number; setPage:(n:number)=>void }) {
    return (
      <div className="pagination">
        <span>{page*GOAT_PAGE+1}–{Math.min((page+1)*GOAT_PAGE,totalPages*GOAT_PAGE)} of {(totalPages*GOAT_PAGE).toLocaleString()}</span>
        <div className="page-btns">
          <button className="page-btn" disabled={page===0} onClick={()=>setPage(0)}>«</button>
          <button className="page-btn" disabled={page===0} onClick={()=>setPage(page-1)}>‹</button>
          {Array.from({length:Math.min(7,totalPages)},(_,i)=>{
            const pg=totalPages<=7?i:page<4?i:page>totalPages-5?totalPages-7+i:page-3+i
            return <button key={pg} className={`page-btn${pg===page?' active':''}`} onClick={()=>setPage(pg)}>{pg+1}</button>
          })}
          <button className="page-btn" disabled={page>=totalPages-1} onClick={()=>setPage(page+1)}>›</button>
          <button className="page-btn" disabled={page>=totalPages-1} onClick={()=>setPage(totalPages-1)}>»</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{display:'flex',height:'calc(100vh - 52px)',overflow:'hidden'}}>
      {/* ── Controls sidebar ── */}
      {showControls&&<aside style={{width:260,flexShrink:0,background:'var(--bg2)',borderRight:'1px solid var(--border)',overflowY:'auto',padding:16,display:'flex',flexDirection:'column',gap:14}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:18,color:'var(--blue)'}}>GOAT CONTROLS</div>

        {/* Presets */}
        <div>
          <label className="filter-label">Preset</label>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {Object.entries(PRESETS).map(([k,p])=>(
              <button key={k} className={`btn${preset===k?' btn-active':''}`} style={{fontSize:11,padding:'3px 8px'}} onClick={()=>applyPreset(k)}>{p.label}</button>
            ))}
            {preset==='custom'&&<span style={{fontSize:11,color:'var(--text3)',padding:'3px 0',alignSelf:'center'}}>Custom</span>}
          </div>
        </div>

        {/* Playoff format */}
        <div>
          <label className="filter-label">Playoff Format</label>
          <select value={weights.format} onChange={e=>setW('format',e.target.value)}>
            {Object.entries(FORMATS).map(([k,f])=>
              <option key={k} value={k}>{f.label}</option>
            )}
          </select>
        </div>

        {/* Weight sliders */}
        <div>
          <label className="filter-label">Importance Weights</label>
          {([['Title Distance','wT'],['Elim. Pressure','wE'],['Round Stage','wR']] as [string,keyof GoatWeights][]).map(([lbl,k])=>(
            <div key={k} className="slider-row">
              <span className="slider-label">{lbl}</span>
              <input type="range" min={0} max={100} step={5} value={weights[k] as number}
                onChange={e=>setW(k,Number(e.target.value))} style={{flex:1}}/>
              <span className="slider-val">{weights[k]}</span>
            </div>
          ))}
        </div>

        <div style={{borderTop:'1px solid var(--border)',paddingTop:12}}>
          <label className="filter-label">Round Boosts & Ceiling</label>
          {([['Finals Boost','fB','%'],['Conf Finals Boost','cB','%'],['Max Multiplier','maxX','%']] as [string,keyof GoatWeights,string][]).map(([lbl,k,sfx])=>(
            <div key={k} className="slider-row">
              <span className="slider-label">{lbl}</span>
              <input type="range" min={0} max={k==='maxX'?200:100} step={5} value={weights[k] as number}
                onChange={e=>setW(k,Number(e.target.value))} style={{flex:1}}/>
              <span className="slider-val">{weights[k]}{sfx}</span>
            </div>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',padding:'6px 8px',background:'var(--bg)',borderRadius:4,marginTop:4}}>
            <span style={{fontSize:11,color:'var(--text2)'}}>Max possible multiplier</span>
            <span style={{fontSize:12,fontWeight:600,color:'var(--gold)'}}>{(1+weights.maxX/100).toFixed(2)}×</span>
          </div>
        </div>

        {/* Aggregation toggle */}
        <div>
          <label className="filter-label">Career Aggregation</label>
          <div style={{display:'flex',gap:4}}>
            <button className={`btn${aggMode==='sum'?' btn-active':''}`} style={{flex:1,justifyContent:'center'}} onClick={()=>setAggMode('sum')}>Sum</button>
            <button className={`btn${aggMode==='avg'?' btn-active':''}`} style={{flex:1,justifyContent:'center'}} onClick={()=>setAggMode('avg')}>Average</button>
          </div>
        </div>

        <div>
          <label className="filter-label">Min games (leaderboard)</label>
          <input type="number" placeholder="No minimum" value={minGames} min={1} onChange={e=>setMinGames(e.target.value)}/>
        </div>

        <div>
          <label className="filter-label">Franchise</label>
          <select value={franchiseFilter} onChange={e=>setFranchiseFilter(e.target.value)}>
            <option value="">All franchises</option>
            {ALL_FRANCHISES.map(f=><option key={f.abbr} value={f.abbr}>{f.name}</option>)}
          </select>
          {franchiseFilter&&(
            <div style={{fontSize:10,color:'var(--text3)',marginTop:4,lineHeight:1.4}}>
              Filtering by team abbrev — games played for this franchise only
            </div>
          )}
        </div>

        {loadingData && (
          <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'var(--text2)'}}>
            <div className="spinner" style={{width:14,height:14}}/>
            Loading game data…
          </div>
        )}
        {dataLoaded && (
          <div style={{fontSize:11,color:'var(--text3)'}}>
            {goatData.length.toLocaleString()} games loaded
          </div>
        )}
      </aside>}

      {/* ── Main content ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',padding:'8px 12px 0',borderBottom:'none',gap:8}}>
          <button className="btn" style={{fontSize:12,padding:'5px 10px',marginBottom:8}} onClick={()=>setShowControls(s=>!s)}>
            {showControls?'◀ Hide controls':'▶ Show controls'}
          </button>
        </div>
        <div className="tab-bar" style={{flexShrink:0,paddingLeft:16}}>
          {([['leaderboard','Career Rankings'],['range','GOAT Range'],['franchise','Franchise Leaders'],['allgames','All Games'],['heatmap','Heat Map'],['methodology','Methodology']] as [string,string][]).map(([k,l])=>(
            <button key={k} className={`tab${tab===k?' active':''}`} onClick={()=>setTab(k as typeof tab)}>{l}</button>
          ))}
        </div>

        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>

          {/* ── LEADERBOARD ── */}
          {tab==='leaderboard'&&(
            <>
              <div style={{flex:1,overflowX:'auto',overflowY:'auto'}}>
                {!dataLoaded?(
                  <div className="loading"><div className="spinner"/>Loading {goatData.length.toLocaleString()} games…</div>
                ):leaderboard.length===0?(
                  <div className="empty">No results.</div>
                ):(
                  <table className="data-table">
                    <thead><tr>
                      <th style={{width:36}}>#</th>
                      <th>Player</th>
                      <th className="num">Games</th>
                      <th className="num">Wins</th>
                      <th className="num">Deepest</th>
                      <th className="num">Seasons</th>
                      <th className="num" style={{color:'var(--blue)'}}>GOAT Score</th>
                      <th className="num" style={{color:'var(--text2)'}}>Adj {aggMode==='sum'?'Total':'Avg'}</th>
                      <th className="num" style={{color:'var(--text2)'}}>Base {aggMode==='sum'?'Total':'Avg'}</th>
                      <th className="num">W%</th>
                      <th className="num">Pts/G</th>
                    </tr></thead>
                    <tbody>
                      {lbSlice.map((r,i)=>(
                        <tr key={r.player}>
                          <td style={{color:'var(--text3)',fontSize:12}}>{lbPage*GOAT_PAGE+i+1}</td>
                          <td className="player-cell" onClick={()=>setModal(r.player)}>{r.player}</td>
                          <td className="num">{r.games}</td>
                          <td className="num win">{r.wins}</td>
                          <td style={{fontSize:11,whiteSpace:'nowrap'}}>
                            {(()=>{
                              const m=careerMeta.get(r.player)
                              if(m?.championships) return <span style={{color:'var(--gold)',fontWeight:600}}>{m.championships}× 🏆 Title</span>
                              if(m?.finals_appearances) return <span style={{color:'var(--text2)'}}>Finals</span>
                              if(r.deepestRound>=3) return <span style={{color:'var(--text3)'}}>Conf Finals</span>
                              if(r.deepestRound===2) return <span style={{color:'var(--text3)'}}>2nd Round</span>
                              return <span style={{color:'var(--text3)'}}>1st Round</span>
                            })()}
                          </td>
                          <td className="num" style={{fontSize:11,color:'var(--text2)'}}>{r.firstSeason}–{r.lastSeason}</td>
                          {(()=>{
                            const maxScore = lbSlice.length>0 || lbPage>0
                              ? (aggMode==='sum'?leaderboard[0]?.adjSum:leaderboard[0]?.adjAvg)??1
                              : 1
                            const gs = aggMode==='sum' ? r.adjSum/maxScore*100 : r.adjAvg/maxScore*100
                            return(
                              <>
                                <td className="num" style={{fontWeight:700,fontSize:14,color:'var(--blue)'}}>{gs.toFixed(1)}</td>
                                <td className="num" style={{color:'var(--text2)'}}>{aggMode==='sum'?r.adjSum.toFixed(1):r.adjAvg.toFixed(2)}</td>
                                <td className="num" style={{color:'var(--text2)'}}>{aggMode==='sum'?r.gmscSum.toFixed(1):r.gmscAvg.toFixed(2)}</td>
                                <td className="num">{r.wins&&r.games?(r.wins/r.games*100).toFixed(1)+'%':'—'}</td>
                                <td className="num">{r.ptsAvg.toFixed(1)}</td>
                              </>
                            )
                          })()}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {lbTotalPages>1&&<Paginator page={lbPage} totalPages={lbTotalPages} setPage={p=>{setLbPage(p)}}/>}
            </>
          )}

          {/* ── ALL GAMES ── */}
          {tab==='franchise'&&(
            <div style={{flex:1,overflowX:'auto',overflowY:'auto',padding:'16px'}}>
              {!dataLoaded?(
                <div className="loading"><div className="spinner"/>Loading…</div>
              ):(
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))',gap:20}}>
                  {ACTIVE_FRANCHISES.map(fr => {
                    const leaders = franchiseLeaders.get(fr.abbr) ?? []
                    return (
                      <div key={fr.abbr} className="card" style={{padding:0,overflow:'hidden',minWidth:0}}>
                        <div style={{background:'var(--blue)',padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span style={{fontFamily:'var(--font-head)',fontSize:15,fontWeight:700,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{fr.name}</span>
                          <span style={{fontSize:11,color:'rgba(255,255,255,0.5)',fontFamily:'var(--font-mono)',flexShrink:0,marginLeft:8}}>{leaders.length} players</span>
                        </div>
                        <div style={{overflowX:'auto'}}>
                          <table className="data-table" style={{fontSize:13,minWidth:'100%'}}>
                            <thead><tr>
                              <th style={{width:28,paddingLeft:10}}>#</th>
                              <th style={{minWidth:130}}>Player</th>
                              <th className="num" style={{minWidth:36}}>G</th>
                              <th className="num" style={{minWidth:58,color:'var(--gold)'}}>Score</th>
                              <th className="num" style={{minWidth:72}}>{aggMode==='sum'?'Adj Total':'Adj Avg'}</th>
                            </tr></thead>
                            <tbody>
                              {leaders.map((r,i) => (
                                <tr key={r.player}>
                                  <td style={{color:'var(--text3)',fontSize:12,paddingLeft:10,fontFamily:'var(--font-mono)'}}>{i+1}</td>
                                  <td className="player-cell" style={{fontSize:13,fontWeight:i===0?700:400,color:i===0?'var(--blue)':'var(--text)',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis'}}
                                    onClick={()=>setModal(r.player)}>{r.player}</td>
                                  <td className="num" style={{fontSize:12}}>{r.games}</td>
                                  <td className="num" style={{color:'var(--gold)',fontWeight:700,fontSize:13}}>{r.goatScore.toFixed(1)}</td>
                                  <td className="num" style={{fontSize:12,color:'var(--text2)'}}>{r.adjVal.toFixed(aggMode==='avg'?2:1)}</td>
                                </tr>
                              ))}
                              {leaders.length===0&&<tr><td colSpan={5} className="empty" style={{padding:'12px 0'}}>No data</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab==='range'&&(
            <div style={{flex:1,overflowY:'auto',padding:'24px 20px'}}>
              <div style={{marginBottom:12}}>
                <div className="section-head" style={{display:'inline-block',paddingRight:24}}>GOAT Range</div>
                <span style={{fontSize:11,color:'var(--text3)',marginLeft:12}}>Mountain silhouette of the top {Math.min(leaderboard.length,60)} playoff GOATs under current settings</span>
              </div>
              <div style={{background:'#060C18',borderRadius:4,padding:'0',marginBottom:8,overflow:'hidden'}}>
                {(()=>{const useAvg=aggMode==='avg';const keyVal=(r:{adjSum:number;adjAvg:number})=>useAvg?r.adjAvg:r.adjSum;const maxAdj=Math.max(...leaderboard.map(keyVal),0.001);return<GoatRange players={leaderboard.map(r=>({player:r.player,adjScore:Math.round(keyVal(r)/maxAdj*1000)/10,games:r.games,wins:r.wins}))} onPlayer={setModal}/>})()}
              </div>
            </div>
          )}

          {tab==='allgames'&&(
            <>
              <div style={{padding:'10px 16px',borderBottom:'1px solid var(--border)',flexShrink:0,display:'flex',alignItems:'center',gap:12}}>
                <input type="search" placeholder="Filter by player…" value={gameSearch}
                  onChange={e=>setGameSearch(e.target.value)} style={{width:220}}/>
                <span style={{fontSize:13,color:'var(--text2)'}}>
                  {!dataLoaded?'Loading…':`${allGames.length.toLocaleString()} games`}
                </span>
              </div>
              <div style={{flex:1,overflowX:'auto',overflowY:'auto'}}>
                {!dataLoaded?(
                  <div className="loading"><div className="spinner"/>Loading game data…</div>
                ):(
                  <table className="data-table">
                    <thead><tr>
                      <th>#</th><th>Player</th><th>Date</th><th>Season</th>
                      <th>Team</th><th>Opp</th><th>W/L</th><th className="num">Rnd</th>
                      <th className="num">Series</th><th className="num">PTS</th>
                      <th className="num">Base GmSc</th>
                      <th className="num">Mult</th>
                      <th className="num" style={{color:'var(--gold)'}}>Adj Score</th>
                    </tr></thead>
                    <tbody>
                      {gmSlice.map((r,i)=>{
                        const {mult,normD,normE,normR}=calcMult(r.round,r.series_my_wins,r.series_opp_wins,weights)
                        const adj=r.gmsc_computed*mult
                        const l=Math.max(r.series_my_wins,r.series_opp_wins)
                        const t=Math.min(r.series_my_wins,r.series_opp_wins)
                        return(
                          <tr key={`${r.player}-${r.date}-${i}`}>
                            <td style={{color:'var(--text3)',fontSize:12}}>{gmPage*GOAT_PAGE+i+1}</td>
                            <td className="player-cell" onClick={()=>setModal(r.player)}>{r.player}</td>
                            <td>{r.date}</td><td>{r.season}</td>
                            <td><span className="tag tag-dim">{r.team}</span></td>
                            <td style={{color:'var(--text2)'}}>{r.opp}</td>
                            <td className={r.result==='W'?'win':'loss'}>{r.result}</td>
                            <td className="num">{r.round}</td>
                            <td className="num" style={{fontSize:11,color:'var(--text2)'}}>G{r.series_my_wins+r.series_opp_wins+1} ({l}–{t})</td>
                            <td className="num">{r.pts??'—'}</td>
                            <td className="num">{r.gmsc_computed.toFixed(1)}</td>
                            <td className="num" style={{color:'var(--text2)',fontSize:11}}>{mult.toFixed(3)}×</td>
                            <td className="num gold" style={{fontWeight:700}}>{adj.toFixed(1)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              {gmTotalPages>1&&<Paginator page={gmPage} totalPages={gmTotalPages} setPage={p=>setGmPage(p)}/>}
            </>
          )}

          {/* ── HEAT MAP ── */}
          {tab==='heatmap'&&(
            <div style={{flex:1,overflowY:'auto',padding:24}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:12}}>
                <div>
                  <h2 style={{fontSize:18,color:'var(--text)',marginBottom:4}}>Importance Multiplier Map</h2>
                  <p style={{fontSize:12,color:'var(--text2)'}}>Each cell = multiplier applied to GmSc for that round + series state.</p>
                </div>
                <div style={{display:'flex',gap:0}}>
                  {(['leading','trailing'] as const).map(p=>(
                    <button key={p} className={`btn${persp===p?' btn-active':''}`} style={{borderRadius:p==='leading'?'6px 0 0 6px':'0 6px 6px 0',borderLeft:p==='trailing'?'none':undefined}} onClick={()=>setPersp(p)}>
                      {p==='leading'?'Leading Team':'Trailing Team'}
                    </button>
                  ))}
                </div>
              </div>
              <HeatMap weights={weights} persp={persp}/>
              <div style={{marginTop:12,fontSize:11,color:'var(--text3)',lineHeight:1.6}}>
                {persp==='leading'?'Title distance uses the leading team\'s wins.':'Title distance uses the trailing team\'s wins.'}{' '}
                Elimination pressure is symmetric — series tension is identical for both teams.{' '}
                — marks states impossible for this round's series format.
              </div>
            </div>
          )}

          {/* ── METHODOLOGY ── */}
          {tab==='methodology'&&(
            <div style={{flex:1,overflowY:'auto',padding:32}}>
              <Methodology/>
            </div>
          )}
        </div>
      </div>
      {modal&&<PlayerModal player={modal} onClose={()=>setModal(null)}/>}
    </div>
  )
}
