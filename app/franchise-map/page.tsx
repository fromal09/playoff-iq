'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { FRANCHISE_NAMES, FRANCHISE_ROLLUP, ACTIVE_FRANCHISES } from '@/lib/franchise'
import PlayerModal from '@/components/PlayerModal'

type CrownRow = { crown_holder:string; crown_team:string; streak:number; season:number; date:string; event:string }
type Stint = { player:string; team:string; franchise:string; games:number; season:number }

// Approximate SVG positions (viewBox 0 0 960 600) for each franchise city
const FRANCHISE_COORDS: Record<string,{x:number;y:number;label:string}> = {
  BOS:{x:868,y:162,label:'Boston'},
  NYK:{x:840,y:188,label:'New York'},
  BRK:{x:845,y:194,label:'Brooklyn'},
  PHI:{x:822,y:210,label:'Philadelphia'},
  WAS:{x:800,y:232,label:'Washington'},
  MIA:{x:752,y:478,label:'Miami'},
  ORL:{x:736,y:440,label:'Orlando'},
  CHO:{x:718,y:318,label:'Charlotte'},
  ATL:{x:692,y:362,label:'Atlanta'},
  MEM:{x:628,y:354,label:'Memphis'},
  NOP:{x:616,y:432,label:'New Orleans'},
  IND:{x:654,y:248,label:'Indianapolis'},
  CHI:{x:642,y:220,label:'Chicago'},
  MIL:{x:635,y:200,label:'Milwaukee'},
  DET:{x:672,y:200,label:'Detroit'},
  CLE:{x:700,y:210,label:'Cleveland'},
  TOR:{x:730,y:175,label:'Toronto'},
  MIN:{x:552,y:172,label:'Minneapolis'},
  DAL:{x:538,y:396,label:'Dallas'},
  HOU:{x:552,y:430,label:'Houston'},
  SAS:{x:510,y:438,label:'San Antonio'},
  OKC:{x:526,y:344,label:'Oklahoma City'},
  DEN:{x:432,y:280,label:'Denver'},
  UTA:{x:358,y:270,label:'Salt Lake City'},
  PHO:{x:316,y:368,label:'Phoenix'},
  SAC:{x:154,y:272,label:'Sacramento'},
  GSW:{x:136,y:296,label:'San Francisco'},
  LAL:{x:174,y:340,label:'Los Angeles'},
  LAC:{x:180,y:346,label:'LA Clippers'},
  POR:{x:136,y:168,label:'Portland'},
  MNL:{x:552,y:172,label:'Minneapolis'},
}

// Simple US map path (very simplified outline)
const US_PATH = "M 120,140 L 900,140 L 900,160 L 920,180 L 920,520 L 840,520 L 820,480 L 760,500 L 720,530 L 680,510 L 640,520 L 580,500 L 520,490 L 480,520 L 420,510 L 360,490 L 300,500 L 240,480 L 180,500 L 140,490 L 120,460 Z"

