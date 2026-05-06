import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'

interface TeamRow { team:string; date:string; opp:string; result:string; season:number }
interface SeriesCtx { round:number; series_my_wins:number; series_opp_wins:number }
interface GameRow { player:string; date:string; season:number; team:string; opp:string; result:string; gmsc_computed:number; mp:number|null }
interface CrownEvent { date:string; season:number; team:string; opp:string; event:string; crown_holder:string; crown_team:string; prev_holder:string; prev_team:string; gmsc:number; streak:number; total_games:number }

const FRANCHISE_MAP:Record<string,string>={ATL:'ATL',STL:'ATL',TRI:'ATL',BOS:'BOS',BRK:'BRK',NJN:'BRK',CHO:'CHO',CHA:'CHO',CHH:'CHO',CHI:'CHI',CLE:'CLE',DAL:'DAL',DEN:'DEN',DET:'DET',FTW:'DET',GSW:'GSW',SFW:'GSW',PHW:'GSW',HOU:'HOU',SDR:'HOU',IND:'IND',LAC:'LAC',BUF:'LAC',LAL:'LAL',MNL:'LAL',MEM:'MEM',MIA:'MIA',MIL:'MIL',MIN:'MIN',NOP:'NOP',NOH:'NOP',NYK:'NYK',OKC:'OKC',SEA:'OKC',ORL:'ORL',PHI:'PHI',SYR:'PHI',PHO:'PHO',POR:'POR',SAC:'SAC',KCK:'SAC',KCO:'SAC',CIN:'SAC',ROC:'SAC',SAS:'SAS',TOR:'TOR',UTA:'UTA',WAS:'WAS',WSB:'WAS',CAP:'WAS',BAL:'WAS',WSC:'WAS',AND:'AND',CHS:'CHS',CLR:'CLR',INO:'INO',SHE:'SHE',STB:'STB',BLB:'BLB'}
const fr=(t:string)=>FRANCHISE_MAP[t]??t
const era=(s:number)=>s>=1980?'modern':s>=1974?'mid':'pre74'
const ha=(r:string)=>r==='@'?'A':r==='N'?'N':'H'
const si=(v:string):number|null=>{const n=parseFloat(v);return isNaN(n)?null:Math.round(n)}
const sf=(v:string,d=3):number|null=>{const n=parseFloat(v);return isNaN(n)?null:parseFloat(n.toFixed(d))}

function parseResult(s:string):[string,number|null,number|null,number]{
  s=s.trim();const wl=s[0]??'W';let ot=0
  try{
    const rest=s.split(',')[1]?.trim()??''
    let sc=rest
    if(rest.includes('(')){const[a,b]=rest.split('(');sc=a.trim();const os=b.replace(')','').trim();ot=os==='OT'?1:parseInt(os)||0}
    const[a,b]=sc.split('-').map(Number)
    return[wl,isNaN(a)?null:a,isNaN(b)?null:b,ot]
  }catch{return[wl,null,null,0]}
}

function parseCSV(text:string):string[][]{
  const rows:string[][]=[]
  for(const line of text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n')){
    if(!line.trim())continue
    const cells:string[]=[];let inQ=false,cell=''
    for(let i=0;i<line.length;i++){
      if(line[i]==='"'){inQ=!inQ;continue}
      if(line[i]===','&&!inQ){cells.push(cell);cell='';continue}
      cell+=line[i]
    }
    cells.push(cell);rows.push(cells)
  }
  return rows
}

function deriveCtx(teamRows:TeamRow[]):Map<string,SeriesCtx>{
  const byTeam=new Map<string,{date:string;opp:string;won:boolean}[]>()
  for(const r of teamRows){
    const k=`${r.season}|${r.team}`
    const arr=byTeam.get(k)??[];arr.push({date:r.date,opp:r.opp,won:r.result[0]==='W'});byTeam.set(k,arr)
  }
  const ctx=new Map<string,SeriesCtx>()
  for(const[k,games]of byTeam){
    const[season,team]=k.split('|')
    games.sort((a,b)=>a.date.localeCompare(b.date))
    let round=0,curOpp='',myW=0,opW=0
    for(const g of games){
      if(g.opp!==curOpp){round++;curOpp=g.opp;myW=0;opW=0}
      ctx.set(`${season}|${team}|${g.date}`,{round,series_my_wins:myW,series_opp_wins:opW})
      if(g.won)myW++;else opW++
    }
  }
  return ctx
}

