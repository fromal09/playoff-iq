const bv = (b as Record<string, unknown>)[col]'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { ALL_FRANCHISES, ACTIVE_FRANCHISES, DEFUNCT_FRANCHISES } from '@/lib/franchise'
import type { CareerRow, PlayerSeasonStats } from '@/lib/types'
import PlayerModal from '@/components/PlayerModal'

const PAGE = 50

// Aggregate season-level rows into career totals (used when filters active)
function aggregateSeasons(seasons: PlayerSeasonStats[]): CareerRow[] {
  const byPlayer = new Map<string, PlayerSeasonStats[]>()
  for (const s of seasons) {
    const arr = byPlayer.get(s.player) ?? []
    arr.push(s)
    byPlayer.set(s.player, arr)
  }
  return Array.from(byPlayer.values()).map(ss => {
    const totalGames = ss.reduce((s,r) => s+r.games, 0) || 1
    const wins = ss.reduce((s,r) => s+(r.wins??0), 0)
    const wa = (k: keyof PlayerSeasonStats) =>
      ss.reduce((s,r) => s+((r[k] as number)??0)*r.games, 0) / totalGames
    const gmscSum = ss.reduce((s,r) => s+(r.gmsc_sum??0), 0)
    return {
      player: ss[0].player,
      games: totalGames,
      wins,
      win_pct: Math.round(wins/totalGames*1000)/10,
      pts_avg:  wa('pts_avg'),  ast_avg: wa('ast_avg'),  trb_avg: wa('trb_avg'),
      stl_avg:  wa('stl_avg'),  blk_avg: wa('blk_avg'),  tov_avg: wa('tov_avg'),
      fg_pct:   wa('fg_pct_avg'), three_p_pct: wa('three_p_pct_avg'),
      ft_pct:   wa('ft_pct_avg'), ts_pct: wa('ts_pct_avg'),
      mp_avg:   wa('mp_avg'),   bpm_avg: wa('bpm_avg'),
      gmsc_avg: gmscSum / totalGames,
      gmsc_sum: gmscSum,
      pts_total: ss.reduce((s,r) => s+(r.pts_total??0), 0),
      first_season: Math.min(...ss.map(s => s.season)),
      last_season:  Math.max(...ss.map(s => s.season)),
      deepest_round: Math.max(...ss.map(s => s.deepest_round??0)),
      finals_appearances: ss.filter(s => s.finals_appearance).length,
      championships: ss.filter(s => s.won_championship).length,
    } as CareerRow
  })
}

function sortCareer(rows: CareerRow[], col: string, dir: 'asc'|'desc'): CareerRow[] {
  return [...rows].sort((a,b) => {
    const av = (a as unknown as Record<string, unknown>)[col]
const bv = (b as unknown as Record<string, unknown>)[col]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number')
      return dir==='asc' ? av-bv : bv-av
    return dir==='asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av))
  })
}

const pct = (v:number|null) => v!=null?(v*100).toFixed(1)+'%':'—'
const num = (v:number|null, d=1) => v!=null?Number(v).toFixed(d):'—'

