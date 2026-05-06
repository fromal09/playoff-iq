'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import PlayerModal from '@/components/PlayerModal'

type GameRow = {
  player:string; date:string; season:number; team:string
  pts:number|null; ast:number|null; trb:number|null
  stl:number|null; blk:number|null; tov:number|null
  fg:number|null; fga:number|null; fg_pct:number|null
  three_p:number|null; ft:number|null; fta:number|null; ft_pct:number|null
  mp:number|null; result:string; gmsc_computed:number
}
type PlayerStat = {
  player:string; games:number; wins:number
  gmscTotal:number; gmscAvg:number
  pts:number; ast:number; trb:number; stl:number; blk:number; tov:number
  fg_pct:number|null; three_p:number; ft_pct:number|null
  // rank comparison (filled after career data loads)
  careerTotal:number
  prePlayoffTotal:number
  currentRank:number
  prePlayoffRank:number
  playersPassed:string[]
}

const n1 = (v:number|null) => v != null ? Number(v).toFixed(1) : '—'
const pct = (v:number|null) => v != null ? (v*100).toFixed(1)+'%' : '—'

type SortCol = 'gmscTotal'|'gmscAvg'|'games'|'pts'|'ast'|'trb'|'stl'|'blk'|'tov'|'wins'

export default function PlayoffsPage() {
  const [currentRows,  setCurrentRows]  = useState<GameRow[]>([])
  const [careerTotals, setCareerTotals] = useState<Map<string,number>>(new Map())
  const [loading,      setLoading]      = useState(true)
  const [season,       setSeason]       = useState(0)
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set())
  const [passedOpen,   setPassedOpen]   = useState<Set<string>>(new Set())
  const [sortCol,      setSortCol]      = useState<SortCol>('gmscTotal')
  const [sortDir,      setSortDir]      = useState<'asc'|'desc'>('desc')
  const [search,       setSearch]       = useState('')
  const [modal,        setModal]        = useState<string|null>(null)

  // Step 1: find current season
  useEffect(()=>{
    supabase.from('player_games').select('season').order('season',{ascending:false}).limit(1)
      .then(({data})=>{ if(data?.[0]) setSeason(data[0].season) })
  },[])

  // Step 2: load current season games
  useEffect(()=>{
    if(!season) return
    async function load(){
      setLoading(true)
      const all:GameRow[]=[]
      let from=0
      while(true){
        const {data}=await supabase.from('player_games')
          .select('player,date,season,team,pts,ast,trb,stl,blk,tov,fg,fga,fg_pct,three_p,ft,fta,ft_pct,mp,result,gmsc_computed')
          .eq('season',season).range(from,from+999)
        if(!data||!data.length) break
        all.push(...(data as GameRow[]))
        if(data.length<1000) break; from+=1000
      }
      setCurrentRows(all)
      setLoading(false)
    }
    load()
  },[season])

  // Step 3: load career totals (gmsc_computed sum per player, all time)
  useEffect(()=>{
    if(!season) return
    async function loadCareer(){
      // Fetch ALL player career gmsc sums using the career stats view or by aggregating
      // We paginate through all player_games to sum gmsc per player
      const all:GameRow[]=[]
      let from=0
      while(true){
        const {data}=await supabase.from('player_games')
          .select('player,gmsc_computed').range(from,from+999)
        if(!data||!data.length) break
        all.push(...(data as GameRow[]))
        if(data.length<1000) break; from+=1000
      }
      const map=new Map<string,number>()
      for(const r of all){
        map.set(r.player,(map.get(r.player)??0)+(r.gmsc_computed??0))
      }
      setCareerTotals(map)
    }
    loadCareer()
  },[season])

  // Aggregate current season into per-player stats
  const playerStats = useMemo(():PlayerStat[]=>{
    const map=new Map<string,{rows:GameRow[]}>()
    for(const r of currentRows){
      const d=map.get(r.player)??{rows:[]}
      d.rows.push(r); map.set(r.player,d)
    }
    return Array.from(map.entries()).map(([player,{rows}])=>{
      const g=rows.length
      const wins=rows.filter(r=>r.result==='W').length
      const wa=(k:keyof GameRow)=>rows.reduce((s,r)=>s+((r[k] as number)??0),0)/g
      const gmscTotal=rows.reduce((s,r)=>s+(r.gmsc_computed??0),0)
      const fgMakes=rows.reduce((s,r)=>s+(r.fg??0),0)
      const fgAttempts=rows.reduce((s,r)=>s+(r.fga??0),0)
      const ftMakes=rows.reduce((s,r)=>s+(r.ft??0),0)
      const ftAttempts=rows.reduce((s,r)=>s+(r.fta??0),0)
      return{
        player, games:g, wins,
        gmscTotal: Math.round(gmscTotal*100)/100,
        gmscAvg: Math.round(gmscTotal/g*100)/100,
        pts: Math.round(wa('pts')*10)/10,
        ast: Math.round(wa('ast')*10)/10,
        trb: Math.round(wa('trb')*10)/10,
        stl: Math.round(wa('stl')*10)/10,
        blk: Math.round(wa('blk')*10)/10,
        tov: Math.round(wa('tov')*10)/10,
        three_p: Math.round(wa('three_p')*10)/10,
        fg_pct: fgAttempts>0?Math.round(fgMakes/fgAttempts*1000)/10:null,
        ft_pct: ftAttempts>0?Math.round(ftMakes/ftAttempts*1000)/10:null,
        // rank comparison filled below
        careerTotal:0, prePlayoffTotal:0, currentRank:0, prePlayoffRank:0, playersPassed:[],
      }
    })
  },[currentRows])

  // Compute rank comparison using career totals
  const enriched = useMemo(():PlayerStat[]=>{
    if(!careerTotals.size||!playerStats.length) return playerStats

    // Current season GmSc per player
    const currentGmsc=new Map(playerStats.map(p=>[p.player,p.gmscTotal]))

    // For each player compute pre-playoff total and ranks
    const result:PlayerStat[]=playerStats.map(p=>{
      const careerTotal=careerTotals.get(p.player)??0
      const prePlayoffTotal=careerTotal-p.gmscTotal

      // Count players whose current career > this player's current career (= current rank)
      let currentRank=1
      for(const[pl,tot] of careerTotals){
        if(pl!==p.player && tot>careerTotal) currentRank++
      }

      // Count players whose pre-playoff total > this player's pre-playoff total (= pre rank)
      let prePlayoffRank=1
      const playersPassed:string[]=[]
      for(const[pl,tot] of careerTotals){
        if(pl===p.player) continue
        const plCur=currentGmsc.get(pl)??0
        const plPre=tot-plCur  // their pre-playoff total
        if(plPre>prePlayoffTotal) prePlayoffRank++
        // They passed this player if: plPre >= p.prePlayoffTotal AND plPre <= p.careerTotal
        // i.e. before the playoffs this player was ahead, now they're behind
        if(plPre>=prePlayoffTotal&&plPre<careerTotal) playersPassed.push(pl)
      }
      // Sort players passed by how recently they were passed (closest gmsc gap)
      playersPassed.sort((a,b)=>{
        const at=careerTotals.get(a)??0, bt=careerTotals.get(b)??0
        return bt-at
      })

      return{...p,careerTotal,prePlayoffTotal,currentRank,prePlayoffRank,playersPassed}
    })

    return result
  },[playerStats,careerTotals])

  const sorted = useMemo(()=>{
    let r=[...enriched].filter(p=>!search||p.player.toLowerCase().includes(search.toLowerCase()))
    r.sort((a,b)=>{
      const av=a[sortCol],bv=b[sortCol]
      return sortDir==='desc'?bv-av:av-bv
    })
    return r
  },[enriched,search,sortCol,sortDir])

  function toggleSort(col:SortCol){
    if(sortCol===col) setSortDir(d=>d==='desc'?'asc':'desc')
    else{setSortCol(col);setSortDir('desc')}
  }

  function Th({col,ch,right=true}:{col:SortCol;ch:string;right?:boolean}){
    const active=sortCol===col
    return(
      <th onClick={()=>toggleSort(col)} className="sortable"
        style={{textAlign:right?'right':'left',cursor:'pointer',color:active?'var(--blue)':'var(--text)',fontSize:13,whiteSpace:'nowrap'}}>
        {ch}{active?(sortDir==='desc'?' ↓':' ↑'):''}
      </th>
    )
  }

  function toggleExpanded(player:string){setExpanded(e=>{const n=new Set(e);n.has(player)?n.delete(player):n.add(player);return n})}
  function togglePassed(player:string){setPassedOpen(e=>{const n=new Set(e);n.has(player)?n.delete(player):n.add(player);return n})}

  const rankChange = (p:PlayerStat) => p.prePlayoffRank - p.currentRank

  return(
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 72px)',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'10px 20px',borderBottom:'2px solid var(--text)',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap',flexShrink:0,background:'var(--surface)'}}>
        <div>
          <div className="section-head" style={{margin:0,border:'none',padding:0,letterSpacing:'0.05em'}}>
            {season||'—'} Playoffs
          </div>
          <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>Per-player stats · click any row to see career rank movement</div>
        </div>
        <div style={{display:'flex',gap:8,marginLeft:'auto',alignItems:'center'}}>
          <input type="search" placeholder="Filter player…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:180,fontSize:12,padding:'5px 8px'}}/>
          <span style={{fontSize:12,color:'var(--text3)'}}>{sorted.length} players</span>
        </div>
      </div>

      {loading?(
        <div className="loading"><div className="spinner"/>Loading {season} playoffs…</div>
      ):(
        <div style={{flex:1,overflowY:'auto',overflowX:'auto'}}>
          <table className="data-table" style={{minWidth:720}}>
            <thead style={{position:'sticky',top:0,zIndex:2,background:'var(--surface)'}}>
              <tr>
                <th style={{width:32,paddingLeft:12,fontSize:13}}>#</th>
                <th style={{fontSize:13,minWidth:160}}>Player</th>
                <Th col="games"    ch="G"/>
                <Th col="wins"     ch="W"/>
                <Th col="gmscTotal" ch="GmSc Total"/>
                <Th col="gmscAvg"  ch="GmSc Avg"/>
                <Th col="pts"      ch="PTS"/>
                <Th col="trb"      ch="REB"/>
                <Th col="ast"      ch="AST"/>
                <Th col="stl"      ch="STL"/>
                <Th col="blk"      ch="BLK"/>
                <Th col="tov"      ch="TOV"/>
                <th className="num" style={{fontSize:13}}>FG%</th>
                <th className="num" style={{fontSize:13}}>FT%</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p,i)=>{
                const isExp=expanded.has(p.player)
                const delta=rankChange(p)
                const hasPassed=p.playersPassed.length>0
                const passedExp=passedOpen.has(p.player)
                const careerLoaded=careerTotals.size>0

                return(
                  <>
                    <tr key={p.player}
                      style={{cursor:'pointer',background:isExp?'var(--blue-dim)':undefined}}
                      onClick={()=>toggleExpanded(p.player)}>
                      <td style={{paddingLeft:12,color:'var(--text3)',fontSize:12,fontFamily:'var(--font-mono)'}}>{i+1}</td>
                      <td style={{fontWeight:i<3?700:500,color:'var(--text)',fontSize:13,display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:11,color:isExp?'var(--blue)':'var(--text3)',transition:'transform .2s',display:'inline-block',transform:isExp?'rotate(90deg)':'none'}}>▶</span>
                        {p.player}
                      </td>
                      <td className="num" style={{fontSize:13}}>{p.games}</td>
                      <td className="num" style={{fontSize:13,color:'var(--text2)'}}>{p.wins}</td>
                      <td className="num" style={{fontWeight:700,color:'var(--blue)',fontSize:13,fontFamily:'var(--font-mono)'}}>{p.gmscTotal.toFixed(1)}</td>
                      <td className="num" style={{fontSize:13,fontFamily:'var(--font-mono)'}}>{p.gmscAvg.toFixed(2)}</td>
                      <td className="num" style={{fontSize:13}}>{n1(p.pts)}</td>
                      <td className="num" style={{fontSize:13}}>{n1(p.trb)}</td>
                      <td className="num" style={{fontSize:13}}>{n1(p.ast)}</td>
                      <td className="num" style={{fontSize:13}}>{n1(p.stl)}</td>
                      <td className="num" style={{fontSize:13}}>{n1(p.blk)}</td>
                      <td className="num" style={{fontSize:13,color:p.tov>3?'var(--red)':'inherit'}}>{n1(p.tov)}</td>
                      <td className="num" style={{fontSize:13}}>{p.fg_pct!=null?p.fg_pct.toFixed(1)+'%':'—'}</td>
                      <td className="num" style={{fontSize:13}}>{p.ft_pct!=null?p.ft_pct.toFixed(1)+'%':'—'}</td>
                    </tr>

                    {/* Expanded rank row */}
                    {isExp&&(
                      <tr key={`${p.player}-exp`}>
                        <td colSpan={14} style={{padding:0,background:'var(--blue-dim)',borderBottom:'2px solid var(--border)'}}>
                          <div style={{padding:'14px 20px 14px 52px'}}>
                            {!careerLoaded?(
                              <div style={{fontSize:12,color:'var(--text3)'}}>Loading career data…</div>
                            ):(
                              <div style={{display:'flex',gap:32,flexWrap:'wrap',alignItems:'flex-start'}}>

                                {/* All-time rank */}
                                <div style={{textAlign:'center',minWidth:100}}>
                                  <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--text3)',marginBottom:4}}>All-Time Rank</div>
                                  <div style={{fontFamily:'var(--font-mono)',fontSize:28,fontWeight:700,color:'var(--blue)'}}>#{p.currentRank}</div>
                                  <div style={{fontSize:10,color:'var(--text3)'}}>GmSc Career Total</div>
                                </div>

                                {/* Arrow and rank change */}
                                <div style={{textAlign:'center',minWidth:100}}>
                                  <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--text3)',marginBottom:4}}>{season} Movement</div>
                                  {delta>0?(
                                    <div style={{fontFamily:'var(--font-mono)',fontSize:28,fontWeight:700,color:'var(--green)'}}>▲{delta}</div>
                                  ):delta<0?(
                                    <div style={{fontFamily:'var(--font-mono)',fontSize:28,fontWeight:700,color:'var(--red)'}}>▼{Math.abs(delta)}</div>
                                  ):(
                                    <div style={{fontFamily:'var(--font-mono)',fontSize:28,fontWeight:700,color:'var(--text3)'}}>—</div>
                                  )}
                                  <div style={{fontSize:10,color:'var(--text3)'}}>
                                    {delta>0?`Moved from #${p.prePlayoffRank}`:delta<0?`Slipped from #${p.prePlayoffRank}`:'No change'}
                                  </div>
                                </div>

                                {/* Career GmSc this playoffs vs career */}
                                <div style={{minWidth:160}}>
                                  <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--text3)',marginBottom:6}}>Career GmSc</div>
                                  <div style={{display:'flex',gap:16}}>
                                    <div>
                                      <div style={{fontSize:10,color:'var(--text3)'}}>Before {season}</div>
                                      <div style={{fontFamily:'var(--font-mono)',fontSize:15,fontWeight:700,color:'var(--text)'}}>{p.prePlayoffTotal.toFixed(1)}</div>
                                    </div>
                                    <div style={{fontSize:16,color:'var(--text3)',alignSelf:'center'}}>→</div>
                                    <div>
                                      <div style={{fontSize:10,color:'var(--text3)'}}>Now</div>
                                      <div style={{fontFamily:'var(--font-mono)',fontSize:15,fontWeight:700,color:'var(--blue)'}}>{p.careerTotal.toFixed(1)}</div>
                                    </div>
                                    <div>
                                      <div style={{fontSize:10,color:'var(--text3)'}}>Added</div>
                                      <div style={{fontFamily:'var(--font-mono)',fontSize:15,fontWeight:700,color:'var(--green)'}}>+{p.gmscTotal.toFixed(1)}</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Players passed */}
                                {hasPassed&&(
                                  <div style={{flex:1,minWidth:200}}>
                                    <button onClick={e=>{e.stopPropagation();togglePassed(p.player)}}
                                      style={{fontSize:12,padding:'4px 12px',marginBottom:8,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:3,cursor:'pointer',color:'var(--blue)',fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
                                      <span style={{transform:passedExp?'rotate(90deg)':'none',display:'inline-block',transition:'transform .15s'}}>▶</span>
                                      {p.playersPassed.length} player{p.playersPassed.length!==1?'s':''} surpassed this postseason
                                    </button>
                                    {passedExp&&(
                                      <div style={{display:'flex',flexWrap:'wrap',gap:4,maxHeight:120,overflowY:'auto'}}>
                                        {p.playersPassed.map(pl=>(
                                          <span key={pl}
                                            style={{fontSize:11,padding:'2px 8px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:2,cursor:'pointer',color:'var(--text)'}}
                                            onClick={e=>{e.stopPropagation();setModal(pl)}}>
                                            {pl}
                                            <span style={{color:'var(--text3)',marginLeft:4,fontFamily:'var(--font-mono)',fontSize:10}}>
                                              ({(careerTotals.get(pl)??0).toFixed(0)})
                                            </span>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {!hasPassed&&delta===0&&(
                                  <div style={{fontSize:12,color:'var(--text3)',alignSelf:'center'}}>No rank change this postseason</div>
                                )}

                                {/* View full modal */}
                                <div style={{alignSelf:'center'}}>
                                  <button onClick={e=>{e.stopPropagation();setModal(p.player)}}
                                    className="btn btn-blue" style={{fontSize:12,padding:'5px 12px'}}>
                                    Full Profile →
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {modal&&<PlayerModal player={modal} onClose={()=>setModal(null)}/>}
    </div>
  )
}