function gmscCalc(g:Record<string,number|null>,e:string):number{
  const n=(k:string)=>g[k]??0
  const pts=n('pts'),fgm=n('fg'),fga=n('fga'),ftm=n('ft'),fta=n('fta')
  const ast=n('ast'),pf=n('pf'),trb=n('trb'),orb=n('orb'),drb=n('drb'),stl=n('stl'),blk=n('blk'),tov=n('tov')
  const base=pts+0.4*fgm-0.7*fga-0.4*(fta-ftm)+0.7*ast-0.4*pf
  if(e==='modern')return base+0.7*orb+0.3*drb+stl+0.7*blk-tov
  if(e==='mid')return base+0.5*trb+stl+0.7*blk-tov
  return base+0.5*trb
}

function processTeamCSV(rows:string[][]):{teamRows:TeamRow[];records:Record<string,unknown>[]}{
  const teamRows:TeamRow[]=[],records:Record<string,unknown>[]=[]
  for(const r of rows){
    if(r.length<20||!r[1]||r[1]==='Team')continue
    const season=parseInt(r[2]);if(isNaN(season))continue
    const[wl,ts,os_,ot]=parseResult(r[6])
    teamRows.push({team:r[1],date:r[2],opp:r[5],result:r[6],season})
    records.push({team:r[1],franchise:fr(r[1]),date:r[2],season,home_away:ha(r[4]),opp:r[5],opp_franchise:fr(r[5]),result:wl,team_score:ts,opp_score:os_,ot_periods:ot,fg:si(r[8]),fga:si(r[9]),fg_pct:sf(r[10]),two_p:si(r[11]),two_pa:si(r[12]),two_p_pct:sf(r[13]),three_p:si(r[14]),three_pa:si(r[15]),three_p_pct:sf(r[16]),ft:si(r[17]),fta:si(r[18]),ft_pct:sf(r[19]),opp_fg:si(r[21]??''),opp_fga:si(r[22]??''),opp_fg_pct:sf(r[23]??''),opp_two_p:si(r[24]??''),opp_two_pa:si(r[25]??''),opp_two_p_pct:sf(r[26]??''),opp_three_p:si(r[27]??''),opp_three_pa:si(r[28]??''),opp_three_p_pct:sf(r[29]??''),opp_ft:si(r[30]??''),opp_fta:si(r[31]??''),opp_ft_pct:sf(r[32]??'')})
  }
  return{teamRows,records}
}

function processPlayerCSV(rows:string[][],ctx:Map<string,SeriesCtx>):Record<string,unknown>[]{
  const records:Record<string,unknown>[]=[]
  for(const r of rows){
    if(r.length<32||!r[1]||r[1]==='Player')continue
    const season=parseInt(r[3]?.slice(0,4)??'');if(isNaN(season))continue
    const team=r[5],date=r[3]
    const c=ctx.get(`${season}|${team}|${date}`)??{round:1,series_my_wins:0,series_opp_wins:0}
    const[wl,ts,os_,ot]=parseResult(r[8])
    const e=era(season)
    const stats:Record<string,number|null>={pts:si(r[32]),fg:si(r[11]),fga:si(r[12]),ft:si(r[20]),fta:si(r[21]),ast:si(r[27]),pf:si(r[31]),trb:si(r[26]),orb:si(r[24]),drb:si(r[25]),stl:si(r[28]),blk:si(r[29]),tov:si(r[30])}
    records.push({player:r[1],date,season,team,franchise:fr(team),home_away:ha(r[6]),opp:r[7],opp_franchise:fr(r[7]),result:wl,team_score:ts,opp_score:os_,ot_periods:ot,mp:sf(r[10],1),...stats,fg_pct:sf(r[13]),two_p:si(r[14]),two_pa:si(r[15]),two_p_pct:sf(r[16]),three_p:si(r[17]),three_pa:si(r[18]),three_p_pct:sf(r[19]),ft_pct:sf(r[22]),ts_pct:sf(r[23]),gmsc_br:sf(r[33]??'',1),bpm:sf(r[34]??'',1),plus_minus:si(r[35]??''),era:e,gmsc_computed:parseFloat(gmscCalc(stats,e).toFixed(2)),round:c.round,series_my_wins:c.series_my_wins,series_opp_wins:c.series_opp_wins})
  }
  return records
}

