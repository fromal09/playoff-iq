import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'

interface GameRow { player:string; date:string; season:number; team:string; opp:string; result:string; gmsc_computed:number; mp:number|null }
interface CrownEvent { date:string; season:number; team:string; opp:string; event:string; crown_holder:string; crown_team:string; prev_holder:string; prev_team:string; gmsc:number; streak:number; total_games:number }
interface TeamRow { team:string; date:string; opp:string; result:string; season:number }
interface SeriesCtx { round:number; series_my_wins:number; series_opp_wins:number }

const FM:Record<string,string>={ATL:'ATL',STL:'ATL',TRI:'ATL',BOS:'BOS',BRK:'BRK',NJN:'BRK',CHO:'CHO',CHA:'CHO',CHH:'CHO',CHI:'CHI',CLE:'CLE',DAL:'DAL',DEN:'DEN',DET:'DET',FTW:'DET',GSW:'GSW',SFW:'GSW',PHW:'GSW',HOU:'HOU',SDR:'HOU',IND:'IND',LAC:'LAC',BUF:'LAC',LAL:'LAL',MNL:'LAL',MEM:'MEM',MIA:'MIA',MIL:'MIL',MIN:'MIN',NOP:'NOP',NOH:'NOP',NYK:'NYK',OKC:'OKC',SEA:'OKC',ORL:'ORL',PHI:'PHI',SYR:'PHI',PHO:'PHO',POR:'POR',SAC:'SAC',KCK:'SAC',KCO:'SAC',CIN:'SAC',ROC:'SAC',SAS:'SAS',TOR:'TOR',UTA:'UTA',WAS:'WAS',WSB:'WAS',CAP:'WAS',BAL:'WAS',WSC:'WAS',AND:'AND',CHS:'CHS',CLR:'CLR',INO:'INO',SHE:'SHE',STB:'STB',BLB:'BLB'}
const fr=(t:string)=>FM[t]??t
const era=(s:number)=>s>=1980?'modern':s>=1974?'mid':'pre74'
const ha=(r:string)=>r==='@'?'A':r==='N'?'N':'H'
const si=(v:string):number|null=>{const n=parseFloat(v);return isNaN(n)?null:Math.round(n)}
const sf=(v:string,d=3):number|null=>{const n=parseFloat(v);return isNaN(n)?null:parseFloat(n.toFixed(d))}

function parseResult(s:string):[string,number|null,number|null,number]{
  s=s.trim();const wl=s[0]??'W';let ot=0
  try{const rest=s.split(',')[1]?.trim()??'';let sc=rest;if(rest.includes('(')){const[a,b]=rest.split('(');sc=a.trim();const os=b.replace(')','').trim();ot=os==='OT'?1:parseInt(os)||0}const[a,b]=sc.split('-').map(Number);return[wl,isNaN(a)?null:a,isNaN(b)?null:b,ot]}
  catch{return[wl,null,null,0]}
}

function parseCSV(text:string):string[][]{
  const rows:string[][]=[]
  for(const line of text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n')){
    if(!line.trim())continue
    const cells:string[]=[];let inQ=false,cell=''
    for(let i=0;i<line.length;i++){if(line[i]==='"'){inQ=!inQ;continue}if(line[i]===','&&!inQ){cells.push(cell);cell='';continue}cell+=line[i]}
    cells.push(cell);rows.push(cells)
  }
  return rows
}

function deriveCtx(teamRows:TeamRow[]):Map<string,SeriesCtx>{
  const byTeam=new Map<string,{date:string;opp:string;won:boolean}[]>()
  for(const r of teamRows){const k=`${r.season}|${r.team}`;const arr=byTeam.get(k)??[];arr.push({date:r.date,opp:r.opp,won:r.result[0]==='W'});byTeam.set(k,arr)}
  const ctx=new Map<string,SeriesCtx>()
  for(const[k,games]of byTeam){const[season,team]=k.split('|');games.sort((a,b)=>a.date.localeCompare(b.date));let round=0,curOpp='',myW=0,opW=0;for(const g of games){if(g.opp!==curOpp){round++;curOpp=g.opp;myW=0;opW=0}ctx.set(`${season}|${team}|${g.date}`,{round,series_my_wins:myW,series_opp_wins:opW});if(g.won)myW++;else opW++}}
  return ctx
}

