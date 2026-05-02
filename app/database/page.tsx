'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ALL_FRANCHISES, ACTIVE_FRANCHISES, DEFUNCT_FRANCHISES, ROUND_NAMES } from '@/lib/franchise'
import type { PlayerGame, FilterState } from '@/lib/types'
import PlayerModal from '@/components/PlayerModal'

const PAGE = 50
const DEFAULT_FILTERS: FilterState = {
  search:'', franchise:'', seasonMin:1947, seasonMax:2026,
  round:'', result:'', homeAway:'',
  ptsMin:'', ptsMax:'', astMin:'', astMax:'',
  trbMin:'', trbMax:'', stlMin:'', stlMax:'',
  blkMin:'', blkMax:'', tovMax:'', gmscMin:'',
  sortCol:'gmsc_computed', sortDir:'desc',
}

const fmtPct = (v:number|null) => v==null?'—':(v*100).toFixed(1)+'%'
const fmtNum = (v:number|null, d=0) => v==null?'—':d?v.toFixed(d):String(v)
const seriesState = (g:PlayerGame) => {
  const l=Math.max(g.series_my_wins,g.series_opp_wins), t=Math.min(g.series_my_wins,g.series_opp_wins)
  return `G${g.series_my_wins+g.series_opp_wins+1} (${l}–${t})`
}

