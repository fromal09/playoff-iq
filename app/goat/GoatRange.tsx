'use client'
import { useState, useMemo } from 'react'

type RangePlayer = { player:string; adjScore:number; games:number; wins:number }

function sr(seed:number){ const s=Math.sin(seed*127.1+311.7)*43758.5453; return s-Math.floor(s) }

function mountainSilhouette(cx:number, peakY:number, baseY:number, halfW:number, seed:number):string {
  const pts:[number,number][] = []
  pts.push([cx - halfW, baseY])
  const leftSegs = 9
  for (let i=0; i<=leftSegs; i++) {
    const t = i/leftSegs
    const bx = (cx-halfW) + t*halfW
    const by = baseY + t*(peakY-baseY)
    const jx = (sr(seed+i*0.31)-0.5)*halfW*0.22*(1-Math.abs(t-0.5)*1.5)
    const jy = sr(seed+i*0.77)*halfW*0.13*(1-t)
    pts.push([bx+jx, by-jy])
  }
  // Secondary spire near summit
  const spOff = (sr(seed+99)-0.5)*halfW*0.22
  const spH   = halfW*(0.07+sr(seed+100)*0.13)
  pts.push([cx+spOff-halfW*0.05, peakY+spH*0.65])
  pts.push([cx+spOff,            peakY-spH])
  pts.push([cx+spOff+halfW*0.05, peakY+spH*0.5])
  pts.push([cx, peakY])
  for (let i=leftSegs; i>=0; i--) {
    const t = i/leftSegs
    const bx = cx + (1-t)*(halfW)
    const by = baseY + t*(peakY-baseY)
    const jx = (sr(seed+50+i*0.31)-0.5)*halfW*0.18*(1-Math.abs(t-0.5)*1.5)
    const jy = sr(seed+50+i*0.77)*halfW*0.11*(1-t)
    pts.push([bx+jx, by-jy])
  }
  pts.push([cx + halfW, baseY])
  return pts.map((p,i)=>`${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')+'Z'
}

function snowCap(cx:number, peakY:number, capH:number, halfW:number, seed:number):string {
  const pts:[number,number][] = [[cx, peakY]]
  const segs = 7
  for (let i=-segs; i<=segs; i++) {
    const t = i/segs
    const bx = cx + t*halfW*0.30 + (sr(seed+200+i)-0.5)*halfW*0.08
    const by = peakY + capH*(0.55 + sr(seed+210+Math.abs(i))*0.7) + sr(seed+220+i)*capH*0.28
    pts.push([bx, by])
  }
  return pts.map((p,i)=>`${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')+'Z'
}

// Positions spread across the panorama — NOT sequential by rank
// Arranged so varying heights create a natural range silhouette
const PEAK_X = [
  0.42, 0.58, 0.33, 0.66, 0.24, 0.76, 0.50, 0.15, 0.85,
  0.08, 0.91, 0.45, 0.62, 0.37, 0.70, 0.55, 0.28, 0.78, 0.19, 0.04
]

export default function GoatRange({players, onPlayer}:{players:RangePlayer[]; onPlayer:(p:string)=>void}){
  const [hov, setHov] = useState<{player:string;score:number;games:number;wins:number;cx:number;peakY:number}|null>(null)
  const W=1200, H=520, GROUND=H-70

  const sorted = useMemo(()=>[...players].sort((a,b)=>b.adjScore-a.adjScore).slice(0,20),[players])
  const maxScore = sorted[0]?.adjScore ?? 1

  const peaks = useMemo(()=> sorted.map((p,rank)=>{
    const xFrac = PEAK_X[rank] ?? 0.5
    const cx = 36 + xFrac*(W-72)
    const score01 = p.adjScore / maxScore
    const minH=90, maxH=360
    const peakH = minH + score01*(maxH-minH)
    const peakY = GROUND - peakH
    // Width reflects career volume loosely — mix of score and games
    const volFrac = Math.min((p.games/300),1)
    const halfW = 65 + score01*95 + volFrac*30 + sr(rank*7)*35
    const snowH = peakH*(0.11+score01*0.16)
    return { ...p, cx, peakY, halfW, snowH, score01, rank }
  }), [sorted, maxScore])

  // Draw shortest (lowest score) first so taller peaks sit in front
  const drawOrder = useMemo(()=>[...peaks].sort((a,b)=>b.peakY-a.peakY),[peaks])

  return(
    <div style={{position:'relative',width:'100%',overflow:'hidden',borderRadius:4}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',display:'block'}}
        onMouseLeave={()=>setHov(null)}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#06101E"/>
            <stop offset="38%"  stopColor="#0E1E3A"/>
            <stop offset="72%"  stopColor="#1E3254"/>
            <stop offset="100%" stopColor="#384E6A"/>
          </linearGradient>
          <radialGradient id="moon" cx="73%" cy="10%" r="6%">
            <stop offset="0%"   stopColor="#D8ECFF" stopOpacity="1"/>
            <stop offset="100%" stopColor="#D8ECFF" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="moonHalo" cx="73%" cy="10%" r="28%">
            <stop offset="0%"   stopColor="#8AACDC" stopOpacity="0.11"/>
            <stop offset="100%" stopColor="#8AACDC" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="snow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#B8CCEC" stopOpacity="0.88"/>
            <stop offset="42%"  stopColor="#E8F2FF" stopOpacity="0.97"/>
            <stop offset="100%" stopColor="#C0D4F0" stopOpacity="0.84"/>
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#050C14"/>
            <stop offset="100%" stopColor="#020508"/>
          </linearGradient>
          {/* Per-rank rock gradient — shifts slightly bluer for shorter peaks (natural recession) */}
          {peaks.map(p=>{
            const blend = 1-p.score01  // lower score = more atmospheric/blue
            const r1=Math.round(10+blend*30), g1=Math.round(16+blend*28), b1=Math.round(28+blend*40)
            const r2=Math.round(22+blend*18), g2=Math.round(38+blend*16), b2=Math.round(68+blend*30)
            return(
              <linearGradient key={p.rank} id={`rk${p.rank}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor={`rgb(${r1},${g1},${b1})`}/>
                <stop offset="40%"  stopColor={`rgb(${r2},${g2},${b2})`}/>
                <stop offset="57%"  stopColor={`rgb(${Math.round(r2*1.2)},${Math.round(g2*1.2)},${Math.round(b2*1.1)})`}/>
                <stop offset="100%" stopColor={`rgb(${r1},${g1},${b1})`}/>
              </linearGradient>
            )
          })}
          <filter id="peakGlow"><feGaussianBlur stdDeviation="5" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        </defs>

        {/* Sky & atmosphere */}
        <rect width={W} height={H} fill="url(#sky)"/>
        <rect width={W} height={H} fill="url(#moonHalo)"/>

        {/* Stars */}
        {Array.from({length:95},(_,i)=>(
          <circle key={i} cx={sr(i*13)*W} cy={sr(i*19)*H*0.50}
            r={sr(i*29)*1.5+0.2} fill="white" opacity={sr(i*41)*0.60+0.08}/>
        ))}

        {/* Moon */}
        <circle cx={W*0.73} cy={H*0.09} r={3} fill="url(#moon)"/>
        <circle cx={W*0.73} cy={H*0.09} r={27} fill="#D0E6FF" opacity={0.92}/>
        <circle cx={W*0.73+8} cy={H*0.09-5} r={23} fill="#0E1E3A" opacity={0.54}/>

        {/* Mountains — shortest drawn first (appear furthest back) */}
        {drawOrder.map(p=>{
          const isHov = hov?.player===p.player
          // Shorter peaks get a tiny bit more opacity-faded to enhance depth
          const depthOp = 0.70 + p.score01*0.30
          const path = mountainSilhouette(p.cx, p.peakY, GROUND, p.halfW, p.rank*100)
          const snow = snowCap(p.cx, p.peakY, p.snowH, p.halfW, p.rank*100)
          return(
            <g key={p.rank} opacity={depthOp} style={{cursor:'pointer'}}
              onClick={()=>onPlayer(p.player)}>
              <path d={path} fill={`url(#rk${p.rank})`}/>
              {/* Subtle light rim on right face */}
              <path d={path} fill="rgba(255,255,255,0.035)"/>
              <path d={snow} fill="url(#snow)"/>
              <path d={snow} fill="rgba(90,130,210,0.10)"/>
              {isHov&&<path d={path} fill="rgba(255,255,255,0.07)" filter="url(#peakGlow)"/>}
              <path d={path} fill="transparent"
                onMouseEnter={()=>setHov({player:p.player,score:p.adjScore,games:p.games,wins:p.wins,cx:p.cx,peakY:p.peakY})}/>
            </g>
          )
        })}

        {/* Tree line */}
        <rect x={0} y={GROUND-30} width={W} height={30} fill="rgba(4,9,16,0.80)"/>
        <path d={Array.from({length:Math.floor(W/5)+1},(_,i)=>{
          const tx=i*5, th=5+sr(i*41)*15
          return `M${tx},${GROUND-30} L${tx+2.5},${GROUND-30-th} L${tx+5},${GROUND-30}`
        }).join(' ')} fill="rgba(3,8,12,0.96)"/>
        <rect x={0} y={GROUND} width={W} height={H-GROUND} fill="url(#ground)"/>

        {/* Fog at valley base */}
        <rect x={0} y={GROUND-52} width={W} height={52} fill="rgba(14,26,50,0.20)"/>

        {/* Labels — render in draw order so front labels don't get buried */}
        {drawOrder.map(p=>{
          const isHov = hov?.player===p.player
          const lastName = p.player.split(' ').pop()??p.player
          const isFront = p.score01 > 0.55
          const isMid   = p.score01 > 0.25
          const fs = isFront ? 11 : isMid ? 9.5 : 8.5
          const lineLen = isFront ? 36 : isMid ? 26 : 18
          const labelAlpha = isFront ? 0.90 : isMid ? 0.68 : 0.48
          return(
            <g key={`L${p.rank}`} style={{pointerEvents:'none'}}>
              <line x1={p.cx} y1={p.peakY-3} x2={p.cx} y2={p.peakY-lineLen}
                stroke={`rgba(180,210,255,${labelAlpha*0.28})`} strokeWidth={0.65} strokeDasharray="2,3"/>
              {isFront&&(
                <>
                  <rect x={p.cx-9} y={p.peakY-lineLen-12} width={18} height={12} rx={2}
                    fill={p.rank===0?'rgba(154,110,28,0.82)':'rgba(20,38,80,0.75)'}
                    stroke={p.rank===0?'rgba(196,142,42,0.5)':'rgba(80,120,200,0.25)'} strokeWidth={0.75}/>
                  <text x={p.cx} y={p.peakY-lineLen-4} textAnchor="middle" fontSize={7}
                    fill={p.rank===0?'#F5C060':'#90B0DC'}
                    fontFamily="var(--font-mono)" fontWeight={700}>
                    #{p.rank+1}
                  </text>
                </>
              )}
              <text x={p.cx} y={p.peakY-lineLen-16} textAnchor="middle" fontSize={fs}
                fill={isHov?'#FFFFFF':`rgba(190,220,255,${labelAlpha})`}
                fontFamily="var(--font-body)" fontWeight={isFront&&p.score01>0.6?700:500}
                style={{letterSpacing:'0.015em'}}>
                {isFront?lastName:lastName.slice(0,9)}
              </text>
              {isHov&&(
                <text x={p.cx} y={p.peakY-lineLen-30} textAnchor="middle" fontSize={9}
                  fill="#F5C060" fontFamily="var(--font-mono)" fontWeight={700}>
                  {p.adjScore.toFixed(1)}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Hover detail */}
      {hov&&(
        <div style={{position:'absolute',
          left:Math.min(Math.max(hov.cx-95,8),W-215),top:14,
          background:'rgba(6,12,24,0.94)',border:'1px solid rgba(90,130,210,0.26)',
          borderRadius:3,padding:'10px 16px',color:'#C0D8F0',fontSize:12,
          backdropFilter:'blur(10px)',pointerEvents:'none',
          boxShadow:'0 4px 28px rgba(0,0,0,0.65)',minWidth:200}}>
          <div style={{fontFamily:'var(--font-head)',fontSize:17,color:'#E4F0FF',marginBottom:3}}>{hov.player}</div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:22,color:'#F5C060',fontWeight:700,marginBottom:6}}>{hov.score.toFixed(1)}</div>
          <div style={{fontSize:11,color:'rgba(150,190,255,0.5)',borderTop:'1px solid rgba(90,130,210,0.16)',paddingTop:5,display:'flex',gap:14}}>
            <span><b style={{color:'#C0D8F0'}}>{hov.games}</b> games</span>
            <span><b style={{color:'#C0D8F0'}}>{hov.wins}</b> wins</span>
          </div>
        </div>
      )}
      <div style={{position:'absolute',bottom:6,right:10,fontSize:8.5,color:'rgba(90,130,200,0.32)',letterSpacing:'0.06em',textTransform:'uppercase'}}>
        Peak height = GOAT score · width ≈ career volume
      </div>
    </div>
  )
}
