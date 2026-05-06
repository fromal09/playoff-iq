'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { FRANCHISE_NAMES, FRANCHISE_ROLLUP } from '@/lib/franchise'
import PlayerModal from '@/components/PlayerModal'

// ── Types ──────────────────────────────────────────────────────────────────
type CrownRow = {
  id:number; date:string; season:number; team:string; opp:string
  event:string; crown_holder:string; crown_team:string
  prev_holder:string; prev_team:string; gmsc:number; streak:number; total_games:number
}
type Stint = {
  player:string; team:string; franchise:string
  startDate:string; endDate:string
  acquireEvent:string; loseEvent:string|null; loseToPlayer:string|null
  games:number; season:number; acquireGmsc:number; bestGmsc:number; prevHolder:string
}
type PlayerStats = {
  player:string; totalGames:number; possessions:number
  defenses:number; losses:number; maxStreak:number; avgGames:number; teams:string[]
}
type FranchiseStat = {
  franchise:string; name:string; totalGames:number; uniqueHolders:number
  topThree:{player:string;games:number}[]
  recentHolder:string; recentDate:string
}

const EV_LABEL:Record<string,string>={initial:'👑 First Crown',defend:'🛡 Defended',transfer_teammate:'🔄 To Teammate',transfer_loss:'⚔️ Wrested Away',new_season:'🆕 New Season'}
const EV_COLOR:Record<string,string>={initial:'var(--gold)',defend:'var(--green)',transfer_teammate:'var(--blue2)',transfer_loss:'var(--red)',new_season:'var(--text3)'}

