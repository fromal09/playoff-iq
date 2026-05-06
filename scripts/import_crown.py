"""Import crown_history.csv into Supabase crown_history table."""
import csv, os, subprocess, json, sys

CSV = '/home/claude/nba-playoff-db/output/crown_history.csv'
URL = 'https://zrluvkxqtzhzghamnvvf.supabase.co'
KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpybHV2a3hxdHpoemdoYW1udnZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU5NzEwMywiZXhwIjoyMDkzMTczMTAzfQ.F7Xb7YyUvp5VYpndNMVEovbaTH7cePJkyJHedJuR_CI'

with open(CSV) as f:
    rows = list(csv.DictReader(f))

def upsert_batch(batch):
    data = json.dumps(batch)
    result = subprocess.run([
        'curl', '-s', '-X', 'POST',
        f'{URL}/rest/v1/crown_history',
        '-H', f'apikey: {KEY}',
        '-H', f'Authorization: Bearer {KEY}',
        '-H', 'Content-Type: application/json',
        '-H', 'Prefer: resolution=merge-duplicates',
        '--data-raw', data
    ], capture_output=True, text=True)
    if result.returncode != 0 or 'error' in result.stdout.lower():
        print(f"  Error: {result.stdout[:200]}")
        return False
    return True

BATCH = 500
total = len(rows)
for i in range(0, total, BATCH):
    batch = rows[i:i+BATCH]
    ok = upsert_batch(batch)
    print(f"{'OK' if ok else 'ERR'} {min(i+BATCH,total)}/{total}")

print("Done")
