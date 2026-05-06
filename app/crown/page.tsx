'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { FRANCHISE_NAMES, FRANCHISE_ROLLUP, ACTIVE_FRANCHISES } from '@/lib/franchise'
import PlayerModal from '@/components/PlayerModal'

type CrownRow = {
  id:number; date:string; season:number; team:string; opp:string
  event:string; crown_holder:string; crown_team:string
  prev_holder:string; streak:number; total_games:number; gmsc:number
}
type Stint = {
  player:string; team:string; franchise:string
  startDate:string; endDate:string; games:number; season:number
  acquireEvent:string; loseToPlayer:string|null; prevHolder:string
  rows:CrownRow[]; stintNum:number
}
type PlayerStats = {
  player:string; totalGames:number; possessions:number
  defenses:number; losses:number; maxStreak:number; avgGames:number; teams:string[]
}
type FranchiseStat = {
  franchise:string; name:string; totalGames:number; uniqueHolders:number
  topThree:{player:string;games:number}[]; recentHolder:string; recentDate:string
}

const EV_LABEL:Record<string,string>={initial:'👑 First Crown',defend:'🛡 Defended',transfer_teammate:'🔄 From Teammate',transfer_loss:'⚔️ Wrested Away',new_season:'🆕 New Season'}
const EV_COLOR:Record<string,string>={initial:'var(--gold)',defend:'var(--green)',transfer_teammate:'var(--blue2)',transfer_loss:'var(--red)',new_season:'var(--text3)'}

function toRoman(n:number):string{
  const v=[1000,900,500,400,100,90,50,40,10,9,5,4,1]
  const s=['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I']
  let r='',i=0;while(n>0){while(n>=v[i]){r+=s[i];n-=v[i]}i++}
  return r
}

