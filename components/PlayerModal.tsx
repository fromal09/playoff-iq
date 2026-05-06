'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { FRANCHISE_NAMES, FRANCHISE_ROLLUP, HISTORICAL_TEAM_NAMES } from '@/lib/franchise'
import { PRESETS, buildLeaderboard } from '@/lib/scoring'
import type { PlayerSeasonStats, PlayerGame, GoatGameRow } from '@/lib/types'

type CrownHistoryRow = {
  id:number; date:string; season:number; team:string; opp:string; event:string
  crown_holder:string; crown_team:string; prev_holder:string; gmsc:number; streak:number; total_games:number
}
type CrownStint = { rows:CrownHistoryRow[]; stintNum:number }

const ALL_STAT_KEYS = ['pts_avg','ast_avg','trb_avg','orb_avg','drb_avg','stl_avg','blk_avg','tov_avg','bpm_avg','fg_pct_avg','three_p_pct_avg','ft_pct_avg','ts_pct_avg']
const PROFILES: Record<string,{label:string;stats:string[]}> = {
  boxscore:{label:'Box Score',stats:['pts_avg','ast_avg','trb_avg','stl_avg','blk_avg']},
  scoring:{label:'Scoring',stats:['pts_avg','fg_pct_avg','three_p_pct_avg','ft_pct_avg','ts_pct_avg']},
  complete:{label:'Complete',stats:['pts_avg','ast_avg','trb_avg','stl_avg','blk_avg','tov_avg','bpm_avg']},
  choose:{label:'Custom',stats:['pts_avg','ast_avg','trb_avg','stl_avg','blk_avg']},
}
const STAT_LABELS:Record<string,string>={
  pts_avg:'PTS',ast_avg:'AST',trb_avg:'REB',orb_avg:'ORB',drb_avg:'DRB',
  stl_avg:'STL',blk_avg:'BLK',tov_avg:'TOV',bpm_avg:'BPM',
  fg_pct_avg:'FG%',three_p_pct_avg:'3P%',ft_pct_avg:'FT%',ts_pct_avg:'TS%',
}
const IS_LOWER:Record<string,boolean>={tov_avg:true}
const IS_PCT:Record<string,boolean>={fg_pct_avg:true,three_p_pct_avg:true,ft_pct_avg:true,ts_pct_avg:true}

// Map franchise abbrev to the name used in a given season year
function historicalName(franchise:string, season:number):string{
  // Teams that changed names — map to the name used at that time
  const overrides:Record<string,Array<[number,number,string]>>={
    NOP: [[2002,2005,'New Orleans Hornets'],[2005,2007,'New Orleans/Oklahoma City Hornets'],[2007,2013,'New Orleans Hornets'],[2013,9999,'New Orleans Pelicans']],
    BRK: [[1967,1977,'New York Nets'],[1977,2012,'New Jersey Nets'],[2012,9999,'Brooklyn Nets']],
    OKC: [[1967,2008,'Seattle SuperSonics'],[2008,9999,'Oklahoma City Thunder']],
    WAS: [[1946,1951,'Washington Capitols'],[1963,1974,'Baltimore Bullets'],[1974,1975,'Capital Bullets'],[1975,1997,'Washington Bullets'],[1997,9999,'Washington Wizards']],
    SAC: [[1945,1958,'Rochester Royals'],[1958,1972,'Cincinnati Royals'],[1972,1975,'Kansas City-Omaha Kings'],[1975,1985,'Kansas City Kings'],[1985,9999,'Sacramento Kings']],
    GSW: [[1946,1962,'Philadelphia Warriors'],[1962,1971,'San Francisco Warriors'],[1971,9999,'Golden State Warriors']],
    LAL: [[1947,1960,'Minneapolis Lakers'],[1960,9999,'Los Angeles Lakers']],
    DET: [[1941,1957,'Fort Wayne Pistons'],[1957,9999,'Detroit Pistons']],
    ATL: [[1946,1951,'Tri-Cities Blackhawks'],[1951,1955,'Milwaukee Hawks'],[1955,1968,'St. Louis Hawks'],[1968,9999,'Atlanta Hawks']],
    CHO: [[1988,2002,'Charlotte Hornets'],[2002,2004,'New Orleans Hornets'],[2004,2014,'Charlotte Bobcats'],[2014,9999,'Charlotte Hornets']],
    HOU: [[1967,1971,'San Diego Rockets'],[1971,9999,'Houston Rockets']],
    PHI: [[1946,1963,'Syracuse Nationals'],[1963,9999,'Philadelphia 76ers']],
    LAC: [[1970,1978,'Buffalo Braves'],[1978,1984,'San Diego Clippers'],[1984,9999,'Los Angeles Clippers']],
  }
  const list=overrides[franchise]
  if(list){
    const match=list.find(([s,e])=>season>=s&&season<e)
    if(match) return match[2]
  }
  return FRANCHISE_NAMES[franchise]??franchise
}

function rollingAvg(vals:number[],n:number):{idx:number;val:number}[]{
  if(vals.length<n) return []
  const result:{idx:number;val:number}[]=[]
  for(let i=n-1;i<vals.length;i++){
    const slice=vals.slice(i-n+1,i+1)
    result.push({idx:i,val:slice.reduce((a,b)=>a+b,0)/n})
  }
  return result
}
function pctile(arr:number[],p:number):number{
  const s=[...arr].filter(v=>v!=null&&!isNaN(v)).sort((a,b)=>a-b)
  return s.length?s[Math.floor(s.length*p)]||0.001:1
}
function clamp(v:number,mn:number,mx:number){return Math.max(mn,Math.min(mx,v))}
function teamName(abbr:string){return FRANCHISE_NAMES[abbr]??abbr}
function deepestLabel(deepest:number,championships:number):string{
  if(championships>0) return `${championships}× 🏆 Title`
  if(deepest===4) return 'Finals'
  if(deepest===3) return 'Conf Finals'
  if(deepest===2) return '2nd Round'
  if(deepest===1) return '1st Round'
  return '—'
}

// ── Season Game Score Total Chart ─────────────────────────────────────────
function SeasonChart({allData,player,playerSeasons}:{
  allData:{player:string;season:number;gmsc_sum:number}[]
  player:string; playerSeasons:PlayerSeasonStats[]
}){
  const [tooltip,setTooltip]=useState<{x:number;y:number;season:number;val:number}|null>(null)
  const svgRef=useRef<SVGSVGElement>(null)
  if(!allData.length) return <div className="loading" style={{padding:'24px 0'}}><div className="spinner"/>Loading chart…</div>
  const W=640,H=180,PL=52,PR=12,PT=12,PB=28,IW=W-PL-PR,IH=H-PT-PB
  const seasons=Array.from(new Set(allData.map(d=>d.season))).sort()
  const minS=seasons[0],maxS=seasons[seasons.length-1]
  const maxVal=Math.max(...allData.map(d=>d.gmsc_sum),1)
  const sx=(s:number)=>PL+(s-minS)/(maxS-minS||1)*IW
  const sy=(v:number)=>PT+IH-clamp(v,0,maxVal)/maxVal*IH
  const byPlayer=new Map<string,{season:number;gmsc_sum:number}[]>()
  for(const d of allData){const a=byPlayer.get(d.player)??[];a.push(d);byPlayer.set(d.player,a)}
  const playerData=playerSeasons.map(s=>({season:s.season,gmsc_sum:s.gmsc_sum??0})).sort((a,b)=>a.season-b.season)
  const playerPath=playerData.length>=2?playerData.map((d,i)=>`${i===0?'M':'L'}${sx(d.season).toFixed(1)},${sy(d.gmsc_sum).toFixed(1)}`).join(' '):''
  const decades=[1950,1960,1970,1980,1990,2000,2010,2020].filter(d=>d>=minS&&d<=maxS)
  const gridLines=[200,400,600,800,1000,1200].filter(v=>v<=maxVal)
  function handleMouseMove(e:React.MouseEvent<SVGSVGElement>){
    const rect=svgRef.current?.getBoundingClientRect()
    if(!rect) return
    const mx=(e.clientX-rect.left)*(W/rect.width)
    const season=Math.round((mx-PL)/IW*(maxS-minS)+minS)
    const d=playerData.find(p=>p.season===season)
    if(d) setTooltip({x:(e.clientX-rect.left)*(640/rect.width),y:sy(d.gmsc_sum),season:d.season,val:d.gmsc_sum})
    else setTooltip(null)
  }
  return(
    <div style={{position:'relative'}}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{width:'100%',display:'block',cursor:'crosshair'}}
        onMouseMove={handleMouseMove} onMouseLeave={()=>setTooltip(null)}>
        {gridLines.map(v=>(
          <g key={v}>
            <line x1={PL} y1={sy(v)} x2={W-PR} y2={sy(v)} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3,3"/>
            <text x={PL-4} y={sy(v)+3} textAnchor="end" fontSize={8} fill="var(--text3)">{v}</text>
          </g>
        ))}
        {Array.from(byPlayer.entries()).filter(([p])=>p!==player).map(([p,pts])=>{
          const sorted=[...pts].sort((a,b)=>a.season-b.season)
          if(sorted.length<2) return null
          const path=sorted.map((d,i)=>`${i===0?'M':'L'}${sx(d.season).toFixed(1)},${sy(d.gmsc_sum).toFixed(1)}`).join(' ')
          return <path key={p} d={path} fill="none" stroke="rgba(100,90,70,0.09)" strokeWidth={0.8}/>
        })}
        {playerPath&&<path d={playerPath} fill="none" stroke="var(--blue)" strokeWidth={2.5} strokeLinejoin="round"/>}
        {playerData.map(d=>(
          <circle key={d.season} cx={sx(d.season)} cy={sy(d.gmsc_sum)} r={3.5} fill="var(--blue)" stroke="var(--surface)" strokeWidth={1.5}/>
        ))}
        {decades.map(d=><text key={d} x={sx(d)} y={H-6} textAnchor="middle" fontSize={8} fill="var(--text3)">{d}</text>)}
        <line x1={PL} y1={H-PB} x2={W-PR} y2={H-PB} stroke="var(--border)" strokeWidth={1}/>
        {tooltip&&<line x1={tooltip.x} y1={PT} x2={tooltip.x} y2={H-PB} stroke="var(--blue)" strokeWidth={1} strokeDasharray="3,2" opacity={0.5}/>}
        {tooltip&&<circle cx={tooltip.x} cy={tooltip.y} r={5} fill="var(--blue)" stroke="var(--surface)" strokeWidth={2}/>}
      </svg>
      {tooltip&&(
        <div style={{position:'absolute',left:tooltip.x+10,top:tooltip.y-32,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:4,padding:'4px 10px',fontSize:12,fontWeight:600,color:'var(--text)',pointerEvents:'none',boxShadow:'var(--shadow2)',whiteSpace:'nowrap'}}>
          {tooltip.season}: {tooltip.val.toFixed(1)}
        </div>
      )}
    </div>
  )
}