function gmscCalc(g:Record<string,number|null>,e:string):number{
  const n=(k:string)=>g[k]??0
  const pts=n('pts'),fgm=n('fg'),fga=n('fga'),ftm=n('ft'),fta=n('fta'),ast=n('ast'),pf=n('pf'),trb=n('trb'),orb=n('orb'),drb=n('drb'),stl=n('stl'),blk=n('blk'),tov=n('tov')
  const base=pts+0.4*fgm-0.7*fga-0.4*(fta-ftm)+0.7*ast-0.4*pf
  if(e==='modern')return base+0.7*orb+0.3*drb+stl+0.7*blk-tov
  if(e==='mid')return base+0.5*trb+stl+0.7*blk-tov
  return base+0.5*trb
}

function processTeamCSV(rows:string[][]):{teamRows:TeamRow[];records:Record<string,unknown>[]}{
  const teamRows:TeamRow[]=[],records:Record<string,unknown>[]=[]
  for(const r of rows){if(r.length<20||!r[1]||r[1]==='Team')continue;const season=parseInt(r[2]);if(isNaN(season))continue;const[wl,ts,os_,ot]=parseResult(r[6]);teamRows.push({team:r[1],date:r[2],opp:r[5],result:r[6],season});records.push({team:r[1],franchise:fr(r[1]),date:r[2],season,home_away:ha(r[4]),opp:r[5],opp_franchise:fr(r[5]),result:wl,team_score:ts,opp_score:os_,ot_periods:ot,fg:si(r[8]),fga:si(r[9]),fg_pct:sf(r[10]),two_p:si(r[11]),two_pa:si(r[12]),two_p_pct:sf(r[13]),three_p:si(r[14]),three_pa:si(r[15]),three_p_pct:sf(r[16]),ft:si(r[17]),fta:si(r[18]),ft_pct:sf(r[19]),opp_fg:si(r[21]??''),opp_fga:si(r[22]??''),opp_fg_pct:sf(r[23]??''),opp_two_p:si(r[24]??''),opp_two_pa:si(r[25]??''),opp_two_p_pct:sf(r[26]??''),opp_three_p:si(r[27]??''),opp_three_pa:si(r[28]??''),opp_three_p_pct:sf(r[29]??''),opp_ft:si(r[30]??''),opp_fta:si(r[31]??''),opp_ft_pct:sf(r[32]??'')})}
  return{teamRows,records}
}

function processPlayerCSV(rows:string[][],ctx:Map<string,SeriesCtx>):Record<string,unknown>[]{
  const records:Record<string,unknown>[]=[]
  for(const r of rows){if(r.length<32||!r[1]||r[1]==='Player')continue;const season=parseInt(r[3]?.slice(0,4)??'');if(isNaN(season))continue;const team=r[5],date=r[3];const c=ctx.get(`${season}|${team}|${date}`)??{round:1,series_my_wins:0,series_opp_wins:0};const[wl,ts,os_,ot]=parseResult(r[8]);const e=era(season);const stats:Record<string,number|null>={pts:si(r[32]),fg:si(r[11]),fga:si(r[12]),ft:si(r[20]),fta:si(r[21]),ast:si(r[27]),pf:si(r[31]),trb:si(r[26]),orb:si(r[24]),drb:si(r[25]),stl:si(r[28]),blk:si(r[29]),tov:si(r[30])};records.push({player:r[1],date,season,team,franchise:fr(team),home_away:ha(r[6]),opp:r[7],opp_franchise:fr(r[7]),result:wl,team_score:ts,opp_score:os_,ot_periods:ot,mp:sf(r[10],1),...stats,fg_pct:sf(r[13]),two_p:si(r[14]),two_pa:si(r[15]),two_p_pct:sf(r[16]),three_p:si(r[17]),three_pa:si(r[18]),three_p_pct:sf(r[19]),ft_pct:sf(r[22]),ts_pct:sf(r[23]),gmsc_br:sf(r[33]??'',1),bpm:sf(r[34]??'',1),plus_minus:si(r[35]??''),era:e,gmsc_computed:parseFloat(gmscCalc(stats,e).toFixed(2)),round:c.round,series_my_wins:c.series_my_wins,series_opp_wins:c.series_opp_wins})}
  return records
}