// ── Reign Timeline ─────────────────────────────────────────────────────────
function ReignTimeline({stints,onPlayer}:{stints:Stint[];onPlayer:(p:string)=>void}){
  const [search,setSearch]=useState('')
  const [expanded,setExpanded]=useState<Set<string>>(new Set())
  const [transfersOnly,setTransfersOnly]=useState(false)
  const seasonRefs=useRef<Record<number,HTMLDivElement|null>>({})
  const seasons=useMemo(()=>[...new Set(stints.map(s=>s.season))].sort((a,b)=>b-a),[stints])

  // Most recent first
  const filtered=useMemo(()=>{
    let s=[...stints].reverse()
    if(search) s=s.filter(st=>st.player.toLowerCase().includes(search.toLowerCase())||(st.loseToPlayer||'').toLowerCase().includes(search.toLowerCase())||(st.prevHolder||'').toLowerCase().includes(search.toLowerCase()))
    if(transfersOnly) s=s.filter(st=>st.acquireEvent!=='defend')
    return s
  },[stints,search,transfersOnly])

  function toggleExpand(key:string){setExpanded(e=>{const n=new Set(e);n.has(key)?n.delete(key):n.add(key);return n})}
  function jumpTo(season:number){seasonRefs.current[season]?.scrollIntoView({behavior:'smooth',block:'start'})}

  // Visual weight by reign length
  function reignStyle(games:number):{borderColor:string;bg:string;headerBg:string;accentColor:string}{
    if(games>=5) return{borderColor:'#9A6E1C',bg:'rgba(154,110,28,0.05)',headerBg:'rgba(154,110,28,0.12)',accentColor:'#9A6E1C'}
    if(games>=3) return{borderColor:'var(--blue)',bg:'rgba(27,46,94,0.04)',headerBg:'rgba(27,46,94,0.10)',accentColor:'var(--blue)'}
    return{borderColor:'var(--border)',bg:'transparent',headerBg:'var(--surface2)',accentColor:'var(--text3)'}
  }

  let lastSeason=-1

  return(
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
      {/* Year jump sidebar */}
      <div style={{width:68,flexShrink:0,borderRight:'1px solid var(--border)',overflowY:'auto',background:'var(--bg2)'}}>
        <div style={{fontSize:8,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',textAlign:'center',color:'var(--text3)',padding:'8px 0 6px',borderBottom:'1px solid var(--border)'}}>Jump</div>
        {seasons.map(yr=>(
          <button key={yr} onClick={()=>jumpTo(yr)} style={{display:'block',width:'100%',padding:'4px 2px',fontSize:10.5,fontFamily:'var(--font-mono)',color:'var(--text2)',background:'none',border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',textAlign:'center'}}>
            {yr}
          </button>
        ))}
      </div>

      {/* Main timeline */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* Filter bar */}
        <div style={{padding:'8px 16px',display:'flex',gap:10,alignItems:'center',borderBottom:'2px solid var(--text)',flexShrink:0,background:'var(--surface)',flexWrap:'wrap'}}>
          <input type="search" placeholder="Filter player…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:180,fontSize:12,padding:'5px 8px'}}/>
          <label style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'var(--text2)',cursor:'pointer'}}>
            <input type="checkbox" checked={transfersOnly} onChange={e=>setTransfersOnly(e.target.checked)}/>
            New reigns only
          </label>
          <div style={{display:'flex',gap:12,fontSize:11,color:'var(--text3)',marginLeft:'auto'}}>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:1,background:'var(--gold)',display:'inline-block'}}/>5+ games (Legendary)</span>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:1,background:'var(--blue)',display:'inline-block'}}/>3–4 games (Dominant)</span>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:1,background:'var(--border)',display:'inline-block'}}/>1–2 games (Brief)</span>
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'0 0 40px'}}>
          <div style={{maxWidth:760,margin:'0 auto',padding:'0 20px'}}>
            {filtered.map((stint,idx)=>{
              const isNewSeason=stint.season!==lastSeason
              if(isNewSeason)lastSeason=stint.season
              const rs=reignStyle(stint.games)
              const key=`${stint.player}-${stint.stintNum}`
              const isExpanded=expanded.has(key)
              const isAcquire=stint.acquireEvent!=='defend'

              return(
                <div key={key}>
                  {isNewSeason&&(
                    <div ref={el=>{seasonRefs.current[stint.season]=el}}
                      style={{display:'flex',alignItems:'center',gap:12,margin:'28px 0 12px'}}>
                      <div style={{flex:1,height:2,background:'var(--text)'}}/>
                      <div style={{fontFamily:'var(--font-head)',fontSize:14,fontWeight:700,color:'var(--text)',letterSpacing:'0.05em',padding:'0 4px'}}>
                        {stint.season} Playoffs
                      </div>
                      <div style={{flex:1,height:2,background:'var(--text)'}}/>
                    </div>
                  )}

                  {/* Reign card */}
                  <div style={{
                    border:`1px solid ${rs.borderColor}`,
                    borderLeft:`4px solid ${rs.borderColor}`,
                    borderRadius:3, marginBottom:8, overflow:'hidden',
                    background:rs.bg,
                    boxShadow:stint.games>=5?`0 2px 12px rgba(154,110,28,0.12)`:undefined
                  }}>
                    {/* Reign header */}
                    <div style={{
                      padding:'10px 14px', background:rs.headerBg,
                      display:'flex',alignItems:'flex-start',gap:12,flexWrap:'wrap',
                      borderBottom:`1px solid ${rs.borderColor}`,
                      cursor:'pointer'
                    }} onClick={()=>toggleExpand(key)}>
                      {/* Crown status glyph */}
                      <div style={{fontSize:stint.games>=5?24:stint.games>=3?20:16,lineHeight:1,flexShrink:0,paddingTop:2}}>
                        {stint.games>=5?'👑':stint.games>=3?'🏅':'🔸'}
                      </div>

                      <div style={{flex:1,minWidth:0}}>
                        {/* Title line */}
                        <div style={{fontFamily:'var(--font-head)',fontSize:stint.games>=5?18:stint.games>=3?16:14,fontWeight:700,color:rs.accentColor,lineHeight:1.2,marginBottom:3}}>
                          Reign of King {stint.player}
                          <span style={{fontFamily:'var(--font-head)',fontSize:stint.games>=3?14:12,fontWeight:400,fontStyle:'italic',marginLeft:8,color:'var(--text2)'}}>
                            {toRoman(stint.stintNum)}
                          </span>
                        </div>

                        {/* Subtitle */}
                        <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:12,color:'var(--text2)'}}>
                          <span style={{fontFamily:'var(--font-mono)'}}>{stint.startDate}{stint.games>1?` – ${stint.endDate}`:''}</span>
                          <span>·</span>
                          <span>{FRANCHISE_NAMES[stint.team]??stint.team}</span>
                          <span>·</span>
                          <span style={{color:rs.accentColor,fontWeight:600}}>{stint.games} {stint.games===1?'game':'games'}</span>
                          <span style={{color:'var(--text3)',fontSize:11}}>{EV_LABEL[stint.acquireEvent]??stint.acquireEvent}</span>
                        </div>
                      </div>

                      <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                        {/* Expand indicator */}
                        <span style={{fontSize:11,color:'var(--text3)'}}>{isExpanded?'▲':'▼'}</span>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded&&(
                      <div style={{padding:'10px 14px'}}>
                        {/* Predecessor */}
                        {stint.prevHolder&&stint.prevHolder!==stint.player&&(
                          <div style={{fontSize:12,color:'var(--text3)',marginBottom:8,paddingBottom:8,borderBottom:'1px dashed var(--border)'}}>
                            <span style={{fontWeight:600,color:'var(--text2)'}}>Took crown from:</span>{' '}
                            <span style={{cursor:'pointer',color:'var(--blue)',fontWeight:600}} onClick={(e)=>{e.stopPropagation();onPlayer(stint.prevHolder)}}>{stint.prevHolder}</span>
                          </div>
                        )}

                        {/* Game-by-game table */}
                        <div style={{overflowX:'auto'}}>
                          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                            <thead>
                              <tr style={{borderBottom:'1px solid var(--border)'}}>
                                <th style={{textAlign:'left',padding:'4px 8px',fontSize:9.5,letterSpacing:'0.09em',textTransform:'uppercase',color:'var(--text3)',fontFamily:'var(--font-body)'}}>Date</th>
                                <th style={{textAlign:'left',padding:'4px 8px',fontSize:9.5,letterSpacing:'0.09em',textTransform:'uppercase',color:'var(--text3)'}}>Opponent</th>
                                <th style={{textAlign:'right',padding:'4px 8px',fontSize:9.5,letterSpacing:'0.09em',textTransform:'uppercase',color:'var(--text3)'}}>Game Score</th>
                                <th style={{textAlign:'right',padding:'4px 8px',fontSize:9.5,letterSpacing:'0.09em',textTransform:'uppercase',color:'var(--text3)'}}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stint.rows.map((row,gi)=>(
                                <tr key={gi} style={{borderBottom:'1px solid var(--border)',background:gi%2===0?'transparent':'rgba(0,0,0,0.02)'}}>
                                  <td style={{padding:'5px 8px',fontFamily:'var(--font-mono)',color:'var(--text2)'}}>{row.date}</td>
                                  <td style={{padding:'5px 8px',color:'var(--text2)'}}>{row.opp}</td>
                                  <td style={{padding:'5px 8px',textAlign:'right',fontFamily:'var(--font-mono)',fontWeight:700,color:'var(--blue)'}}>{Number(row.gmsc).toFixed(1)}</td>
                                  <td style={{padding:'5px 8px',textAlign:'right',fontSize:11,color:row.event==='defend'?'var(--green)':row.event==='initial'?'var(--gold)':'var(--text3)'}}>
                                    {row.event==='defend'?'🛡 Held':row.event==='initial'?'👑 Crowned':'✓'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Dethroned section */}
                        {stint.loseToPlayer&&(
                          <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:16}}>💀</span>
                            <div style={{fontSize:12}}>
                              <span style={{fontWeight:700,color:'var(--red)'}}>Dethroned: King {stint.player} {toRoman(stint.stintNum)}</span>
                              <span style={{color:'var(--text3)',marginLeft:8}}>— crown passed to{' '}
                                <span style={{cursor:'pointer',color:'var(--text)',fontWeight:600}} onClick={(e)=>{e.stopPropagation();onPlayer(stint.loseToPlayer!)}}>{stint.loseToPlayer}</span>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            <div style={{textAlign:'center',padding:'24px 0',color:'var(--text3)',fontSize:11,letterSpacing:'0.06em',textTransform:'uppercase'}}>— 1947–2026 · {stints.length} Reigns —</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Franchise Map (hyperrealistic topographic) ─────────────────────────────
// US state coordinates for more realistic map
const STATE_PATHS: Record<string,string> = {
  // Very simplified but geographically accurate key outlines
}
const FRANCHISE_COORDS: Record<string,{x:number;y:number}> = {
  BOS:{x:872,y:168},NYK:{x:844,y:192},BRK:{x:848,y:198},PHI:{x:824,y:214},
  WAS:{x:800,y:238},MIA:{x:752,y:480},ORL:{x:732,y:442},CHO:{x:716,y:320},
  ATL:{x:688,y:366},MEM:{x:626,y:356},NOP:{x:614,y:434},IND:{x:654,y:252},
  CHI:{x:640,y:222},MIL:{x:632,y:202},DET:{x:668,y:202},CLE:{x:696,y:212},
  TOR:{x:728,y:176},MIN:{x:550,y:174},DAL:{x:536,y:398},HOU:{x:550,y:432},
  SAS:{x:508,y:440},OKC:{x:524,y:346},DEN:{x:430,y:282},UTA:{x:356,y:272},
  PHO:{x:314,y:370},SAC:{x:152,y:274},GSW:{x:132,y:298},LAL:{x:172,y:342},
  LAC:{x:178,y:348},POR:{x:134,y:168},MNL:{x:550,y:174},
}

function FranchiseMap({stints,onPlayer}:{stints:Stint[];onPlayer:(p:string)=>void}){
  const [hover,setHover]=useState<string|null>(null)
  const [metric,setMetric]=useState<'games'|'stints'>('games')

  const franchiseData=useMemo(()=>{
    const map=new Map<string,{games:number;stints:number;holders:Map<string,number>;recent:string;recentDate:string}>()
    for(const s of stints){
      const fr=s.franchise
      const d=map.get(fr)??{games:0,stints:0,holders:new Map(),recent:'',recentDate:''}
      d.games+=s.games;d.stints++
      d.holders.set(s.player,(d.holders.get(s.player)??0)+s.games)
      if(s.endDate>d.recentDate){d.recent=s.player;d.recentDate=s.endDate}
      map.set(fr,d)
    }
    return map
  },[stints])

  const maxVal=useMemo(()=>Math.max(...[...franchiseData.values()].map(d=>metric==='games'?d.games:d.stints),1),[franchiseData,metric])

  function bubR(fr:string){const d=franchiseData.get(fr);if(!d)return 0;const v=metric==='games'?d.games:d.stints;return Math.max(Math.sqrt(v/maxVal)*52,3)}

  const W=980,H=580

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <div style={{padding:'8px 16px',borderBottom:'1px solid var(--border)',display:'flex',gap:10,alignItems:'center',flexShrink:0,background:'var(--surface)'}}>
        <span style={{fontSize:11,color:'var(--text3)'}}>Crown geography · bubble size = {metric}</span>
        <div style={{display:'flex',gap:0,marginLeft:'auto'}}>
          <button className={`btn${metric==='games'?' btn-active':''}`} style={{fontSize:11,padding:'3px 10px',borderRadius:'2px 0 0 2px',borderRight:'none'}} onClick={()=>setMetric('games')}>Games held</button>
          <button className={`btn${metric==='stints'?' btn-active':''}`} style={{fontSize:11,padding:'3px 10px',borderRadius:'0 2px 2px 0'}} onClick={()=>setMetric('stints')}>Reigns</button>
        </div>
      </div>
      <div style={{flex:1,overflow:'hidden',position:'relative'}}>
        <svg viewBox={`60 130 920 460`} style={{width:'100%',height:'100%',display:'block'}} onMouseLeave={()=>setHover(null)}>
          <defs>
            <radialGradient id="terrainGrad" cx="50%" cy="40%" r="70%">
              <stop offset="0%"   stopColor="#D4C9A8"/>
              <stop offset="40%"  stopColor="#C8BA94"/>
              <stop offset="100%" stopColor="#B8A880"/>
            </radialGradient>
            <filter id="terrain"><feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="4" seed="2"/><feColorMatrix type="saturate" values="0.3"/><feBlend in="SourceGraphic" mode="multiply" result="blend"/><feComposite in="blend" in2="SourceGraphic" operator="in"/></filter>
            <radialGradient id="oceanGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#A8C4D8"/>
              <stop offset="100%" stopColor="#8AB0C8"/>
            </radialGradient>
            {/* Bubble gradients */}
            {ACTIVE_FRANCHISES.map(fr=>{
              const d=franchiseData.get(fr.abbr)
              const val=d?(metric==='games'?d.games:d.stints):0
              const intensity=val/maxVal
              return(
                <radialGradient key={fr.abbr} id={`bub${fr.abbr}`} cx="38%" cy="32%" r="65%">
                  <stop offset="0%"   stopColor={`rgba(27,46,94,${0.6+intensity*0.3})`}/>
                  <stop offset="60%"  stopColor={`rgba(15,28,70,${0.7+intensity*0.25})`}/>
                  <stop offset="100%" stopColor={`rgba(8,14,40,${0.8+intensity*0.15})`}/>
                </radialGradient>
              )
            })}
          </defs>

          {/* Ocean background */}
          <rect x="0" y="0" width={W} height={H} fill="url(#oceanGrad)"/>

          {/* Land mass — roughly accurate US outline */}
          <path d="M 108,155 L 115,148 L 200,140 L 280,135 L 380,132 L 500,130 L 620,132 L 740,134 L 840,138 L 900,145 L 920,158 L 925,180 L 920,220 L 915,280 L 910,340 L 905,400 L 890,440 L 870,465 L 845,488 L 810,498 L 780,502 L 750,510 L 720,530 L 700,538 L 680,528 L 660,520 L 640,525 L 600,510 L 560,505 L 520,512 L 480,520 L 440,514 L 400,518 L 360,505 L 320,508 L 280,500 L 250,492 L 220,498 L 190,510 L 162,510 L 140,500 L 120,488 L 108,470 L 100,440 L 95,400 L 90,340 L 88,280 L 90,220 L 95,180 Z"
            fill="url(#terrainGrad)" stroke="rgba(120,100,70,0.4)" strokeWidth="1.5"/>

          {/* Topographic detail — subtle elevation lines */}
          {[200,260,320,380].map(y=>(
            <path key={y} d={`M 95,${y} Q 500,${y-8} 915,${y}`} fill="none" stroke="rgba(160,140,100,0.12)" strokeWidth="1"/>
          ))}

          {/* Great Lakes */}
          <ellipse cx="680" cy="200" rx="20" ry="13" fill="#A8C4D8" opacity="0.85"/>
          <ellipse cx="715" cy="186" rx="15" ry="9"  fill="#A8C4D8" opacity="0.85"/>
          <ellipse cx="646" cy="210" rx="11" ry="7"  fill="#A8C4D8" opacity="0.80"/>
          <ellipse cx="702" cy="218" rx="8"  ry="5"  fill="#A8C4D8" opacity="0.75"/>

          {/* Mountain ranges — subtle ridges */}
          <path d="M 120,220 L 140,200 L 160,215 L 175,195 L 195,210 L 210,190 L 225,205 L 240,185 L 255,200 L 265,175 L 275,190 L 285,170 L 295,185 L 305,165 L 315,180"
            fill="rgba(140,120,80,0.20)" stroke="rgba(120,100,60,0.25)" strokeWidth="2" strokeLinejoin="round"/>
          {/* Appalachians */}
          <path d="M 690,180 L 700,200 L 705,230 L 708,260 L 706,290 L 700,320 L 695,350 L 688,370"
            fill="none" stroke="rgba(140,120,80,0.18)" strokeWidth="6" strokeLinecap="round"/>

          {/* Canada border */}
          <line x1="108" y1="175" x2="918" y2="175" stroke="rgba(80,60,40,0.25)" strokeWidth="1" strokeDasharray="6,4"/>

          {/* Franchise bubbles */}
          {ACTIVE_FRANCHISES.map(fr=>{
            const coord=FRANCHISE_COORDS[fr.abbr]
            if(!coord) return null
            const r=bubR(fr.abbr)
            const d=franchiseData.get(fr.abbr)
            const isHov=hover===fr.abbr
            if(r<1) return <circle key={fr.abbr} cx={coord.x} cy={coord.y} r={2.5} fill="rgba(80,60,40,0.3)"/>
            return(
              <g key={fr.abbr} style={{cursor:'pointer'}}
                onMouseEnter={()=>setHover(fr.abbr)} onMouseLeave={()=>setHover(null)}
                onClick={()=>{const top=d?[...d.holders.entries()].sort((a,b)=>b[1]-a[1])[0]:null;if(top)onPlayer(top[0])}}>
                {/* Drop shadow */}
                <circle cx={coord.x+2} cy={coord.y+3} r={r} fill="rgba(0,0,0,0.15)"/>
                {/* Main bubble */}
                <circle cx={coord.x} cy={coord.y} r={r} fill={`url(#bub${fr.abbr})`}
                  stroke={isHov?'rgba(196,142,42,0.9)':'rgba(255,255,255,0.25)'}
                  strokeWidth={isHov?2:1}/>
                {/* Specular highlight */}
                <circle cx={coord.x-r*0.28} cy={coord.y-r*0.28} r={r*0.32}
                  fill="rgba(255,255,255,0.12)" />
                {/* Value label inside large bubbles */}
                {r>20&&(
                  <text x={coord.x} y={coord.y+4} textAnchor="middle"
                    fontSize={Math.min(r*0.42,13)} fontWeight={700}
                    fill="rgba(255,255,255,0.90)" fontFamily="var(--font-mono)">
                    {metric==='games'?d?.games:d?.stints}
                  </text>
                )}
                {/* City label */}
                {r>14&&(
                  <text x={coord.x} y={coord.y+r+11} textAnchor="middle"
                    fontSize={8.5} fill="rgba(60,40,20,0.65)" fontFamily="var(--font-body)">
                    {fr.name.split(' ').slice(-1)[0]}
                  </text>
                )}
                {/* Hover tooltip */}
                {isHov&&d&&(()=>{
                  const tx=coord.x<450?coord.x+r+6:coord.x-r-160
                  const ty=Math.max(coord.y-55,140)
                  const top3=[...d.holders.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3)
                  return(
                    <g style={{pointerEvents:'none'}}>
                      <rect x={tx} y={ty} width={154} height={20+top3.length*14+10} rx={3}
                        fill="var(--surface)" stroke="var(--border2)" strokeWidth={1}/>
                      <text x={tx+9} y={ty+14} fontSize={11} fontWeight={700} fill="var(--blue)" fontFamily="var(--font-head)">{fr.name}</text>
                      <text x={tx+9} y={ty+26} fontSize={9.5} fill="var(--text3)" fontFamily="var(--font-body)">{d.games}g · {d.stints} reigns · {d.holders.size} kings</text>
                      {top3.map(([p,g],i)=>(
                        <text key={p} x={tx+9} y={ty+39+i*14} fontSize={10} fill="var(--text)" fontFamily="var(--font-body)">
                          {['🥇','🥈','🥉'][i]} {p.split(' ').pop()} ({g}g)
                        </text>
                      ))}
                    </g>
                  )
                })()}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function CrownPage(){
  const [rows,setRows]     =useState<CrownRow[]>([])
  const [loading,setLoading]=useState(true)
  const [tab,setTab]       =useState<'leaderboard'|'timeline'|'map'|'methodology'>('leaderboard')
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
        if(data.length<1000) break; from+=1000
      }
      setRows(all); setLoading(false)
    }
    load()
  },[])

  const stints=useMemo(():Stint[]=>{
    const result:Stint[]=[]
    const playerStintCount:Record<string,number>={}
    let i=0
    while(i<rows.length){
      const s=rows[i],player=s.crown_holder
      const sr:CrownRow[]=[]
      while(i<rows.length&&rows[i].crown_holder===player){sr.push(rows[i]);i++}
      const last=sr[sr.length-1],next=rows[i]
      playerStintCount[player]=(playerStintCount[player]??0)+1
      result.push({
        player,team:s.crown_team,franchise:FRANCHISE_ROLLUP[s.crown_team]??s.crown_team,
        startDate:s.date,endDate:last.date,
        games:Math.max(...sr.map(r=>r.streak)),
        season:s.season,acquireEvent:s.event,
        loseToPlayer:next?.crown_holder??null,prevHolder:s.prev_holder||'',
        rows:sr,stintNum:playerStintCount[player],
      })
    }
    return result
  },[rows])

  const playerStats=useMemo(():PlayerStats[]=>{
    const map=new Map<string,{g:number;p:number;def:number;loss:number;maxS:number;teams:Set<string>}>()
    for(const s of stints){
      const p=map.get(s.player)??{g:0,p:0,def:0,loss:0,maxS:0,teams:new Set()}
      p.g+=s.games;p.p++;p.maxS=Math.max(p.maxS,s.games);p.def+=s.games-1
      if(s.loseToPlayer)p.loss++
      p.teams.add(s.team);map.set(s.player,p)
    }
    return Array.from(map.entries()).map(([player,p])=>({
      player,totalGames:p.g,possessions:p.p,defenses:p.def,losses:p.loss,
      maxStreak:p.maxS,avgGames:p.p>0?Math.round(p.g/p.p*10)/10:0,teams:[...p.teams],
    }))
  },[stints])

  const sortedStats=useMemo(()=>playerStats
    .filter(p=>!search||p.player.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>b[lbSort]-a[lbSort])
  ,[playerStats,search,lbSort])

  const maxGames=useMemo(()=>Math.max(...playerStats.map(p=>p.totalGames),0),[playerStats])
  const maxStreak=useMemo(()=>Math.max(...playerStats.map(p=>p.maxStreak),0),[playerStats])
  const maxDef=useMemo(()=>Math.max(...playerStats.map(p=>p.defenses),0),[playerStats])
  const maxAvg=useMemo(()=>Math.max(...playerStats.filter(p=>p.possessions>=3).map(p=>p.avgGames),0),[playerStats])
  const byGames =playerStats.filter(p=>p.totalGames===maxGames)
  const byStreak=playerStats.filter(p=>p.maxStreak===maxStreak)
  const byDef   =playerStats.filter(p=>p.defenses===maxDef)
  const byAvg   =playerStats.filter(p=>p.possessions>=3&&p.avgGames===maxAvg)

  const current=stints[stints.length-1]

  function SortTh({col,ch}:{col:typeof lbSort;ch:string}){
    return<th className="num sortable" onClick={()=>setLbSort(col)} style={{color:lbSort===col?'var(--blue)':'var(--text)',fontSize:13,cursor:'pointer'}}>{ch}{lbSort===col?' ↓':''}</th>
  }

  function RecordCard({icon,label,holders,val}:{icon:string;label:string;holders:{player:string}[];val:string}){
    return(
      <div className="card2" style={{padding:'10px 12px',marginBottom:8}}>
        <div style={{fontSize:9,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:5}}>{icon} {label}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:4}}>
          {holders.map(h=>(<span key={h.player} style={{fontSize:13,fontWeight:600,color:'var(--text)',cursor:'pointer',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:3,padding:'1px 8px'}} onClick={()=>setModal(h.player)}>{h.player}</span>))}
        </div>
        <div style={{fontSize:16,fontWeight:700,color:'var(--blue)',fontFamily:'var(--font-mono)'}}>{val}</div>
      </div>
    )
  }

  return(
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 72px)',overflow:'hidden'}}>
      {/* Hero */}
      {current&&!loading&&(
        <div style={{background:'var(--blue)',padding:'12px 24px',display:'flex',alignItems:'center',gap:18,flexWrap:'wrap',flexShrink:0}}>
          <div style={{fontSize:28}}>👑</div>
          <div style={{flex:1,minWidth:160}}>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:2}}>Reigning Champion · 2026 Playoffs</div>
            <div style={{fontFamily:'var(--font-head)',fontSize:22,color:'#fff',cursor:'pointer'}} onClick={()=>setModal(current.player)}>{current.player}</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:1}}>{FRANCHISE_NAMES[current.team]??current.team} · Reign {toRoman(current.stintNum)}</div>
          </div>
          {[['Streak',`${current.games}g`],['Total Held',`${playerStats.find(p=>p.player===current.player)?.totalGames??0}g`],['Unique Kings',`${new Set(rows.map(r=>r.crown_holder)).size}`],['Total Reigns',`${stints.length}`]].map(([l,v])=>(
            <div key={l} style={{textAlign:'center',flexShrink:0}}>
              <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.09em',marginBottom:1}}>{l}</div>
              <div style={{fontSize:18,fontWeight:700,color:'#fff',fontFamily:'var(--font-mono)'}}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="tab-bar" style={{flexShrink:0}}>
        {([['leaderboard','Leaderboard'],['timeline','Reign Timeline'],['map','Crown Map'],['methodology','Methodology']] as [string,string][]).map(([k,l])=>(
          <button key={k} className={`tab${tab===k?' active':''}`} onClick={()=>setTab(k as typeof tab)}>{l}</button>
        ))}
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {loading?(<div className="loading"><div className="spinner"/>Loading crown history…</div>
        ):tab==='leaderboard'?(
          <div style={{flex:1,display:'flex',overflow:'hidden'}}>
            <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
              <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:12}}>
                <input type="search" placeholder="Filter player…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:180,fontSize:12,padding:'5px 8px'}}/>
                <span style={{fontSize:12,color:'var(--text3)'}}>{sortedStats.length} kings</span>
              </div>
              <div style={{overflowX:'auto'}}>
                <table className="data-table" style={{minWidth:560}}>
                  <thead><tr>
                    <th style={{width:32,paddingLeft:10,fontSize:13}}>#</th>
                    <th style={{fontSize:13}}>Player</th>
                    <SortTh col="totalGames" ch="Games Held"/>
                    <SortTh col="defenses" ch="Defenses"/>
                    <SortTh col="maxStreak" ch="Best Reign"/>
                    <SortTh col="avgGames" ch="Avg Games"/>
                    <SortTh col="possessions" ch="Reigns"/>
                    <th className="num" style={{fontSize:13}}>Losses</th>
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
            <div style={{width:240,flexShrink:0,borderLeft:'1px solid var(--border)',overflowY:'auto',padding:'16px 14px',background:'var(--bg2)'}}>
              <div className="section-head" style={{marginBottom:12}}>Records</div>
              <RecordCard icon="🎮" label="Most Games Held" holders={byGames} val={`${maxGames}g`}/>
              <RecordCard icon="⚡" label="Longest Reign" holders={byStreak} val={`${maxStreak}g`}/>
              <RecordCard icon="🛡" label="Most Defenses" holders={byDef} val={`${maxDef}`}/>
              <RecordCard icon="⏳" label="Best Avg Reign" holders={byAvg} val={`${maxAvg.toFixed(1)}g`}/>
              <div style={{padding:'10px 12px',background:'var(--surface)',borderRadius:3,border:'1px solid var(--border)',marginTop:8}}>
                <div style={{fontSize:9,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Reign Breakdown</div>
                {[['⚔️ Wrested',stints.filter(s=>s.acquireEvent==='transfer_loss').length,'var(--red)'],['🔄 Teammate',stints.filter(s=>s.acquireEvent==='transfer_teammate').length,'var(--blue2)'],['🆕 New Season',stints.filter(s=>s.acquireEvent==='new_season').length,'var(--text3)']].map(([l,v,col])=>(
                  <div key={l as string} style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                    <span style={{fontSize:13,color:'var(--text)'}}>{l as string}</span>
                    <span style={{fontWeight:700,color:col as string,fontFamily:'var(--font-mono)',fontSize:13}}>{v as number}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ):tab==='timeline'?(
          <ReignTimeline stints={stints} onPlayer={setModal}/>
        ):tab==='map'?(
          <FranchiseMap stints={stints} onPlayer={setModal}/>
        ):(
          <div style={{flex:1,overflowY:'auto',padding:'24px 32px',maxWidth:760,margin:'0 auto'}}>
            <div className="section-head">The Crown — Rules & Methodology</div>
            {[
              ['Initial Award','The player with the highest Game Score on a winning team in the first playoff game ever (April 2, 1947) receives the Crown.'],
              ['Defense','The Crown is contested each time the holder\'s team plays. If the holder\'s team wins AND the holder has the highest (or tied) Game Score on their team, they retain — and the reign continues.'],
              ['Teammate Transfer','If the team wins but a teammate posts a higher Game Score, the Crown passes to that teammate. A new Reign begins.'],
              ['Loss','If the Crown holder\'s team loses, the Crown passes to the highest Game Score on the winning team. A new Reign begins.'],
              ['Tiebreaker','Among tied Game Scores for a new winner: fewest minutes played, then most points, then most rebounds.'],
              ['Between Seasons','If the holder doesn\'t appear in the following year\'s playoffs, the Crown is awarded on opening night of the next season.'],
              ['Retain on Tie','If the holder ties for highest Game Score on the winning team, they retain. Incumbency holds.'],
              ['Reigns','Each new acquisition — regardless of how many games it lasts — is counted as a new Reign with a roman numeral designation. King Michael Jordan XXVII means Jordan has held the Crown 27 separate times.'],
              ['Updating','After uploading new game data via the Admin tab, run compute_crown.py, delete the crown_history table, and re-import. Takes under 30 seconds.'],
            ].map(([rule,desc])=>(
              <div key={rule as string} style={{display:'flex',gap:14,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:13,fontWeight:700,color:'var(--blue)',width:180,flexShrink:0}}>{rule as string}</span>
                <span style={{fontSize:13,color:'var(--text2)',lineHeight:1.65}}>{desc as string}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {modal&&<PlayerModal player={modal} onClose={()=>setModal(null)}/>}
    </div>
  )
}
