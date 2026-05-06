"""Run from project root: python3 scripts/import_crown_local.py"""
import csv, json, subprocess, os

CSV = os.path.join(os.path.dirname(__file__), '..', 'output', 'crown_history.csv')
URL = 'https://zrluvkxqtzhzghamnvvf.supabase.co'
KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpybHV2a3hxdHpoemdoYW1udnZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU5NzEwMywiZXhwIjoyMDkzMTczMTAzfQ.F7Xb7YyUvp5VYpndNMVEovbaTH7cePJkyJHedJuR_CI'

with open(CSV) as f:
    rows = list(csv.DictReader(f))

print(f"Importing {len(rows)} rows...")
for i in range(0, len(rows), 500):
    batch = rows[i:i+500]
    r = subprocess.run([
        'curl', '-s', '-X', 'POST',
        f'{URL}/rest/v1/crown_history',
        '-H', f'apikey: {KEY}',
        '-H', f'Authorization: Bearer {KEY}',
        '-H', 'Content-Type: application/json',
        '--data-raw', json.dumps(batch)
    ], capture_output=True, text=True)
    status = 'OK' if not r.stdout.strip() else r.stdout[:60]
    print(f"  {min(i+500,len(rows))}/{len(rows)} {status}")

print("Done.")