// ── Game Score Distribution Chart ─────────────────────────────────────────
function DistributionChart({games}:{games:PlayerGame[]}){
  const W=640,H=140,PL=32,PR=12,PT=12,PB=24,IW=W-PL-PR,IH=H-PT-PB
  const BW=2.5
  const vals=games.map(g=>g.gmsc_computed)
  if(!vals.length) return null
  const mean=vals.reduce((a,b)=>a+b,0)/vals.length
  const minB=Math.floor(Math.min(...vals)/BW)*BW-BW
  const maxB=Math.ceil(Math.max(...vals)/BW)*BW+BW
  const buckets:number[]=[]
  for(let b=minB;b<=maxB;b+=BW) buckets.push(b)
  const counts=buckets.map(b=>vals.filter(v=>v>=b&&v<b+BW).length)
  const maxCount=Math.max(...counts,1)
  const sx=(b:number)=>PL+(b-minB)/(maxB-minB)*IW
  const sy=(cnt:number)=>PT+IH-cnt/maxCount*IH
  const barW=IW/(buckets.length)||4
  const ticks=buckets.filter((_,i)=>i%4===0)
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',display:'block'}}>
      {buckets.map((b,i)=>(
        <rect key={i} x={sx(b)} y={sy(counts[i])} width={Math.max(barW-1,1)} height={IH-sy(counts[i])+PT}
          fill={b+BW/2>=mean?'rgba(29,52,97,0.65)':'rgba(139,32,32,0.45)'} rx={1}/>
      ))}
      <line x1={PL} y1={H-PB} x2={W-PR} y2={H-PB} stroke="var(--border)" strokeWidth={1}/>
      {ticks.map(b=>(
        <text key={b} x={sx(b+BW/2)} y={H-6} textAnchor="middle" fontSize={8} fill="var(--text3)">{b>0?'+':''}{b.toFixed(0)}</text>
      ))}
      <line x1={sx(mean)} y1={PT} x2={sx(mean)} y2={H-PB} stroke="var(--text3)" strokeWidth={1} strokeDasharray="2,2"/>
    </svg>
  )
}

// ── Radar Chart ────────────────────────────────────────────────────────────
function RadarChart({stats,profile,bounds,customStats}:{stats:Record<string,number>;profile:string;bounds:Record<string,number>;customStats?:string[]}){
  const axes=profile==='choose'?(customStats??PROFILES.boxscore.stats):(PROFILES[profile]?.stats??PROFILES.boxscore.stats)
  const n=axes.length,R=85,cx=120,cy=120
  function angle(i:number){return(Math.PI*2*i/n)-Math.PI/2}
  function pt(i:number,r:number){return{x:cx+r*Math.cos(angle(i)),y:cy+r*Math.sin(angle(i))}}
  const ratios=axes.map(k=>{
    const v=stats[k]??0,mx=bounds[k]??1
    return IS_LOWER[k]?Math.max(0,Math.min(1,1-v/mx)):Math.max(0,Math.min(1,v/mx))
  })
  const poly=ratios.map((r,i)=>{const p=pt(i,r*R);return`${p.x},${p.y}`}).join(' ')
  return(
    <svg viewBox="0 0 240 240" style={{width:'100%',maxWidth:260}}>
      {[0.25,0.5,0.75,1].map(lvl=>(
        <polygon key={lvl} points={axes.map((_,i)=>pt(i,lvl*R)).map(p=>`${p.x},${p.y}`).join(' ')}
          fill="none" stroke={lvl===1?'var(--border2)':'var(--border)'} strokeWidth={lvl===1?1.5:1} strokeDasharray={lvl===1?undefined:'3,3'}/>
      ))}
      {axes.map((_,i)=>{const p=pt(i,R);return<line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth={1}/>})}
      <polygon points={poly} fill="rgba(29,52,97,0.13)" stroke="var(--blue)" strokeWidth={2} strokeLinejoin="round"/>
      {ratios.map((r,i)=>{const p=pt(i,r*R);return<circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--blue)" stroke="var(--surface)" strokeWidth={1.5}/>})}
      {axes.map((k,i)=>{
        const p=pt(i,R+22),v=stats[k]??0,disp=IS_PCT[k]?(v*100).toFixed(1)+'%':v.toFixed(1)
        return(
          <g key={k}>
            <text x={p.x} y={p.y-4} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--text)" fontFamily="var(--font-body)">{STAT_LABELS[k]}</text>
            <text x={p.x} y={p.y+9} textAnchor="middle" fontSize={8} fill="var(--blue)" fontFamily="var(--font-body)">{disp}</text>
          </g>
        )
      })}
    </svg>
  )
}

function PctBar({label,value,p,isPct}:{label:string;value:number;p:number;isPct?:boolean}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
      <span style={{width:36,fontSize:12,fontWeight:600,color:'var(--text)',flexShrink:0}}>{label}</span>
      <div className="pct-bar-track"><div className="pct-bar-fill" style={{width:`${p}%`}}/></div>
      <span style={{fontSize:11,fontWeight:700,color:'var(--blue)',width:30,textAlign:'right',fontFamily:'var(--font-mono)'}}>{p}th</span>
      <span style={{fontSize:11,color:'var(--text2)',width:46,textAlign:'right',fontFamily:'var(--font-mono)'}}>{isPct?(value*100).toFixed(1)+'%':value.toFixed(1)}</span>
    </div>
  )
}


