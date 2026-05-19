"""
Crown Computation Script
Processes player_games.csv chronologically to determine crown history.
"""
import csv, json
from collections import defaultdict

SRC = '/Users/adam.fromal/nba-playoff-db/output/player_games.csv'
OUT = '/Users/adam.fromal/nba-playoff-db/output/crown_history.csv'

def gmsc(row):
    try: return float(row.get('gmsc_computed') or 0)
    except: return 0.0

def mp(row):
    try: return float(row.get('mp') or 999)
    except: return 999.0

def pts(row):
    try: return int(row.get('pts') or 0)
    except: return 0

def trb(row):
    try: return int(row.get('trb') or 0)
    except: return 0

def pick_winner(candidates, current_holder=None):
    """
    From a list of player rows, pick the crown winner.
    If current_holder is in the list and ties for best GmSc, they retain.
    Tiebreaks: fewest minutes, most points, most rebounds.
    """
    if not candidates:
        return None
    best_gs = max(gmsc(p) for p in candidates)

    # If holder is tied for best, retain
    if current_holder:
        holder_rows = [p for p in candidates if p['player'] == current_holder]
        if holder_rows and gmsc(holder_rows[0]) >= best_gs - 0.001:
            return holder_rows[0]

    # All players tied at best_gs
    tied = [p for p in candidates if gmsc(p) >= best_gs - 0.001]
    if len(tied) == 1:
        return tied[0]

    # Tiebreak: fewest mp, then most pts, then most trb
    return min(tied, key=lambda p: (mp(p), -pts(p), -trb(p)))

# ── Load all rows ──────────────────────────────────────────────────────────
all_rows = []
with open(SRC) as f:
    for row in csv.DictReader(f):
        all_rows.append(row)
print(f"Loaded {len(all_rows)} rows")

# ── Group into game events: (date, frozenset([team,opp])) ─────────────────
game_map = defaultdict(lambda: defaultdict(list))
for row in all_rows:
    key = (row['date'], frozenset([row['team'], row['opp']]))
    game_map[key][row['team']].append(row)

# Sort by date, then by opp (consistent ordering within a date)
sorted_keys = sorted(game_map.keys(), key=lambda x: (x[0], sorted(x[1])[0]))
print(f"Total game events: {len(sorted_keys)}")

# ── Group game events by season ───────────────────────────────────────────
def get_season(key):
    team = sorted(key[1])[0]
    rows = game_map[key][team] or game_map[key][sorted(key[1])[1]]
    if rows: return rows[0].get('season','')
    return ''

seasons_order = []
seen_seasons = set()
for k in sorted_keys:
    s = get_season(k)
    if s not in seen_seasons:
        seasons_order.append(s)
        seen_seasons.add(s)

# Group keys by season
by_season = defaultdict(list)
for k in sorted_keys:
    by_season[get_season(k)].append(k)

# ── Crown computation ─────────────────────────────────────────────────────
crown_holder = None  # player name
crown_team   = None  # team abbrev
streak       = 0
total_games  = 0     # total games crown has been held by this holder
history      = []    # list of crown events

def record(event_type, date, season, team, opp, holder, team_abbr,
           prev_holder, prev_team, gs_val, streak_val, total_val):
    history.append({
        'date':         date,
        'season':       season,
        'team':         team,
        'opp':          opp,
        'event':        event_type,   # initial / defend / transfer_teammate / transfer_loss / new_season
        'crown_holder': holder,
        'crown_team':   team_abbr,
        'prev_holder':  prev_holder or '',
        'prev_team':    prev_team or '',
        'gmsc':         f"{gs_val:.2f}",
        'streak':       streak_val,
        'total_games':  total_val,
    })

