'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { FRANCHISE_NAMES, FRANCHISE_ROLLUP } from '@/lib/franchise'
import PlayerModal from '@/components/PlayerModal'

type CrownRow = {
  id: number; date: string; season: number; team: string; opp: string
  event: string; crown_holder: string; crown_team: string
  prev_holder: string; prev_team: string; gmsc: number; streak: number; total_games: number
}

type Possession = {
  player: string; team: string; franchise: string
  startDate: string; endDate: string
  games: number; season: number; event: string
}

type PlayerStats = {
  player: string; totalGames: number; possessions: number
  defenses: number; losses: number; maxStreak: number; avgGames: number
  teams: string[]
}

type FranchiseStat = {
  franchise: string; name: string; totalGames: number
  uniqueHolders: number; topHolder: string; topHolderGames: number
}

const EVENT_LABEL: Record<string,string> = {
  initial:           '👑 First Ever',
  defend:            '🛡 Defended',
  transfer_teammate: '🔄 To Teammate',
  transfer_loss:     '⚔️ Wrested Away',
  new_season:        '🆕 New Season',
}
const EVENT_COLOR: Record<string,string> = {
  initial:           'var(--gold)',
  defend:            'var(--green)',
  transfer_teammate: 'var(--blue2)',
  transfer_loss:     'var(--red)',
  new_season:        'var(--text3)',
}
const EVENT_BG: Record<string,string> = {
  initial:           'rgba(154,110,28,0.08)',
  defend:            'rgba(45,106,79,0.05)',
  transfer_teammate: 'rgba(40,80,160,0.06)',
  transfer_loss:     'rgba(139,32,32,0.05)',
  new_season:        'rgba(100,100,100,0.04)',
}

