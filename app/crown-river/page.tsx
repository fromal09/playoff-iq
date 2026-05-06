'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { FRANCHISE_NAMES, FRANCHISE_ROLLUP } from '@/lib/franchise'
import PlayerModal from '@/components/PlayerModal'

type CrownRow = {
  id:number; date:string; season:number; team:string; opp:string
  event:string; crown_holder:string; crown_team:string
  prev_holder:string; streak:number
}
type Stint = {
  player:string; team:string; franchise:string
  startDate:string; endDate:string
  games:number; season:number; acquireEvent:string; loseToPlayer:string|null
  prevHolder:string
}

const EV_COLOR:Record<string,string> = {
  initial:'#9A6E1C', defend:'#2D4F35',
  transfer_teammate:'#2A4A90', transfer_loss:'#8B1F1F', new_season:'#6B5C42',
}

// Franchise color associations
const FR_COLORS:Record<string,string> = {
  BOS:'#007A33', LAL:'#552583', CHI:'#CE1141', GSW:'#1D428A',
  SAS:'#C4CED4', MIA:'#98002E', DET:'#C8102E', PHI:'#006BB6',
  CLE:'#6F263D', OKC:'#007AC1', MNL:'#5C2D91', NOP:'#0C2340',
  HOU:'#CE1141', UTA:'#002B5C', NYK:'#F58426', IND:'#002D62',
  WAS:'#002B5C', DEN:'#0E2240', PHO:'#1D1160', ATL:'#E03A3E',
  POR:'#E03A3E', MIL:'#00471B', DAL:'#00538C', SAC:'#5A2D81',
  TOR:'#CE1141', MEM:'#5D76A9', CHA:'#00788C', ORL:'#007DC5',
  MIN:'#0C2340', LAC:'#C8102E', CHO:'#00788C',
}

