#!/usr/bin/env bash
# Hermit / AlfaClub runtime ownership — automated audit + manual checklist.
#
# Verifies Railway bridge/executor ownership, Vercel creative/cron ownership,
# durable reaction claims, and the live-room steps operators still do by hand.
#
# Usage (from repo root):
#   bash frontend/scripts/ops/audit-hermit-e2e.sh
#   bash frontend/scripts/ops/audit-hermit-e2e.sh --production-env --strict
#   bash frontend/scripts/ops/audit-hermit-e2e.sh --skip-probe
#
# Options:
#   --strict           Exit 1 if any automated check fails
#   --production-env   Run env preflight + creative probe via `vercel env run -e production`
#   --skip-tests       Skip Vitest Hermit suite
#   --skip-probe       Skip the Vercel creative draft probe (needs HERMIT_AGENT_*)
#   --help             Show usage

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
FRONTEND="$REPO_ROOT/frontend"
FAILURES=0

STRICT=0
PRODUCTION_ENV=0
SKIP_TESTS=0
SKIP_PROBE=0

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \?//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict) STRICT=1 ;;
    --production-env) PRODUCTION_ENV=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    --skip-probe) SKIP_PROBE=1 ;;
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

run_in_env() {
  if [[ "$PRODUCTION_ENV" -eq 1 ]]; then
    if ! command -v vercel >/dev/null 2>&1; then
      log_fail "vercel CLI not found (needed for --production-env)"
      return 1
    fi
    (cd "$FRONTEND" && vercel env run -e production -- "$@")
  else
    # Node parses dotenv records as data. Never `source` operator-managed env
    # files, since command substitutions in them would execute as shell code.
    local executable
    executable="$(command -v "$1")"
    shift
    (
      cd "$FRONTEND" &&
        node \
          --env-file-if-exists=.env \
          --env-file-if-exists=.env.local \
          "$executable" "$@"
    )
  fi
}

echo "Hermit runtime ownership E2E audit"
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

log_section "4. Vercel creative draft probe (via skillRouter)"
if [[ "$SKIP_PROBE" -eq 1 ]]; then
  log_warn "skipped (--skip-probe)"
else
  if run_in_env pnpm exec tsx scripts/ops/probe-pinata-hermit.ts; then
    log_ok "Vercel creative draft probe"
  else
    log_fail "Vercel creative draft probe (check HERMIT_AGENT_* and /api/hermit/draft)"
  fi
fi

log_section "5. Vercel production ownership spot-check (optional)"
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
    "ALFACLUB_API_KEY": lambda v: len(v.strip()) >= 8,
}
failed = 0
for key, ok in checks.items():
    val = os.environ.get(key, "")
    if ok(val):
        if key.endswith("TOKEN") or key.endswith("API_KEY"):
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

log_section "Manual checklist (all configured Hermit rooms)"
cat <<'EOF'
Run these in live rooms after automated checks pass:

  [ ] /bridge or /alfa status — JWT + bridge pipeline healthy
  [ ] /help — Hermit catalog, under 2k chars
  [ ] /h copy probe ok one line only — Hermit copy, no unavailable error
  [ ] /meme akita noir — caption; inline GIF/image if provider returns HTTPS asset
  [ ] /gmeow — bare command: local GIF (fast) unless HERMIT_GMEOW_HERMIT_CAPTION=always
  [ ] /gmeow moon — Hermit caption when args present
  [ ] /h announce drop nuevo — Spanish values, English JSON keys

Ops hygiene:

  [ ] Railway Hermit /readyz: bridgeStarted=true
  [ ] Railway Hermit /readyz: tokenRefresherStarted=false, reason=vercel_cron_owner
  [ ] Railway Hermit /readyz: 200 only when an enabled runner has counterTradeEffective=true
  [ ] Vercel /api/v1/alfaclub/chat-token-refresh: recent 200, no privy_refresh_failed
  [ ] Supabase inverse_opinion_* claim/outbox tables exist before capture is enabled
  [ ] ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED=1 on the single Railway executor

Reference: frontend/Dockerfile.hermit
           frontend/vercel.json
           docs/_internal/operations/alfaclub/alfaclub-counter-trade-production-runbook.md
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