function pickWinner(candidates:GameRow[], currentHolder?:string):GameRow|null{
  if(!candidates.length)return null
  const bestGmsc=Math.max(...candidates.map(g=>g.gmsc_computed))
  if(currentHolder){const hr=candidates.filter(g=>g.player===currentHolder);if(hr.length&&hr[0].gmsc_computed>=bestGmsc-0.001)return hr[0]}
  const tied=candidates.filter(g=>g.gmsc_computed>=bestGmsc-0.001)
  if(tied.length===1)return tied[0]
  return tied.reduce((best,g)=>{const bmp=best.mp??999,gmp=g.mp??999;if(gmp!==bmp)return gmp<bmp?g:best;return best})
}

async function recomputeCrown(sb:ReturnType<typeof adminClient>, details:string[]){
  try{
    // Load all player_games
    const allRows:GameRow[]=[]
    let from=0
    while(true){
      const{data,error}=await sb.from('player_games').select('player,date,season,team,opp,result,gmsc_computed,mp').order('date',{ascending:true}).range(from,from+999)
      if(error)throw new Error(error.message)
      if(!data?.length)break
      allRows.push(...(data as GameRow[]))
      if(data.length<1000)break
      from+=1000
    }
    details.push(`Crown: loaded ${allRows.length} rows`)

    // Build game map: date|team|opp → {team → GameRow[]}
    const gameMap=new Map<string,Map<string,GameRow[]>>()
    for(const row of allRows){
      const key=`${row.date}|${row.team}|${row.opp}`
      if(!gameMap.has(key))gameMap.set(key,new Map())
      const tm=gameMap.get(key)!
      const arr=tm.get(row.team)??[];arr.push(row);tm.set(row.team,arr)
    }

    // Sort keys, group by season
    const sortedKeys=[...gameMap.keys()].sort((a,b)=>a.localeCompare(b))
    const bySeasonKeys=new Map<number,string[]>()
    for(const key of sortedKeys){
      const season=gameMap.get(key)!.values().next().value?.[0]?.season??0
      const arr=bySeasonKeys.get(season)??[];arr.push(key);bySeasonKeys.set(season,arr)
    }
    const seasons=[...bySeasonKeys.keys()].sort((a,b)=>a-b)

    let holder='',holderTeam='',streak=0,totalGames=0
    const events:CrownEvent[]=[]

    for(const season of seasons){
      const seasonKeys=bySeasonKeys.get(season)!
      const seasonPlayers=new Set<string>()
      for(const key of seasonKeys)for(const rows of gameMap.get(key)!.values())for(const r of rows)seasonPlayers.add(r.player)

      let newSeasonDate=''

      // New season free-for-all
      if(holder&&!seasonPlayers.has(holder)){
        const firstDate=seasonKeys[0].split('|')[0]
        const openingKeys=seasonKeys.filter(k=>k.startsWith(firstDate+'|'))
        const candidates:GameRow[]=[]
        for(const k of openingKeys)for(const[,rows]of gameMap.get(k)!)if(rows[0]?.result==='W')candidates.push(...rows)
        const winner=pickWinner(candidates)
        if(winner){
          const ph=holder,pt=holderTeam
          holder=winner.player;holderTeam=winner.team;streak=1;totalGames=1;newSeasonDate=firstDate
          events.push({date:winner.date,season,team:winner.team,opp:winner.opp,event:'new_season',crown_holder:holder,crown_team:holderTeam,prev_holder:ph,prev_team:pt,gmsc:winner.gmsc_computed,streak,total_games:totalGames})
        }
      }

      for(const key of seasonKeys){
        const date=key.split('|')[0]
        if(date===newSeasonDate)continue
        const teamMap=gameMap.get(key)!
        const teams=[...teamMap.keys()]

        // Initial crown
        if(!holder){
          for(const[,rows]of teamMap){
            if(rows[0]?.result==='W'){
              const winner=pickWinner(rows)
              if(winner){holder=winner.player;holderTeam=winner.team;streak=1;totalGames=1;events.push({date:winner.date,season,team:winner.team,opp:winner.opp,event:'initial',crown_holder:holder,crown_team:holderTeam,prev_holder:'',prev_team:'',gmsc:winner.gmsc_computed,streak,total_games:totalGames})}
            }
          }
          continue
        }

        if(!teams.includes(holderTeam))continue

        const crownRows=teamMap.get(holderTeam)??[]
        const oppTeam=teams.find(t=>t!==holderTeam)??''
        const oppRows=teamMap.get(oppTeam)??[]
        const crownWon=crownRows[0]?.result==='W'
        const opp=crownRows[0]?.opp??oppTeam

        if(crownWon){
          const best=pickWinner(crownRows,holder)
          if(!best)continue
          if(best.player===holder){streak++;totalGames++;events.push({date:best.date,season,team:holderTeam,opp,event:'defend',crown_holder:holder,crown_team:holderTeam,prev_holder:holder,prev_team:holderTeam,gmsc:best.gmsc_computed,streak,total_games:totalGames})}
          else{const ph=holder,pt=holderTeam;holder=best.player;streak=1;totalGames=1;events.push({date:best.date,season,team:holderTeam,opp,event:'transfer_teammate',crown_holder:holder,crown_team:holderTeam,prev_holder:ph,prev_team:pt,gmsc:best.gmsc_computed,streak,total_games:totalGames})}
        }else{
          const winner=pickWinner(oppRows)
          if(!winner)continue
          const ph=holder,pt=holderTeam;holder=winner.player;holderTeam=winner.team;streak=1;totalGames=1
          events.push({date:winner.date,season,team:holderTeam,opp:pt,event:'transfer_loss',crown_holder:holder,crown_team:holderTeam,prev_holder:ph,prev_team:pt,gmsc:winner.gmsc_computed,streak,total_games:totalGames})
        }
      }
    }

    details.push(`Crown: computed ${events.length} events`)

    // Replace all crown_history
    const{error:delErr}=await sb.from('crown_history').delete().gte('id',0)
    if(delErr)throw new Error(`Delete: ${delErr.message}`)

    for(let i=0;i<events.length;i+=500){
      const{error}=await sb.from('crown_history').insert(events.slice(i,i+500))
      if(error)throw new Error(`Insert: ${error.message}`)
    }

    const last=events[events.length-1]
    details.push(`Crown: ✓ done — current holder: ${last?.crown_holder} (streak ${last?.streak})`)
  }catch(e){
    details.push(`Crown error: ${e instanceof Error?e.message:String(e)}`)
  }
}