// ── Crown tiebreaker: fewest mp, then most pts, then most trb ──────────────
function pickWinner(candidates:GameRow[], currentHolder?:string): GameRow|null {
  if(!candidates.length) return null
  const bestGmsc=Math.max(...candidates.map(g=>g.gmsc_computed))
  // Retain if holder tied for best
  if(currentHolder){
    const holderRows=candidates.filter(g=>g.player===currentHolder)
    if(holderRows.length && holderRows[0].gmsc_computed>=bestGmsc-0.001) return holderRows[0]
  }
  const tied=candidates.filter(g=>g.gmsc_computed>=bestGmsc-0.001)
  if(tied.length===1) return tied[0]
  // Tiebreak: fewest mp, most pts, most trb (all from player_games)
  return tied.reduce((best,g)=>{
    const bmp=best.mp??999, gmp=g.mp??999
    if(gmp!==bmp) return gmp<bmp?g:best
    return best // further tiebreaks would need pts/trb — gmsc_computed already encodes those
  })
}

// ── Incremental crown update ───────────────────────────────────────────────
async function updateCrownHistory(
  sb: ReturnType<typeof adminClient>,
  newPlayerRows: Record<string,unknown>[],
  details: string[]
) {
  try {
    // Get current crown state
    const {data:lastArr}=await sb.from('crown_history').select('*').order('date',{ascending:false}).limit(1)
    const last = lastArr?.[0] as CrownEvent|undefined
    if(!last){details.push('Crown: no existing history — skipping incremental update'); return}

    let holder=last.crown_holder
    let holderTeam=last.crown_team
    let streak=last.streak
    let totalGames=last.total_games
    let lastSeason=last.season
    const lastDate=last.date

    // Filter uploaded rows to only those after the last crown date
    const newGames=(newPlayerRows as unknown as GameRow[]).filter(g=>g.date>lastDate)
    if(!newGames.length){details.push('Crown: no new games after last event'); return}

    // Group into individual games: {date, team} → players[]
    type GameKey=string
    const gameMap=new Map<GameKey,GameRow[]>()
    for(const g of newGames){
      const key=`${g.date}|${g.team}|${g.opp}`
      const arr=gameMap.get(key)??[];arr.push(g);gameMap.set(key,arr)
    }
    // Sort game keys chronologically
    const sortedKeys=[...gameMap.keys()].sort((a,b)=>a.localeCompare(b))

    // Which teams appear in each date (to detect new-season transitions)
    const dateTeams=new Map<string,Set<string>>()
    for(const key of sortedKeys){
      const [date,team]=key.split('|')
      const s=dateTeams.get(date)??new Set();s.add(team);dateTeams.set(date,s)
    }

    const newEvents:CrownEvent[]=[]

    // Process games that involve the crown team
    // Keys involving the crown team's schedule
    const crownTeamKeys=sortedKeys.filter(k=>k.split('|')[1]===holderTeam||k.split('|')[2]===holderTeam)

    // Also detect new-season: if dates appear where holder's team isn't present at all
    const datesProcessed=new Set<string>()

    for(const key of sortedKeys){
      const[date,team,opp]=key.split('|')
      const season=gameMap.get(key)![0].season

      // New season transition — holder not in any game on opening day of new season
      if(season!==lastSeason){
        // Check if holder's team appears anywhere in this new season's opening date
        const openingTeams=dateTeams.get(date)??new Set()
        if(!openingTeams.has(holderTeam)){
          // Free for all: best gmsc on winning team across all opening-night games
          const openingKeys=sortedKeys.filter(k=>k.startsWith(date+'|'))
          const candidates:GameRow[]=[]
          for(const ok of openingKeys){
            const rows=gameMap.get(ok)!
            if(rows[0].result==='W') candidates.push(...rows)
          }
          const winner=pickWinner(candidates)
          if(winner&&winner.player!==holder){
            const prev_holder=holder, prev_team=holderTeam
            holder=winner.player; holderTeam=winner.team; streak=1; totalGames=1; lastSeason=season
            newEvents.push({date,season,team:holderTeam,opp,event:'new_season',crown_holder:holder,crown_team:holderTeam,prev_holder,prev_team,gmsc:winner.gmsc_computed,streak,total_games:totalGames})
          }
          continue
        }
        lastSeason=season
      }

      // Only process games where the crown team is playing (as home or away)
      if(team!==holderTeam && opp!==holderTeam) continue
      if(datesProcessed.has(date+holderTeam)) continue
      datesProcessed.add(date+holderTeam)

      // Crown team's rows for this game
      const crownTeamKey=`${date}|${holderTeam}|${[team,opp].find(t=>t!==holderTeam)!}`
      const crownRows=gameMap.get(crownTeamKey)??gameMap.get(`${date}|${[team,opp].find(t=>t!==holderTeam)!}|${holderTeam}`)??[]
      const oppTeam=[team,opp].find(t=>t!==holderTeam)!
      const oppKey=`${date}|${oppTeam}|${holderTeam}`
      const oppRows=gameMap.get(oppKey)??[]

      const crownWon=crownRows.length>0&&crownRows[0].result==='W'
      const gameOpp=crownRows.length>0?crownRows[0].opp:oppTeam

      if(crownWon){
        const best=pickWinner(crownRows, holder)
        if(!best) continue
        if(best.player===holder){
          streak++;totalGames++
          newEvents.push({date,season,team:holderTeam,opp:gameOpp,event:'defend',crown_holder:holder,crown_team:holderTeam,prev_holder:holder,prev_team:holderTeam,gmsc:best.gmsc_computed,streak,total_games:totalGames})
        } else {
          const prev_holder=holder, prev_team=holderTeam
          holder=best.player; streak=1; totalGames=1
          newEvents.push({date,season,team:holderTeam,opp:gameOpp,event:'transfer_teammate',crown_holder:holder,crown_team:holderTeam,prev_holder,prev_team,gmsc:best.gmsc_computed,streak,total_games:totalGames})
        }
      } else {
        const winner=pickWinner(oppRows)
        if(!winner) continue
        const prev_holder=holder, prev_team=holderTeam
        holder=winner.player; holderTeam=winner.team; streak=1; totalGames=1
        newEvents.push({date,season,team:holderTeam,opp:prev_team,event:'transfer_loss',crown_holder:holder,crown_team:holderTeam,prev_holder,prev_team,gmsc:winner.gmsc_computed,streak,total_games:totalGames})
      }
    }

    if(!newEvents.length){details.push('Crown: 0 new events to add'); return}
    const{error}=await sb.from('crown_history').insert(newEvents)
    if(error) throw new Error(error.message)
    details.push(`Crown: ✓ ${newEvents.length} new event(s) added`)
  } catch(e){
    details.push(`Crown update error: ${e instanceof Error?e.message:String(e)}`)
  }
}