for season in seasons_order:
    season_keys = by_season[season]

    # Check if crown holder (or their team) appears in this season
    season_players = set()
    season_teams   = set()
    for k in season_keys:
        for team, rows in game_map[k].items():
            season_teams.add(team)
            for r in rows:
                season_players.add(r['player'])

    # If crown holder isn't in this season at all → opening-night free-for-all
    if crown_holder is not None and crown_holder not in season_players:
        # Free-for-all: best GmSc on a winning team on opening night
        first_date = season_keys[0][0]
        opening_keys = [k for k in season_keys if k[0] == first_date]
        candidates = []
        for k in opening_keys:
            for team, rows in game_map[k].items():
                if rows and rows[0].get('result') == 'W':
                    candidates.extend(rows)
        winner = pick_winner(candidates)
        new_season_date = first_date  # remember to skip in normal loop
        if winner:
            prev_h, prev_t = crown_holder, crown_team
            crown_holder = winner['player']
            crown_team   = winner['team']
            streak       = 1
            total_games  = 1
            record('new_season', winner['date'], season,
                   winner['team'], winner['opp'],
                   crown_holder, crown_team, prev_h, prev_t,
                   gmsc(winner), streak, total_games)
        else:
            new_season_date = ''  # no winner found, don't skip anything
        # Fall through — process rest of season normally
    else:
        new_season_date = ''  # no new_season triggered this season

    # Process games in this season that involve the crown team
    for k in season_keys:
        date = k[0]
        teams_in_game = list(game_map[k].keys())

        # Skip opening night if it was handled as a new_season event
        if date == new_season_date:
            continue

        # ── Initial crown (very first game ever) ──
        if crown_holder is None:
            for team, rows in game_map[k].items():
                if rows and rows[0].get('result') == 'W':
                    winner = pick_winner(rows)
                    if winner:
                        crown_holder = winner['player']
                        crown_team   = winner['team']
                        streak       = 1
                        total_games  = 1
                        opp = winner['opp']
                        record('initial', date, season, crown_team, opp,
                               crown_holder, crown_team, None, None,
                               gmsc(winner), streak, total_games)
            continue

        # ── Is crown team playing this game? ──
        if crown_team not in teams_in_game:
            continue  # crown team not playing, skip

        crown_rows  = game_map[k][crown_team]
        other_team  = [t for t in teams_in_game if t != crown_team][0]
        other_rows  = game_map[k][other_team]

        # Determine result for crown team
        crown_won = bool(crown_rows and crown_rows[0].get('result') == 'W')

        opp = crown_rows[0]['opp'] if crown_rows else other_team

        if crown_won:
            # Find best on crown team
            best = pick_winner(crown_rows, current_holder=crown_holder)
            if best and best['player'] == crown_holder:
                # DEFEND
                streak      += 1
                total_games += 1
                record('defend', date, season, crown_team, opp,
                       crown_holder, crown_team, crown_holder, crown_team,
                       gmsc(best), streak, total_games)
            else:
                # TRANSFER to teammate
                prev_h, prev_t = crown_holder, crown_team
                crown_holder   = best['player'] if best else crown_holder
                crown_team     = crown_team  # same team
                streak         = 1
                total_games    = 1
                record('transfer_teammate', date, season, crown_team, opp,
                       crown_holder, crown_team, prev_h, prev_t,
                       gmsc(best) if best else 0, streak, total_games)
        else:
            # Crown team lost → transfer to best on winning side
            best = pick_winner(other_rows)
            prev_h, prev_t = crown_holder, crown_team
            if best:
                crown_holder = best['player']
                crown_team   = other_team
                streak       = 1
                total_games  = 1
                record('transfer_loss', date, season, other_team, crown_rows[0]['team'] if crown_rows else opp,
                       crown_holder, crown_team, prev_h, prev_t,
                       gmsc(best), streak, total_games)

print(f"\nCrown events: {len(history)}")

# ── Write output ───────────────────────────────────────────────────────────
if history:
    fields = list(history[0].keys())
    with open(OUT, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(history)
    print(f"Written to {OUT}")

    # Quick stats
    from collections import Counter
    holders = Counter(e['crown_holder'] for e in history)
    print("\nTop 10 crown holders by event count:")
    for name, cnt in holders.most_common(10):
        print(f"  {cnt:3d}  {name}")

    # Longest streak
    max_streak = max(int(e['streak']) for e in history)
    max_holder = next(e['crown_holder'] for e in history if int(e['streak']) == max_streak)
    print(f"\nLongest streak: {max_streak} games — {max_holder}")
    print(f"Current crown holder: {history[-1]['crown_holder']} (streak {history[-1]['streak']})")