// Reign game log for player modal (fetches box scores on demand)
function ModalReignGameLog({player,crownRows}:{player:string;crownRows:CrownHistoryRow[]}){
  const [boxScores,setBoxScores]=useState<Map<string,Record<string,unknown>>>(new Map())
  const [boxLoading,setBoxLoading]=useState(true)
  useEffect(()=>{
    async function load(){
      setBoxLoading(true)
      const dates=crownRows.map(r=>r.date)
      const {data}=await supabase.from('player_games')
        .select('date,opp,result,team_score,opp_score,pts,ast,trb,stl,blk,tov,fg,fga,fg_pct,three_p,ft,fta,mp,gmsc_computed')
        .eq('player',player).in('date',dates)
      if(data){
        const m=new Map<string,Record<string,unknown>>()
        for(const row of data as Record<string,unknown>[]) m.set(row.date as string,row)
        setBoxScores(m)
      }
      setBoxLoading(false)
    }
    load()
  },[player,crownRows])
  const fN=(v:unknown)=>v!=null?String(v):'—'
  if(boxLoading) return<div style={{fontSize:11,color:'var(--text3)',padding:'6px 0'}}>Loading…</div>
  return(
    <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse',fontSize:11.5,minWidth:500}}>
        <thead><tr style={{borderBottom:'2px solid var(--text)'}}>
          {['Date','Opp','Score','MIN','PTS','REB','AST','STL','BLK','TOV','FG','3P','FT%','GmSc',''].map(h=>(
            <th key={h} style={{padding:'3px 6px',fontSize:9,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',textAlign:['Date','Opp','Score'].includes(h)?'left':'right'}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {crownRows.map((row,gi)=>{
            const b=boxScores.get(row.date)
            return(
              <tr key={gi} style={{borderBottom:'1px solid var(--border)',background:gi%2===0?'transparent':'rgba(0,0,0,0.02)'}}>
                <td style={{padding:'4px 6px',fontFamily:'var(--font-mono)',color:'var(--text2)',fontSize:11}}>{row.date}</td>
                <td style={{padding:'4px 6px',color:'var(--text2)'}}>{row.opp}</td>
                <td style={{padding:'4px 6px',whiteSpace:'nowrap'}}>
                  {b?<span style={{fontFamily:'var(--font-mono)',color:(b.result as string)==='W'?'var(--green)':'var(--red)',fontWeight:600}}>{b.result as string} {b.team_score as number}–{b.opp_score as number}</span>:'—'}
                </td>
                <td style={{padding:'4px 6px',textAlign:'right',fontFamily:'var(--font-mono)',color:'var(--text2)'}}>{b?Math.round((b.mp as number)??0):'—'}</td>
                <td style={{padding:'4px 6px',textAlign:'right',fontFamily:'var(--font-mono)',fontWeight:700,color:'var(--blue)'}}>{fN(b?.pts)}</td>
                <td style={{padding:'4px 6px',textAlign:'right',fontFamily:'var(--font-mono)'}}>{fN(b?.trb)}</td>
                <td style={{padding:'4px 6px',textAlign:'right',fontFamily:'var(--font-mono)'}}>{fN(b?.ast)}</td>
                <td style={{padding:'4px 6px',textAlign:'right',fontFamily:'var(--font-mono)'}}>{fN(b?.stl)}</td>
                <td style={{padding:'4px 6px',textAlign:'right',fontFamily:'var(--font-mono)'}}>{fN(b?.blk)}</td>
                <td style={{padding:'4px 6px',textAlign:'right',fontFamily:'var(--font-mono)',color:((b?.tov as number)>3)?'var(--red)':'inherit'}}>{fN(b?.tov)}</td>
                <td style={{padding:'4px 6px',textAlign:'right',fontFamily:'var(--font-mono)',fontSize:10,whiteSpace:'nowrap'}}>{b?`${fN(b.fg)}/${fN(b.fga)}`:'—'}</td>
                <td style={{padding:'4px 6px',textAlign:'right',fontFamily:'var(--font-mono)'}}>{fN(b?.three_p)}</td>
                <td style={{padding:'4px 6px',textAlign:'right',fontFamily:'var(--font-mono)'}}>{b&&(b.fta as number)?`${fN(b.ft)}/${fN(b.fta)}`:'—'}</td>
                <td style={{padding:'4px 6px',textAlign:'right',fontFamily:'var(--font-mono)',fontWeight:700,color:'var(--blue)'}}>{b?Number(b.gmsc_computed).toFixed(1):Number(row.gmsc).toFixed(1)}</td>
                <td style={{padding:'4px 6px',textAlign:'center',fontSize:11}}>{row.event==='defend'?'🛡':row.event==='initial'?'👑':''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────
export default function PlayerModal({player,onClose}:{player:string;onClose:()=>void}){
  const [seasons,    setSeasons]    = useState<PlayerSeasonStats[]>([])
  const [games,      setGames]      = useState<PlayerGame[]>([])
  const [dists,      setDists]      = useState<Record<string,number[]>>({})
  const [distsTotal, setDistsTotal] = useState<Record<string,number[]>>({})
  const [careerRank, setCareerRank] = useState<number|null>(null)
  const [gmscSum,    setGmscSum]    = useState<number>(0)
  const [topThresholds, setTopThresholds] = useState<{t10:number;t100:number;t500:number;t1k:number}|null>(null)
  const [allSeasonData, setAllSeasonData] = useState<{player:string;season:number;gmsc_sum:number}[]>([])
  const [profile,    setProfile]    = useState('boxscore')
  const [radarMode,  setRadarMode]  = useState<'career'|'totals'|'best'>('career')
  const [customStats,setCustomStats]= useState<string[]>(['pts_avg','ast_avg','trb_avg','stl_avg','blk_avg'])
  const [subTab,     setSubTab]     = useState<'overview'|'radar'|'seasons'|'games'>('overview')
  const [gameSort,   setGameSort]   = useState({col:'date',dir:'desc' as 'asc'|'desc'})
  const [loading,    setLoading]    = useState(true)
  const [crownStats, setCrownStats] = useState<{total:number;defenses:number;maxStreak:number;losses:number}|null>(null)
  const [crownStints, setCrownStints] = useState<CrownStint[]>([])
  const [modalExpandedReigns, setModalExpandedReigns] = useState<Set<string>>(new Set())
  const [isCurrentCrownHolder, setIsCurrentCrownHolder] = useState(false)
  const [frMode, setFrMode] = useState<'totals'|'pergame'>('totals')
  const [allGoatRows, setAllGoatRows] = useState<GoatGameRow[]>([])
  const [goatLoaded,  setGoatLoaded]  = useState(false)

  useEffect(()=>{
    let cancelled=false
    async function load(){
      setLoading(true)
      const [s,g,dRes,rankRes,threshRes]=await Promise.all([
        supabase.from('player_season_stats').select('*').eq('player',player).order('season'),
        supabase.from('player_games').select('*').eq('player',player).order('date',{ascending:true}).limit(500),
        supabase.from('player_career_stats').select('pts_avg,ast_avg,trb_avg,stl_avg,blk_avg,tov_avg,fg_pct,three_p_pct,ft_pct,ts_pct,bpm_avg,pts_total,ast_total,trb_total,stl_total,blk_total,games').gte('games',10).limit(5000),
        supabase.from('player_career_stats').select('gmsc_sum').eq('player',player).single(),
        supabase.from('player_games').select('gmsc_computed').order('gmsc_computed',{ascending:false}).limit(1001),
      ])
      if(cancelled) return
      setSeasons((s.data as PlayerSeasonStats[])??[])
      setGames((g.data as PlayerGame[])??[])
      const myGmsc=(rankRes.data as {gmsc_sum:number}|null)?.gmsc_sum??0
      setGmscSum(myGmsc)
      // Build dist maps
      const ds:Record<string,number[]>={}, dsT:Record<string,number[]>={}
      if(dRes.data){
        const rows=dRes.data as Record<string,number>[]
        const remaps:Record<string,string>={fg_pct:'fg_pct_avg',three_p_pct:'three_p_pct_avg',ft_pct:'ft_pct_avg',ts_pct:'ts_pct_avg'}
        for(const k of ['pts_avg','ast_avg','trb_avg','stl_avg','blk_avg','tov_avg','bpm_avg','fg_pct','three_p_pct','ft_pct','ts_pct']){
          const mapped=remaps[k]??k
          const vals=rows.map(r=>r[k]).filter(v=>v!=null&&!isNaN(Number(v)))
          if(vals.length) ds[mapped]=vals
        }
        for(const k of ['pts_total','ast_total','trb_total','stl_total','blk_total']){
          const vals=rows.map(r=>r[k]).filter(v=>v!=null&&!isNaN(Number(v)))
          if(vals.length) dsT[k]=vals
        }
        dsT['fg_pct_avg']=ds['fg_pct_avg']
        dsT['three_p_pct_avg']=ds['three_p_pct_avg']
        dsT['ft_pct_avg']=ds['ft_pct_avg']
        dsT['ts_pct_avg']=ds['ts_pct_avg']
      }
      setDists(ds); setDistsTotal(dsT)
      if(threshRes.data){
        const sorted=(threshRes.data as {gmsc_computed:number}[]).map(r=>r.gmsc_computed).sort((a,b)=>b-a)
        setTopThresholds({t10:sorted[9]??0,t100:sorted[99]??0,t500:sorted[499]??0,t1k:sorted[999]??0})
      }
      setLoading(false)
      // Load crown stats — also load stints for Reign History
      // Check if this player is the current crown holder
      const {data:lastCrown} = await supabase.from('crown_history').select('crown_holder').order('date',{ascending:false}).limit(1)
      setIsCurrentCrownHolder(lastCrown?.[0]?.crown_holder === player)
      const {data:crownData} = await supabase.from('crown_history').select('*').eq('crown_holder',player).order('date',{ascending:true})
      if(crownData?.length){
        const cd=crownData as CrownHistoryRow[]
        const totalGames=cd.length  // every row = one game held
        const defenses=cd.filter(r=>r.event==='defend').length
        const maxStreak=Math.max(...cd.map(r=>r.streak))
        setCrownStats({total:totalGames,defenses,maxStreak,losses:0})
        // Build reign stints
        const reigns:CrownStint[]=[]
        let si=0
        while(si<cd.length){
          const stintRows:CrownHistoryRow[]=[]
          while(si<cd.length){stintRows.push(cd[si]);si++}
          // Actually stints are consecutive blocks — since we only have this player's rows, each "new" acquisition = new stint
          break
        }
        // Build stints properly: split on non-defend events (each new acquisition = new stint)
        const allStints:CrownStint[]=[]
        let cur:CrownHistoryRow[]=[]
        for(const row of cd){
          if(cur.length>0 && row.event!=='defend'){
            // This row starts a new stint — save old one first? No: each row IS a game in the stint
            // A stint = consecutive rows for this player. Since cd is already filtered to this player,
            // each row is one game. A "new stint" starts when event != defend (means they just acquired it)
            allStints.push({rows:cur,stintNum:allStints.length+1})
            cur=[]
          }
          cur.push(row)
        }
        if(cur.length>0) allStints.push({rows:cur,stintNum:allStints.length+1})
        setCrownStints(allStints)
      }
      // Phase 2: all season data for spaghetti + badges
      if(cancelled) return
      const allSeas:{player:string;season:number;gmsc_sum:number}[]=[]
      let from=0
      while(!cancelled){
        const {data}=await supabase.from('player_season_stats').select('player,season,gmsc_sum').range(from,from+999)
        if(!data||!data.length) break
        allSeas.push(...(data as {player:string;season:number;gmsc_sum:number}[]))
        if(data.length<1000) break
        from+=1000
        if(from>60000) break
      }
      if(cancelled) return
      setAllSeasonData(allSeas)
      const byPlayer=new Map<string,number>()
      for(const d of allSeas) byPlayer.set(d.player,(byPlayer.get(d.player)??0)+d.gmsc_sum)
      const sorted=[...byPlayer.values()].sort((a,b)=>b-a)
      const rank=sorted.findIndex(v=>Math.abs(v-myGmsc)<0.5)+1
      if(!cancelled) setCareerRank(rank>0?rank:null)

      // Phase 3: load all goat_game_rows for GOAT preset ranks + franchise table
      const BATCH=1000
      const goatRows:GoatGameRow[]=[]
      let gFrom=0
      while(!cancelled){
        const promises=Array.from({length:5},(_,i)=>
          supabase.from('goat_game_rows')
            .select('player,season,date,team,opp,result,pts,gmsc_computed,round,series_my_wins,series_opp_wins,era')
            .range(gFrom+i*BATCH, gFrom+(i+1)*BATCH-1)
        )
        const results=await Promise.all(promises)
        let anyData=false
        for(const {data} of results){
          if(data?.length){
            goatRows.push(...(data as GoatGameRow[]))
            anyData=true
          }
        }
        if(!cancelled) setAllGoatRows([...goatRows])
        const lastLen=results[results.length-1]?.data?.length??0
        if(!anyData||lastLen<BATCH) break
        gFrom+=5*BATCH
        if(gFrom>100000) break
      }
      if(!cancelled) setGoatLoaded(true)
    }
    load()
    return()=>{cancelled=true}
  },[player])

  // GOAT preset ranks across all players
  const goatRanks = useMemo(()=>{
    if(!allGoatRows.length) return null
    const presetKeys:Array<keyof typeof PRESETS> = ['raw','balanced','championship','clutch','prestige']
    const result:Record<string,{rank:number|null;score:number|null}>={}
    for(const key of presetKeys){
      const p=PRESETS[key]
      const weights={wT:p.wT,wE:p.wE,wR:p.wR,fB:p.fB,cB:p.cB,maxX:p.maxX,format:p.format}
      const lb=buildLeaderboard(allGoatRows,weights).sort((a,b)=>b.adjSum-a.adjSum)
      const rank=lb.findIndex(r=>r.player===player)+1
      const playerRow=lb.find(r=>r.player===player)
      const maxScore=lb[0]?.adjSum??1
      const score=playerRow?Math.round(playerRow.adjSum/maxScore*1000)/10:null
      result[key]={rank:rank>0?rank:null,score}
    }
    return result
  },[allGoatRows,player])

  // Per-franchise GOAT ranks
  const franchiseBreakdown = useMemo(()=>{
    if(!allGoatRows.length||!seasons.length) return []
    const franchises=[...new Set(seasons.map(s=>s.franchise))]
    const presetKeys:Array<keyof typeof PRESETS>=['balanced','championship','clutch','prestige']
    return franchises.map(fr=>{
      const frRows=allGoatRows.filter(r=>FRANCHISE_ROLLUP[r.team]===fr)
      const frSeasons=seasons.filter(s=>s.franchise===fr)
      const games=frSeasons.reduce((s,r)=>s+(r.games??0),0)
      const rawGmsc=frSeasons.reduce((s,r)=>s+(r.gmsc_sum??0),0)
      // Raw rank
      const rawW={wT:0,wE:0,wR:0,fB:0,cB:0,maxX:0,format:'modern'}
      const rawLb=buildLeaderboard(frRows,rawW).sort((a,b)=>b.adjSum-a.adjSum)
      const rawRank=rawLb.findIndex(r=>r.player===player)+1
      const rawPlayerRow=rawLb.find(r=>r.player===player)
      const rawMaxScore=rawLb[0]?.adjSum??1
      const rawScore=rawPlayerRow?Math.round(rawPlayerRow.adjSum/rawMaxScore*1000)/10:null
      // Preset ranks + scores
      const presetRanks:Record<string,{rank:number|null;score:number|null;pergameScore:number|null}>={}
      for(const key of presetKeys){
        const p=PRESETS[key]
        const w={wT:p.wT,wE:p.wE,wR:p.wR,fB:p.fB,cB:p.cB,maxX:p.maxX,format:p.format}
        const lb=buildLeaderboard(frRows,w).sort((a,b)=>b.adjSum-a.adjSum)
        const lbPg=[...lb].sort((a,b)=>b.adjAvg-a.adjAvg)
        const rank=lb.findIndex(r=>r.player===player)+1
        const pgRank=lbPg.findIndex(r=>r.player===player)+1
        const playerRow=lb.find(r=>r.player===player)
        const maxS=lb[0]?.adjSum??1
        const maxPg=lbPg[0]?.adjAvg??1
        const score=playerRow?Math.round(playerRow.adjSum/maxS*1000)/10:null
        const pgScore=playerRow?Math.round(playerRow.adjAvg/maxPg*1000)/10:null
        presetRanks[key]={
          rank:rank>0?rank:null,
          score,
          pergameScore:pgScore,
        }
      }
      return{franchise:fr,games,rawGmsc,rawRank:rawRank>0?rawRank:null,rawScore,presetRanks}
    }).sort((a,b)=>b.games-a.games)
  },[allGoatRows,seasons,player])

  // Derived
  const totalGames=seasons.reduce((s,r)=>s+(r.games??0),0)||1
  const totalWins=seasons.reduce((s,r)=>s+(r.wins??0),0)
  const championships=seasons.filter(s=>s.won_championship).length
  const finalsApp=seasons.filter(s=>s.finals_appearance).length
  const champSeasons=useMemo(()=>new Set(seasons.filter(s=>s.won_championship).map(s=>s.season)),[seasons])
  const finalsSeasons=useMemo(()=>new Set(seasons.filter(s=>s.finals_appearance).map(s=>s.season)),[seasons])
  const deepest=Math.max(...seasons.map(r=>r.deepest_round??0),0)

  const ca=(k:string)=>seasons.reduce((s,r)=>s+((r as unknown as Record<string,number>)[k]??0)*(r.games??0),0)/totalGames
  const career:Record<string,number>={
    pts_avg:ca('pts_avg'),ast_avg:ca('ast_avg'),trb_avg:ca('trb_avg'),
    stl_avg:ca('stl_avg'),blk_avg:ca('blk_avg'),tov_avg:ca('tov_avg'),bpm_avg:ca('bpm_avg'),
    fg_pct_avg:ca('fg_pct_avg'),three_p_pct_avg:ca('three_p_pct_avg'),
    ft_pct_avg:ca('ft_pct_avg'),ts_pct_avg:ca('ts_pct_avg'),
  }
  const bestSeason=seasons.reduce((b,s)=>!b||(s.gmsc_avg??0)>(b.gmsc_avg??0)?s:b,null as PlayerSeasonStats|null)
  const bestStats:Record<string,number>=bestSeason?{
    pts_avg:bestSeason.pts_avg,ast_avg:bestSeason.ast_avg,trb_avg:bestSeason.trb_avg,
    stl_avg:bestSeason.stl_avg,blk_avg:bestSeason.blk_avg,tov_avg:bestSeason.tov_avg,
    bpm_avg:bestSeason.bpm_avg??0,fg_pct_avg:bestSeason.fg_pct_avg,
    three_p_pct_avg:bestSeason.three_p_pct_avg,ft_pct_avg:bestSeason.ft_pct_avg,ts_pct_avg:bestSeason.ts_pct_avg,
  }:career
  const careerTotals:Record<string,number>={
    pts_avg:seasons.reduce((s,r)=>s+(r.pts_total??0),0),
    ast_avg:seasons.reduce((s,r)=>s+(r.ast_total??0),0),
    trb_avg:seasons.reduce((s,r)=>s+(r.trb_total??0),0),
    stl_avg:seasons.reduce((s,r)=>s+(r.stl_total??0),0),
    blk_avg:seasons.reduce((s,r)=>s+(r.blk_total??0),0),
    tov_avg:0,bpm_avg:0,
    fg_pct_avg:career.fg_pct_avg,three_p_pct_avg:career.three_p_pct_avg,
    ft_pct_avg:career.ft_pct_avg,ts_pct_avg:career.ts_pct_avg,
  }

  const bounds=useMemo(()=>({
    pts_avg:pctile(dists['pts_avg']??[],0.90),ast_avg:pctile(dists['ast_avg']??[],0.90),
    trb_avg:pctile(dists['trb_avg']??[],0.90),stl_avg:pctile(dists['stl_avg']??[],0.90),
    blk_avg:pctile(dists['blk_avg']??[],0.90),tov_avg:pctile(dists['tov_avg']??[],0.90),
    bpm_avg:pctile(dists['bpm_avg']??[],0.90),fg_pct_avg:pctile(dists['fg_pct_avg']??[],0.90),
    three_p_pct_avg:pctile(dists['three_p_pct_avg']??[],0.90),ft_pct_avg:pctile(dists['ft_pct_avg']??[],0.90),
    ts_pct_avg:pctile(dists['ts_pct_avg']??[],0.90),
  }),[dists])

  const totalsBounds=useMemo(()=>({
    pts_avg:pctile(distsTotal['pts_total']??[],0.90)||1,
    ast_avg:pctile(distsTotal['ast_total']??[],0.90)||1,
    trb_avg:pctile(distsTotal['trb_total']??[],0.90)||1,
    stl_avg:pctile(distsTotal['stl_total']??[],0.90)||1,
    blk_avg:pctile(distsTotal['blk_total']??[],0.90)||1,
    tov_avg:bounds.tov_avg*Math.max(1,totalGames),bpm_avg:bounds.bpm_avg,
    fg_pct_avg:bounds.fg_pct_avg,three_p_pct_avg:bounds.three_p_pct_avg,
    ft_pct_avg:bounds.ft_pct_avg,ts_pct_avg:bounds.ts_pct_avg,
  }),[bounds,distsTotal,totalGames])

  const radarStats=radarMode==='career'?career:radarMode==='totals'?careerTotals:bestStats
  const radarBounds=radarMode==='totals'?totalsBounds:bounds

  function pctCalc(k:string,v:number,distMap:Record<string,number[]>){
    const all=distMap[k]??[]
    return all.length?Math.round(all.filter(x=>x<v).length/all.length*100):50
  }

  const badges=useMemo(()=>{
    const bySeason=new Map<number,{player:string;gmsc_sum:number}[]>()
    for(const d of allSeasonData){const a=bySeason.get(d.season)??[];a.push(d);bySeason.set(d.season,a)}
    let gold=0,silver=0,bronze=0,top10s=0,top50s=0,top100s=0
    for(const s of seasons){
      const pool=(bySeason.get(s.season)??[]).sort((a,b)=>b.gmsc_sum-a.gmsc_sum)
      const rank=pool.findIndex(p=>p.player===player)+1
      if(rank===1) gold++; else if(rank===2) silver++; else if(rank===3) bronze++
      if(rank>=1&&rank<=10) top10s++
      if(rank>=1&&rank<=50) top50s++
      if(rank>=1&&rank<=100) top100s++
    }
    let g10=0,g100=0,g500=0,g1k=0
    if(topThresholds){
      for(const g of games){
        const gs=g.gmsc_computed
        if(gs>=topThresholds.t10) g10++
        else if(gs>=topThresholds.t100) g100++
        else if(gs>=topThresholds.t500) g500++
        else if(gs>=topThresholds.t1k) g1k++
      }
    }
    return{gold,silver,bronze,top10s,top50s,top100s,g10,g100,g500,g1k}
  },[allSeasonData,seasons,player,games,topThresholds])

  const highlights=useMemo(()=>{
    if(!games.length) return null
    const bestGame=[...games].sort((a,b)=>b.gmsc_computed-a.gmsc_computed)[0]
    const bestSeasonRow=seasons.reduce((b,s)=>!b||(s.gmsc_sum??0)>(b.gmsc_sum??0)?s:b,null as PlayerSeasonStats|null)
    const seriesMap=new Map<string,{g:PlayerGame[];total:number;team:string;opp:string}>()
    for(const g of games){
      const k=`${g.season}-R${g.round}`
      const cur=seriesMap.get(k)??{g:[],total:0,team:g.team,opp:g.opp}
      cur.g.push(g);cur.total+=g.gmsc_computed;seriesMap.set(k,cur)
    }
    const bestSeries=[...seriesMap.entries()].sort((a,b)=>b[1].total-a[1].total)[0]
    return{bestGame,bestSeasonRow,bestSeries}
  },[games,seasons])

  const sortedGames=useMemo(()=>[...games].sort((a,b)=>{
    const av=(a as unknown as Record<string,unknown>)[gameSort.col]
    const bv=(b as unknown as Record<string,unknown>)[gameSort.col]
    if(av==null&&bv==null) return 0; if(av==null) return 1; if(bv==null) return -1
    if(typeof av==='number'&&typeof bv==='number') return gameSort.dir==='asc'?av-bv:bv-av
    return gameSort.dir==='asc'?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av))
  }),[games,gameSort])

  function GameTh({col,children,right}:{col:string;children:React.ReactNode;right?:boolean}){
    const active=gameSort.col===col
    return(
      <th className="sortable" style={{textAlign:right?'right':'left'}}
        onClick={()=>setGameSort(gs=>({col,dir:gs.col===col&&gs.dir==='desc'?'asc':'desc'}))}>
        {children}{active?(gameSort.dir==='desc'?' ↓':' ↑'):''}
      </th>
    )
  }

  const fmtPct=(v:number|null)=>v!=null?(v*100).toFixed(1)+'%':'—'
  const gsAvg=(seasons.reduce((s,r)=>s+(r.gmsc_avg??0)*(r.games??0),0)/totalGames).toFixed(1)
  const dlabel=deepestLabel(deepest,championships)

  const STAT_ROW=[
    ['Games',String(totalGames)],['Wins',String(totalWins)],
    ['Win%',(totalWins/totalGames*100).toFixed(1)+'%'],
    ['PTS',career.pts_avg.toFixed(1)],['AST',career.ast_avg.toFixed(1)],
    ['REB',career.trb_avg.toFixed(1)],['STL',career.stl_avg.toFixed(1)],
    ['BLK',career.blk_avg.toFixed(1)],['FG%',fmtPct(career.fg_pct_avg)],
    ['TS%',fmtPct(career.ts_pct_avg)],['Deepest',dlabel],
  ]

  return(
    <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="modal" style={{maxWidth:960,borderRadius:'inherit'}}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {/* Header */}
        <div style={{background:'var(--blue)',borderRadius:'8px 8px 0 0',padding:'24px 28px 20px',color:'#fff'}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:16}}>
            <div>
              <h2 style={{fontSize:30,letterSpacing:'-0.01em',color:'#fff',marginBottom:8,fontFamily:'var(--font-head)'}}>{player}</h2>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {careerRank&&<span style={{background:'rgba(255,255,255,0.2)',borderRadius:3,padding:'3px 10px',fontSize:12,fontWeight:700,letterSpacing:'0.04em'}}>#{careerRank} All-Time</span>}
                {championships>0&&<span style={{background:'rgba(255,215,0,0.28)',borderRadius:3,padding:'3px 10px',fontSize:12,fontWeight:700}}>🏆 {championships}× Title</span>}
                {finalsApp>championships&&<span style={{background:'rgba(255,255,255,0.14)',borderRadius:3,padding:'3px 10px',fontSize:12,fontWeight:600}}>🥈 {finalsApp-championships}× Finals</span>}
                {seasons.length>0&&<span style={{background:'rgba(255,255,255,0.10)',borderRadius:3,padding:'3px 10px',fontSize:12,color:'rgba(255,255,255,0.75)',fontFamily:'var(--font-mono)'}}>{seasons[0].season}–{seasons[seasons.length-1].season}</span>}
              </div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',letterSpacing:'0.10em',textTransform:'uppercase',marginBottom:2}}>Career Game Score</div>
              <div style={{fontSize:34,fontWeight:700,color:'#fff',fontFamily:'var(--font-mono)',letterSpacing:'-0.02em'}}>{gmscSum.toFixed(1)}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',fontFamily:'var(--font-mono)'}}>{gsAvg} per game</div>
            </div>
          </div>
          <div style={{display:'flex',gap:0,borderTop:'1px solid rgba(255,255,255,0.12)',paddingTop:12,flexWrap:'wrap',rowGap:8,overflowX:'auto'}}>
            {STAT_ROW.map(([l,v],i,arr)=>(
              <div key={l} style={{paddingRight:14,marginRight:14,borderRight:i<arr.length-1?'1px solid rgba(255,255,255,0.10)':'none'}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',textTransform:'uppercase',letterSpacing:'0.09em',marginBottom:2}}>{l}</div>
                <div style={{fontSize:15,fontWeight:600,color:'#fff',whiteSpace:'nowrap',fontFamily:['Games','Wins'].includes(l)?'var(--font-mono)':'var(--font-body)'}}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-bar" style={{borderRadius:0,overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
          {([['overview','Overview'],['radar','Radar'],['seasons','By Season'],['games','Game Log']] as [string,string][]).map(([k,l])=>(
            <button key={k} className={`tab${subTab===k?' active':''}`} onClick={()=>setSubTab(k as typeof subTab)}>{l}</button>
          ))}
        </div>

        {loading?(<div className="loading"><div className="spinner"/>Loading…</div>):(
          <div style={{padding:'20px 24px',overflowY:'auto',maxHeight:'64vh'}}>

            {/* OVERVIEW */}
            {subTab==='overview'&&(
              <div>
                {/* Badges */}
                {(allSeasonData.length>0||topThresholds)&&(
                  <div style={{marginBottom:20,display:'grid',gridTemplateColumns:'auto 1fr',gap:'8px 16px',alignItems:'start'}}>
                    {[
                      ['ALL-TIME CAREER', [
                        careerRank?`#${careerRank} All-Time Career Game Score`:null,
                        goatRanks?.balanced?.rank?`#${goatRanks.balanced?.rank} Balanced GOAT`:null,
                        goatRanks?.championship?.rank?`#${goatRanks.championship?.rank} Championship DNA GOAT`:null,
                        goatRanks?.clutch?.rank?`#${goatRanks.clutch?.rank} Clutch Moments GOAT`:null,
                        goatRanks?.prestige?.rank?`#${goatRanks.prestige?.rank} Finals Prestige GOAT`:null,
                      ].filter(Boolean) as string[]],
                      ['POSTSEASON MEDALS',[
                        badges.gold>0?`🥇 ${badges.gold}× Gold — led postseason`:null,
                        badges.silver>0?`🥈 ${badges.silver}× Silver`:null,
                        badges.bronze>0?`🥉 ${badges.bronze}× Bronze`:null,
                      ].filter(Boolean) as string[]],
                      ['TOP SEASONS',[
                        badges.top10s>0?`${badges.top10s}× Top-10 Season`:null,
                        (badges.top50s-badges.top10s)>0?`${badges.top50s-badges.top10s}× Top-50 Season`:null,
                        (badges.top100s-badges.top50s)>0?`${badges.top100s-badges.top50s}× Top-100 Season`:null,
                      ].filter(Boolean) as string[]],
                      ['TOP GAMES',[
                        badges.g10>0?`${badges.g10}× Top-10 Game`:null,
                        badges.g100>0?`${badges.g100}× Top-100 Game`:null,
                        badges.g500>0?`${badges.g500}× Top-500 Game`:null,
                        badges.g1k>0?`${badges.g1k}× Top-1K Game`:null,
                      ].filter(Boolean) as string[]],
                      ...(crownStats&&crownStats.total>0?[
                        ['👑 THE CROWN', [
                          `${crownStats.total} Games Held`,
                          crownStats.defenses>0?`${crownStats.defenses} Successful Defenses`:null,
                          crownStats.maxStreak>1?`Best Streak: ${crownStats.maxStreak} Games`:null,
                        ].filter(Boolean) as string[]]
                      ]:[]),
                    ].filter(([,items])=>(items as string[]).length>0).map(([label,items])=>(
                      <><div key={label as string} style={{fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',paddingTop:4,whiteSpace:'nowrap'}}>{label as string}</div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        {(items as string[]).map(item=>(
                          <span key={item} style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:3,padding:'3px 10px',fontSize:12,fontWeight:500,color:'var(--text)'}}>{item}</span>
                        ))}
                      </div></>
                    ))}
                  </div>
                )}

                {/* Franchise breakdown table */}
                {franchiseBreakdown.length>0&&(
                  <div style={{marginBottom:20}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                      <div style={{fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase'}}>
                        Franchise Rankings{!goatLoaded&&<span style={{fontWeight:400,marginLeft:8}}>— loading…</span>}
                      </div>
                      <div style={{display:'flex',gap:0}}>
                        <button className={`btn${frMode==='totals'?' btn-active':''}`}
                          style={{fontSize:11,padding:'3px 10px',borderRadius:'4px 0 0 4px',borderRight:'none'}}
                          onClick={()=>setFrMode('totals')}>Career Totals</button>
                        <button className={`btn${frMode==='pergame'?' btn-active':''}`}
                          style={{fontSize:11,padding:'3px 10px',borderRadius:'0 4px 4px 0'}}
                          onClick={()=>setFrMode('pergame')}>Per Game</button>
                      </div>
                    </div>
                    <div style={{overflowX:'auto',borderRadius:5,border:'1px solid var(--border)'}}>
                      <table className="data-table" style={{fontSize:13}}>
                        <thead>
                          <tr>
                            <th style={{minWidth:170,fontSize:12}}>Franchise</th>
                            <th className="num" style={{fontSize:12}}>G</th>
                            <th className="num" style={{fontSize:12}}>Game Score</th>
                            <th className="num" style={{fontSize:12,color:'var(--text2)'}}>Raw</th>
                            <th className="num" style={{fontSize:12,color:'var(--text2)'}}>Balanced</th>
                            <th className="num" style={{fontSize:12,color:'var(--text2)'}}>Champ DNA</th>
                            <th className="num" style={{fontSize:12,color:'var(--text2)'}}>Clutch</th>
                            <th className="num" style={{fontSize:12,color:'var(--text2)'}}>Prestige</th>
                          </tr>
                        </thead>
                        <tbody>
                          {franchiseBreakdown.map(fr=>(
                            <tr key={fr.franchise}>
                              <td style={{fontWeight:500,fontSize:13}}>{FRANCHISE_NAMES[fr.franchise]??fr.franchise}</td>
                              <td className="num" style={{fontSize:13}}>{fr.games}</td>
                              <td className="num blue" style={{fontSize:13}}>{fr.rawGmsc.toFixed(1)}</td>
                              {goatLoaded?(
                                <>
                                  <td className="num" style={{fontSize:13}}>
                                    {fr.rawRank?(<><span style={{color:'var(--text2)',fontWeight:600}}>#{fr.rawRank}</span><br/><span style={{fontSize:11,color:'var(--gold)'}}>{fr.rawScore?.toFixed(1)}</span></>):'—'}
                                  </td>
                                  {(['balanced','championship','clutch','prestige'] as const).map(key=>{
                                    const pr=fr.presetRanks[key]
                                    const rank=pr?.rank
                                    const score=frMode==='pergame'?pr?.pergameScore:pr?.score
                                    return(
                                      <td key={key} className="num" style={{fontSize:13}}>
                                        {rank?(<><span style={{color:'var(--text2)',fontWeight:600}}>#{rank}</span><br/><span style={{fontSize:11,color:'var(--gold)'}}>{score?.toFixed(1)??'—'}</span></>):'—'}
                                      </td>
                                    )
                                  })}
                                </>
                              ):(
                                <td className="num" colSpan={5} style={{color:'var(--text3)',fontStyle:'italic',textAlign:'center',fontSize:12}}>loading…</td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{fontSize:11,color:'var(--text3)',marginTop:6}}>
                      Score = 0–100 within each franchise. {frMode==='pergame'?'Per-game mode: normalized by per-game average.':'Career totals mode: normalized by total adjusted score.'}
                    </div>
                  </div>
                )}


                                {/* Reign History */}
                {crownStints.length>0&&(
                  <div style={{marginBottom:20}}>
                    <div style={{fontFamily:'var(--font-head)',fontSize:14,fontWeight:700,color:'var(--blue)',marginBottom:8,borderTop:'2px solid var(--text)',paddingTop:8}}>
                      👑 Reign History — {crownStints.length} {crownStints.length===1?'Reign':'Reigns'}
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {crownStints.slice().reverse().map((stint,ridx)=>{
                        const games=stint.rows.length
                        const start=(stint.rows[0] as CrownHistoryRow).date
                        const end=(stint.rows[stint.rows.length-1] as CrownHistoryRow).date
                        const team=(stint.rows[0] as CrownHistoryRow).crown_team
                        const acquireEvent=(stint.rows[0] as CrownHistoryRow).event
                        const n=stint.stintNum
                        function toRomanM(num:number):string{
                          const v=[1000,900,500,400,100,90,50,40,10,9,5,4,1]
                          const s=['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I']
                          let r='',i=0;while(num>0){while(num>=v[i]){r+=s[i];num-=v[i]}i++}
                          return r
                        }
                        // Is this the current/active reign? (most recent = ridx===0, not yet dethroned)
                        const isActive=ridx===0&&isCurrentCrownHolder
                        const accentColor=isActive?'#9A6E1C':games>=5?'var(--gold)':games>=3?'var(--blue)':'var(--text3)'
                        const borderColor=isActive?'#9A6E1C':games>=5?'#9A6E1C':games>=3?'var(--blue)':'var(--border)'
                        const headerBg=isActive?'rgba(154,110,28,0.13)':games>=5?'rgba(154,110,28,0.10)':games>=3?'rgba(27,46,94,0.08)':'var(--surface2)'
                        const cardKey=`modal-reign-${n}`
                        const isExpanded=modalExpandedReigns.has(cardKey)
                        const eventLabel=acquireEvent==='initial'?'First Ever':acquireEvent==='new_season'?'New Season':acquireEvent==='transfer_loss'?'Wrested Away':'From Teammate'
                        return(
                          <div key={n} style={{
                            border:isActive?`2px solid #9A6E1C`:`1px solid ${borderColor}`,
                            borderLeft:isActive?`5px solid #9A6E1C`:`4px solid ${borderColor}`,
                            borderRadius:4,overflow:'hidden',
                            marginLeft:isActive?-14:0,marginRight:isActive?-14:0,
                            marginBottom:isActive?12:0,
                            boxShadow:isActive?'0 4px 20px rgba(154,110,28,0.22)':games>=5?'0 2px 8px rgba(154,110,28,0.10)':undefined
                          }}>
                            {/* Header */}
                            <div style={{padding:isActive?'14px 16px':'9px 12px',background:headerBg,cursor:'pointer',display:'flex',alignItems:'flex-start',gap:10}}
                              onClick={()=>setModalExpandedReigns(s=>{const ns=new Set(s);ns.has(cardKey)?ns.delete(cardKey):ns.add(cardKey);return ns})}>
                              <div style={{fontSize:isActive?20:games>=5?18:games>=3?16:14,lineHeight:1,flexShrink:0,paddingTop:1}}>
                                {isActive?'👑':games>=5?'🏅':'🔸'}
                              </div>
                              <div style={{flex:1,minWidth:0}}>
                                {isActive&&(
                                  <span style={{background:'#9A6E1C',color:'#fff',fontSize:9,fontWeight:700,letterSpacing:'0.10em',textTransform:'uppercase',padding:'2px 8px',borderRadius:2,display:'inline-block',marginBottom:4}}>
                                    ⚔ Active Reign
                                  </span>
                                )}
                                <div style={{fontFamily:'var(--font-reign)',fontSize:isActive?18:games>=5?15:games>=3?13:12,fontWeight:800,color:accentColor,marginBottom:2,letterSpacing:'0.03em'}}>
                                  King {player} {toRomanM(n)}
                                </div>
                                <div style={{display:'flex',gap:8,fontSize:11,color:'var(--text2)',flexWrap:'wrap'}}>
                                  <span style={{fontFamily:'var(--font-mono)'}}>{start}{start!==end?` – ${end}`:''}</span>
                                  <span>·</span><span>{FRANCHISE_NAMES[team]??team}</span>
                                  <span>·</span>
                                  <span style={{color:accentColor,fontWeight:600}}>{games}g {games>=5?'⚡':games>=3?'🔥':''}</span>
                                  <span style={{color:'var(--text3)'}}>{eventLabel}</span>
                                </div>
                              </div>
                              <span style={{fontSize:10,color:'var(--text3)',flexShrink:0}}>{isExpanded?'▲':'▼'}</span>
                            </div>
                            {/* Expanded box score */}
                            {isExpanded&&(
                              <div style={{padding:'8px 12px',borderTop:`1px solid ${borderColor}`}}>
                                <ModalReignGameLog player={player} crownRows={stint.rows as CrownHistoryRow[]}/>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {/* Career Highlights */}
                {highlights&&(
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:20}}>
                    <div className="card2" style={{padding:14}}>
                      <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:8}}>Best Game</div>
                      <div style={{fontSize:22,fontWeight:700,color:'var(--blue)',marginBottom:2,fontFamily:'var(--font-mono)'}}>{highlights.bestGame.gmsc_computed.toFixed(1)}</div>
                      <div style={{fontSize:10,color:'var(--text3)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.06em'}}>Game Score</div>
                      <div style={{fontSize:12,fontWeight:600,color:'var(--text)',marginBottom:2}}>{highlights.bestGame.date}</div>
                      <div style={{fontSize:12,color:'var(--text2)',marginBottom:2}}>{teamName(highlights.bestGame.team)} vs. {teamName(highlights.bestGame.opp)}</div>
                      <div style={{fontSize:11,color:'var(--text3)',marginBottom:6}}>Round {highlights.bestGame.round} · {highlights.bestGame.result==='W'?'Win':'Loss'}</div>
                      <div style={{fontSize:12,color:'var(--text2)',fontFamily:'var(--font-mono)'}}>{highlights.bestGame.pts} PTS · {highlights.bestGame.ast} AST · {highlights.bestGame.trb} REB</div>
                    </div>
                    {highlights.bestSeasonRow&&(
                      <div className="card2" style={{padding:14}}>
                        <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:8}}>Best Postseason</div>
                        <div style={{fontSize:22,fontWeight:700,color:'var(--blue)',marginBottom:2,fontFamily:'var(--font-mono)'}}>{highlights.bestSeasonRow.gmsc_sum?.toFixed(1)}</div>
                        <div style={{fontSize:10,color:'var(--text3)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.06em'}}>Total Game Score</div>
                        <div style={{fontSize:12,fontWeight:600,color:'var(--text)',marginBottom:2}}>{highlights.bestSeasonRow.season}</div>
                        <div style={{fontSize:12,color:'var(--text2)',marginBottom:2}}>{teamName(highlights.bestSeasonRow.franchise)}</div>
                        <div style={{fontSize:11,color:'var(--text3)',marginBottom:6}}>{highlights.bestSeasonRow.games} games · {highlights.bestSeasonRow.gmsc_avg?.toFixed(1)}/game</div>
                        <div style={{fontSize:12}}>{highlights.bestSeasonRow.won_championship?'🏆 Title':highlights.bestSeasonRow.finals_appearance?'🥈 Finals':''}</div>
                      </div>
                    )}
                    {highlights.bestSeries&&(()=>{
                      const [key,{g:sg,total,team,opp}]=highlights.bestSeries
                      const [season,rnd]=key.split('-')
                      const wins=sg.filter(g=>g.result==='W').length
                      return(
                        <div className="card2" style={{padding:14}}>
                          <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:8}}>Best Series</div>
                          <div style={{fontSize:22,fontWeight:700,color:'var(--blue)',marginBottom:2,fontFamily:'var(--font-mono)'}}>{total.toFixed(1)}</div>
                          <div style={{fontSize:10,color:'var(--text3)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.06em'}}>Total Game Score</div>
                          <div style={{fontSize:12,fontWeight:600,color:'var(--text)',marginBottom:2}}>{season} · {rnd}</div>
                          <div style={{fontSize:12,color:'var(--text2)',marginBottom:2}}>{teamName(team)} vs. {teamName(opp)}</div>
                          <div style={{fontSize:11,color:'var(--text3)',marginBottom:6}}>{sg.length} games · {wins}W–{sg.length-wins}L</div>
                          <div style={{fontSize:12,color:'var(--text2)',fontFamily:'var(--font-mono)'}}>{(total/sg.length).toFixed(1)} per game</div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Season Game Score Total */}
                <div className="card" style={{padding:'14px 16px',marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text2)'}}>Season Game Score Total</div>
                    <div style={{fontSize:11,color:'var(--text3)'}}>All players in background · {player} highlighted</div>
                  </div>
                  <SeasonChart allData={allSeasonData} player={player} playerSeasons={seasons}/>
                </div>

                {/* Game Score Distribution */}
                <div className="card" style={{padding:'14px 16px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text2)'}}>Game Score Distribution</div>
                    <div style={{fontSize:11,color:'var(--text3)'}}>{games.length} career games · 2.5pt buckets · dashed = player mean</div>
                  </div>
                  <DistributionChart games={games}/>
                </div>
              </div>
            )}

            {/* RADAR */}
            {subTab==='radar'&&(
              <div style={{display:'grid',gridTemplateColumns:'minmax(0,300px) 1fr',gap:24}}>
                <div>
                  <div style={{display:'flex',gap:4,marginBottom:8,flexWrap:'wrap'}}>
                    {Object.entries(PROFILES).map(([k,p])=>(
                      <button key={k} className={`btn${profile===k?' btn-active':''}`} style={{fontSize:11,padding:'3px 8px'}} onClick={()=>setProfile(k)}>{p.label}</button>
                    ))}
                  </div>
                  {profile==='choose'&&(
                    <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8,padding:8,background:'var(--surface2)',borderRadius:4,border:'1px solid var(--border)'}}>
                      {ALL_STAT_KEYS.map(k=>{
                        const on=customStats.includes(k)
                        return(
                          <button key={k} className={`btn${on?' btn-active':''}`}
                            style={{fontSize:10,padding:'2px 6px',opacity:!on&&customStats.length>=7?0.4:1}}
                            onClick={()=>{
                              if(on) setCustomStats(cs=>cs.filter(s=>s!==k))
                              else if(customStats.length<7) setCustomStats(cs=>[...cs,k])
                            }}>
                            {STAT_LABELS[k]}
                          </button>
                        )
                      })}
                      <span style={{fontSize:10,color:'var(--text3)',alignSelf:'center',marginLeft:2}}>max 7</span>
                    </div>
                  )}
                  <div style={{display:'flex',gap:4,marginBottom:12}}>
                    {[['career','Career Avg'],['totals','Career Totals'],['best',`Best (${bestSeason?.season??'—'})`]].map(([m,l])=>(
                      <button key={m} className={`btn${radarMode===m?' btn-active':''}`}
                        style={{fontSize:11,flex:1,justifyContent:'center'}} onClick={()=>setRadarMode(m as typeof radarMode)}>{l}</button>
                    ))}
                  </div>
                  <RadarChart stats={radarStats} profile={profile} bounds={radarBounds} customStats={customStats}/>
                  <div style={{fontSize:10,color:'var(--text3)',textAlign:'center',marginTop:4}}>
                    {radarMode==='totals'?'Outer ring = 90th pct career totals':'Outer ring = 90th pct per-game · 10+ game players'}
                  </div>
                </div>
                <div>
                  <div style={{marginBottom:10,fontSize:10,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>
                    Percentile vs Qualified Players (10+ games)
                  </div>
                  {radarMode==='totals'&&(
                    <div style={{fontSize:11,color:'var(--blue)',background:'var(--blue-dim)',border:'1px solid rgba(29,52,97,.15)',borderRadius:3,padding:'5px 8px',marginBottom:10,lineHeight:1.5}}>
                      Comparing career totals vs. all qualified players
                    </div>
                  )}
                  {radarMode==='best'&&(
                    <div style={{fontSize:11,color:'var(--text3)',marginBottom:10,lineHeight:1.5}}>
                      Comparing {bestSeason?.season??'best'} season per-game stats
                    </div>
                  )}
                  {radarMode==='totals'
                    ? [['PTS','pts_total'],['AST','ast_total'],['REB','trb_total'],['STL','stl_total'],['BLK','blk_total'],['FG%','fg_pct_avg'],['TS%','ts_pct_avg'],['BPM','bpm_avg']].map(([l,k])=>{
                        const isTot=['pts_total','ast_total','trb_total','stl_total','blk_total'].includes(k)
                        const statKey=isTot?k.replace('_total','_avg'):k
                        const val=isTot?careerTotals[statKey]??0:career[k]??0
                        const distMap=isTot?distsTotal:dists
                        return <PctBar key={k} label={l} value={val} p={pctCalc(k,val,distMap)} isPct={IS_PCT[k]}/>
                      })
                    : radarMode==='best'
                    ? [['PTS','pts_avg'],['AST','ast_avg'],['REB','trb_avg'],['STL','stl_avg'],['BLK','blk_avg'],['FG%','fg_pct_avg'],['TS%','ts_pct_avg'],['BPM','bpm_avg']].map(([l,k])=>(
                        <PctBar key={k} label={l} value={bestStats[k]??0} p={pctCalc(k,bestStats[k]??0,dists)} isPct={IS_PCT[k]}/>
                      ))
                    : [['PTS','pts_avg'],['AST','ast_avg'],['REB','trb_avg'],['STL','stl_avg'],['BLK','blk_avg'],['FG%','fg_pct_avg'],['TS%','ts_pct_avg'],['BPM','bpm_avg']].map(([l,k])=>(
                        <PctBar key={k} label={l} value={career[k]??0} p={pctCalc(k,career[k]??0,dists)} isPct={IS_PCT[k]}/>
                      ))
                  }
                  <div style={{marginTop:10,fontSize:11,color:'var(--text3)'}}>
                    Among {(dists['pts_avg']?.length??0).toLocaleString()} qualified players
                  </div>
                </div>
              </div>
            )}

            {/* BY SEASON */}
            {subTab==='seasons'&&(
              <div style={{overflowX:'auto'}}>
                <table className="data-table">
                  <thead><tr>
                    <th></th><th>Season</th><th>Franchise</th>
                    <th className="num">G</th><th className="num">W</th><th className="num">W%</th>
                    <th className="num">PTS</th><th className="num">AST</th><th className="num">REB</th>
                    <th className="num">STL</th><th className="num">BLK</th><th className="num">TOV</th>
                    <th className="num">FG%</th><th className="num">3P%</th><th className="num">FT%</th>
                    <th className="num">TS%</th><th className="num">MIN</th>
                    <th className="num">GS/G</th><th className="num">GS Tot</th><th className="num">BPM</th>
                  </tr></thead>
                  <tbody>
                    {seasons.map(r=>{
                      const isC=champSeasons.has(r.season),isF=finalsSeasons.has(r.season)
                      return(
                        <tr key={r.season} style={{background:isC?'rgba(154,110,28,0.08)':undefined}}>
                          <td style={{fontSize:15,width:28}}>{isC?'🏆':isF?'🥈':''}</td>
                          <td style={{fontWeight:700,color:isC?'var(--gold)':'var(--blue)',fontFamily:'var(--font-mono)'}}>{r.season}</td>
                          <td style={{fontSize:12}}>{historicalName(r.franchise, r.season)}</td>
                          <td className="num">{r.games}</td><td className="num win">{r.wins}</td>
                          <td className="num">{r.win_pct!=null?Number(r.win_pct).toFixed(1)+'%':'—'}</td>
                          <td className="num blue">{r.pts_avg?.toFixed(1)}</td>
                          <td className="num">{r.ast_avg?.toFixed(1)}</td><td className="num">{r.trb_avg?.toFixed(1)}</td>
                          <td className="num">{r.stl_avg?.toFixed(1)}</td><td className="num">{r.blk_avg?.toFixed(1)}</td>
                          <td className="num">{r.tov_avg?.toFixed(1)}</td>
                          <td className="num">{fmtPct(r.fg_pct_avg)}</td><td className="num">{fmtPct(r.three_p_pct_avg)}</td>
                          <td className="num">{fmtPct(r.ft_pct_avg)}</td><td className="num">{fmtPct(r.ts_pct_avg)}</td>
                          <td className="num">{r.mp_avg?.toFixed(1)}</td>
                          <td className="num blue">{r.gmsc_avg?.toFixed(1)}</td>
                          <td className="num blue">{r.gmsc_sum?.toFixed(1)}</td>
                          <td className="num">{r.bpm_avg?.toFixed(1)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* GAME LOG */}
            {subTab==='games'&&(
              <div style={{overflowX:'auto'}}>
                <table className="data-table">
                  <thead><tr>
                    <GameTh col="date">Date</GameTh><th>Team</th><th>Opp</th>
                    <GameTh col="result">W/L</GameTh><GameTh col="round" right>Rnd</GameTh>
                    <th>Series</th>
                    <GameTh col="pts" right>PTS</GameTh><GameTh col="ast" right>AST</GameTh>
                    <GameTh col="trb" right>REB</GameTh><GameTh col="stl" right>STL</GameTh>
                    <GameTh col="blk" right>BLK</GameTh><GameTh col="tov" right>TOV</GameTh>
                    <GameTh col="fg_pct" right>FG%</GameTh><GameTh col="three_p" right>3PM</GameTh>
                    <GameTh col="ts_pct" right>TS%</GameTh><GameTh col="mp" right>MIN</GameTh>
                    <GameTh col="gmsc_computed" right>Game Score</GameTh>
                    <GameTh col="bpm" right>BPM</GameTh><GameTh col="plus_minus" right>+/-</GameTh>
                  </tr></thead>
                  <tbody>
                    {sortedGames.map(g=>{
                      const isChamp=champSeasons.has(g.season)&&g.result==='W'&&g.series_my_wins===3
                      return(
                        <tr key={g.id} style={{background:isChamp?'rgba(154,110,28,0.07)':undefined}}>
                          <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{g.date}</td>
                          <td><span className="tag tag-dim">{g.team}</span></td>
                          <td style={{color:'var(--text2)'}}>{g.opp}</td>
                          <td className={g.result==='W'?'win':'loss'}>{g.result}</td>
                          <td className="num">{g.round}</td>
                          <td style={{fontSize:11,color:'var(--text2)',fontFamily:'var(--font-mono)'}}>G{g.series_my_wins+g.series_opp_wins+1} ({Math.max(g.series_my_wins,g.series_opp_wins)}–{Math.min(g.series_my_wins,g.series_opp_wins)})</td>
                          <td className="num blue">{g.pts??'—'}</td>
                          <td className="num">{g.ast??'—'}</td><td className="num">{g.trb??'—'}</td>
                          <td className="num">{g.stl??'—'}</td><td className="num">{g.blk??'—'}</td>
                          <td className="num">{g.tov??'—'}</td>
                          <td className="num">{fmtPct(g.fg_pct)}</td><td className="num">{g.three_p??'—'}</td>
                          <td className="num">{fmtPct(g.ts_pct)}</td>
                          <td className="num">{g.mp!=null?Math.round(g.mp):'—'}</td>
                          <td className="num blue">{g.gmsc_computed.toFixed(1)}</td>
                          <td className="num">{g.bpm!=null?g.bpm.toFixed(1):'—'}</td>
                          <td className="num" style={{color:(g.plus_minus??0)>=0?'var(--green)':'var(--red)'}}>
                            {g.plus_minus!=null?(g.plus_minus>=0?'+':'')+g.plus_minus:'—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