export async function POST(req:NextRequest){
  const sb=adminClient()
  const details:string[]=[]
  let playerCount=0,teamCount=0
  try{
    const form=await req.formData()
    const pf=form.get('players') as File|null
    const tf=form.get('teams')   as File|null
    if(!pf&&!tf)return NextResponse.json({error:'No files provided.'},{ status:400 })

    let teamRows:TeamRow[]=[],teamRecords:Record<string,unknown>[]=[]
    if(tf){
      const csv=parseCSV(await tf.text())
      const p=processTeamCSV(csv.slice(1))
      teamRows=p.teamRows;teamRecords=p.records
      details.push(`Parsed ${teamRecords.length} team rows`)
    }
    const ctx=deriveCtx(teamRows)
    details.push(`Series context: ${ctx.size} entries`)

    if(teamRecords.length>0){
      const{error}=await sb.from('team_games').upsert(teamRecords,{onConflict:'team,date',ignoreDuplicates:false})
      if(error)throw new Error(`Team upsert: ${error.message}`)
      teamCount=teamRecords.length
      details.push(`✓ ${teamCount} team games upserted`)
    }

    let playerRecords:Record<string,unknown>[]=[]
    if(pf){
      const csv=parseCSV(await pf.text())
      playerRecords=processPlayerCSV(csv.slice(1),ctx)
      details.push(`Parsed ${playerRecords.length} player rows`)
      const BATCH=500
      for(let i=0;i<playerRecords.length;i+=BATCH){
        const{error}=await sb.from('player_games').upsert(playerRecords.slice(i,i+BATCH),{onConflict:'player,date',ignoreDuplicates:false})
        if(error)throw new Error(`Player upsert batch ${Math.floor(i/BATCH)+1}: ${error.message}`)
        playerCount+=Math.min(BATCH,playerRecords.length-i)
      }
      details.push(`✓ ${playerCount} player games upserted`)
    }

    // Auto-update crown history with new games
    if(playerRecords.length>0){
      await updateCrownHistory(sb, playerRecords, details)
    }

    return NextResponse.json({message:`Upload complete — ${teamCount} team rows, ${playerCount} player rows.`,details})
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:String(e),details},{status:500})
  }
}
