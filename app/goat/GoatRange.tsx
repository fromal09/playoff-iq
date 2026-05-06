'use client'
import { useState, useMemo } from 'react'

type RangePlayer = { player:string; adjScore:number; adjSum:number; games:number; wins:number }

// ── Mountain geometry helpers ──────────────────────────────────────────────
function seededRandom(seed:number){ let s=Math.sin(seed)*10000; return s-Math.floor(s) }

function mountainSilhouette(cx:number, peakY:number, baseY:number, halfW:number, seed:number):string {
  // Build a jagged realistic peak from left base → peak → right base
  const pts:[number,number][] = []
  const leftBase = cx - halfW
  const rightBase = cx + halfW
  pts.push([leftBase, baseY])

  // Left slope — 8 segments with noise
  const leftSegs = 8
  for (let i=0; i<=leftSegs; i++) {
    const t = i/leftSegs
    const bx = leftBase + t*(cx-leftBase)
    const by = baseY + t*(peakY-baseY)
    const jitter = seededRandom(seed + i*0.31) * halfW * 0.18 * (1-Math.abs(t-0.5)*2)
    const jy = seededRandom(seed + i*0.77) * halfW * 0.12 * (1-t)
    pts.push([bx + jitter - halfW*0.09*(1-t), by - jy])
  }

  // Peak area — add a secondary spire
  const spireOff = (seededRandom(seed+99) - 0.5) * halfW * 0.2
  const spireH = halfW * (0.08 + seededRandom(seed+100)*0.12)
  pts.push([cx+spireOff-halfW*0.04, peakY+spireH*0.7])
  pts.push([cx+spireOff, peakY-spireH])
  pts.push([cx+spireOff+halfW*0.04, peakY+spireH*0.5])
  pts.push([cx, peakY]) // true peak

  // Right slope — mirror with different noise
  for (let i=leftSegs; i>=0; i--) {
    const t = i/leftSegs
    const bx = cx + (1-t)*(rightBase-cx)
    const by = baseY + t*(peakY-baseY)
    const jitter = seededRandom(seed + 50 + i*0.31) * halfW * 0.16 * (1-Math.abs(t-0.5)*2)
    const jy = seededRandom(seed + 50 + i*0.77) * halfW * 0.10 * (1-t)
    pts.push([bx + jitter - halfW*0.06*(1-t), by - jy])
  }

  pts.push([rightBase, baseY])
  return pts.map((p,i)=>`${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')+'Z'
}

function snowCap(cx:number, peakY:number, capH:number, halfW:number, seed:number):string {
  const snowBase = peakY + capH
  const pts:[number,number][] = [[cx, peakY]]
  const segs = 6
  for (let i=-segs; i<=segs; i++) {
    const t = i/segs
    const bx = cx + t * halfW * 0.32
    const by = snowBase + seededRandom(seed+200+i)*capH*0.35
    pts.push([bx, by])
  }
  return pts.map((p,i)=>`${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')+'Z'
}

// Pre-defined x positions for the 20 peaks — arranged for visual drama not rank order
// Center-weighted with natural spread, creating a genuine panorama feel
const PEAK_POSITIONS = [
  0.42, 0.57, 0.35, 0.64, 0.28, 0.72, 0.50, 0.21, 0.80,
  0.14, 0.88, 0.45, 0.60, 0.38, 0.67, 0.53, 0.25, 0.75, 0.08, 0.92
]

// Arrange so highest scores get the center dramatic positions
// We'll re-map: rank 0 → pos index 0 (0.42 — dramatic center-left)
// rank 1 → pos index 1 (0.57) etc.

export default function GoatRange({players,onPlayer}:{players:RangePlayer[];onPlayer:(p:string)=>void}){
  const [hov, setHov] = useState<{player:string;score:number;games:number;wins:number;x:number;py:number}|null>(null)
  const W=1200, H=520, GROUND=H-80

  // Sort by adjScore desc, take top 20
  const sorted = useMemo(()=>[...players].sort((a,b)=>b.adjScore-a.adjScore).slice(0,20),[players])
  const maxScore = sorted[0]?.adjScore ?? 1

  const peaks = useMemo(()=> sorted.map((p,rank)=>{
    const xFrac = PEAK_POSITIONS[rank] ?? 0.5
    const cx = 40 + xFrac*(W-80)
    const score01 = p.adjScore/maxScore
    const minPeakH = 80, maxPeakH = 340
    const peakH = minPeakH + score01*(maxPeakH-minPeakH)
    const peakY = GROUND - peakH
    const halfW = 80 + score01*120 + seededRandom(rank*7)*40
    const snowH = peakH * (0.12 + score01*0.15)
    return { ...p, cx, peakY, halfW, snowH, score01, rank }
  }),[sorted,maxScore])

  // Sort peaks by cx for layering — peaks further left or right drawn first (painter's algo approximation)
  // Actually sort by how far from center — further = drawn first (behind)
  const drawOrder = useMemo(()=>[...peaks].sort((a,b)=>{
    const distA = Math.abs(a.cx - W/2)
    const distB = Math.abs(b.cx - W/2)
    return distB - distA
  }),[peaks])

  return(
    <div style={{position:'relative',width:'100%',borderRadius:4,overflow:'hidden'}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',display:'block'}}
        onMouseLeave={()=>setHov(null)}>
        <defs>
          {/* Sky — dramatic pre-dawn atmosphere */}
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#0A1628"/>
            <stop offset="40%"  stopColor="#1B2E5E"/>
            <stop offset="75%"  stopColor="#3A4F7A"/>
            <stop offset="100%" stopColor="#6B7FA0"/>
          </linearGradient>

          {/* Far atmosphere haze */}
          <linearGradient id="hazeFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4A5E80" stopOpacity="0.65"/>
            <stop offset="100%" stopColor="#6B7FA0" stopOpacity="0.8"/>
          </linearGradient>

          {/* Mid distance */}
          <linearGradient id="hazeMid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2D3F5E" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#4A5E80" stopOpacity="0.9"/>
          </linearGradient>

          {/* Near mountains */}
          <linearGradient id="nearDark" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#0E1628"/>
            <stop offset="45%"  stopColor="#1B2E4A"/>
            <stop offset="100%" stopColor="#0A1020"/>
          </linearGradient>
          <linearGradient id="nearLight" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#1B2E5E"/>
            <stop offset="55%"  stopColor="#263F72"/>
            <stop offset="100%" stopColor="#1B2E5E"/>
          </linearGradient>

          {/* Rock face texture gradient */}
          {peaks.map(p=>(
            <linearGradient key={`rf-${p.rank}`} id={`rf${p.rank}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#0A1020" stopOpacity="1"/>
              <stop offset="38%"  stopColor="#1A2840" stopOpacity="1"/>
              <stop offset="52%"  stopColor="#263F72" stopOpacity="1"/>
              <stop offset="68%"  stopColor="#1E3260" stopOpacity="1"/>
              <stop offset="100%" stopColor="#0E1828" stopOpacity="1"/>
            </linearGradient>
          ))}

          {/* Snow gradient */}
          <linearGradient id="snowGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#C8D4E8" stopOpacity="0.95"/>
            <stop offset="40%"  stopColor="#E8F0FF" stopOpacity="0.98"/>
            <stop offset="70%"  stopColor="#D0DCF0" stopOpacity="0.92"/>
            <stop offset="100%" stopColor="#B8C8E0" stopOpacity="0.88"/>
          </linearGradient>

          {/* Ground gradient */}
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#060C18"/>
            <stop offset="100%" stopColor="#0A1020"/>
          </linearGradient>

          {/* Moon glow */}
          <radialGradient id="moonGlow" cx="75%" cy="12%" r="30%">
            <stop offset="0%"   stopColor="#E8F0FF" stopOpacity="0.12"/>
            <stop offset="100%" stopColor="#E8F0FF" stopOpacity="0"/>
          </radialGradient>

          {/* Hover highlight */}
          <filter id="peakGlow">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>

        {/* Sky */}
        <rect width={W} height={H} fill="url(#sky)"/>
        <rect width={W} height={H} fill="url(#moonGlow)"/>

        {/* Stars */}
        {Array.from({length:80},(_,i)=>{
          const sx=seededRandom(i*17)*W
          const sy=seededRandom(i*23)*H*0.5
          const sr=seededRandom(i*31)*1.5+0.3
          const so=seededRandom(i*41)*0.6+0.2
          return<circle key={i} cx={sx} cy={sy} r={sr} fill="white" opacity={so}/>
        })}

        {/* Moon */}
        <circle cx={W*0.78} cy={H*0.10} r={28} fill="#D8E8FF" opacity={0.9}/>
        <circle cx={W*0.78+8} cy={H*0.10-4} r={24} fill="#1B2E5E" opacity={0.55}/>

        {/* Far background peaks — atmosphere haze */}
        {Array.from({length:12},(_,i)=>{
          const bcx=60+i*(W-60)/11
          const bh=60+seededRandom(i*13)*120
          const bw=120+seededRandom(i*17)*160
          const path=mountainSilhouette(bcx,GROUND-bh-60,GROUND-30,bw,i*100+500)
          return<path key={i} d={path} fill="url(#hazeFar)"/>
        })}

        {/* Mid-distance peaks */}
        {Array.from({length:8},(_,i)=>{
          const bcx=100+i*(W-140)/7
          const bh=90+seededRandom(i*19)*160
          const bw=100+seededRandom(i*23)*140
          const path=mountainSilhouette(bcx,GROUND-bh-40,GROUND-20,bw,i*100+300)
          return<path key={i} d={path} fill="url(#hazeMid)"/>
        })}

        {/* Main peaks — drawn back to front */}
        {drawOrder.map(p=>{
          const isHov = hov?.player===p.player
          const path = mountainSilhouette(p.cx,p.peakY,GROUND,p.halfW,p.rank*100)
          const snow = snowCap(p.cx,p.peakY,p.snowH,p.halfW,p.rank*100)
          // Light streak on upper right face
          const streakPath = mountainSilhouette(p.cx+p.halfW*0.1,p.peakY+p.snowH*0.5,p.peakY+p.halfW*0.35,p.halfW*0.18,p.rank*100+999)
          return(
            <g key={p.rank} style={{cursor:'pointer'}} onClick={()=>onPlayer(p.player)}>
              {/* Mountain body */}
              <path d={path} fill={`url(#rf${p.rank})`}/>
              {/* Light face */}
              <path d={path} fill="rgba(255,255,255,0.04)" clipPath={`polygon(${p.cx}px 0, ${p.cx+p.halfW}px 100%, ${p.cx}px 100%)`}/>
              {/* Snow */}
              <path d={snow} fill="url(#snowGrad)" opacity={0.92}/>
              {/* Snow shadow */}
              <path d={snow} fill="rgba(100,140,220,0.15)"/>
              {/* Hover glow */}
              {isHov&&<path d={path} fill="rgba(255,255,255,0.08)" filter="url(#peakGlow)"/>}
              {/* Hit area */}
              <path d={path} fill="transparent"
                onMouseEnter={()=>setHov({player:p.player,score:p.adjScore,games:p.games,wins:p.wins,x:p.cx,py:p.peakY})}/>
            </g>
          )
        })}

        {/* Tree line band */}
        <rect x={0} y={GROUND-28} width={W} height={28} fill="rgba(4,8,16,0.7)"/>
        {/* Jagged tree silhouette */}
        <path d={Array.from({length:W/6},(_,i)=>{
          const tx=i*6, th=6+seededRandom(i*37)*14
          return`M${tx},${GROUND-28} L${tx+3},${GROUND-28-th} L${tx+6},${GROUND-28}`
        }).join(' ')} fill="rgba(6,10,20,0.9)"/>

        {/* Ground */}
        <rect x={0} y={GROUND} width={W} height={H-GROUND} fill="url(#ground)"/>

        {/* Player name labels — above each peak */}
        {peaks.map(p=>{
          const isHov=hov?.player===p.player
          const shortName=p.player.split(' ').pop()??p.player
          const fontSize=p.score01>0.7?11:p.score01>0.4?10:9
          return(
            <g key={`lbl-${p.rank}`} style={{pointerEvents:'none'}}>
              {/* Vertical guide line from peak */}
              <line x1={p.cx} y1={p.peakY-4} x2={p.cx} y2={p.peakY-32}
                stroke="rgba(200,220,255,0.35)" strokeWidth={0.75} strokeDasharray="2,3"/>
              {/* Rank badge */}
              <rect x={p.cx-10} y={p.peakY-50} width={20} height={14} rx={2}
                fill={p.rank===0?'rgba(154,110,28,0.85)':'rgba(27,46,94,0.75)'}
                stroke={p.rank===0?'rgba(196,142,42,0.6)':'rgba(100,140,220,0.3)'}
                strokeWidth={0.75}/>
              <text x={p.cx} y={p.peakY-41} textAnchor="middle" fontSize={8}
                fill={p.rank===0?'#F5C060':'#A0B8E0'}
                fontFamily="var(--font-mono)" fontWeight={700}>
                #{p.rank+1}
              </text>
              {/* Name label */}
              <text x={p.cx} y={p.peakY-56} textAnchor="middle" fontSize={fontSize}
                fill={isHov?'#FFFFFF':p.rank<3?'#D4E8FF':'rgba(180,210,255,0.75)'}
                fontFamily="var(--font-body)" fontWeight={p.rank<5?700:500}
                style={{letterSpacing:'0.02em'}}>
                {shortName}
              </text>
              {/* Score on hover */}
              {isHov&&(
                <text x={p.cx} y={p.peakY-70} textAnchor="middle" fontSize={9}
                  fill="#F5C060" fontFamily="var(--font-mono)" fontWeight={700}>
                  {p.adjScore.toFixed(1)}
                </text>
              )}
            </g>
          )
        })}

        {/* Atmospheric fog over base */}
        <rect x={0} y={GROUND-60} width={W} height={60} fill="rgba(20,35,70,0.18)"/>
      </svg>

      {/* Hover detail card */}
      {hov&&(
        <div style={{
          position:'absolute',
          left:Math.min(hov.x+16, W-220),
          top: 20,
          background:'rgba(10,16,32,0.92)',
          border:'1px solid rgba(100,140,220,0.3)',
          borderRadius:3,
          padding:'10px 16px',
          color:'#C8DCF0',
          fontSize:12,
          backdropFilter:'blur(8px)',
          pointerEvents:'none',
          minWidth:200,
          boxShadow:'0 4px 24px rgba(0,0,0,0.5)',
        }}>
          <div style={{fontFamily:'var(--font-head)',fontSize:18,color:'#E8F0FF',marginBottom:4}}>{hov.player}</div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:22,color:'#F5C060',fontWeight:700,marginBottom:6}}>{hov.score.toFixed(1)}</div>
          <div style={{fontSize:11,color:'rgba(180,210,255,0.6)',borderTop:'1px solid rgba(100,140,220,0.2)',paddingTop:6,display:'flex',gap:16}}>
            <span><b style={{color:'#C8DCF0'}}>{hov.games}</b> games</span>
            <span><b style={{color:'#C8DCF0'}}>{hov.wins}</b> wins</span>
          </div>
          <div style={{fontSize:10,color:'rgba(140,180,220,0.45)',marginTop:4}}>Click to open player card</div>
        </div>
      )}

      {/* Legend */}
      <div style={{position:'absolute',bottom:8,left:16,display:'flex',gap:16,fontSize:10,color:'rgba(140,180,220,0.5)'}}>
        <span>Peak height = GOAT Score</span>
        <span>·</span>
        <span>Width ≈ career volume</span>
        <span>·</span>
        <span>Snow cap = dominance</span>
      </div>
    </div>
  )
}