export default function CrownRiverPage() {
  const [rows, setRows]   = useState<CrownRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<string|null>(null)
  const [hover, setHover] = useState<{stint:Stint;x:number;y:number}|null>(null)
  const [colorBy, setColorBy] = useState<'team'|'event'>('team')
  const scrollRef = useRef<HTMLDivElement>(null)
  const seasonRefs = useRef<Record<number,number>>({}) // season → x pixel

  useEffect(()=>{
    async function load(){
      setLoading(true)
      const all:CrownRow[]=[]
      let from=0
      while(true){
        const {data}=await supabase.from('crown_history').select('id,date,season,team,opp,event,crown_holder,crown_team,prev_holder,streak').order('date',{ascending:true}).range(from,from+999)
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
      const last=sr[sr.length-1], next=rows[i]
      result.push({
        player, team:s.crown_team, franchise:FRANCHISE_ROLLUP[s.crown_team]??s.crown_team,
        startDate:s.date, endDate:last.date,
        games:Math.max(...sr.map(r=>r.streak)),
        season:s.season, acquireEvent:s.event,
        loseToPlayer:next?.crown_holder??null, prevHolder:s.prev_holder||'',
      })
    }
    return result
  },[rows])

  // Pixel geometry
  const PX_PER_GAME = 10
  const RIVER_H = 80
  const LABEL_H = 28
  const YEAR_H = 24
  const TOTAL_H = RIVER_H + LABEL_H + YEAR_H + 20
  const SVG_PADDING = 20

  const { totalWidth, stintPositions, seasonMarkers } = useMemo(()=>{
    let x = SVG_PADDING
    const positions: { stint:Stint; x:number; w:number; color:string }[] = []
    const marks: { season:number; x:number }[] = []
    let lastSeason = -1

    for (const stint of stints) {
      if (stint.season !== lastSeason) {
        marks.push({ season:stint.season, x })
        lastSeason = stint.season
      }
      const w = Math.max(stint.games * PX_PER_GAME, 2)
      const fr = stint.franchise
      const color = colorBy==='team'
        ? (FR_COLORS[fr] ?? '#4A3C28')
        : (EV_COLOR[stint.acquireEvent] ?? '#4A3C28')
      positions.push({ stint, x, w, color })
      x += w
    }
    return { totalWidth: x + SVG_PADDING, stintPositions: positions, seasonMarkers: marks }
  }, [stints, colorBy])

  function jumpTo(season:number) {
    const mark = seasonMarkers.find(m=>m.season===season)
    if (mark && scrollRef.current) {
      scrollRef.current.scrollLeft = mark.x - 60
    }
  }

  const decades = seasonMarkers.filter(m => m.season % 10 === 0 || m.season === 1947)

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 72px)',overflow:'hidden',background:'var(--bg)'}}>
      {/* Header */}
      <div style={{padding:'12px 24px',borderBottom:'2px solid var(--text)',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap',flexShrink:0,background:'var(--surface)'}}>
        <div>
          <div className="section-head" style={{margin:0,border:'none',padding:0,fontSize:13,letterSpacing:'0.04em'}}>The Crown River</div>
          <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>Each reach of the river is one crown tenure · width = games held · 1947–2026</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',marginLeft:'auto',flexWrap:'wrap'}}>
          <span style={{fontSize:11,color:'var(--text3)'}}>Color by:</span>
          <div style={{display:'flex',gap:0}}>
            <button className={`btn${colorBy==='team'?' btn-active':''}`} style={{fontSize:11,padding:'4px 10px',borderRadius:'2px 0 0 2px',borderRight:'none'}} onClick={()=>setColorBy('team')}>Team</button>
            <button className={`btn${colorBy==='event'?' btn-active':''}`} style={{fontSize:11,padding:'4px 10px',borderRadius:'0 2px 2px 0'}} onClick={()=>setColorBy('event')}>Event type</button>
          </div>
          {colorBy==='event'&&(
            <div style={{display:'flex',gap:10,fontSize:11}}>
              {Object.entries(EV_COLOR).map(([k,col])=>(
                <span key={k} style={{display:'flex',alignItems:'center',gap:4}}>
                  <span style={{width:10,height:10,borderRadius:2,background:col,display:'inline-block'}}/>
                  <span style={{color:'var(--text3)',textTransform:'capitalize'}}>{k.replace('transfer_','').replace('_',' ')}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Year jump bar */}
      <div style={{padding:'6px 24px',borderBottom:'1px solid var(--border)',display:'flex',gap:4,flexWrap:'wrap',flexShrink:0,background:'var(--bg2)'}}>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text3)',alignSelf:'center',marginRight:4}}>Jump →</span>
        {seasonMarkers.filter(m=>m.season%5===0||m.season===1947).map(m=>(
          <button key={m.season} onClick={()=>jumpTo(m.season)} style={{fontSize:11,padding:'2px 8px',borderRadius:2,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font-mono)'}}>
            {m.season}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"/>Loading crown river…</div>
      ) : (
        <div ref={scrollRef} style={{flex:1,overflowX:'auto',overflowY:'hidden',position:'relative'}}>
          <svg
            width={totalWidth}
            height={TOTAL_H}
            style={{display:'block',cursor:'crosshair'}}
            onMouseLeave={()=>setHover(null)}
          >
            {/* Season markers */}
            {seasonMarkers.map(m=>(
              <g key={m.season}>
                <line x1={m.x} y1={0} x2={m.x} y2={RIVER_H+LABEL_H} stroke="var(--border)" strokeWidth={0.5}/>
                {(m.season%5===0||m.season===1947)&&(
                  <text x={m.x+3} y={RIVER_H+LABEL_H+16} fontSize={9} fill="var(--text3)" fontFamily="var(--font-mono)">{m.season}</text>
                )}
              </g>
            ))}

            {/* River band */}
            {stintPositions.map(({stint,x,w,color},i)=>{
              const isTop = ['initial','new_season'].includes(stint.acquireEvent)
              return (
                <g key={i}>
                  <rect
                    x={x} y={LABEL_H} width={w} height={RIVER_H}
                    fill={color} opacity={0.85}
                    rx={0}
                    onMouseEnter={e=>setHover({stint,x,y:LABEL_H})}
                  />
                  {/* Player name label on long stints */}
                  {w > 80 && (
                    <text
                      x={x+w/2} y={LABEL_H+RIVER_H/2+4}
                      textAnchor="middle" fontSize={10} fontWeight={700}
                      fill="rgba(255,255,255,0.92)"
                      fontFamily="var(--font-body)"
                      style={{pointerEvents:'none'}}
                    >
                      {stint.player.split(' ').pop()}
                    </text>
                  )}
                  {/* Thin separator */}
                  <line x1={x} y1={LABEL_H} x2={x} y2={LABEL_H+RIVER_H} stroke="rgba(255,255,255,0.3)" strokeWidth={1}/>
                </g>
              )
            })}

            {/* Crown crown on current holder */}
            {stintPositions.length>0&&(()=>{
              const last=stintPositions[stintPositions.length-1]
              return<text x={last.x+last.w/2} y={LABEL_H-6} textAnchor="middle" fontSize={14} style={{pointerEvents:'none'}}>👑</text>
            })()}

            {/* Hover hit areas */}
            {stintPositions.map(({stint,x,w},i)=>(
              <rect key={`hit-${i}`} x={x} y={0} width={Math.max(w,8)} height={TOTAL_H}
                fill="transparent"
                onMouseEnter={e=>setHover({stint,x:x+w/2,y:LABEL_H})}
                onClick={()=>setModal(stint.player)}
              />
            ))}
          </svg>

          {/* Tooltip */}
          {hover&&(
            <div style={{position:'fixed',left:Math.min(hover.x+12,window.innerWidth-260),top:200,background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:3,padding:'10px 14px',fontSize:12,boxShadow:'var(--shadow2)',pointerEvents:'none',zIndex:10,minWidth:220}}>
              <div style={{fontFamily:'var(--font-head)',fontSize:16,fontWeight:700,color:'var(--blue)',marginBottom:4}}>👑 {hover.stint.player}</div>
              <div style={{color:'var(--text2)',marginBottom:2}}>{FRANCHISE_NAMES[hover.stint.team]??hover.stint.team}</div>
              <div style={{display:'flex',gap:12,color:'var(--text3)',marginBottom:4}}>
                <span><b style={{color:'var(--text)'}}>{hover.stint.games}g</b> held</span>
                <span>{hover.stint.startDate}{hover.stint.startDate!==hover.stint.endDate?` → ${hover.stint.endDate}`:''}</span>
              </div>
              {hover.stint.loseToPlayer&&<div style={{color:'var(--red)',fontSize:11}}>💀 Lost to {hover.stint.loseToPlayer}</div>}
              <div style={{fontSize:10,color:'var(--text3)',marginTop:4,borderTop:'1px solid var(--border)',paddingTop:4}}>Click to open player card</div>
            </div>
          )}
        </div>
      )}
      {modal&&<PlayerModal player={modal} onClose={()=>setModal(null)}/>}
    </div>
  )
}