// ── Vertical Timeline ──────────────────────────────────────────────────────
function Timeline({stints, onPlayer}:{stints:Stint[];onPlayer:(p:string)=>void}){
  const [search,setSearch]=useState('')
  const [transfersOnly,setTransfersOnly]=useState(false)
  const seasonRefs=useRef<Record<string,HTMLDivElement|null>>({})

  const filtered=useMemo(()=>{
    let s=[...stints].reverse() // most recent first
    if(search) s=s.filter(st=>st.player.toLowerCase().includes(search.toLowerCase())||st.prevHolder.toLowerCase().includes(search.toLowerCase())||(st.loseToPlayer||'').toLowerCase().includes(search.toLowerCase()))
    if(transfersOnly) s=s.filter(st=>st.acquireEvent!=='defend')
    return s
  },[stints,search,transfersOnly])

  const seasons=useMemo(()=>[...new Set(stints.map(s=>s.season))].sort((a,b)=>b-a),[stints])

  function jumpTo(season:number){
    // Find first stint in this season (reversed = most recent, so season header appears at first occurrence)
    const el=seasonRefs.current[String(season)]
    if(el) el.scrollIntoView({behavior:'smooth',block:'start'})
  }

  let lastSeason=-1

  return(
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
      {/* Year jump sidebar */}
      <div style={{width:72,flexShrink:0,borderRight:'1px solid var(--border)',overflowY:'auto',background:'var(--bg2)',padding:'8px 0'}}>
        <div style={{fontSize:9,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',textAlign:'center',padding:'4px 0 8px'}}>Jump</div>
        {seasons.map(yr=>(
          <button key={yr} onClick={()=>jumpTo(yr)} style={{display:'block',width:'100%',padding:'5px 4px',fontSize:11,fontFamily:'var(--font-mono)',fontWeight:500,color:'var(--text2)',background:'none',border:'none',cursor:'pointer',textAlign:'center',borderBottom:'1px solid var(--border)'}}>
            {yr}
          </button>
        ))}
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* Filter bar */}
        <div style={{padding:'10px 16px',display:'flex',gap:10,alignItems:'center',borderBottom:'1px solid var(--border)',flexShrink:0,flexWrap:'wrap',background:'var(--surface)'}}>
          <input type="search" placeholder="Filter by player…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:180,fontSize:12,padding:'5px 8px'}}/>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text2)',cursor:'pointer'}}>
            <input type="checkbox" checked={transfersOnly} onChange={e=>setTransfersOnly(e.target.checked)}/>
            Transfers only
          </label>
          <span style={{fontSize:11,color:'var(--text3)',marginLeft:'auto'}}>{filtered.length} stints · most recent first</span>
        </div>

        {/* Scrollable stints */}
        <div style={{flex:1,overflowY:'auto',padding:'0 0 40px'}}>
          <div style={{maxWidth:700,margin:'0 auto',padding:'0 20px'}}>
            {filtered.map((stint,i)=>{
              const isNewSeason=stint.season!==lastSeason
              if(isNewSeason) lastSeason=stint.season
              const isAcquire=stint.acquireEvent!=='defend'
              const acqColor=EV_COLOR[stint.acquireEvent]??'var(--text3)'
              const multiGame=stint.games>1
              const dateLabel=stint.startDate===stint.endDate?stint.startDate:`${stint.startDate} → ${stint.endDate}`
              return(
                <div key={i}>
                  {isNewSeason&&(
                    <div ref={el=>{seasonRefs.current[String(stint.season)]=el}}
                      style={{display:'flex',alignItems:'center',gap:12,margin:'28px 0 16px'}}>
                      <div style={{flex:1,height:1,background:'var(--border)'}}/>
                      <div style={{background:'var(--blue)',color:'#fff',fontFamily:'var(--font-head)',fontSize:14,fontWeight:700,padding:'4px 16px',borderRadius:20,flexShrink:0,letterSpacing:'0.03em'}}>
                        {stint.season} Playoffs
                      </div>
                      <div style={{flex:1,height:1,background:'var(--border)'}}/>
                    </div>
                  )}

                  {/* Stint card */}
                  <div style={{display:'flex',gap:0,marginBottom:4}}>
                    {/* Timeline line + dot */}
                    <div style={{width:32,flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',paddingTop:16}}>
                      <div style={{width:isAcquire?14:10,height:isAcquire?14:10,borderRadius:'50%',background:acqColor,border:'2px solid var(--surface)',flexShrink:0,zIndex:1,boxShadow:isAcquire?`0 0 0 3px ${acqColor}33`:'none'}}/>
                      <div style={{width:1,flex:1,background:'var(--border)',marginTop:3}}/>
                    </div>

                    {/* Card */}
                    <div style={{flex:1,paddingLeft:10,paddingBottom:6}}>
                      <div style={{border:`1px solid ${isAcquire?acqColor+'44':'var(--border)'}`,borderRadius:8,padding:'12px 14px',background:isAcquire?`${acqColor}08`:'var(--surface2)'}}>
                        {/* Acquire badge + date range */}
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                          <span style={{fontSize:10,fontWeight:700,color:acqColor,textTransform:'uppercase',letterSpacing:'0.07em'}}>{EV_LABEL[stint.acquireEvent]??stint.acquireEvent}</span>
                          <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--font-mono)'}}>{dateLabel}</span>
                          {multiGame&&<span style={{fontSize:10,color:'var(--green)',fontWeight:600,background:'rgba(45,106,79,0.1)',padding:'1px 6px',borderRadius:3}}>{stint.games} games held</span>}
                        </div>

                        {/* Player row */}
                        <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4,flexWrap:'wrap'}}>
                          <span style={{fontFamily:'var(--font-head)',fontSize:isAcquire?20:16,fontWeight:700,color:'var(--blue)',cursor:'pointer',lineHeight:1.2}}
                            onClick={()=>onPlayer(stint.player)}>
                            👑 {stint.player}
                          </span>
                          <span style={{fontSize:12,color:'var(--text2)'}}>{FRANCHISE_NAMES[stint.team]??stint.team}</span>
                          <span style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--font-mono)'}}>GmSc {stint.acquireGmsc.toFixed(1)}{stint.bestGmsc>stint.acquireGmsc?` → peak ${stint.bestGmsc.toFixed(1)}`:''}</span>
                        </div>

                        {/* Predecessor */}
                        {stint.prevHolder&&stint.prevHolder!==stint.player&&(
                          <div style={{fontSize:11,color:'var(--text3)'}}>
                            Taken from{' '}
                            <span style={{cursor:'pointer',color:'var(--text2)',fontWeight:500}} onClick={()=>onPlayer(stint.prevHolder)}>{stint.prevHolder}</span>
                          </div>
                        )}

                        {/* Loss line */}
                        {stint.loseToPlayer&&(
                          <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)',display:'flex',alignItems:'center',gap:6}}>
                            <span style={{fontSize:18,lineHeight:1}}>💀</span>
                            <div>
                              <span style={{fontSize:12,fontWeight:700,color:'var(--red)'}}>Lost to </span>
                              <span style={{fontSize:12,fontWeight:700,color:'var(--text)',cursor:'pointer'}} onClick={()=>onPlayer(stint.loseToPlayer!)}>{stint.loseToPlayer}</span>
                              {stint.loseEvent&&<span style={{fontSize:11,color:'var(--text3)',marginLeft:6}}>({EV_LABEL[stint.loseEvent]??stint.loseEvent})</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div style={{textAlign:'center',padding:'32px 0 16px',color:'var(--text3)',fontSize:12}}>── 1947–2026 · {stints.length} stints ──</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function CrownPage(){
  const [rows,setRows]     =useState<CrownRow[]>([])
  const [loading,setLoading]=useState(true)
  const [tab,setTab]       =useState<'leaderboard'|'timeline'|'franchise'|'methodology'>('leaderboard')
  const [lbSort,setLbSort] =useState<'totalGames'|'defenses'|'maxStreak'|'avgGames'|'possessions'>('totalGames')
  const [search,setSearch] =useState('')
  const [modal,setModal]   =useState<string|null>(null)

  useEffect(()=>{
    async function load(){
      setLoading(true)
      const all:CrownRow[]=[]
      let from=0
      while(true){
        const {data}=await supabase.from('crown_history').select('*').order('date',{ascending:true}).range(from,from+999)
        if(!data||!data.length) break
        all.push(...(data as CrownRow[]))
        if(data.length<1000) break
        from+=1000
      }
      setRows(all)
      setLoading(false)
    }
    load()
  },[])

  // ── Build stints (group consecutive same-holder rows) ────────────────────
  const stints=useMemo(():Stint[]=>{
    const result:Stint[]=[]
    let i=0
    while(i<rows.length){
      const startRow=rows[i]
      const player=startRow.crown_holder
      const stintRows:CrownRow[]=[]
      while(i<rows.length&&rows[i].crown_holder===player){stintRows.push(rows[i]);i++}
      const lastRow=stintRows[stintRows.length-1]
      const nextRow=rows[i]
      result.push({
        player,team:startRow.crown_team,
        franchise:FRANCHISE_ROLLUP[startRow.crown_team]??startRow.crown_team,
        startDate:startRow.date,endDate:lastRow.date,
        acquireEvent:startRow.event,
        loseEvent:nextRow?.event??null,
        loseToPlayer:nextRow?.crown_holder??null,
        games:Math.max(...stintRows.map(r=>r.streak)),
        season:startRow.season,
        acquireGmsc:Number(startRow.gmsc)||0,
        bestGmsc:Math.max(...stintRows.map(r=>Number(r.gmsc)||0)),
        prevHolder:startRow.prev_holder||'',
      })
    }
    return result
  },[rows])

  // ── Player stats from stints ────────────────────────────────────────────
  const playerStats=useMemo(():PlayerStats[]=>{
    const map=new Map<string,{total:number;poss:number;def:number;loss:number;maxS:number;teams:Set<string>}>()
    for(const s of stints){
      const p=map.get(s.player)??{total:0,poss:0,def:0,loss:0,maxS:0,teams:new Set()}
      p.total+=s.games; p.poss++; p.maxS=Math.max(p.maxS,s.games)
      p.def+=s.games-1 // each game after first = a defense
      if(s.loseToPlayer) p.loss++
      p.teams.add(s.team)
      map.set(s.player,p)
    }
    return Array.from(map.entries()).map(([player,p])=>({
      player,totalGames:p.total,possessions:p.poss,defenses:p.def,losses:p.loss,
      maxStreak:p.maxS,avgGames:p.poss>0?Math.round(p.total/p.poss*10)/10:0,teams:[...p.teams],
    }))
  },[stints])

  // ── Franchise stats ──────────────────────────────────────────────────────
  const franchiseStats=useMemo(():FranchiseStat[]=>{
    const map=new Map<string,{total:number;holders:Map<string,number>;recentHolder:string;recentDate:string}>()
    for(const s of stints){
      const fr=s.franchise
      const fs=map.get(fr)??{total:0,holders:new Map(),recentHolder:'',recentDate:''}
      fs.total+=s.games
      fs.holders.set(s.player,(fs.holders.get(s.player)??0)+s.games)
      if(s.endDate>fs.recentDate){fs.recentHolder=s.player;fs.recentDate=s.endDate}
      map.set(fr,fs)
    }
    return Array.from(map.entries()).map(([fr,fs])=>{
      const sorted=[...fs.holders.entries()].sort((a,b)=>b[1]-a[1])
      return{
        franchise:fr,name:FRANCHISE_NAMES[fr]??fr,
        totalGames:fs.total,uniqueHolders:fs.holders.size,
        topThree:sorted.slice(0,3).map(([player,games])=>({player,games})),
        recentHolder:fs.recentHolder,recentDate:fs.recentDate,
      }
    }).sort((a,b)=>b.totalGames-a.totalGames)
  },[stints])

  const sortedStats=useMemo(()=>playerStats
    .filter(p=>!search||p.player.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>b[lbSort]-a[lbSort])
  ,[playerStats,search,lbSort])

  const current=stints[stints.length-1]

  // Records — handle ties
  const maxGames=Math.max(...playerStats.map(p=>p.totalGames))
  const maxStreak=Math.max(...playerStats.map(p=>p.maxStreak))
  const maxDef=Math.max(...playerStats.map(p=>p.defenses))
  const maxAvg=Math.max(...playerStats.filter(p=>p.possessions>=3).map(p=>p.avgGames))
  const byGames  =playerStats.filter(p=>p.totalGames===maxGames)
  const byStreak =playerStats.filter(p=>p.maxStreak===maxStreak)
  const byDef    =playerStats.filter(p=>p.defenses===maxDef)
  const byAvg    =playerStats.filter(p=>p.possessions>=3&&p.avgGames===maxAvg)

  function SortTh({col,children}:{col:typeof lbSort;children:React.ReactNode}){
    return<th className="num sortable" onClick={()=>setLbSort(col)} style={{color:lbSort===col?'var(--blue)':'var(--text)',cursor:'pointer',whiteSpace:'nowrap',fontSize:13}}>{children}{lbSort===col?' ↓':''}</th>
  }

  function RecordCard({icon,label,holders,val}:{icon:string;label:string;holders:{player:string}[];val:string}){
    return(
      <div className="card2" style={{padding:'10px 12px',marginBottom:8}}>
        <div style={{fontSize:9,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:5}}>{icon} {label}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:4}}>
          {holders.map(h=>(
            <span key={h.player} style={{fontSize:13,fontWeight:600,color:'var(--text)',cursor:'pointer',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:4,padding:'1px 8px'}}
              onClick={()=>setModal(h.player)}>{h.player}</span>
          ))}
        </div>
        <div style={{fontSize:16,fontWeight:700,color:'var(--blue)',fontFamily:'var(--font-mono)'}}>{val}</div>
      </div>
    )
  }

  return(
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 72px)',overflow:'hidden'}}>
      {/* Hero */}
      {current&&!loading&&(
        <div style={{background:'var(--blue)',padding:'14px 24px',display:'flex',alignItems:'center',gap:20,flexWrap:'wrap',flexShrink:0}}>
          <div style={{fontSize:32}}>👑</div>
          <div style={{flex:1,minWidth:160}}>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:2}}>Current Crown Holder · 2026 Playoffs</div>
            <div style={{fontFamily:'var(--font-head)',fontSize:24,color:'#fff',cursor:'pointer'}} onClick={()=>setModal(current.player)}>
              {current.player}
            </div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:2}}>{FRANCHISE_NAMES[current.team]??current.team}</div>
          </div>
          {[
            ['Streak',`${current.games}g`],
            ['Total Held',`${playerStats.find(p=>p.player===current.player)?.totalGames??0}g`],
            ['Last GmSc',current.bestGmsc.toFixed(1)],
            ['Unique Holders',`${new Set(rows.map(r=>r.crown_holder)).size}`],
            ['Total Stints',`${stints.length}`],
          ].map(([l,v])=>(
            <div key={l} style={{textAlign:'center',flexShrink:0}}>
              <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.09em',marginBottom:2}}>{l}</div>
              <div style={{fontSize:20,fontWeight:700,color:'#fff',fontFamily:'var(--font-mono)'}}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="tab-bar" style={{flexShrink:0}}>
        {([['leaderboard','Leaderboard'],['timeline','Timeline'],['franchise','Franchise Leaders'],['methodology','Methodology']] as [string,string][]).map(([k,l])=>(
          <button key={k} className={`tab${tab===k?' active':''}`} onClick={()=>setTab(k as typeof tab)}>{l}</button>
        ))}
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {loading?(
          <div className="loading"><div className="spinner"/>Loading crown history…</div>
        ):tab==='leaderboard'?(

          // ── LEADERBOARD ────────────────────────────────────────────────
          <div style={{flex:1,display:'flex',overflow:'hidden'}}>
            <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
              <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:12,flexWrap:'wrap'}}>
                <input type="search" placeholder="Filter player…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:180,fontSize:12,padding:'5px 8px'}}/>
                <span style={{fontSize:12,color:'var(--text3)'}}>{sortedStats.length} holders</span>
              </div>
              <div style={{overflowX:'auto'}}>
                <table className="data-table" style={{minWidth:580}}>
                  <thead><tr>
                    <th style={{width:32,paddingLeft:10,fontSize:13}}>#</th>
                    <th style={{fontSize:13}}>Player</th>
                    <SortTh col="totalGames">Games Held</SortTh>
                    <SortTh col="defenses">Defenses</SortTh>
                    <SortTh col="maxStreak">Best Streak</SortTh>
                    <SortTh col="avgGames">Avg Games/Run</SortTh>
                    <SortTh col="possessions">Stints</SortTh>
                    <th className="num" style={{fontSize:13}}>Times Lost</th>
                  </tr></thead>
                  <tbody>
                    {sortedStats.map((r,i)=>(
                      <tr key={r.player}>
                        <td style={{paddingLeft:10,color:'var(--text3)',fontSize:12,fontFamily:'var(--font-mono)'}}>{i+1}</td>
                        <td className="player-cell" style={{fontWeight:i<3?700:400,color:i<3?'var(--blue)':'var(--text)',fontSize:13}} onClick={()=>setModal(r.player)}>{r.player}</td>
                        <td className="num" style={{fontWeight:700,color:'var(--blue)',fontFamily:'var(--font-mono)',fontSize:13}}>{r.totalGames}</td>
                        <td className="num" style={{color:'var(--green)',fontFamily:'var(--font-mono)',fontSize:13}}>{r.defenses}</td>
                        <td className="num" style={{color:r.maxStreak>=5?'var(--gold)':r.maxStreak>=3?'var(--blue)':'var(--text)',fontWeight:r.maxStreak>=4?700:400,fontFamily:'var(--font-mono)',fontSize:13}}>{r.maxStreak}</td>
                        <td className="num" style={{fontFamily:'var(--font-mono)',color:'var(--text)',fontSize:13}}>{r.avgGames.toFixed(1)}</td>
                        <td className="num" style={{fontFamily:'var(--font-mono)',color:'var(--text2)',fontSize:13}}>{r.possessions}</td>
                        <td className="num" style={{color:'var(--red)',fontFamily:'var(--font-mono)',fontSize:13}}>{r.losses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Records sidebar */}
            <div style={{width:240,flexShrink:0,borderLeft:'1px solid var(--border)',overflowY:'auto',padding:'16px 14px',background:'var(--bg2)'}}>
              <div style={{fontFamily:'var(--font-head)',fontSize:15,color:'var(--blue)',marginBottom:12}}>Records</div>
              <RecordCard icon="🎮" label="Most Games Held" holders={byGames} val={`${maxGames}g`}/>
              <RecordCard icon="⚡" label="Longest Streak" holders={byStreak} val={`${maxStreak}g`}/>
              <RecordCard icon="🛡" label="Most Defenses" holders={byDef} val={`${maxDef}`}/>
              <RecordCard icon="⏳" label="Best Avg Games/Stint" holders={byAvg} val={`${maxAvg.toFixed(1)}g`}/>
              <div style={{marginTop:8,padding:'10px 12px',background:'var(--surface)',borderRadius:5,border:'1px solid var(--border)'}}>
                <div style={{fontSize:9,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Transfer Breakdown</div>
                {[
                  ['⚔️ Wrested',stints.filter(s=>s.acquireEvent==='transfer_loss').length,'var(--red)'],
                  ['🔄 Teammate',stints.filter(s=>s.acquireEvent==='transfer_teammate').length,'var(--blue2)'],
                  ['🆕 New Season',stints.filter(s=>s.acquireEvent==='new_season').length,'var(--text3)'],
                ].map(([l,v,col])=>(
                  <div key={l as string} style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                    <span style={{fontSize:13,color:'var(--text)'}}>{l as string}</span>
                    <span style={{fontWeight:700,color:col as string,fontFamily:'var(--font-mono)',fontSize:13}}>{v as number}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        ):tab==='timeline'?(

          // ── TIMELINE ──────────────────────────────────────────────────
          <Timeline stints={stints} onPlayer={setModal}/>

        ):tab==='franchise'?(

          // ── FRANCHISE LEADERS ──────────────────────────────────────────
          <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
            <div style={{overflowX:'auto',border:'1px solid var(--border)',borderRadius:6,marginBottom:24}}>
              <table className="data-table">
                <thead><tr>
                  <th style={{width:28,paddingLeft:10,fontSize:13}}>#</th>
                  <th style={{fontSize:13}}>Franchise</th>
                  <th className="num" style={{fontSize:13}}>Games</th>
                  <th className="num" style={{fontSize:13}}>Holders</th>
                  <th style={{fontSize:13}}>Top Holder</th>
                  <th style={{fontSize:13}}>Recent Holder</th>
                  <th className="num" style={{fontSize:13}}>Recent Date</th>
                </tr></thead>
                <tbody>
                  {franchiseStats.map((fr,i)=>(
                    <tr key={fr.franchise}>
                      <td style={{paddingLeft:10,color:'var(--text3)',fontSize:12}}>{i+1}</td>
                      <td style={{fontWeight:i<3?700:400,fontSize:13,color:'var(--text)'}}>{fr.name}</td>
                      <td className="num" style={{fontWeight:700,color:'var(--blue)',fontFamily:'var(--font-mono)',fontSize:13}}>{fr.totalGames}</td>
                      <td className="num" style={{fontFamily:'var(--font-mono)',color:'var(--text2)',fontSize:13}}>{fr.uniqueHolders}</td>
                      <td className="player-cell" style={{color:'var(--blue)',fontSize:13}} onClick={()=>setModal(fr.topThree[0]?.player)}>{fr.topThree[0]?.player}</td>
                      <td className="player-cell" style={{color:'var(--text)',fontSize:13}} onClick={()=>setModal(fr.recentHolder)}>{fr.recentHolder}</td>
                      <td className="num" style={{fontFamily:'var(--font-mono)',color:'var(--text3)',fontSize:12}}>{fr.recentDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{fontFamily:'var(--font-head)',fontSize:16,color:'var(--blue)',marginBottom:12}}>Top Holders by Franchise</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
              {franchiseStats.slice(0,20).map(fr=>(
                <div key={fr.franchise} className="card" style={{padding:0,overflow:'hidden'}}>
                  <div style={{background:'var(--blue)',padding:'8px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontFamily:'var(--font-head)',fontSize:14,fontWeight:700,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{fr.name}</span>
                    <span style={{fontSize:11,color:'rgba(255,255,255,0.45)',flexShrink:0,marginLeft:8,fontFamily:'var(--font-mono)'}}>{fr.totalGames}g</span>
                  </div>
                  <div style={{padding:'10px 14px'}}>
                    {/* Top 3 */}
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:9,fontWeight:700,color:'var(--text3)',letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:6}}>Top Holders</div>
                      {fr.topThree.map((h,i)=>(
                        <div key={h.player} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 0',borderBottom:i<fr.topThree.length-1?'1px solid var(--border)':'none'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--font-mono)',width:16}}>{['🥇','🥈','🥉'][i]}</span>
                            <span className="player-cell" style={{fontSize:13,fontWeight:i===0?700:400,color:i===0?'var(--blue)':'var(--text)'}} onClick={()=>setModal(h.player)}>{h.player}</span>
                          </div>
                          <span style={{fontSize:12,fontFamily:'var(--font-mono)',fontWeight:i===0?700:400,color:i===0?'var(--blue)':'var(--text2)'}}>{h.games}g</span>
                        </div>
                      ))}
                    </div>
                    {/* Most recent */}
                    <div style={{borderTop:'1px solid var(--border)',paddingTop:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div style={{fontSize:9,fontWeight:700,color:'var(--text3)',letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:2}}>Most Recent</div>
                        <span className="player-cell" style={{fontSize:13,color:'var(--text)'}} onClick={()=>setModal(fr.recentHolder)}>{fr.recentHolder}</span>
                      </div>
                      <span style={{fontSize:11,fontFamily:'var(--font-mono)',color:'var(--text3)'}}>{fr.recentDate}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        ):(

          // ── METHODOLOGY ────────────────────────────────────────────────
          <div style={{flex:1,overflowY:'auto',padding:'24px 32px',maxWidth:820,margin:'0 auto'}}>

            <h2 style={{fontFamily:'var(--font-head)',fontSize:26,color:'var(--blue)',marginBottom:4}}>Methodology</h2>
            <p style={{color:'var(--text3)',fontSize:13,marginBottom:28}}>How the numbers are calculated — from individual box scores to the GOAT Index and The Crown.</p>

            <h3 style={{fontFamily:'var(--font-head)',fontSize:18,color:'var(--blue)',marginBottom:10,marginTop:24}}>Game Score</h3>
            <p style={{fontSize:14,color:'var(--text2)',marginBottom:10,lineHeight:1.65}}>
              Game Score is John Hollinger's single-number approximation of a player's overall contribution in a game. We compute it independently for every playoff game using three era-specific formulas based on which statistics were tracked at the time.
            </p>
            <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'14px 18px',marginBottom:14,fontFamily:'var(--font-mono)',fontSize:12,lineHeight:2.0}}>
              <div style={{fontWeight:700,color:'var(--blue)',marginBottom:4}}>Modern (1980–present) — full stats available</div>
              <div style={{color:'var(--text)'}}>GmSc = PTS + 0.4×FG − 0.7×FGA − 0.4×(FTA−FT) + 0.7×ORB + 0.3×DRB + STL + 0.7×AST + 0.7×BLK − 0.4×PF − TOV</div>
            </div>
            <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'14px 18px',marginBottom:14,fontFamily:'var(--font-mono)',fontSize:12,lineHeight:2.0}}>
              <div style={{fontWeight:700,color:'var(--blue)',marginBottom:4}}>Mid era (1974–1979) — no ORB/DRB split, STL/BLK available</div>
              <div style={{color:'var(--text)'}}>GmSc = PTS + 0.4×FG − 0.7×FGA − 0.4×(FTA−FT) + 0.5×TRB + STL + 0.7×AST + 0.7×BLK − 0.4×PF − TOV</div>
            </div>
            <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'14px 18px',marginBottom:20,fontFamily:'var(--font-mono)',fontSize:12,lineHeight:2.0}}>
              <div style={{fontWeight:700,color:'var(--blue)',marginBottom:4}}>Pre-1974 — no STL, BLK, or TOV tracked</div>
              <div style={{color:'var(--text)'}}>GmSc = PTS + 0.4×FG − 0.7×FGA − 0.4×(FTA−FT) + 0.5×TRB + 0.7×AST − 0.4×PF</div>
            </div>
            <p style={{fontSize:13,color:'var(--text3)',marginBottom:24,lineHeight:1.65}}>
              Because the pre-1974 formula omits three positive contributors (STL, BLK, AST bonus from blocks) and one negative (TOV), scores from that era are not directly comparable to modern scores. This is why era context is especially important in the GOAT Index.
            </p>

            <h3 style={{fontFamily:'var(--font-head)',fontSize:18,color:'var(--blue)',marginBottom:10,marginTop:8}}>GOAT Index Scoring</h3>
            <p style={{fontSize:14,color:'var(--text2)',marginBottom:12,lineHeight:1.65}}>
              The GOAT Index adjusts raw Game Score totals with a contextual multiplier that rewards games played in high-pressure, high-stakes situations.
            </p>
            <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'14px 18px',marginBottom:14,fontFamily:'var(--font-mono)',fontSize:12,lineHeight:2.2}}>
              <div style={{color:'var(--text)'}}>Adj Score = GmSc × (1 + (maxX/100) × blend(normD, normE, normR))</div>
              <div style={{color:'var(--text3)',marginTop:6,fontSize:11}}>
                normD = title distance proximity · normE = elimination pressure · normR = round prestige
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
              {[
                ['normD — Title Distance','How many wins away from the championship when this game was played. A Game 7 of the Finals scores 1.0; a first-round opener scores lower.'],
                ['normE — Elimination Pressure','How close both teams are to elimination. A series tied 3–3 is maximum pressure; a series sweep in progress is minimal.'],
                ['normR — Round Prestige','Multiplier for advancing rounds. Finals > Conference Finals > Semifinals > First Round.'],
                ['maxX — Ceiling','The maximum possible multiplier. Adjustable in the GOAT Index controls (default 80% = up to 1.80× base score).'],
              ].map(([title,desc])=>(
                <div key={title as string} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:5,padding:'10px 12px'}}>
                  <div style={{fontSize:12,fontWeight:700,color:'var(--blue)',marginBottom:4,fontFamily:'var(--font-mono)'}}>{title as string}</div>
                  <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.55}}>{desc as string}</div>
                </div>
              ))}
            </div>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:8,lineHeight:1.65}}><strong>Presets</strong> adjust the weights applied to each factor:</p>
            <div style={{marginBottom:24}}>
              {[
                ['Raw Game Score','No multiplier. Pure box score accumulation.'],
                ['Balanced','Equal weight across all three factors. The default view.'],
                ['Championship DNA','Heavy weight on title distance — rewards players who performed in clinching games.'],
                ['Clutch Moments','Heavy weight on elimination pressure — rewards performers in must-win situations.'],
                ['Finals Prestige','Heavy weight on round stage — rewards Finals performers above all else.'],
              ].map(([name,desc])=>(
                <div key={name as string} style={{display:'flex',gap:12,alignItems:'baseline',padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:13,fontWeight:600,color:'var(--blue)',width:180,flexShrink:0}}>{name as string}</span>
                  <span style={{fontSize:13,color:'var(--text2)',lineHeight:1.55}}>{desc as string}</span>
                </div>
              ))}
            </div>

            <h3 style={{fontFamily:'var(--font-head)',fontSize:18,color:'var(--blue)',marginBottom:10}}>The Crown Rules</h3>
            <div style={{marginBottom:20}}>
              {[
                ['Initial award','The player with the highest Game Score on a winning team in the very first playoff game (April 2, 1947) receives the Crown.'],
                ['Defense','The Crown is contested in the next game the holder\'s team plays. If the holder\'s team wins AND the holder has the highest (or tied) Game Score on their team, they retain.'],
                ['Teammate transfer','If the team wins but a teammate posts a higher Game Score, the Crown transfers to that teammate.'],
                ['Loss','If the Crown holder\'s team loses, the Crown passes to the player with the highest Game Score on the winning team.'],
                ['Tiebreaker','Among tied Game Scores for a new winner: fewest minutes played, then most points, then most rebounds.'],
                ['Between seasons','If the holder\'s team (or the holder themselves) doesn\'t appear in the following year\'s playoffs, the Crown is awarded to the highest Game Score on a winning team on opening night of the next season.'],
                ['Retain on tie','If the holder ties for highest on the winning team, they retain the Crown. Incumbency holds.'],
              ].map(([rule,desc])=>(
                <div key={rule as string} style={{display:'flex',gap:12,alignItems:'baseline',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:13,fontWeight:600,color:'var(--blue)',width:180,flexShrink:0}}>{rule as string}</span>
                  <span style={{fontSize:13,color:'var(--text2)',lineHeight:1.6}}>{desc as string}</span>
                </div>
              ))}
            </div>

            <h3 style={{fontFamily:'var(--font-head)',fontSize:18,color:'var(--blue)',marginBottom:10}}>Updating the Crown</h3>
            <p style={{fontSize:14,color:'var(--text2)',marginBottom:10,lineHeight:1.65}}>When new playoff games are uploaded via the Admin tab, the Crown history needs to be recomputed and re-imported:</p>
            <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'14px 18px',fontFamily:'var(--font-mono)',fontSize:12,lineHeight:2.0,marginBottom:8}}>
              <div style={{color:'var(--text3)',marginBottom:4}}># 1. Recompute from the updated CSV</div>
              <div style={{color:'var(--text)'}}>python3 scripts/compute_crown.py</div>
              <div style={{color:'var(--text3)',marginTop:8,marginBottom:4}}># 2. Clear existing data (Supabase SQL Editor)</div>
              <div style={{color:'var(--text)'}}>DELETE FROM crown_history WHERE id &gt;= 0;</div>
              <div style={{color:'var(--text3)',marginTop:8,marginBottom:4}}># 3. Re-import from project root</div>
              <div style={{color:'var(--text)'}}>python3 scripts/import_crown_local.py</div>
            </div>
            <p style={{fontSize:12,color:'var(--text3)',lineHeight:1.6}}>
              The computation script reads output/player_games.csv and produces output/crown_history.csv. The import script sends that CSV to Supabase in 500-row batches. The entire process takes under 30 seconds.
            </p>
          </div>
        )}
      </div>
      {modal&&<PlayerModal player={modal} onClose={()=>setModal(null)}/>}
    </div>
  )
}
