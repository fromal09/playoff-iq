#!/usr/bin/env python3
"""
NBA Playoff Data Processor
Reads player_games.csv and team_games.csv (Basketball Reference / Stathead format),
derives series context (round + series record) for every game, and outputs
two clean CSVs ready for Supabase bulk import.

Usage:
  python3 process_data.py \
    --players "NBA_Playoff_Data_-_Player_Games.csv" \
    --teams   "NBA_Playoff_Data_-_Team_Games.csv"   \
    --out     ./output

Outputs:
  output/player_games.csv   — ~91k rows, ready for Supabase import
  output/team_games.csv     — ~9k rows, ready for Supabase import
"""

import csv, json, sys, os, argparse
from collections import defaultdict
from pathlib import Path

# ── Franchise map ─────────────────────────────────────────────────────────────
# Maps historical abbrev → current franchise abbrev (Basketball Reference canonical)
FRANCHISE = {
    # Atlanta Hawks lineage
    'ATL':'ATL','STL':'ATL','TRI':'ATL',
    # Boston Celtics
    'BOS':'BOS',
    # Brooklyn Nets
    'BRK':'BRK','NJN':'BRK',
    # Charlotte (original Hornets → Pelicans, Bobcats → current Hornets)
    'CHO':'CHO','CHA':'CHO','CHH':'CHO',
    # Chicago Bulls
    'CHI':'CHI',
    # Cleveland Cavaliers
    'CLE':'CLE',
    # Dallas Mavericks
    'DAL':'DAL',
    # Denver Nuggets
    'DEN':'DEN',
    # Detroit Pistons / Fort Wayne
    'DET':'DET','FTW':'DET',
    # Golden State Warriors / SF / Philadelphia Warriors
    'GSW':'GSW','SFW':'GSW','PHW':'GSW',
    # Houston Rockets / San Diego Rockets
    'HOU':'HOU','SDR':'HOU',
    # Indiana Pacers
    'IND':'IND',
    # LA Clippers / Buffalo Braves
    'LAC':'LAC','BUF':'LAC',
    # LA Lakers / Minneapolis
    'LAL':'LAL','MNL':'LAL',
    # Memphis Grizzlies
    'MEM':'MEM',
    # Miami Heat
    'MIA':'MIA',
    # Milwaukee Bucks (all MIL in data = 1970+ Bucks; pre-1956 Hawks are STL/TRI)
    'MIL':'MIL',
    # Minnesota Timberwolves
    'MIN':'MIN',
    # New Orleans Pelicans / Hornets
    'NOP':'NOP','NOH':'NOP',
    # New York Knicks
    'NYK':'NYK',
    # OKC Thunder / Seattle SuperSonics
    'OKC':'OKC','SEA':'OKC',
    # Orlando Magic
    'ORL':'ORL',
    # Philadelphia 76ers / Syracuse Nationals
    'PHI':'PHI','SYR':'PHI',
    # Phoenix Suns
    'PHO':'PHO',
    # Portland Trail Blazers
    'POR':'POR',
    # Sacramento Kings lineage: Rochester → Cincinnati → KC → SAC
    'SAC':'SAC','KCK':'SAC','KCO':'SAC','CIN':'SAC','ROC':'SAC',
    # San Antonio Spurs
    'SAS':'SAS',
    # Toronto Raptors
    'TOR':'TOR',
    # Utah Jazz
    'UTA':'UTA',
    # Washington Wizards lineage: WSC → BAL → CAP → WSB → WAS
    'WAS':'WAS','WSB':'WAS','CAP':'WAS','BAL':'WAS','WSC':'WAS',
    # Defunct — no modern successor
    'AND':'AND','CHS':'CHS','CLR':'CLR','INO':'INO',
    'SHE':'SHE','STB':'STB','BLB':'BLB',
}

def franchise(team):
    return FRANCHISE.get(team, team)

# ── Era detection ─────────────────────────────────────────────────────────────
def get_era(season: int) -> str:
    if season >= 1980: return 'modern'
    if season >= 1974: return 'mid'
    return 'pre74'