export default function FranchiseMapPage() {
  const [rows, setRows]     = useState<CrownRow[]>([])
  const [loading, setLoading] = useState(true)
  const [hover, setHover]   = useState<string|null>(null)
  const [modal, setModal]   = useState<string|null>(null)
  const [metric, setMetric] = useState<'games'|'stints'>('games')

  useEffect(()=>{
    async function load(){
      setLoading(true)
      const all:CrownRow[]=[]
      let from=0
      while(true){
        const {data}=await supabase.from('crown_history').select('crown_holder,crown_team,streak,season,date,event').order('date',{ascending:true}).range(from,from+999)
        if(!data||!data.length) break
        all.push(...(data as CrownRow[]))
        if(data.length<1000) break; from+=1000
      }
      setRows(all); setLoading(false)
    }
    load()
  },[])

  const stints = useMemo(():Stint[]=>{
    const result:Stint[]=[]
    let i=0
    while(i<rows.length){
      const s=rows[i], player=s.crown_holder
      const sr:CrownRow[]=[]
      while(i<rows.length&&rows[i].crown_holder===player){sr.push(rows[i]);i++}
      result.push({player,team:s.crown_team,franchise:FRANCHISE_ROLLUP[s.crown_team]??s.crown_team,games:Math.max(...sr.map(r=>r.streak)),season:s.season})
    }
    return result
  },[rows])

  // Per-franchise stats
  const franchiseData = useMemo(()=>{
    const map=new Map<string,{games:number;stints:number;holders:Set<string>;topHolder:string;topGames:number}>()
    for(const s of stints){
      const fr=s.franchise
      const d=map.get(fr)??{games:0,stints:0,holders:new Set(),topHolder:'',topGames:0}
      d.games+=s.games; d.stints++; d.holders.add(s.player)
      const hg=(map.get(fr)?.topGames??0)
      if(s.games>hg){d.topHolder=s.player;d.topGames=s.games}
      map.set(fr,d)
    }
    // Re-calculate top holder properly
    const holderGames=new Map<string,Map<string,number>>()
    for(const s of stints){
      if(!holderGames.has(s.franchise))holderGames.set(s.franchise,new Map())
      const hm=holderGames.get(s.franchise)!
      hm.set(s.player,(hm.get(s.player)??0)+s.games)
    }
    for(const [fr,hm] of holderGames){
      const top=[...hm.entries()].sort((a,b)=>b[1]-a[1])[0]
      if(top&&map.has(fr)){const d=map.get(fr)!;d.topHolder=top[0];d.topGames=top[1]}
    }
    return map
  },[stints])

  const maxVal = useMemo(()=>Math.max(...[...franchiseData.values()].map(d=>metric==='games'?d.games:d.stints),1),[franchiseData,metric])

  function bubbleR(fr:string){
    const d=franchiseData.get(fr)
    if(!d) return 0
    const val=metric==='games'?d.games:d.stints
    return Math.max(Math.sqrt(val/maxVal)*48,4)
  }

  const hoverData = hover ? franchiseData.get(hover) : null
  const hoverCoord = hover ? FRANCHISE_COORDS[hover] : null

  return(
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 72px)',background:'var(--bg)',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'12px 24px',borderBottom:'2px solid var(--text)',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap',flexShrink:0,background:'var(--surface)'}}>
        <div>
          <div className="section-head" style={{margin:0,border:'none',padding:0,fontSize:13,letterSpacing:'0.04em'}}>Crown by Franchise — Geography</div>
          <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>Bubble size = crown games held · click any city for details</div>
        </div>
        <div style={{display:'flex',gap:0,marginLeft:'auto'}}>
          <button className={`btn${metric==='games'?' btn-active':''}`} style={{fontSize:11,padding:'4px 10px',borderRadius:'2px 0 0 2px',borderRight:'none'}} onClick={()=>setMetric('games')}>Games held</button>
          <button className={`btn${metric==='stints'?' btn-active':''}`} style={{fontSize:11,padding:'4px 10px',borderRadius:'0 2px 2px 0'}} onClick={()=>setMetric('stints')}>Stints</button>
        </div>
      </div>

      {loading?(
        <div className="loading"><div className="spinner"/>Loading map data…</div>
      ):(
        <div style={{flex:1,display:'flex',overflow:'hidden'}}>
          {/* Map */}
          <div style={{flex:1,position:'relative',overflow:'hidden'}}>
            <svg viewBox="60 120 900 460" style={{width:'100%',height:'100%',display:'block'}}>
              {/* US outline — simplified state grid */}
              {/* Draw a gentle land mass */}
              <rect x="60" y="120" width="900" height="460" fill="var(--bg)" rx="4"/>
              {/* Ocean tint */}
              <rect x="60" y="120" width="900" height="460" fill="rgba(27,46,94,0.04)"/>

              {/* Simplified US land — rough bounding shape */}
              {/* West coast */}
              <path d="M 110,155 L 110,420 L 160,430 L 175,460 L 190,465 L 195,480 L 220,490 L 260,495 L 290,510 L 350,510 L 400,520 L 440,515 L 480,525 L 530,510 L 570,510 L 610,525 L 650,515 L 690,520 L 730,540 L 750,530 L 780,520 L 820,495 L 840,500 L 860,490 L 870,460 L 900,445 L 920,420 L 920,155 L 110,155 Z"
                fill="rgba(240,233,216,0.6)" stroke="var(--border)" strokeWidth="1.5"/>

              {/* Great Lakes rough */}
              <ellipse cx="680" cy="198" rx="18" ry="12" fill="rgba(27,46,94,0.08)"/>
              <ellipse cx="715" cy="185" rx="14" ry="8"  fill="rgba(27,46,94,0.08)"/>
              <ellipse cx="650" cy="208" rx="10" ry="6"  fill="rgba(27,46,94,0.08)"/>

              {/* Canada border hint */}
              <line x1="110" y1="175" x2="920" y2="175" stroke="var(--border)" strokeWidth="0.75" strokeDasharray="4,4"/>
              <text x="115" y="171" fontSize="8" fill="var(--border2)" fontFamily="var(--font-body)">Canada</text>

              {/* Grid lines at key latitudes */}
              {[200,250,300,350,400,450].map(y=>(
                <line key={y} x1="110" y1={y} x2="920" y2={y} stroke="var(--border)" strokeWidth="0.3" strokeDasharray="2,6"/>
              ))}
              {[200,300,400,500,600,700,800].map(x=>(
                <line key={x} x1={x} y1="155" x2={x} y2="530" stroke="var(--border)" strokeWidth="0.3" strokeDasharray="2,6"/>
              ))}

              {/* Franchise bubbles */}
              {ACTIVE_FRANCHISES.map(fr=>{
                const coord=FRANCHISE_COORDS[fr.abbr]
                if(!coord) return null
                const r=bubbleR(fr.abbr)
                const d=franchiseData.get(fr.abbr)
                const isHov=hover===fr.abbr
                const hasData=r>0
                return(
                  <g key={fr.abbr} style={{cursor:hasData?'pointer':'default'}}
                    onMouseEnter={()=>setHover(fr.abbr)}
                    onMouseLeave={()=>setHover(null)}
                    onClick={()=>d?.topHolder&&setModal(d.topHolder)}>
                    {hasData&&(
                      <>
                        <circle cx={coord.x} cy={coord.y} r={r+2} fill="rgba(27,46,94,0.12)" />
                        <circle cx={coord.x} cy={coord.y} r={r}
                          fill={isHov?'var(--blue)':'rgba(27,46,94,0.72)'}
                          stroke={isHov?'var(--gold)':'rgba(255,255,255,0.4)'}
                          strokeWidth={isHov?2:1}
                        />
                        {r>16&&(
                          <text x={coord.x} y={coord.y+3} textAnchor="middle" fontSize={Math.min(r*0.45,11)} fontWeight={700} fill="rgba(255,255,255,0.9)" fontFamily="var(--font-body)" style={{pointerEvents:'none'}}>
                            {metric==='games'?d?.games:d?.stints}
                          </text>
                        )}
                      </>
                    )}
                    {/* City dot for franchises with no data */}
                    {!hasData&&<circle cx={coord.x} cy={coord.y} r={2} fill="var(--border2)"/>}
                    {/* City label for large bubbles */}
                    {r>20&&(
                      <text x={coord.x} y={coord.y+r+12} textAnchor="middle" fontSize={9} fill="var(--text2)" fontFamily="var(--font-body)" style={{pointerEvents:'none'}}>
                        {coord.label}
                      </text>
                    )}
                  </g>
                )
              })}

              {/* Hover tooltip in SVG */}
              {hover&&hoverCoord&&hoverData&&(()=>{
                const tx=hoverCoord.x<500?hoverCoord.x+bubbleR(hover)+8:hoverCoord.x-bubbleR(hover)-160
                const ty=Math.max(hoverCoord.y-50,160)
                return(
                  <g style={{pointerEvents:'none'}}>
                    <rect x={tx} y={ty} width={155} height={80} rx={3} fill="var(--surface)" stroke="var(--border2)" strokeWidth={1}/>
                    <text x={tx+10} y={ty+18} fontSize={12} fontWeight={700} fill="var(--blue)" fontFamily="var(--font-head)">{FRANCHISE_NAMES[hover]??hover}</text>
                    <text x={tx+10} y={ty+34} fontSize={10} fill="var(--text2)" fontFamily="var(--font-body)">{hoverData.games} games · {hoverData.stints} stints</text>
                    <text x={tx+10} y={ty+48} fontSize={10} fill="var(--text3)" fontFamily="var(--font-body)">{hoverData.holders.size} unique holders</text>
                    <text x={tx+10} y={ty+64} fontSize={10} fill="var(--text)" fontFamily="var(--font-body)">Top: {hoverData.topHolder}</text>
                  </g>
                )
              })()}
            </svg>
          </div>

          {/* Sidebar */}
          <div style={{width:240,flexShrink:0,borderLeft:'1px solid var(--border)',overflowY:'auto',background:'var(--surface)'}}>
            <div style={{padding:'12px 14px',borderBottom:'2px solid var(--text)'}}>
              <div className="section-head" style={{margin:0,border:'none',padding:0}}>Franchise Rankings</div>
            </div>
            <table className="data-table" style={{fontSize:12}}>
              <thead><tr>
                <th style={{paddingLeft:10}}>#</th>
                <th>Franchise</th>
                <th className="num">{metric==='games'?'G':'Stints'}</th>
              </tr></thead>
              <tbody>
                {[...franchiseData.entries()]
                  .sort((a,b)=>(metric==='games'?b[1].games-a[1].games:b[1].stints-a[1].stints))
                  .map(([fr,d],i)=>(
                    <tr key={fr} style={{background:hover===fr?'var(--blue-dim)':undefined}}
                      onMouseEnter={()=>setHover(fr)} onMouseLeave={()=>setHover(null)}>
                      <td style={{paddingLeft:10,color:'var(--text3)',fontSize:11}}>{i+1}</td>
                      <td style={{fontSize:12,fontWeight:i<3?700:400,cursor:'pointer'}} onClick={()=>setHover(fr)}>
                        {FRANCHISE_NAMES[fr]??fr}
                      </td>
                      <td className="num" style={{fontFamily:'var(--font-mono)',fontWeight:i<3?700:400,color:i<3?'var(--blue)':'var(--text)'}}>{metric==='games'?d.games:d.stints}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {modal&&<PlayerModal player={modal} onClose={()=>setModal(null)}/>}
    </div>
  )
}
