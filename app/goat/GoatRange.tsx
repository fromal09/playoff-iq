'use client'
import { useState, useMemo } from 'react'

type RangePlayer = { player:string; adjScore:number; adjSum:number; games:number; wins:number }

function sr(seed:number){ const s=Math.sin(seed*127.1+311.7)*43758.5453; return s-Math.floor(s) }

// ── 5 distinct mountain archetypes ────────────────────────────────────────
type Archetype = 0|1|2|3|4
function getArchetype(seed:number): Archetype { return Math.floor(sr(seed)*5) as Archetype }

function buildSilhouette(
  cx:number, peakY:number, baseY:number, halfW:number, seed:number, arch:Archetype
): string {
  const pts:[number,number][] = []
  const L = cx - halfW, R = cx + halfW

  if (arch === 0) {
    // Classic sharp pyramid — steep symmetric, narrow
    const w = halfW * 0.7
    pts.push([cx-w, baseY])
    for (let i=0;i<=6;i++){
      const t=i/6
      pts.push([cx-w+t*w + (sr(seed+i)*w*0.08 - w*0.04), baseY+(peakY-baseY)*Math.pow(t,0.8) - sr(seed+i+10)*halfW*0.06*t])
    }
    pts.push([cx, peakY]) // summit
    for (let i=6;i>=0;i--){
      const t=i/6
      pts.push([cx+w-t*w + (sr(seed+i+50)*w*0.08 - w*0.03), baseY+(peakY-baseY)*Math.pow(t,0.8) - sr(seed+i+60)*halfW*0.05*t])
    }
    pts.push([cx+w, baseY])
  } else if (arch === 1) {
    // Broad massif — wide, flat-topped, imposing
    const w = halfW * 1.3
    const flatW = halfW * 0.25
    pts.push([cx-w, baseY])
    for (let i=0;i<=8;i++){
      const t=i/8
      const ease=1-Math.pow(1-t,2.5)
      pts.push([cx-w+t*w + (sr(seed+i)*w*0.12-w*0.06), baseY+(peakY-baseY)*ease - sr(seed+i+20)*halfW*0.09*Math.sin(t*Math.PI)])
    }
    pts.push([cx-flatW, peakY + halfW*0.04])
    pts.push([cx-flatW*0.3, peakY - halfW*0.02])
    pts.push([cx, peakY])
    pts.push([cx+flatW*0.4, peakY - halfW*0.01])
    pts.push([cx+flatW, peakY + halfW*0.05])
    for (let i=8;i>=0;i--){
      const t=i/8
      const ease=1-Math.pow(1-t,2.5)
      pts.push([cx+w-t*w + (sr(seed+i+60)*w*0.10-w*0.05), baseY+(peakY-baseY)*ease - sr(seed+i+80)*halfW*0.08*Math.sin(t*Math.PI)])
    }
    pts.push([cx+w, baseY])
  } else if (arch === 2) {
    // Asymmetric ridge — steep left wall, long gentle right slope
    const steepW = halfW * 0.55
    const gradW = halfW * 1.5
    pts.push([cx-steepW, baseY])
    for (let i=0;i<=5;i++){
      const t=i/5
      pts.push([cx-steepW+t*steepW*0.9 + sr(seed+i)*halfW*0.07, baseY+(peakY-baseY)*Math.pow(t,0.6) - sr(seed+i+10)*halfW*0.08*t])
    }
    // Secondary summit on left
    pts.push([cx - halfW*0.15, peakY + halfW*0.12])
    pts.push([cx, peakY])
    for (let i=0;i<=10;i++){
      const t=i/10
      const ease=Math.pow(1-t,0.7)
      pts.push([cx+t*gradW + sr(seed+i+70)*halfW*0.09, peakY+(baseY-peakY)*Math.pow(t,0.55) - sr(seed+i+90)*halfW*0.07*ease])
    }
    pts.push([cx+gradW, baseY])
  } else if (arch === 3) {
    // Double-peaked — two summits, saddle between
    const peakL = cx - halfW*0.3
    const peakR = cx + halfW*0.28
    const peakYL = peakY + halfW*(0.03 + sr(seed)*0.12)
    const peakYR = peakY + halfW*(0.06 + sr(seed+1)*0.10)
    const saddleY = Math.min(peakYL,peakYR) + halfW*(0.12 + sr(seed+2)*0.10)
    pts.push([cx-halfW, baseY])
    for (let i=0;i<=5;i++){
      const t=i/5
      pts.push([cx-halfW+t*(peakL-(cx-halfW)) + sr(seed+i)*halfW*0.08-halfW*0.04, baseY+(peakYL-baseY)*Math.pow(t,0.75) - sr(seed+i+20)*halfW*0.07*t])
    }
    pts.push([peakL, peakYL])
    for (let i=1;i<=4;i++){ // saddle
      const t=i/4
      pts.push([peakL+t*(peakR-peakL) + sr(seed+i+40)*halfW*0.05, peakYL+(saddleY-peakYL)*Math.sin(t*Math.PI) - sr(seed+i+50)*halfW*0.04])
    }
    pts.push([peakR, peakYR])
    for (let i=5;i>=0;i--){
      const t=i/5
      pts.push([cx+halfW-(t)*(cx+halfW-peakR) + sr(seed+i+80)*halfW*0.08-halfW*0.04, baseY+(peakYR-baseY)*Math.pow(t,0.75) - sr(seed+i+100)*halfW*0.06*t])
    }
    pts.push([cx+halfW, baseY])
  } else {
    // Narrow spire — very tall thin pinnacle with exposed rock ribs
    const w = halfW * 0.45
    pts.push([cx-w, baseY])
    for (let i=0;i<=8;i++){
      const t=i/8
      const ribble = Math.sin(t*Math.PI*3)*halfW*0.04*(1-t)
      pts.push([cx-w*(1-t*0.8) + sr(seed+i)*halfW*0.06 - halfW*0.03 + ribble, baseY+(peakY-baseY)*Math.pow(t,0.65) - sr(seed+i+10)*halfW*0.05*t])
    }
    pts.push([cx, peakY])
    for (let i=8;i>=0;i--){
      const t=i/8
      const ribble = Math.sin(t*Math.PI*3)*halfW*0.035*(1-t)
      pts.push([cx+w*(1-t*0.8) + sr(seed+i+50)*halfW*0.05 - halfW*0.02 - ribble, baseY+(peakY-baseY)*Math.pow(t,0.65) - sr(seed+i+60)*halfW*0.04*t])
    }
    pts.push([cx+w, baseY])
  }

  pts.push([pts[0][0], baseY])
  return pts.map((p,i)=>`${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')+'Z'
}

function buildSnow(cx:number, peakY:number, capDepth:number, halfW:number, seed:number, arch:Archetype):string {
  const pts:[number,number][] = [[cx, peakY]]
  const segs = arch===1 ? 10 : arch===3 ? 8 : 7
  const spreadFrac = arch===1 ? 0.42 : arch===2 ? 0.28 : arch===4 ? 0.18 : 0.30
  for (let i=-segs; i<=segs; i++){
    const t = i/segs
    const bx = cx + t*halfW*spreadFrac + (sr(seed+200+i)*halfW*0.06 - halfW*0.03)
    const by = peakY + capDepth*(0.6 + sr(seed+210+Math.abs(i))*0.8) + sr(seed+220+i)*capDepth*0.25
    pts.push([bx, by])
  }
  return pts.map((p,i)=>`${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')+'Z'
}

// ── Depth layers and positions ─────────────────────────────────────────────
// Front 5 (highest scorers) — big, full detail, spread wide
const FRONT_X = [0.18, 0.38, 0.57, 0.75, 0.91]
// Mid 8 (ranks 6-13) — medium, slightly recessed
const MID_X   = [0.06, 0.27, 0.46, 0.65, 0.84, 0.14, 0.52, 0.78]
// Back 7 (ranks 14-20) — smallest, atmospheric, fill gaps
const BACK_X  = [0.10, 0.31, 0.50, 0.68, 0.87, 0.22, 0.60]

export default function GoatRange({players,onPlayer}:{players:RangePlayer[];onPlayer:(p:string)=>void}){
  const [hov, setHov] = useState<{player:string;score:number;games:number;wins:number;x:number;py:number}|null>(null)
  const W=1200, H=540, GROUND=H-70

  const sorted = useMemo(()=>[...players].sort((a,b)=>b.adjScore-a.adjScore).slice(0,20),[players])
  const maxScore = sorted[0]?.adjScore ?? 1

  type PeakData = RangePlayer & {
    cx:number; peakY:number; halfW:number; snowDepth:number
    score01:number; rank:number; layer:0|1|2; arch:Archetype
    silPath:string; snowPath:string
  }

  const peaks = useMemo(():PeakData[]=> sorted.map((p,rank)=>{
    const layer:0|1|2 = rank<5 ? 0 : rank<13 ? 1 : 2
    const xFrac = layer===0 ? FRONT_X[rank] : layer===1 ? MID_X[rank-5] : BACK_X[rank-13]
    const cx = 30 + (xFrac??0.5)*(W-60)
    const score01 = p.adjScore/maxScore

    // Height varies dramatically by layer and score
    const layerScale = layer===0 ? 1.0 : layer===1 ? 0.72 : 0.50
    const minH = layer===0 ? 120 : layer===1 ? 70 : 45
    const maxH = layer===0 ? 360 : layer===1 ? 240 : 160
    const peakH = (minH + score01*(maxH-minH)) * layerScale
    const peakY = GROUND - peakH

    // Width varies by archetype — some very narrow, some very wide
    const arch = getArchetype(rank*17+3) as Archetype
    const archWidthMult = [0.85, 1.35, 1.10, 1.05, 0.55][arch]
    const baseHalfW = (55 + score01*90 + sr(rank*7)*35) * layerScale * archWidthMult

    // Snow depth — deeper for higher scorers
    const snowDepth = peakH * (0.10 + score01*0.18) * (arch===4 ? 0.7 : 1)

    const silPath = buildSilhouette(cx, peakY, GROUND, baseHalfW, rank*100, arch)
    const snowPath = buildSnow(cx, peakY, snowDepth, baseHalfW, rank*100, arch)

    return { ...p, cx, peakY, halfW:baseHalfW, snowDepth, score01, rank, layer, arch, silPath, snowPath }
  }), [sorted, maxScore])

  // Draw order: back → mid → front, within each layer by cx
  const drawOrder = useMemo(()=>[...peaks].sort((a,b)=>{
    if (a.layer !== b.layer) return b.layer - a.layer
    return a.cx - b.cx
  }), [peaks])

  const layerColor = (layer:0|1|2) => {
    if (layer===0) return { body:'#0E1628', light:'rgba(255,255,255,0.055)', opacity:1 }
    if (layer===1) return { body:'#1A2840', light:'rgba(255,255,255,0.03)', opacity:0.88 }
    return        { body:'#2A3C58', light:'rgba(255,255,255,0.015)', opacity:0.70 }
  }
  const snowOpacity = (layer:0|1|2) => [0.94, 0.72, 0.45][layer]
  const labelOpacity = (layer:0|1|2) => ['rgba(220,235,255,0.92)','rgba(160,195,240,0.75)','rgba(110,155,210,0.55)'][layer]

  return(
    <div style={{position:'relative',width:'100%',borderRadius:4,overflow:'hidden',userSelect:'none'}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',display:'block'}} onMouseLeave={()=>setHov(null)}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#06101E"/>
            <stop offset="35%"  stopColor="#0E1E3A"/>
            <stop offset="70%"  stopColor="#1E3358"/>
            <stop offset="100%" stopColor="#3A5070"/>
          </linearGradient>
          <radialGradient id="moonGlow" cx="72%" cy="11%" r="28%">
            <stop offset="0%"   stopColor="#C8DCFF" stopOpacity="0.14"/>
            <stop offset="100%" stopColor="#C8DCFF" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="snowL" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#B8CCEC" stopOpacity="0.9"/>
            <stop offset="45%"  stopColor="#E8F0FF" stopOpacity="0.98"/>
            <stop offset="100%" stopColor="#C0D4F0" stopOpacity="0.85"/>
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#060C14"/>
            <stop offset="100%" stopColor="#030608"/>
          </linearGradient>
          <linearGradient id="treeLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#08140A" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#040808" stopOpacity="1"/>
          </linearGradient>
          {/* Per-layer atmospheric tint for rock faces */}
          {([0,1,2] as const).map(l=>(
            <linearGradient key={l} id={`rock${l}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={layerColor(l).body}/>
              <stop offset="42%"  stopColor={['#18284A','#253850','#354868'][l]}/>
              <stop offset="58%"  stopColor={['#1E3060','#2A4060','#3A5070'][l]}/>
              <stop offset="100%" stopColor={layerColor(l).body}/>
            </linearGradient>
          ))}
          <filter id="glow2"><feGaussianBlur stdDeviation="5" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
          <filter id="atmos"><feGaussianBlur stdDeviation="2.5"/></filter>
        </defs>

        {/* Sky */}
        <rect width={W} height={H} fill="url(#sky)"/>
        <rect width={W} height={H} fill="url(#moonGlow)"/>

        {/* Stars */}
        {Array.from({length:90},(_,i)=>(
          <circle key={i} cx={sr(i*13)*W} cy={sr(i*19)*H*0.48}
            r={sr(i*29)*1.4+0.25} fill="white" opacity={sr(i*37)*0.55+0.1}/>
        ))}
        {/* Moon */}
        <circle cx={W*0.73} cy={H*0.09} r={26} fill="#D0E4FF" opacity={0.88}/>
        <circle cx={W*0.73+7} cy={H*0.09-5} r={22} fill="#0E1E3A" opacity={0.52}/>

        {/* All mountains — back to front */}
        {drawOrder.map(p=>{
          const lc = layerColor(p.layer)
          const isHov = hov?.player===p.player
          return(
            <g key={p.rank} style={{cursor:'pointer'}} opacity={lc.opacity}
              onClick={()=>onPlayer(p.player)}>
              {/* Atmospheric blur for back layer */}
              {p.layer===2&&<path d={p.silPath} fill={`url(#rock${p.layer})`} filter="url(#atmos)" opacity={0.6}/>}
              {/* Rock body */}
              <path d={p.silPath} fill={`url(#rock${p.layer})`}/>
              {/* Subtle light face */}
              <path d={p.silPath} fill={lc.light}/>
              {/* Snow */}
              <path d={p.snowPath} fill="url(#snowL)" opacity={snowOpacity(p.layer)}/>
              {/* Snow shadow */}
              <path d={p.snowPath} fill="rgba(80,120,200,0.12)"/>
              {/* Hover highlight */}
              {isHov&&<path d={p.silPath} fill="rgba(255,255,255,0.07)" filter="url(#glow2)"/>}
              {/* Hit area */}
              <path d={p.silPath} fill="transparent"
                onMouseEnter={()=>setHov({player:p.player,score:p.adjScore,games:p.games,wins:p.wins,x:p.cx,py:p.peakY})}/>
            </g>
          )
        })}

        {/* Tree line */}
        <rect x={0} y={GROUND-32} width={W} height={32} fill="url(#treeLine)"/>
        <path d={Array.from({length:Math.floor(W/5)+1},(_,i)=>{
          const tx=i*5, th=4+sr(i*41)*16
          return `M${tx},${GROUND-32} L${tx+2.5},${GROUND-32-th} L${tx+5},${GROUND-32}`
        }).join(' ')} fill="rgba(4,10,8,0.95)"/>

        {/* Ground */}
        <rect x={0} y={GROUND} width={W} height={H-GROUND} fill="url(#ground)"/>

        {/* Atmospheric valley fog */}
        <rect x={0} y={GROUND-50} width={W} height={50} fill="rgba(15,28,55,0.22)"/>

        {/* Labels — drawn on top of everything, front layer most prominent */}
        {[2,1,0].map(layer=>
          drawOrder.filter(p=>p.layer===layer).map(p=>{
            const isHov=hov?.player===p.player
            const lastName=p.player.split(' ').pop()??p.player
            const fs = p.layer===0 ? (p.score01>0.6?12:11) : p.layer===1 ? 10 : 9
            const labelY = p.peakY - (p.layer===0 ? 38 : p.layer===1 ? 28 : 20)
            const lineLen = p.layer===0 ? 34 : p.layer===1 ? 24 : 16
            return(
              <g key={`lbl-${p.rank}`} style={{pointerEvents:'none'}}>
                <line x1={p.cx} y1={p.peakY-3} x2={p.cx} y2={p.peakY-lineLen}
                  stroke="rgba(180,210,255,0.25)" strokeWidth={0.6} strokeDasharray="2,3"/>
                {/* Rank dot */}
                {p.layer===0&&(
                  <circle cx={p.cx} cy={p.peakY-lineLen-3} r={7}
                    fill={p.rank===0?'rgba(154,110,28,0.8)':'rgba(27,46,94,0.7)'}
                    stroke={p.rank===0?'rgba(196,142,42,0.5)':'rgba(100,130,200,0.25)'} strokeWidth={0.75}/>
                )}
                {p.layer===0&&(
                  <text x={p.cx} y={p.peakY-lineLen} textAnchor="middle" fontSize={7.5}
                    fill={p.rank===0?'#F5C060':'#90B0E0'} fontFamily="var(--font-mono)" fontWeight={700}>
                    #{p.rank+1}
                  </text>
                )}
                <text x={p.cx} y={labelY} textAnchor="middle" fontSize={fs}
                  fill={isHov?'#FFFFFF':labelOpacity(p.layer)}
                  fontFamily="var(--font-body)" fontWeight={p.layer===0&&p.score01>0.5?700:500}
                  style={{letterSpacing:'0.01em'}}>
                  {p.layer<2?lastName:lastName.slice(0,8)}
                </text>
                {isHov&&p.layer===0&&(
                  <text x={p.cx} y={labelY-16} textAnchor="middle" fontSize={9.5}
                    fill="#F5C060" fontFamily="var(--font-mono)" fontWeight={700}>
                    {p.adjScore.toFixed(1)}
                  </text>
                )}
              </g>
            )
          })
        )}
      </svg>

      {/* Hover card */}
      {hov&&(
        <div style={{position:'absolute',left:Math.min(Math.max(hov.x-90,8),W-220),top:16,
          background:'rgba(8,14,28,0.93)',border:'1px solid rgba(100,140,220,0.28)',
          borderRadius:3,padding:'10px 16px',color:'#C8DCF0',fontSize:12,
          backdropFilter:'blur(10px)',pointerEvents:'none',minWidth:200,
          boxShadow:'0 4px 28px rgba(0,0,0,0.6)'}}>
          <div style={{fontFamily:'var(--font-head)',fontSize:17,color:'#E8F0FF',marginBottom:3}}>{hov.player}</div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:21,color:'#F5C060',fontWeight:700,marginBottom:6}}>{hov.score.toFixed(1)}</div>
          <div style={{fontSize:11,color:'rgba(160,200,255,0.55)',borderTop:'1px solid rgba(100,140,220,0.18)',paddingTop:5,display:'flex',gap:14}}>
            <span><b style={{color:'#C8DCF0'}}>{hov.games}</b> playoff games</span>
            <span><b style={{color:'#C8DCF0'}}>{hov.wins}</b> wins</span>
          </div>
        </div>
      )}

      <div style={{position:'absolute',bottom:6,right:12,fontSize:9,color:'rgba(100,140,200,0.35)',letterSpacing:'0.06em',textTransform:'uppercase'}}>
        Peak height · width · and depth reflect GOAT score and career volume
      </div>
    </div>
  )
}