export default function AggregatePage() {
  const [search,     setSearch]     = useState('')
  const [franchise,  setFranchise]  = useState('')
  const [seasonMin,  setSeasonMin]  = useState(1947)
  const [seasonMax,  setSeasonMax]  = useState(2026)
  const [minGames,   setMinGames]   = useState('')
  const [sortCol,    setSortCol]    = useState('gmsc_sum')
  const [sortDir,    setSortDir]    = useState<'asc'|'desc'>('desc')
  const [rows,       setRows]       = useState<CareerRow[]>([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(0)
  const [loading,    setLoading]    = useState(false)
  const [modal,      setModal]      = useState<string|null>(null)
  const debRef = useRef<ReturnType<typeof setTimeout>>()

  const hasAdvancedFilters = franchise !== '' || seasonMin !== 1947 || seasonMax !== 2026

  const loadFiltered = useCallback(async (s:string,fr:string,smn:number,smx:number,mg:string,sc:string,sd:'asc'|'desc',pg:number) => {
    setLoading(true)
    // Fetch all matching season rows
    let allSeasons: PlayerSeasonStats[] = []
    let from = 0
    while (true) {
      let q = supabase.from('player_season_stats').select('*')
      if (fr) q = q.eq('franchise', fr)
      if (smn > 1947) q = q.gte('season', smn)
      if (smx < 2026) q = q.lte('season', smx)
      q = q.range(from, from+999)
      const { data } = await q
      if (!data || data.length === 0) break
      allSeasons.push(...(data as PlayerSeasonStats[]))
      if (data.length < 1000) break
      from += 1000
      if (from > 30000) break // safety
    }
    let aggregated = aggregateSeasons(allSeasons)
    if (s) aggregated = aggregated.filter(r => r.player.toLowerCase().includes(s.toLowerCase()))
    if (mg) aggregated = aggregated.filter(r => r.games >= Number(mg))
    aggregated = sortCareer(aggregated, sc, sd)
    const total = aggregated.length
    setTotal(total)
    setRows(aggregated.slice(pg*PAGE, (pg+1)*PAGE))
    setLoading(false)
  }, [])

  const loadDirect = useCallback(async (s:string,mg:string,sc:string,sd:'asc'|'desc',pg:number) => {
    setLoading(true)
    let q = supabase.from('player_career_stats').select('*',{count:'exact'})
    if (s)  q = q.ilike('player',`%${s}%`)
    if (mg) q = q.gte('games',Number(mg))
    q = q.order(sc,{ascending:sd==='asc',nullsFirst:false}).range(pg*PAGE,pg*PAGE+PAGE-1)
    const {data,count} = await q
    setRows((data as CareerRow[])??[])
    setTotal(count??0)
    setLoading(false)
  }, [])

  const triggerLoad = useCallback((pg:number) => {
    if (hasAdvancedFilters) {
      loadFiltered(search, franchise, seasonMin, seasonMax, minGames, sortCol, sortDir, pg)
    } else {
      loadDirect(search, minGames, sortCol, sortDir, pg)
    }
  }, [search, franchise, seasonMin, seasonMax, minGames, sortCol, sortDir, hasAdvancedFilters, loadFiltered, loadDirect])

  useEffect(() => {
    clearTimeout(debRef.current)
    debRef.current = setTimeout(() => { setPage(0); triggerLoad(0) }, 400)
    return () => clearTimeout(debRef.current)
  }, [triggerLoad])

  function sort(col:string) {
    const nd = sortCol===col && sortDir==='desc' ? 'asc' as const : 'desc' as const
    setSortCol(col); setSortDir(nd)
  }
  function goPage(pg:number) { setPage(pg); triggerLoad(pg) }
  const totalPages = Math.ceil(total/PAGE)

  function Th({col,children}:{col:string;children:React.ReactNode}) {
    return (
      <th className="sortable num" onClick={()=>sort(col)}>
        {children}{sortCol===col?(sortDir==='desc'?' ↓':' ↑'):''}
      </th>
    )
  }

  const champLabel = (r:CareerRow) => {
    if (!r.finals_appearances) return '—'
    const champ = r.championships ?? 0
    const finals = r.finals_appearances
    if (champ === 0) return `${finals}× 🥈`
    if (champ === finals) return `${champ}× 🏆`
    return `${champ}× 🏆 ${finals-champ}× 🥈`
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 52px)',overflow:'hidden'}}>
      <div style={{padding:'12px 20px',borderBottom:'1px solid var(--border)',background:'var(--surface)',display:'flex',alignItems:'center',gap:12,flexShrink:0,flexWrap:'wrap'}}>
        <span style={{fontFamily:'var(--font-head)',fontSize:20,letterSpacing:'0.06em',color:'var(--blue)'}}>CAREER LEADERS</span>
        <input type="search" placeholder="Search player…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:180}}/>
        <select value={franchise} onChange={e=>setFranchise(e.target.value)} style={{width:160}}>
          <option value="">All franchises</option>
          <optgroup label="Active Franchises">
              {ACTIVE_FRANCHISES.map(f=><option key={f.abbr} value={f.abbr}>{f.name}</option>)}
            </optgroup>
            <optgroup label="── Defunct ──">
              {DEFUNCT_FRANCHISES.map(f=><option key={f.abbr} value={f.abbr}>{f.name}</option>)}
            </optgroup>
        </select>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <label style={{fontSize:12,color:'var(--text2)',whiteSpace:'nowrap'}}>Seasons</label>
          <input type="number" value={seasonMin} min={1947} max={2026} onChange={e=>setSeasonMin(Number(e.target.value))} style={{width:68}}/>
          <span style={{fontSize:12,color:'var(--text3)'}}>–</span>
          <input type="number" value={seasonMax} min={1947} max={2026} onChange={e=>setSeasonMax(Number(e.target.value))} style={{width:68}}/>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <label style={{fontSize:12,color:'var(--text2)',whiteSpace:'nowrap'}}>Min G</label>
          <input type="number" placeholder="—" value={minGames} min={1} onChange={e=>setMinGames(e.target.value)} style={{width:64}}/>
        </div>
        {hasAdvancedFilters && (
          <span style={{fontSize:11,color:'var(--blue)',background:'var(--blue-dim)',padding:'3px 8px',borderRadius:3,border:'1px solid rgba(29,66,138,.2)'}}>
            Filtered — aggregating by selected seasons
          </span>
        )}
        <span style={{marginLeft:'auto',fontSize:13,color:'var(--text2)'}}>{loading?'Loading…':`${total.toLocaleString()} players`}</span>
      </div>

      <div style={{flex:1,overflowX:'auto',overflowY:'auto'}}>
        {loading&&rows.length===0?(<div className="loading"><div className="spinner"/>Loading…</div>)
        :rows.length===0?(<div className="empty">No players found.</div>):(
          <table className="data-table">
            <thead><tr>
              <th style={{position:'sticky',left:0,background:'var(--bg)',zIndex:1,minWidth:28}}>#</th>
              <th style={{position:'sticky',left:28,background:'var(--bg)',zIndex:1,minWidth:180,cursor:'pointer'}} className="sortable" onClick={()=>sort('player')}>
                Player{sortCol==='player'?(sortDir==='desc'?' ↓':' ↑'):''}
              </th>
              <Th col="games">G</Th>
              <Th col="wins">W</Th>
              <Th col="win_pct">W%</Th>
              <Th col="championships">Deepest</Th>
              <Th col="first_season">From</Th>
              <Th col="last_season">To</Th>
              <Th col="pts_avg">PTS</Th>
              <Th col="ast_avg">AST</Th>
              <Th col="trb_avg">REB</Th>
              <Th col="stl_avg">STL</Th>
              <Th col="blk_avg">BLK</Th>
              <Th col="tov_avg">TOV</Th>
              <Th col="fg_pct">FG%</Th>
              <Th col="three_p_pct">3P%</Th>
              <Th col="ft_pct">FT%</Th>
              <Th col="ts_pct">TS%</Th>
              <Th col="mp_avg">MIN</Th>
              <Th col="bpm_avg">BPM</Th>
              <Th col="gmsc_avg">GmSc/G</Th>
              <Th col="gmsc_sum">GmSc Tot</Th>
            </tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={r.player}>
                  <td style={{position:'sticky',left:0,background:'var(--surface)',zIndex:1,color:'var(--text3)',fontSize:12}}>{page*PAGE+i+1}</td>
                  <td style={{position:'sticky',left:28,background:'var(--surface)',zIndex:1}}>
                    <span className="player-cell" onClick={()=>setModal(r.player)}>{r.player}</span>
                  </td>
                  <td className="num">{r.games}</td>
                  <td className="num win">{r.wins}</td>
                  <td className="num">{r.win_pct!=null?Number(r.win_pct).toFixed(1)+'%':'—'}</td>
                  <td style={{fontSize:12,whiteSpace:'nowrap'}}>{champLabel(r)}</td>
                  <td className="num">{r.first_season}</td>
                  <td className="num">{r.last_season}</td>
                  <td className="num blue">{num(r.pts_avg)}</td>
                  <td className="num">{num(r.ast_avg)}</td>
                  <td className="num">{num(r.trb_avg)}</td>
                  <td className="num">{num(r.stl_avg)}</td>
                  <td className="num">{num(r.blk_avg)}</td>
                  <td className="num">{num(r.tov_avg)}</td>
                  <td className="num">{pct(r.fg_pct)}</td>
                  <td className="num">{pct(r.three_p_pct)}</td>
                  <td className="num">{pct(r.ft_pct)}</td>
                  <td className="num">{pct(r.ts_pct)}</td>
                  <td className="num">{num(r.mp_avg)}</td>
                  <td className="num">{num(r.bpm_avg)}</td>
                  <td className="num blue">{num(r.gmsc_avg,2)}</td>
                  <td className="num blue">{num(r.gmsc_sum,1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages>1&&(
        <div className="pagination">
          <span>{page*PAGE+1}–{Math.min((page+1)*PAGE,total)} of {total.toLocaleString()}</span>
          <div className="page-btns">
            <button className="page-btn" disabled={page===0} onClick={()=>goPage(0)}>«</button>
            <button className="page-btn" disabled={page===0} onClick={()=>goPage(page-1)}>‹</button>
            {Array.from({length:Math.min(7,totalPages)},(_,i)=>{
              const pg=totalPages<=7?i:page<4?i:page>totalPages-5?totalPages-7+i:page-3+i
              return <button key={pg} className={`page-btn${pg===page?' active':''}`} onClick={()=>goPage(pg)}>{pg+1}</button>
            })}
            <button className="page-btn" disabled={page>=totalPages-1} onClick={()=>goPage(page+1)}>›</button>
            <button className="page-btn" disabled={page>=totalPages-1} onClick={()=>goPage(totalPages-1)}>»</button>
          </div>
        </div>
      )}
      {modal&&<PlayerModal player={modal} onClose={()=>setModal(null)}/>}
    </div>
  )
}
