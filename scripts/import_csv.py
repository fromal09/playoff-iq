#!/usr/bin/env python3
import csv, json, urllib.request, urllib.error, os, time

SUPABASE_URL         = "https://zrluvkxqtzhzghamnvvf.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpybHV2a3hxdHpoemdoYW1udnZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU5NzEwMywiZXhwIjoyMDkzMTczMTAzfQ.F7Xb7YyUvp5VYpndNMVEovbaTH7cePJkyJHedJuR_CI"

BATCH      = 100
MAX_RETRY  = 5
RETRY_WAIT = 3

def make_headers():
    return {
        "apikey":        SUPABASE_SERVICE_KEY,
        "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
        "Content-Type":  "application/json",
        "Prefer":        "resolution=merge-duplicates,return=minimal",
    }

def upsert_batch(table, rows):
    conflict = "player,date" if table == "player_games" else "team,date"
    url  = SUPABASE_URL + "/rest/v1/" + table + "?on_conflict=" + conflict
    data = json.dumps(rows).encode()
    req  = urllib.request.Request(url, data=data, headers=make_headers(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return True, r.status
    except urllib.error.HTTPError as e:
        return False, "HTTP " + str(e.code) + ": " + e.read().decode()[:200]
    except Exception as e:
        return False, str(e)

def coerce(v):
    if v == "" or v is None:
        return None
    try:
        if '.' in str(v):
            return float(v)
        return int(v)
    except (ValueError, TypeError):
        return v

def load_csv(path, dedup_keys=None):
    with open(path, newline="", encoding="utf-8-sig") as f:
        raw = list(csv.DictReader(f))
    rows = [{k: coerce(v) for k, v in r.items()} for r in raw]

    if dedup_keys:
        seen = {}
        deduped = []
        removed = 0
        for r in rows:
            key = tuple(r.get(k) for k in dedup_keys)
            if key not in seen:
                seen[key] = True
                deduped.append(r)
            else:
                removed += 1
        if removed:
            print("  Removed " + str(removed) + " duplicate rows (same " + ",".join(dedup_keys) + ")")
        return deduped

    return rows

def upload(table, path, dedup_keys=None):
    print("")
    print("==================================================")
    print("Table: " + table)
    print("File:  " + path)
    print("==================================================")

    if not os.path.exists(path):
        print("ERROR: File not found: " + path)
        return False

    print("Loading CSV...", end=" ", flush=True)
    rows  = load_csv(path, dedup_keys)
    total = len(rows)
    print(str(total) + " rows")

    uploaded      = 0
    failed_count  = 0
    total_batches = (total + BATCH - 1) // BATCH

    for b in range(total_batches):
        batch   = rows[b * BATCH:(b + 1) * BATCH]
        success = False

        for attempt in range(1, MAX_RETRY + 1):
            ok, result = upsert_batch(table, batch)
            if ok:
                success = True
                break
            if attempt < MAX_RETRY:
                print("")
                print("  Batch " + str(b+1) + " attempt " + str(attempt) + " failed: " + result[:100])
                print("  Retrying in " + str(RETRY_WAIT) + "s...", end=" ", flush=True)
                time.sleep(RETRY_WAIT)
            else:
                print("")
                print("  Batch " + str(b+1) + " FAILED permanently")
                failed_count += 1

        if success:
            uploaded += len(batch)

        pct    = (b + 1) / total_batches * 100
        filled = int(30 * (b + 1) / total_batches)
        bar    = chr(9608) * filled + chr(9617) * (30 - filled)
        print("\r  [" + bar + "] " + str(round(pct, 1)) + "%  " + str(uploaded) + "/" + str(total) + "  batch " + str(b+1) + "/" + str(total_batches) + "  ", end="", flush=True)

    print("")

    if failed_count > 0:
        print("  " + str(failed_count) + " batches failed. Re-run to retry.")
        return False

    print("  Done: " + str(uploaded) + " rows uploaded to " + table)
    return True

base      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
team_path = os.path.join(base, "output", "team_games.csv")
plyr_path = os.path.join(base, "output", "player_games.csv")

print("NBA Playoff DB - CSV Importer")
print("Deduplicates rows before upload. Already-uploaded rows are updated.")

team_ok = upload("team_games",   team_path, dedup_keys=["team", "date"])
plyr_ok = upload("player_games", plyr_path, dedup_keys=["player", "date"])

print("")
print("==================================================")
print("team_games:   " + ("OK" if team_ok else "FAILED - re-run"))
print("player_games: " + ("OK" if plyr_ok else "FAILED - re-run"))
print("Expected: team_games=9,120  player_games=~90,695")
