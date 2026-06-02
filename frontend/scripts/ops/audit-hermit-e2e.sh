#!/usr/bin/env bash
# Hermit / AlfaClub creative lane — automated audit + manual checklist.
#
# Runs repo-local gates (tests, seeds, env preflight, Hermit probe) and prints
# the live-room steps operators still do by hand.
#
# Usage (from repo root):
#   bash frontend/scripts/ops/audit-hermit-e2e.sh
#   bash frontend/scripts/ops/audit-hermit-e2e.sh --production-env --strict
#   bash frontend/scripts/ops/audit-hermit-e2e.sh --skip-probe --skip-pinata
#
# Options:
#   --strict           Exit 1 if any automated check fails
#   --production-env   Run env preflight + creative probe via `vercel env run -e production`
#   --skip-tests       Skip Vitest Hermit suite
#   --skip-probe       Skip probe-pinata-hermit.ts (needs HERMIT_AGENT_*)
#   --skip-pinata      Skip Pinata CLI agent/gateway checks
#   --help             Show usage

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
FRONTEND="$REPO_ROOT/frontend"
FAILURES=0

STRICT=0
PRODUCTION_ENV=0
SKIP_TESTS=0
SKIP_PROBE=0
SKIP_PINATA=0

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \?//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict) STRICT=1 ;;
    --production-env) PRODUCTION_ENV=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    --skip-probe) SKIP_PROBE=1 ;;
    --skip-pinata) SKIP_PINATA=1 ;;
    --help | -h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

log_section() {
  echo
  echo "== $* =="
}

log_ok() {
  echo "OK: $*"
}

log_warn() {
  echo "WARN: $*"
}

log_fail() {
  echo "FAIL: $*"
  FAILURES=$((FAILURES + 1))
}

load_local_env() {
  for env_file in "$FRONTEND/.env.local" "$FRONTEND/.env"; do
    if [[ -f "$env_file" ]]; then
      # shellcheck disable=SC1090
      set -a && source "$env_file" && set +a
    fi
  done
}

run_in_env() {
  if [[ "$PRODUCTION_ENV" -eq 1 ]]; then
    if ! command -v vercel >/dev/null 2>&1; then
      log_fail "vercel CLI not found (needed for --production-env)"
      return 1
    fi
    (cd "$FRONTEND" && vercel env run -e production -- "$@")
  else
    load_local_env
    (cd "$FRONTEND" && "$@")
  fi
}

resolve_pinata_cli() {
  if [[ -n "${PINATA_CLI:-}" && -x "$PINATA_CLI" ]]; then
    echo "$PINATA_CLI"
    return 0
  fi
  local candidates=(
    "$HOME/.local/share/pinata/pinata"
    "$(command -v pinata 2>/dev/null || true)"
  )
  for candidate in "${candidates[@]}"; do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

resolve_agent_id() {
  local endpoint="${HERMIT_AGENT_CHAT_ENDPOINT:-}"
  if [[ -z "$endpoint" ]]; then
    echo "x7lmjaxx"
    return 0
  fi
  python3 - <<'PY' "$endpoint"
import sys
from urllib.parse import urlparse
host = urlparse(sys.argv[1]).hostname or ""
if host.endswith(".agents.pinata.cloud"):
    print(host.split(".", 1)[0])
else:
    print("x7lmjaxx")
PY
}

echo "Hermit creative lane E2E audit"
echo "repo: $REPO_ROOT"
if [[ "$PRODUCTION_ENV" -eq 1 ]]; then
  echo "env: production (vercel env run)"
else
  echo "env: local (frontend/.env.local + .env)"
fi

log_section "1. Workspace seeds"
if bash "$FRONTEND/scripts/hermit-seed-sync.sh" verify-local; then
  log_ok "hermit seed files present and non-empty"
else
  log_fail "hermit-seed-sync verify-local"
fi

log_section "2. Hermit unit + architecture tests"
if [[ "$SKIP_TESTS" -eq 1 ]]; then
  log_warn "skipped (--skip-tests)"
else
  if (
    cd "$FRONTEND" &&
      pnpm exec vitest run \
        server/_lib/hermit/ \
        server/commands/families/help.test.ts \
        server/_lib/alfaclub/alfaclubChatHelp.test.ts \
        api/__tests__/alfaclubArchitectureInvariants.test.ts
  ); then
    log_ok "Vitest Hermit suite"
  else
    log_fail "Vitest Hermit suite"
  fi
fi

log_section "3. AlfaClub / Hermit env preflight"
if run_in_env pnpm exec tsx scripts/ops/alfaclub-env-preflight.ts --strict; then
  log_ok "alfaclub-env-preflight --strict"
else
  log_fail "alfaclub-env-preflight --strict"
fi

log_section "4. Hermit creative probe (skillRouter)"
if [[ "$SKIP_PROBE" -eq 1 ]]; then
  log_warn "skipped (--skip-probe)"
else
  if run_in_env pnpm exec tsx scripts/ops/probe-pinata-hermit.ts; then
    log_ok "probe-pinata-hermit"
  else
    log_fail "probe-pinata-hermit (check HERMIT_AGENT_* and agent status)"
  fi
fi

log_section "5. Pinata agent health (CLI)"
if [[ "$SKIP_PINATA" -eq 1 ]]; then
  log_warn "skipped (--skip-pinata)"
else
  PINATA_BIN="$(resolve_pinata_cli || true)"
  if [[ -z "$PINATA_BIN" ]]; then
    log_warn "pinata CLI not found — install or set PINATA_CLI"
  else
    load_local_env
    AGENT_ID="$(resolve_agent_id)"
    echo "agent: $AGENT_ID (from HERMIT_AGENT_CHAT_ENDPOINT or default)"

    if STATUS_JSON="$("$PINATA_BIN" agents get "$AGENT_ID" 2>/dev/null)"; then
      AGENT_STATUS="$(python3 - <<'PY' "$STATUS_JSON"
import json, sys
raw = sys.argv[1].strip()
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print("unknown")
    raise SystemExit(0)
candidates = [
    data.get("processStatus"),
    (data.get("agent") or {}).get("status"),
    (data.get("agent") or {}).get("state"),
    data.get("status"),
    data.get("state"),
    data.get("phase"),
]
for val in candidates:
    if isinstance(val, str) and val.strip():
        print(val.strip().lower())
        raise SystemExit(0)
print("unknown")
PY
)"
      if [[ "$AGENT_STATUS" == "running" || "$AGENT_STATUS" == "ready" ]]; then
        log_ok "Pinata agent status=$AGENT_STATUS"
      else
        log_fail "Pinata agent status=$AGENT_STATUS (expected running)"
      fi
    else
      log_fail "pinata agents get $AGENT_ID"
    fi

    if GATEWAY_REPORT="$("$PINATA_BIN" agents config get "$AGENT_ID" 2>/dev/null)"; then
      if python3 - <<'PY' "$GATEWAY_REPORT" "$AGENT_ID"
