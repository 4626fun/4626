#!/usr/bin/env bash
# Pull production keeper secrets from Vercel into kpr/.env (non-destructive merge).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND="$ROOT/frontend"
KPR_ENV="$ROOT/kpr/.env"
TMP_ENV="$(mktemp)"

cleanup() { rm -f "$TMP_ENV" /tmp/kpr-key-from-vercel.txt; }
trap cleanup EXIT

if [[ ! -f "$KPR_ENV" ]]; then
  cp "$ROOT/kpr/secrets.example.env" "$KPR_ENV"
  echo "Created $KPR_ENV from secrets.example.env"
fi

cd "$FRONTEND"
vercel env run -e production -- node -e "
const fs = require('fs');
const keys = [
  'KPR_API_KEY',
  'BASE_RPC_URL',
  'BASE_WS_RPC_URL',
  'SOLANA_ORCHESTRATOR_URL',
  'SOLANA_ORCHESTRATOR_API_KEY',
];
const out = {};
for (const k of keys) {
  const v = String(process.env[k] ?? '').trim();
  if (v) out[k] = v;
}
fs.writeFileSync(process.argv[1], JSON.stringify(out));
" "$TMP_ENV"

python3 - <<PY
import json, re
from pathlib import Path

kpr_env = Path("$KPR_ENV")
pulled = json.loads(Path("$TMP_ENV").read_text())
if not pulled.get("KPR_API_KEY"):
    raise SystemExit("Vercel production KPR_API_KEY is empty — set it in Vercel first.")

# Always prefer app shell for protected keeper routes.
pulled["KPR_API_BASE_URL"] = "https://app.4626.fun/api"

text = kpr_env.read_text()
for key, value in pulled.items():
    line = f"{key}={value}"
    if re.search(rf"^{re.escape(key)}=", text, re.M):
        text = re.sub(rf"^{re.escape(key)}=.*$", line, text, count=1, flags=re.M)
    else:
        text = text.rstrip() + "\n" + line + "\n"
kpr_env.write_text(text)
print(f"Synced {len(pulled) + 1} keys into kpr/.env")
PY

echo "Done. Run: ./scripts/ops/test-akita-keeper-stack.sh"
