'use client'
import { useMemo } from 'react'

interface RadarAxis {
  key: string
  label: string
  value: number       // player's value
  percentile: number  // 0-100
  displayVal: string  // formatted for display
}

interface RadarChartProps {
  axes: RadarAxis[]
  size?: number
}

export default function RadarChart({ axes, size = 280 }: RadarChartProps) {
  const n = axes.length
  if (n < 3) return null

  const cx = size / 2
  const cy = size / 2
  const R  = size * 0.38   // outer radius
  const Ri = size * 0.15   // inner reference ring radius
  const labelR = R + 36    // label placement

  const angle = (i: number) => (i * 2 * Math.PI) / n - Math.PI / 2

  const point = (r: number, i: number) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  })

  const playerPts = axes.map((a, i) => point(R * (a.percentile / 100), i))
  const outerPts  = axes.map((_, i) => point(R, i))
  const midPts    = axes.map((_, i) => point(R * 0.5, i))
  const innerPts  = axes.map((_, i) => point(Ri, i))

  const polyStr = (pts: { x: number; y: number }[]) =>
    pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const labelPts = axes.map((a, i) => {
    const ang = angle(i)
    const lx = cx + labelR * Math.cos(ang)
    const ly = cy + labelR * Math.sin(ang)
    // Adjust alignment based on angle
    const textAnchor =
      Math.abs(Math.cos(ang)) < 0.15 ? 'middle'
      : Math.cos(ang) < 0 ? 'end'
      : 'start'
    return { ...a, lx, ly, textAnchor }
  })

  return (
    <svg width={size + 80} height={size + 40}
      viewBox={`-40 -20 ${size + 80} ${size + 40}`}
      style={{ overflow: 'visible' }}>

      {/* Reference rings */}
      {[1, 0.5].map(scale => (
        <polygon key={scale}
          points={polyStr(outerPts.map((_, i) => point(R * scale, i)))}
          fill="none"
          stroke={scale === 1 ? '#1E2A45' : '#1A2438'}
          strokeWidth={scale === 1 ? 1 : 0.5}
          strokeDasharray={scale === 1 ? '4 3' : '3 3'}
        />
      ))}

      {/* Spokes */}
      {outerPts.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y}
          stroke="#1E2A45" strokeWidth={0.5} />
      ))}

      {/* Player polygon fill */}
      <polygon
        points={polyStr(playerPts)}
        fill="rgba(201,168,76,0.15)"
        stroke="none"
      />

      {/* Player polygon stroke */}
      <polygon
        points={polyStr(playerPts)}
        fill="none"
        stroke="#C9A84C"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Vertex dots */}
      {playerPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4}
          fill="#C9A84C" stroke="#08091A" strokeWidth={1.5} />
      ))}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={2.5} fill="#1E2A45" />

      {/* Labels */}
      {labelPts.map((a, i) => (
        <g key={i}>
          <text x={a.lx} y={a.ly - 4}
            textAnchor={a.textAnchor}
            fontFamily="'Barlow Condensed', sans-serif"
            fontWeight={700} fontSize={11}
            letterSpacing=".08em"
            fill="#7B8DB0"
            style={{ textTransform: 'uppercase' }}>
            {a.label}
          </text>
          <text x={a.lx} y={a.ly + 10}
            textAnchor={a.textAnchor}
            fontFamily="'Barlow Condensed', sans-serif"
            fontWeight={600} fontSize={13}
            fill="#E2E8F4">
            {a.displayVal}
          </text>
          <text x={a.lx} y={a.ly + 23}
            textAnchor={a.textAnchor}
            fontFamily="'Barlow Condensed', sans-serif"
            fontWeight={600} fontSize={11}
            fill="#C9A84C">
            {a.percentile}th
          </text>
        </g>
      ))}

      {/* Center percentile label */}
      <text x={cx} y={cy + 4}
        textAnchor="middle"
        fontFamily="'Barlow Condensed', sans-serif"
        fontWeight={700} fontSize={13}
        fill="#C9A84C">
        {Math.round(axes.reduce((s, a) => s + a.percentile, 0) / n)}
      </text>
    </svg>
  )
}

// ── Helper: compute percentile rank of value within distribution ──────────────
export function percentileRank(value: number, distribution: number[]): number {
  if (!distribution.length) return 50
  const sorted = [...distribution].sort((a, b) => a - b)
  let below = 0
  for (const v of sorted) { if (v < value) below++ }
  return Math.round((below / sorted.length) * 100)
}