import json, sys
raw = sys.argv[1].strip()
agent_id = sys.argv[2]
try:
    inner = json.loads(raw)
    if isinstance(inner, str):
        cfg = json.loads(inner)
    else:
        cfg = inner
except json.JSONDecodeError:
    print(f"FAIL: could not parse pinata config for {agent_id}")
    raise SystemExit(1)
env = cfg.get("env") or {}
expected = f"https://{agent_id}.agents.pinata.cloud"
failed = 0
for key in ("PINATA_GATEWAY", "PINATA_GATEWAY_URL"):
    val = str(env.get(key) or "").strip()
    if val == expected:
        print(f"OK: inline {key} -> {val}")
    elif not val:
        print(f"WARN: inline {key} unset (attached secret may still override)")
    else:
        print(f"FAIL: inline {key}={val} (expected {expected})")
        failed += 1
raise SystemExit(1 if failed else 0)
PY
      then
        log_ok "Pinata gateway inline config"
      else
        log_fail "Pinata gateway inline config drift"
      fi
    else
      log_warn "pinata agents config get failed (non-fatal if secrets are correct)"
    fi
  fi
fi

log_section "6. Production env spot-check (optional)"
if [[ "$PRODUCTION_ENV" -eq 1 ]]; then
  if command -v vercel >/dev/null 2>&1; then
    if (
      cd "$FRONTEND" &&
        vercel env run -e production -- python3 - <<'PY'
import os
checks = {
    "HERMIT_AGENT_CHAT_ENDPOINT": lambda v: len(v.strip()) >= 8,
    "HERMIT_AGENT_BEARER_TOKEN": lambda v: len(v.strip()) >= 8,
    "ALFACLUB_HERMIT_COMMAND_ROOMS": lambda v: "1043" in v or "1659" in v,
    "ALFACLUB_CHAT_BRIDGE_ENABLED": lambda v: v.strip() in ("1", "true", "yes", "on"),
}
failed = 0
for key, ok in checks.items():
    val = os.environ.get(key, "")
    if ok(val):
        if key.endswith("TOKEN"):
            print(f"OK: {key} set (len={len(val.strip())})")
        else:
            print(f"OK: {key}={val.strip()[:72]}")
    else:
        print(f"FAIL: {key} missing or unexpected")
        failed += 1
raise SystemExit(1 if failed else 0)
PY
    ); then
      log_ok "Vercel production Hermit env keys"
    else
      log_fail "Vercel production Hermit env keys"
    fi
  else
    log_fail "vercel CLI missing for --production-env"
  fi
else
  echo "SKIP: pass --production-env to verify Vercel production vars via vercel env run"
fi

log_section "Manual checklist (AlfaClub rooms 1043 + 1659)"
cat <<'EOF'
Run these in live rooms after automated checks pass:

  [ ] /bridge or /alfa status — JWT + bridge pipeline healthy
  [ ] /help — Hermit catalog, under 2k chars
  [ ] /hermit copy probe ok one line only — Hermit copy, no unavailable error
  [ ] /meme akita noir — caption; inline GIF/image if provider returns HTTPS asset
  [ ] /gmeow — bare command: local GIF (fast) unless HERMIT_GMEOW_HERMIT_CAPTION=always
  [ ] /gmeow moon — Hermit caption when args present
  [ ] /hermit announce drop nuevo — Spanish values, English JSON keys

Ops hygiene:

  [ ] Vercel /api/v1/alfaclub/chat-bridge-run logs: no privy_refresh_failed, no CF 403
  [ ] Railway Hermit/Keepr: ALFACLUB_CHAT_BRIDGE_ENABLED unset (Vercel sole writer)
  [ ] alfaclub_runtime_secret.chat_jwt updated_by=privy-token-refresher within ~30 min
  [ ] After seed edits: hermit-seed-sync.sh tar → upload Pinata workspace → restart agent

Reference: docs/operations/alfaclub-creative-architecture.md
           docs/operations/hermit-pinata-spanish.md § Verifying after deploy
EOF

log_section "Summary"
if [[ "$FAILURES" -eq 0 ]]; then
  echo "Result: all automated checks passed."
  echo "Complete the manual checklist above before calling the lane fully audited."
  exit 0
fi

echo "Result: $FAILURES automated check(s) failed."
if [[ "$STRICT" -eq 1 ]]; then
  exit 1
fi
exit 0