// ── Vertical Timeline ───────────────────────────────────────────────────────
function VerticalTimeline({ rows, onPlayer }: { rows: CrownRow[]; onPlayer: (p:string)=>void }) {
  const [search, setSearch] = useState('')
  const [onlyTransfers, setOnlyTransfers] = useState(false)

  const filtered = useMemo(()=> rows.filter(r => {
    if (search && !r.crown_holder.toLowerCase().includes(search.toLowerCase()) &&
        !(r.prev_holder||'').toLowerCase().includes(search.toLowerCase())) return false
    if (onlyTransfers && r.event === 'defend') return false
    return true
  }), [rows, search, onlyTransfers])

  let lastSeason = 0

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      {/* Toolbar */}
      <div style={{padding:'10px 20px',display:'flex',gap:10,alignItems:'center',borderBottom:'1px solid var(--border)',flexShrink:0,flexWrap:'wrap',background:'var(--surface)'}}>
        <input type="search" placeholder="Filter player…" value={search} onChange={e=>setSearch(e.target.value)}
          style={{width:180,fontSize:12,padding:'5px 8px'}}/>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text2)',cursor:'pointer'}}>
          <input type="checkbox" checked={onlyTransfers} onChange={e=>setOnlyTransfers(e.target.checked)}/>
          Transfers only
        </label>
        <span style={{fontSize:11,color:'var(--text3)',marginLeft:'auto'}}>{filtered.length} events · scroll to journey through history</span>
      </div>

      {/* Scrollable timeline */}
      <div style={{flex:1,overflowY:'auto',padding:'0 0 40px 0'}}>
        <div style={{maxWidth:680,margin:'0 auto',padding:'0 20px'}}>
          {filtered.map((r, i) => {
            const showSeasonBreak = r.season !== lastSeason
            if (showSeasonBreak) lastSeason = r.season
            const isTransfer = r.event !== 'defend'
            const isNew = r.event === 'initial' || r.event === 'new_season'

            return (
              <div key={r.id}>
                {/* Season break */}
                {showSeasonBreak && (
                  <div style={{display:'flex',alignItems:'center',gap:12,margin:'28px 0 20px',position:'relative'}}>
                    <div style={{flex:1,height:1,background:'var(--border)'}}/>
                    <div style={{
                      background:'var(--blue)', color:'#fff',
                      fontFamily:'var(--font-head)', fontSize:15, fontWeight:700,
                      padding:'4px 16px', borderRadius:20, letterSpacing:'0.04em',
                      flexShrink:0, boxShadow:'0 2px 8px rgba(29,52,97,0.25)'
                    }}>
                      {r.season} Playoffs
                    </div>
                    <div style={{flex:1,height:1,background:'var(--border)'}}/>
                  </div>
                )}

                {/* Timeline entry */}
                <div style={{display:'flex',gap:0,marginBottom:6}}>
                  {/* Left: date column */}
                  <div style={{width:86,flexShrink:0,textAlign:'right',paddingRight:14,paddingTop:14}}>
                    <div style={{fontSize:10,fontFamily:'var(--font-mono)',color:'var(--text3)',lineHeight:1.4}}>
                      {r.date.slice(5)}
                    </div>
                    <div style={{fontSize:9,color:'var(--border2)',fontFamily:'var(--font-mono)'}}>{r.date.slice(0,4)}</div>
                  </div>

                  {/* Center: line + dot */}
                  <div style={{width:28,flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center'}}>
                    <div style={{
                      width: isNew?14:isTransfer?12:10,
                      height: isNew?14:isTransfer?12:10,
                      borderRadius:'50%',
                      background: EVENT_COLOR[r.event]??'var(--border)',
                      border:`2px solid var(--surface)`,
                      marginTop:14, flexShrink:0, zIndex:1,
                      boxShadow: isTransfer?`0 0 0 3px ${EVENT_COLOR[r.event]}22`:'none'
                    }}/>
                    <div style={{width:1,flex:1,background:'var(--border)',marginTop:3}}/>
                  </div>

                  {/* Right: content card */}
                  <div style={{flex:1,paddingLeft:12,paddingBottom:6}}>
                    <div style={{
                      background: EVENT_BG[r.event]??'var(--surface2)',
                      border:`1px solid ${isTransfer&&!r.event.includes('defend')?EVENT_COLOR[r.event]+'33':'var(--border)'}`,
                      borderRadius:8, padding:'10px 14px', marginBottom:2,
                    }}>
                      {/* Event badge */}
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                        <span style={{
                          fontSize:10, fontWeight:700, color:EVENT_COLOR[r.event]??'var(--text3)',
                          textTransform:'uppercase', letterSpacing:'0.07em'
                        }}>
                          {EVENT_LABEL[r.event]??r.event}
                        </span>
                        {r.streak>1&&(
                          <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--font-mono)'}}>
                            {r.streak}-game streak
                          </span>
                        )}
                      </div>

                      {/* Player name */}
                      <div style={{
                        fontFamily:'var(--font-head)', fontSize:isTransfer?18:15,
                        fontWeight:700, color:'var(--blue)', cursor:'pointer', marginBottom:3, lineHeight:1.2
                      }} onClick={()=>onPlayer(r.crown_holder)}>
                        👑 {r.crown_holder}
                      </div>

                      {/* Subline */}
                      <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
                        <span style={{fontSize:12,color:'var(--text2)'}}>{FRANCHISE_NAMES[r.crown_team]??r.crown_team}</span>
                        <span style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--font-mono)'}}>
                          GmSc {Number(r.gmsc).toFixed(1)} vs {r.opp}
                        </span>
                        {r.prev_holder && r.prev_holder !== r.crown_holder && (
                          <span style={{fontSize:11,color:'var(--text3)'}}>
                            from{' '}
                            <span style={{cursor:'pointer',textDecoration:'underline dotted',color:'var(--text2)'}}
                              onClick={()=>onPlayer(r.prev_holder)}>{r.prev_holder}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* End of timeline */}
          <div style={{textAlign:'center',padding:'32px 0 16px',color:'var(--text3)',fontSize:12}}>
            ── 1947–2026 · {rows.length} crown events ──
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function CrownPage() {
  const [rows, setRows]       = useState<CrownRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'leaderboard'|'timeline'|'franchise'>('leaderboard')
  const [lbSort, setLbSort]   = useState<'totalGames'|'defenses'|'maxStreak'|'avgGames'|'possessions'>('totalGames')
  const [search, setSearch]   = useState('')
  const [modal, setModal]     = useState<string|null>(null)

  useEffect(()=>{
    async function load() {
      setLoading(true)
      const all: CrownRow[] = []
      let from = 0
      while (true) {
        const {data} = await supabase.from('crown_history').select('*').order('date',{ascending:true}).range(from,from+999)
        if (!data||!data.length) break
        all.push(...(data as CrownRow[]))
        if (data.length < 1000) break
        from += 1000
      }
      setRows(all)
      setLoading(false)
    }
    load()
  },[])

  // ── Possessions ─────────────────────────────────────────────────────────
  const possessions = useMemo((): Possession[] => rows.map((r,i) => ({
    player: r.crown_holder, team: r.crown_team,
    franchise: FRANCHISE_ROLLUP[r.crown_team]??r.crown_team,
    startDate: r.date, endDate: rows[i+1]?.date??r.date,
    games: r.streak, season: r.season, event: r.event,
  })), [rows])

  // ── Player stats ─────────────────────────────────────────────────────────
  const playerStats = useMemo((): PlayerStats[] => {
    const map = new Map<string,{games:number;poss:number;def:number;loss:number;maxStreak:number;teams:Set<string>}>()
    for (const r of rows) {
      const s = map.get(r.crown_holder) ?? {games:0,poss:0,def:0,loss:0,maxStreak:0,teams:new Set()}
      s.games += 1; s.poss++; s.teams.add(r.crown_team)
      if (r.event==='defend') s.def++
      s.maxStreak = Math.max(s.maxStreak, r.streak)
      map.set(r.crown_holder, s)
    }
    // count losses
    for (let i=0;i<rows.length-1;i++) {
      const cur=rows[i], nxt=rows[i+1]
      if (nxt.crown_holder!==cur.crown_holder && nxt.prev_holder===cur.crown_holder) {
        const s=map.get(cur.crown_holder); if(s) s.loss++
      }
    }
    return Array.from(map.entries()).map(([player,s]) => ({
      player, totalGames:s.games, possessions:s.poss,
      defenses:s.def, losses:s.loss, maxStreak:s.maxStreak,
      avgGames: s.poss>0 ? Math.round(s.games/s.poss*10)/10 : 0,
      teams:[...s.teams],
    }))
  }, [rows])

  // ── Franchise stats ──────────────────────────────────────────────────────
  const franchiseStats = useMemo((): FranchiseStat[] => {
    const map = new Map<string,{games:number;holders:Map<string,number>}>()
    for (const p of possessions) {
      const fr = p.franchise
      const s = map.get(fr) ?? {games:0,holders:new Map()}
      s.games += p.games
      s.holders.set(p.player,(s.holders.get(p.player)??0)+p.games)
      map.set(fr, s)
    }
    return Array.from(map.entries()).map(([fr,s]) => {
      const [topHolder,topG] = [...s.holders.entries()].sort((a,b)=>b[1]-a[1])[0]??['—',0]
      return {
        franchise:fr, name:FRANCHISE_NAMES[fr]??fr,
        totalGames:s.games, uniqueHolders:s.holders.size,
        topHolder, topHolderGames:topG,
      }
    }).sort((a,b)=>b.totalGames-a.totalGames)
  }, [possessions])

  const sortedStats = useMemo(()=> playerStats
    .filter(p=>!search||p.player.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>b[lbSort]-a[lbSort])
  ,[playerStats,search,lbSort])

  const current = rows[rows.length-1]

  function SortTh({col,children}:{col:typeof lbSort;children:React.ReactNode}) {
    return (
      <th className="num sortable" onClick={()=>setLbSort(col)}
        style={{color:lbSort===col?'var(--blue)':'var(--text2)',cursor:'pointer',whiteSpace:'nowrap'}}>
        {children}{lbSort===col?' ↓':''}
      </th>
    )
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 72px)',overflow:'hidden'}}>

      {/* Hero */}
      {current&&!loading&&(
        <div style={{background:'var(--blue)',padding:'14px 24px',display:'flex',alignItems:'center',gap:20,flexWrap:'wrap',flexShrink:0}}>
          <div style={{fontSize:32,lineHeight:1}}>👑</div>
          <div style={{flex:1,minWidth:160}}>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:2}}>Current Crown Holder · 2026 Playoffs</div>
            <div style={{fontFamily:'var(--font-head)',fontSize:24,color:'#fff',cursor:'pointer',lineHeight:1.1}}
              onClick={()=>setModal(current.crown_holder)}>
              {current.crown_holder}
            </div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:2}}>{FRANCHISE_NAMES[current.crown_team]??current.crown_team}</div>
          </div>
          {[
            ['Streak',`${current.streak}g`],
            ['Total Held',`${current.total_games}g`],
            ['Last GmSc',`${Number(current.gmsc).toFixed(1)}`],
            ['Unique Holders',`${new Set(rows.map(r=>r.crown_holder)).size}`],
            ['Total Events',`${rows.length}`],
          ].map(([l,v])=>(
            <div key={l} style={{textAlign:'center',flexShrink:0}}>
              <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.09em',marginBottom:2}}>{l}</div>
              <div style={{fontSize:20,fontWeight:700,color:'#fff',fontFamily:'var(--font-mono)'}}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar" style={{flexShrink:0}}>
        {([['leaderboard','Leaderboard'],['timeline','Timeline'],['franchise','Franchise Leaders']] as [string,string][]).map(([k,l])=>(
          <button key={k} className={`tab${tab===k?' active':''}`} onClick={()=>setTab(k as typeof tab)}>{l}</button>
        ))}
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {loading ? (
          <div className="loading"><div className="spinner"/>Loading crown history…</div>
        ) : tab==='leaderboard' ? (

          /* ── LEADERBOARD ─────────────────────────────────────────────── */
          <div style={{flex:1,display:'flex',gap:0,overflow:'hidden'}}>
            <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
              <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:12,flexWrap:'wrap'}}>
                <input type="search" placeholder="Filter player…" value={search}
                  onChange={e=>setSearch(e.target.value)} style={{width:180,fontSize:12,padding:'5px 8px'}}/>
                <span style={{fontSize:12,color:'var(--text3)'}}>{sortedStats.length} holders</span>
              </div>
              <div style={{overflowX:'auto'}}>
                <table className="data-table" style={{fontSize:13,minWidth:600}}>
                  <thead><tr>
                    <th style={{width:32,paddingLeft:10}}>#</th>
                    <th>Player</th>
                    <SortTh col="totalGames">Games Held</SortTh>
                    <SortTh col="defenses">Defenses</SortTh>
                    <SortTh col="maxStreak">Best Streak</SortTh>
                    <SortTh col="avgGames">Avg Games/Run</SortTh>
                    <SortTh col="possessions">Possessions</SortTh>
                    <th className="num">Times Lost</th>
                  </tr></thead>
                  <tbody>
                    {sortedStats.map((r,i)=>(
                      <tr key={r.player}>
                        <td style={{paddingLeft:10,color:'var(--text3)',fontSize:12,fontFamily:'var(--font-mono)'}}>{i+1}</td>
                        <td className="player-cell" style={{fontWeight:i<3?700:400,color:i<3?'var(--blue)':'var(--text)'}}
                          onClick={()=>setModal(r.player)}>{r.player}</td>
                        <td className="num" style={{fontWeight:700,color:'var(--blue)',fontFamily:'var(--font-mono)'}}>{r.totalGames}</td>
                        <td className="num" style={{color:'var(--green)',fontFamily:'var(--font-mono)'}}>{r.defenses}</td>
                        <td className="num" style={{
                          color:r.maxStreak>=5?'var(--gold)':r.maxStreak>=3?'var(--blue)':'var(--text2)',
                          fontWeight:r.maxStreak>=4?700:400,fontFamily:'var(--font-mono)'
                        }}>{r.maxStreak}</td>
                        <td className="num" style={{fontFamily:'var(--font-mono)',color:'var(--text2)'}}>{r.avgGames.toFixed(1)}</td>
                        <td className="num" style={{fontFamily:'var(--font-mono)',color:'var(--text3)'}}>{r.possessions}</td>
                        <td className="num" style={{color:'var(--red)',fontFamily:'var(--font-mono)'}}>{r.losses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Records sidebar */}
            <div style={{width:232,flexShrink:0,borderLeft:'1px solid var(--border)',overflowY:'auto',padding:'16px 14px',background:'var(--bg2)'}}>
              <div style={{fontFamily:'var(--font-head)',fontSize:15,color:'var(--blue)',marginBottom:12}}>Records</div>
              {(()=>{
                const stats = playerStats
                const byGames   = [...stats].sort((a,b)=>b.totalGames-a.totalGames)[0]
                const byStreak  = [...stats].sort((a,b)=>b.maxStreak-a.maxStreak)[0]
                const byAvg     = [...stats].filter(p=>p.possessions>=3).sort((a,b)=>b.avgGames-a.avgGames)[0]
                const byDef     = [...stats].sort((a,b)=>b.defenses-a.defenses)[0]
                const byPoss    = [...stats].sort((a,b)=>b.possessions-a.possessions)[0]
                return [
                  {icon:'🎮',label:'Most Games Held',   p:byGames?.player,  val:`${byGames?.totalGames}g`},
                  {icon:'⚡',label:'Longest Streak',    p:byStreak?.player, val:`${byStreak?.maxStreak}g`},
                  {icon:'⏳',label:'Best Avg Games/Run', p:byAvg?.player,    val:`${byAvg?.avgGames.toFixed(1)}g`},
                  {icon:'🛡',label:'Most Defenses',     p:byDef?.player,    val:`${byDef?.defenses}`},
                  {icon:'🔁',label:'Most Possessions',  p:byPoss?.player,   val:`${byPoss?.possessions}×`},
                ].map(r=>(
                  <div key={r.label} className="card2" style={{padding:'10px 12px',marginBottom:8}}>
                    <div style={{fontSize:9,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:4}}>{r.icon} {r.label}</div>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--text)',cursor:'pointer',marginBottom:2}}
                      onClick={()=>r.p&&setModal(r.p)}>{r.p??'—'}</div>
                    <div style={{fontSize:16,fontWeight:700,color:'var(--blue)',fontFamily:'var(--font-mono)'}}>{r.val}</div>
                  </div>
                ))
              })()}
              <div style={{marginTop:4,padding:'10px 12px',background:'var(--surface)',borderRadius:5,border:'1px solid var(--border)'}}>
                <div style={{fontSize:9,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Transfer Breakdown</div>
                {[
                  ['⚔️ Wrested',  rows.filter(r=>r.event==='transfer_loss').length,     'var(--red)'],
                  ['🔄 Teammate', rows.filter(r=>r.event==='transfer_teammate').length,  'var(--blue2)'],
                  ['🆕 New Season',rows.filter(r=>r.event==='new_season').length,        'var(--text3)'],
                  ['🛡 Defenses', rows.filter(r=>r.event==='defend').length,             'var(--green)'],
                ].map(([l,v,col])=>(
                  <div key={l as string} style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                    <span style={{fontSize:12,color:'var(--text2)'}}>{l as string}</span>
                    <span style={{fontWeight:700,color:col as string,fontFamily:'var(--font-mono)'}}>{v as number}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        ) : tab==='timeline' ? (

          /* ── VERTICAL TIMELINE ───────────────────────────────────────── */
          <VerticalTimeline rows={rows} onPlayer={setModal}/>

        ) : (

          /* ── FRANCHISE LEADERS ───────────────────────────────────────── */
          <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
            <div style={{overflowX:'auto',border:'1px solid var(--border)',borderRadius:6,marginBottom:24}}>
              <table className="data-table" style={{fontSize:13}}>
                <thead><tr>
                  <th style={{width:28,paddingLeft:10}}>#</th>
                  <th>Franchise</th>
                  <th className="num">Games Held</th>
                  <th className="num">Unique Holders</th>
                  <th>Top Holder</th>
                  <th className="num">Top Holder Games</th>
                </tr></thead>
                <tbody>
                  {franchiseStats.map((fr,i)=>(
                    <tr key={fr.franchise}>
                      <td style={{paddingLeft:10,color:'var(--text3)',fontSize:12}}>{i+1}</td>
                      <td style={{fontWeight:i<3?700:400}}>{fr.name}</td>
                      <td className="num" style={{fontWeight:700,color:'var(--blue)',fontFamily:'var(--font-mono)'}}>{fr.totalGames}</td>
                      <td className="num" style={{fontFamily:'var(--font-mono)',color:'var(--text2)'}}>{fr.uniqueHolders}</td>
                      <td className="player-cell" style={{color:'var(--blue)'}} onClick={()=>setModal(fr.topHolder)}>{fr.topHolder}</td>
                      <td className="num" style={{fontFamily:'var(--font-mono)',color:'var(--text3)'}}>{fr.topHolderGames}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{fontFamily:'var(--font-head)',fontSize:16,color:'var(--blue)',marginBottom:12}}>Top Holders by Franchise</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
              {franchiseStats.slice(0,20).map(fr=>{
                const frPoss = possessions.filter(p=>p.franchise===fr.franchise)
                const byPlayer = new Map<string,number>()
                for (const p of frPoss) byPlayer.set(p.player,(byPlayer.get(p.player)??0)+p.games)
                const sorted = [...byPlayer.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8)
                return (
                  <div key={fr.franchise} className="card" style={{padding:0,overflow:'hidden'}}>
                    <div style={{background:'var(--blue)',padding:'8px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontFamily:'var(--font-head)',fontSize:14,fontWeight:700,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{fr.name}</span>
                      <span style={{fontSize:11,color:'rgba(255,255,255,0.45)',flexShrink:0,marginLeft:8,fontFamily:'var(--font-mono)'}}>{fr.totalGames}g</span>
                    </div>
                    <table className="data-table" style={{fontSize:12}}>
                      <thead><tr>
                        <th style={{paddingLeft:10}}>#</th>
                        <th>Player</th>
                        <th className="num">Games</th>
                      </tr></thead>
                      <tbody>
                        {sorted.map(([player,g],i)=>(
                          <tr key={player}>
                            <td style={{paddingLeft:10,color:'var(--text3)',fontSize:11}}>{i+1}</td>
                            <td className="player-cell" style={{fontWeight:i===0?700:400,color:i===0?'var(--blue)':'var(--text)',fontSize:12}}
                              onClick={()=>setModal(player)}>{player}</td>
                            <td className="num" style={{fontWeight:i===0?700:400,color:i===0?'var(--blue)':'var(--text2)',fontFamily:'var(--font-mono)'}}>{g}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      {modal&&<PlayerModal player={modal} onClose={()=>setModal(null)}/>}
    </div>
  )
}