# ── Era-appropriate GmSc ──────────────────────────────────────────────────────
def compute_gmsc(g: dict, era: str) -> float:
    def n(k):
        try: return float(g.get(k) or 0)
        except: return 0.0
    pts,fgm,fga = n('pts'),n('fg'),n('fga')
    ftm,fta     = n('ft'),n('fta')
    ast,pf      = n('ast'),n('pf')
    trb         = n('trb')
    orb,drb     = n('orb'),n('drb')
    stl,blk,tov = n('stl'),n('blk'),n('tov')

    base = pts + 0.4*fgm - 0.7*fga - 0.4*(fta-ftm) + 0.7*ast - 0.4*pf
    if era == 'modern':
        return base + 0.7*orb + 0.3*drb + stl + 0.7*blk - tov
    elif era == 'mid':
        return base + 0.5*trb + stl + 0.7*blk - tov
    else:   # pre74 — TRB×0.5, no STL/BLK/TOV
        return base + 0.5*trb

# ── Result parser ─────────────────────────────────────────────────────────────
def parse_result(s: str):
    """Return (W|L, team_score, opp_score, ot_periods)"""
    s = (s or '').strip()
    if not s: return 'W', None, None, 0
    wl = s[0]
    ot = 0
    try:
        rest = s.split(',', 1)[1].strip()
        if '(' in rest:
            scores_part, ot_part = rest.split('(')
            ot_str = ot_part.rstrip(') ').strip()
            ot = 1 if ot_str == 'OT' else int(ot_str[:-2]) if ot_str.endswith('OT') else 0
        else:
            scores_part = rest
        a, b = scores_part.strip().split('-')
        return wl, int(a), int(b), ot
    except:
        return wl, None, None, 0

def si(v):
    try: return int(float(v)) if v and str(v).strip() not in ('','nan') else None
    except: return None

def sf(v, decimals=3):
    try: return round(float(v), decimals) if v and str(v).strip() not in ('','nan') else None
    except: return None