export async function POST(req:NextRequest){
  const sb=adminClient()
  const details:string[]=[]
  let playerCount=0,teamCount=0
  try{
    const form=await req.formData()
    const pf=form.get('players') as File|null
    const tf=form.get('teams') as File|null
    if(!pf&&!tf)return NextResponse.json({error:'No files provided.'},{status:400})

    let teamRows:TeamRow[]=[],teamRecords:Record<string,unknown>[]=[]
    if(tf){const csv=parseCSV(await tf.text());const p=processTeamCSV(csv.slice(1));teamRows=p.teamRows;teamRecords=p.records;details.push(`Parsed ${teamRecords.length} team rows`)}
    const ctx=deriveCtx(teamRows);details.push(`Series context: ${ctx.size} entries`)

    if(teamRecords.length>0){const{error}=await sb.from('team_games').upsert(teamRecords,{onConflict:'team,date',ignoreDuplicates:false});if(error)throw new Error(`Team upsert: ${error.message}`);teamCount=teamRecords.length;details.push(`✓ ${teamCount} team games upserted`)}

    if(pf){
      const csv=parseCSV(await pf.text());const playerRecords=processPlayerCSV(csv.slice(1),ctx);details.push(`Parsed ${playerRecords.length} player rows`)
      for(let i=0;i<playerRecords.length;i+=500){const{error}=await sb.from('player_games').upsert(playerRecords.slice(i,i+500),{onConflict:'player,date',ignoreDuplicates:false});if(error)throw new Error(`Player upsert: ${error.message}`);playerCount+=Math.min(500,playerRecords.length-i)}
      details.push(`✓ ${playerCount} player games upserted`)
      await recomputeCrown(sb,details)
    }

    return NextResponse.json({message:`Upload complete — ${teamCount} team rows, ${playerCount} player rows.`,details})
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:String(e),details},{status:500})
  }
}