export default function DatabasePage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [pending, setPending] = useState<FilterState>(DEFAULT_FILTERS)
  const [rows,    setRows]    = useState<PlayerGame[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(0)
  const [loading, setLoading] = useState(false)
  const [modal,   setModal]   = useState<string|null>(null)
  const [showFilters, setShowFilters] = useState(true)
  const debRef = useRef<ReturnType<typeof setTimeout>>()

  const fetchRows = useCallback(async (f:FilterState, pg:number) => {
    setLoading(true)
    let q = supabase.from('player_games').select('*',{count:'exact'})
    if (f.search)    q = q.ilike('player',`%${f.search}%`)
    if (f.franchise) q = q.eq('franchise',f.franchise)
    if (f.round === 'title') {
      // Show only games played by players on championship teams in the Finals
      q = q.eq('round', 4).eq('result', 'W')
    } else if (f.round) {
      q = q.eq('round', Number(f.round))
    }
    if (f.result)    q = q.eq('result',f.result)
    if (f.homeAway)  q = q.eq('home_away',f.homeAway)
    q = q.gte('season',f.seasonMin).lte('season',f.seasonMax)
    if (f.ptsMin)  q = q.gte('pts',Number(f.ptsMin))
    if (f.ptsMax)  q = q.lte('pts',Number(f.ptsMax))
    if (f.astMin)  q = q.gte('ast',Number(f.astMin))
    if (f.astMax)  q = q.lte('ast',Number(f.astMax))
    if (f.trbMin)  q = q.gte('trb',Number(f.trbMin))
    if (f.trbMax)  q = q.lte('trb',Number(f.trbMax))
    if (f.stlMin)  q = q.gte('stl',Number(f.stlMin))
    if (f.stlMax)  q = q.lte('stl',Number(f.stlMax))
    if (f.blkMin)  q = q.gte('blk',Number(f.blkMin))
    if (f.blkMax)  q = q.lte('blk',Number(f.blkMax))
    if (f.tovMax)  q = q.lte('tov',Number(f.tovMax))
    if (f.gmscMin) q = q.gte('gmsc_computed',Number(f.gmscMin))
    q = q.order(f.sortCol,{ascending:f.sortDir==='asc',nullsFirst:false})
         .range(pg*PAGE, pg*PAGE+PAGE-1)
    const {data,count} = await q
    setRows((data as PlayerGame[])??[])
    setTotal(count??0)
    setLoading(false)
  },[])

  useEffect(()=>{
    clearTimeout(debRef.current)
    debRef.current=setTimeout(()=>{setPage(0);fetchRows(pending,0)},350)
    return()=>clearTimeout(debRef.current)
  },[pending,fetchRows])

  function apply(){setPage(0);setFilters(pending);fetchRows(pending,0)}
  function reset(){setPending(DEFAULT_FILTERS);setFilters(DEFAULT_FILTERS);setPage(0);fetchRows(DEFAULT_FILTERS,0)}
  function goPage(pg:number){setPage(pg);fetchRows(filters,pg)}
  function sort(col:string){
    const n={...filters,sortCol:col,sortDir:(filters.sortCol===col&&filters.sortDir==='desc')?'asc' as const:'desc' as const}
    setFilters(n);setPending(n);setPage(0);fetchRows(n,0)
  }
  const totalPages=Math.ceil(total/PAGE)

  function Th({col,children,right}:{col:string;children:React.ReactNode;right?:boolean}){
    const active=filters.sortCol===col
    return(
      <th className="sortable" onClick={()=>sort(col)} style={{textAlign:right?'right':'left'}}>
        {children}{active?(filters.sortDir==='desc'?' ↓':' ↑'):''}
      </th>
    )
  }

  return(
    <div style={{display:'flex',height:'calc(100vh - 52px)',overflow:'hidden'}}>
      {showFilters&&(
        <aside style={{width:240,flexShrink:0,background:'var(--bg)',borderRight:'1px solid var(--border)',overflowY:'auto',padding:'16px 14px',display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontFamily:'var(--font-head)',fontSize:16,letterSpacing:'0.06em',color:'var(--blue)'}}>FILTERS</span>
            <button className="btn" style={{padding:'3px 8px',fontSize:11}} onClick={reset}>Reset</button>
          </div>
          <div><label className="filter-label">Player</label>
            <input type="search" placeholder="Search name…" value={pending.search} onChange={e=>setPending(p=>({...p,search:e.target.value}))}/></div>
          <div><label className="filter-label">Franchise</label>
            <select value={pending.franchise} onChange={e=>setPending(p=>({...p,franchise:e.target.value}))}>
              <option value="">All franchises</option>
              <optgroup label="Active Franchises">
                {ACTIVE_FRANCHISES.map(f=><option key={f.abbr} value={f.abbr}>{f.name}</option>)}
              </optgroup>
              <optgroup label="── Defunct ──">
                {DEFUNCT_FRANCHISES.map(f=><option key={f.abbr} value={f.abbr}>{f.name}</option>)}
              </optgroup>
            </select></div>
          <div><label className="filter-label">Season</label>
            <div className="filter-row">
              <input type="number" placeholder="From" value={pending.seasonMin} onChange={e=>setPending(p=>({...p,seasonMin:Number(e.target.value)}))}/>
              <input type="number" placeholder="To"   value={pending.seasonMax} onChange={e=>setPending(p=>({...p,seasonMax:Number(e.target.value)}))}/>
            </div></div>
          <div><label className="filter-label">Round</label>
            <select value={pending.round} onChange={e=>setPending(p=>({...p,round:e.target.value}))}>
              <option value="">All rounds</option>
              {[1,2,3,4].map(r=><option key={r} value={r}>{ROUND_NAMES[r]}</option>)}
              <option value="title">🏆 Champions only</option>
            </select></div>
          <div><label className="filter-label">Result</label>
            <select value={pending.result} onChange={e=>setPending(p=>({...p,result:e.target.value}))}>
              <option value="">W & L</option><option value="W">Wins only</option><option value="L">Losses only</option>
            </select></div>
          <div><label className="filter-label">Location</label>
            <select value={pending.homeAway} onChange={e=>setPending(p=>({...p,homeAway:e.target.value}))}>
              <option value="">All</option><option value="H">Home</option><option value="A">Away</option><option value="N">Neutral</option>
            </select></div>
          <div style={{borderTop:'1px solid var(--border)',paddingTop:10}}>
            <span className="filter-label" style={{marginBottom:8,display:'block'}}>Stat Thresholds</span>
            {[['PTS','ptsMin','ptsMax'],['AST','astMin','astMax'],['REB','trbMin','trbMax'],['STL','stlMin','stlMax'],['BLK','blkMin','blkMax']].map(([lbl,mn,mx])=>(
              <div key={lbl} style={{marginBottom:8}}>
                <label className="filter-label" style={{fontSize:10}}>{lbl}</label>
                <div className="filter-row">
                  <input type="number" placeholder="Min" value={(pending as Record<string,string>)[mn]} onChange={e=>setPending(p=>({...p,[mn]:e.target.value}))}/>
                  <input type="number" placeholder="Max" value={(pending as Record<string,string>)[mx]} onChange={e=>setPending(p=>({...p,[mx]:e.target.value}))}/>
                </div>
              </div>
            ))}
            <div style={{marginBottom:8}}><label className="filter-label" style={{fontSize:10}}>TOV max</label>
              <input type="number" placeholder="e.g. 3" value={pending.tovMax} onChange={e=>setPending(p=>({...p,tovMax:e.target.value}))}/></div>
            <div><label className="filter-label" style={{fontSize:10}}>GmSc min</label>
              <input type="number" placeholder="e.g. 20" value={pending.gmscMin} onChange={e=>setPending(p=>({...p,gmscMin:e.target.value}))}/></div>
          </div>
          <button className="btn btn-blue" onClick={apply} style={{width:'100%',justifyContent:'center'}}>Apply</button>
        </aside>
      )}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'10px 16px',borderBottom:'1px solid var(--border)',background:'var(--surface)',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <button className="btn" onClick={()=>setShowFilters(f=>!f)}>{showFilters?'◀ Hide':'▶ Filters'}</button>
          <span style={{fontSize:13,color:'var(--text2)'}}>{loading?'Loading…':`${total.toLocaleString()} games`}</span>
          <span style={{marginLeft:'auto',fontSize:12,color:'var(--text3)'}}>Click player name to open card</span>
        </div>
        <div style={{flex:1,overflowX:'auto',overflowY:'auto'}}>
          {loading&&rows.length===0?(<div className="loading"><div className="spinner"/>Loading…</div>)
          :rows.length===0?(<div className="empty">No games match these filters.</div>):(
            <table className="data-table">
              <thead><tr>
                <Th col="player">Player</Th><Th col="date">Date</Th><Th col="season">Season</Th>
                <th>Team</th><th>Opp</th><th>W/L</th><th>Rnd</th><th>Series</th>
                <Th col="pts" right>PTS</Th><Th col="ast" right>AST</Th><Th col="trb" right>REB</Th>
                <Th col="stl" right>STL</Th><Th col="blk" right>BLK</Th><Th col="tov" right>TOV</Th>
                <Th col="fg_pct" right>FG%</Th><Th col="three_p" right>3PM</Th>
                <Th col="three_p_pct" right>3P%</Th><Th col="ft_pct" right>FT%</Th>
                <Th col="ts_pct" right>TS%</Th><Th col="mp" right>MIN</Th>
                <Th col="gmsc_computed" right>GmSc</Th><Th col="bpm" right>BPM</Th>
                <Th col="plus_minus" right>+/-</Th>
              </tr></thead>
              <tbody>
                {rows.map(g=>(
                  <tr key={g.id}>
                    <td className="player-cell" onClick={()=>setModal(g.player)}>{g.player}</td>
                    <td>{g.date}</td><td>{g.season}</td>
                    <td><span className="tag tag-dim">{g.team}</span></td>
                    <td style={{color:'var(--text2)'}}>{g.opp}</td>
                    <td className={g.result==='W'?'win':'loss'}>{g.result}</td>
                    <td className="num">{g.round}</td>
                    <td style={{fontSize:11,color:'var(--text2)'}}>{seriesState(g)}</td>
                    <td className="num blue">{fmtNum(g.pts)}</td>
                    <td className="num">{fmtNum(g.ast)}</td><td className="num">{fmtNum(g.trb)}</td>
                    <td className="num">{fmtNum(g.stl)}</td><td className="num">{fmtNum(g.blk)}</td>
                    <td className="num">{fmtNum(g.tov)}</td>
                    <td className="num">{fmtPct(g.fg_pct)}</td><td className="num">{fmtNum(g.three_p)}</td>
                    <td className="num">{fmtPct(g.three_p_pct)}</td><td className="num">{fmtPct(g.ft_pct)}</td>
                    <td className="num">{fmtPct(g.ts_pct)}</td><td className="num">{fmtNum(g.mp,0)}</td>
                    <td className="num blue">{fmtNum(g.gmsc_computed,1)}</td>
                    <td className="num">{fmtNum(g.bpm,1)}</td>
                    <td className="num" style={{color:(g.plus_minus??0)>=0?'var(--green)':'var(--red)'}}>
                      {g.plus_minus!=null?(g.plus_minus>=0?'+':'')+g.plus_minus:'—'}
                    </td>
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
      </div>
      {modal&&<PlayerModal player={modal} onClose={()=>setModal(null)}/>}
    </div>
  )
}