# ── Parse team CSV ────────────────────────────────────────────────────────────
def parse_team_csv(path: str) -> list:
    rows = []
    with open(path, newline='', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        next(reader)  # skip header
        for r in reader:
            if len(r) < 20 or not r[1] or r[1] == 'Team': continue
            rows.append(r)
    return rows

def team_row_to_dict(r: list) -> dict:
    """
    Team CSV column layout (0-indexed):
    0=Rk  1=Team  2=Date  3=PTS(team)  4=@/N  5=Opp  6=Result  7=MP
    8-19  = team  FG FGA FG% 2P 2PA 2P% 3P 3PA 3P% FT FTA FT%
    20=PTS(dup)  21-32 = opp stats  33=PTS(opp)
    """
    return {
        'team': r[1].strip(),
        'date': r[2].strip(),
        'home_away_raw': r[4].strip(),
        'opp': r[5].strip(),
        'result_raw': r[6].strip(),
        # team shooting
        'fg':si(r[8]),'fga':si(r[9]),'fg_pct':sf(r[10]),
        'two_p':si(r[11]),'two_pa':si(r[12]),'two_p_pct':sf(r[13]),
        'three_p':si(r[14]),'three_pa':si(r[15]),'three_p_pct':sf(r[16]),
        'ft':si(r[17]),'fta':si(r[18]),'ft_pct':sf(r[19]),
        # opp shooting
        'opp_fg':si(r[21]) if len(r)>21 else None,
        'opp_fga':si(r[22]) if len(r)>22 else None,
        'opp_fg_pct':sf(r[23]) if len(r)>23 else None,
        'opp_two_p':si(r[24]) if len(r)>24 else None,
        'opp_two_pa':si(r[25]) if len(r)>25 else None,
        'opp_two_p_pct':sf(r[26]) if len(r)>26 else None,
        'opp_three_p':si(r[27]) if len(r)>27 else None,
        'opp_three_pa':si(r[28]) if len(r)>28 else None,
        'opp_three_p_pct':sf(r[29]) if len(r)>29 else None,
        'opp_ft':si(r[30]) if len(r)>30 else None,
        'opp_fta':si(r[31]) if len(r)>31 else None,
        'opp_ft_pct':sf(r[32]) if len(r)>32 else None,
        'opp_score_raw': r[33].strip() if len(r)>33 else '',
    }

# ── Parse player CSV ──────────────────────────────────────────────────────────
def parse_player_csv(path: str) -> list:
    rows = []
    with open(path, newline='', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        next(reader)
        for r in reader:
            if len(r) < 32 or not r[1] or r[1] == 'Player': continue
            rows.append(r)
    return rows

def player_row_to_dict(r: list) -> dict:
    """
    Player CSV (0-indexed):
    0=Rk  1=Player  2=GmSc(skip)  3=Date  4=Age  5=Team  6=@/N  7=Opp
    8=Result  9=GS  10=MP  11=FG  12=FGA  13=FG%  14=2P  15=2PA  16=2P%
    17=3P  18=3PA  19=3P%  20=FT  21=FTA  22=FT%  23=TS%
    24=ORB  25=DRB  26=TRB  27=AST  28=STL  29=BLK  30=TOV  31=PF  32=PTS
    33=GmSc(BR)  34=BPM  35=#ERROR!(plus_minus)  36=Pos.(skip)
    """
    return {
        'player': r[1].strip(),
        'date': r[3].strip(),
        'team': r[5].strip(),
        'home_away_raw': r[6].strip(),
        'opp': r[7].strip(),
        'result_raw': r[8].strip(),
        'mp': sf(r[10], 1),
        'fg':si(r[11]),'fga':si(r[12]),'fg_pct':sf(r[13]),
        'two_p':si(r[14]),'two_pa':si(r[15]),'two_p_pct':sf(r[16]),
        'three_p':si(r[17]),'three_pa':si(r[18]),'three_p_pct':sf(r[19]),
        'ft':si(r[20]),'fta':si(r[21]),'ft_pct':sf(r[22]),
        'ts_pct':sf(r[23]),
        'orb':si(r[24]),'drb':si(r[25]),'trb':si(r[26]),
        'ast':si(r[27]),'stl':si(r[28]),'blk':si(r[29]),
        'tov':si(r[30]),'pf':si(r[31]),'pts':si(r[32]),
        'gmsc_br':sf(r[33], 1) if len(r)>33 else None,
        'bpm':sf(r[34], 1) if len(r)>34 else None,
        'plus_minus':si(r[35]) if len(r)>35 else None,
    }

# ── Series context derivation ─────────────────────────────────────────────────
def derive_series_context(team_dicts: list) -> dict:
    """
    For every (season, team, date) compute:
      round           — which round this team is in (1=first, N=Finals)
      series_my_wins  — team's wins going INTO this game
      series_opp_wins — opponent's wins going INTO this game

    Algorithm:
      Sort each team's games by date within a season.
      When the opponent changes → new series, increment round counter.
      Track cumulative wins/losses within each series.

    Returns dict keyed by (season, team, date).
    """
    # Group by (season, team), collect (date, opp, won)
    by_team = defaultdict(list)
    for g in team_dicts:
        season = int(g['date'][:4])
        wl, ts, os_, _ = parse_result(g['result_raw'])
        by_team[(season, g['team'])].append({
            'date': g['date'],
            'opp': g['opp'],
            'won': wl == 'W',
        })

    ctx = {}  # (season, team, date) → {round, my_wins, opp_wins}

    for (season, team), games in by_team.items():
        games.sort(key=lambda g: g['date'])
        round_num = 0
        cur_opp   = None
        my_wins   = 0
        opp_wins  = 0

        for g in games:
            if g['opp'] != cur_opp:
                # New series
                round_num += 1
                cur_opp  = g['opp']
                my_wins  = 0
                opp_wins = 0

            ctx[(season, team, g['date'])] = {
                'round':            round_num,
                'series_my_wins':   my_wins,
                'series_opp_wins':  opp_wins,
            }

            if g['won']:
                my_wins  += 1
            else:
                opp_wins += 1

    return ctx

# ── Home/away normalizer ──────────────────────────────────────────────────────
def home_away(raw: str) -> str:
    raw = (raw or '').strip()
    if raw == '@': return 'A'
    if raw == 'N': return 'N'
    return 'H'

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--players', required=True)
    ap.add_argument('--teams',   required=True)
    ap.add_argument('--out',     default='./output')
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    print('Parsing team CSV…')
    team_raw  = parse_team_csv(args.teams)
    team_dicts = [team_row_to_dict(r) for r in team_raw]

    print('Deriving series context…')
    ctx = derive_series_context(team_dicts)
    print(f'  Series context entries: {len(ctx):,}')

    # ── Write team_games.csv ────────────────────────────────────────────────
    print('Writing team_games.csv…')
    TEAM_FIELDS = [
        'team','franchise','date','season','home_away','opp','opp_franchise',
        'result','team_score','opp_score','ot_periods',
        'fg','fga','fg_pct','two_p','two_pa','two_p_pct',
        'three_p','three_pa','three_p_pct','ft','fta','ft_pct',
        'opp_fg','opp_fga','opp_fg_pct','opp_two_p','opp_two_pa','opp_two_p_pct',
        'opp_three_p','opp_three_pa','opp_three_p_pct','opp_ft','opp_fta','opp_ft_pct',
        'round','series_my_wins','series_opp_wins',
    ]
    with open(out / 'team_games.csv', 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=TEAM_FIELDS, extrasaction='ignore')
        w.writeheader()
        skipped = 0
        for g in team_dicts:
            season = int(g['date'][:4])
            key    = (season, g['team'], g['date'])
            if key not in ctx:
                skipped += 1
                continue
            c = ctx[key]
            wl, ts, os_, ot = parse_result(g['result_raw'])
            w.writerow({
                'team':           g['team'],
                'franchise':      franchise(g['team']),
                'date':           g['date'],
                'season':         season,
                'home_away':      home_away(g['home_away_raw']),
                'opp':            g['opp'],
                'opp_franchise':  franchise(g['opp']),
                'result':         wl,
                'team_score':     ts,
                'opp_score':      os_,
                'ot_periods':     ot,
                **{k: g.get(k) for k in TEAM_FIELDS if k in g},
                'round':          c['round'],
                'series_my_wins': c['series_my_wins'],
                'series_opp_wins':c['series_opp_wins'],
            })
        if skipped:
            print(f'  Warning: {skipped} team rows had no context match (investigate)')

    # ── Parse & write player_games.csv ──────────────────────────────────────
    print('Parsing player CSV…')
    player_raw  = parse_player_csv(args.players)
    print(f'  {len(player_raw):,} player rows')

    PLAYER_FIELDS = [
        'player','date','season','team','franchise','home_away','opp','opp_franchise',
        'result','team_score','opp_score','ot_periods',
        'mp','fg','fga','fg_pct','two_p','two_pa','two_p_pct',
        'three_p','three_pa','three_p_pct','ft','fta','ft_pct',
        'ts_pct','orb','drb','trb','ast','stl','blk','tov','pf','pts',
        'gmsc_br','bpm','plus_minus',
        'era','gmsc_computed',
        'round','series_my_wins','series_opp_wins',
    ]

    print('Writing player_games.csv…')
    no_ctx = 0
    with open(out / 'player_games.csv', 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=PLAYER_FIELDS, extrasaction='ignore')
        w.writeheader()

        for r in player_raw:
            g = player_row_to_dict(r)
            season = int(g['date'][:4])
            key    = (season, g['team'], g['date'])

            if key not in ctx:
                no_ctx += 1
                # Still write row with round=1, wins=0 so no data is lost
                c = {'round': 1, 'series_my_wins': 0, 'series_opp_wins': 0}
            else:
                c = ctx[key]

            wl, ts, os_, ot = parse_result(g['result_raw'])
            era  = get_era(season)
            gmsc = compute_gmsc(g, era)

            w.writerow({
                **g,
                'season':          season,
                'franchise':       franchise(g['team']),
                'opp_franchise':   franchise(g['opp']),
                'home_away':       home_away(g['home_away_raw']),
                'result':          wl,
                'team_score':      ts,
                'opp_score':       os_,
                'ot_periods':      ot,
                'era':             era,
                'gmsc_computed':   round(gmsc, 2),
                'round':           c['round'],
                'series_my_wins':  c['series_my_wins'],
                'series_opp_wins': c['series_opp_wins'],
            })

    if no_ctx:
        print(f'  Warning: {no_ctx} player rows had no series context (wrote with round=1, wins=0)')

    print(f'\nDone. Files written to {out}/')
    print(f'  team_games.csv  — {len(team_dicts):,} rows')
    print(f'  player_games.csv — {len(player_raw):,} rows')
    print('\nNext: import both CSVs into Supabase via the dashboard Table Editor → Import CSV.')

if __name__ == '__main__':
    main()
