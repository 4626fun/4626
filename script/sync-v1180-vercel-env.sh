#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AMOE_ROUTER="${1:-}"

if [[ -z "$AMOE_ROUTER" ]]; then
  echo "Usage: $0 <AMOE_ROUTER_ADDRESS>" >&2
  exit 1
fi

HANDOFF="${BASE_RELEASE_HANDOFF_ENV_PATH:-${ROOT_DIR}/tmp/base-v1.19.1-handoff.env}"
if [[ ! -f "$HANDOFF" ]]; then
  HANDOFF="${ROOT_DIR}/tmp/base-v1.18.0-handoff.env"
fi
if [[ -f "$HANDOFF" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$HANDOFF"
  set +a
fi

# CRON_SECRET for publish-cron lives in frontend/.env (not root .env).
if [[ -f "${ROOT_DIR}/frontend/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/frontend/.env"
  set +a
fi

REGISTRY="${REGISTRY_4626:-${REGISTRY:-0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2}}"
OVAULT_FACTORY="${OVAULT_FACTORY:-0xCAb65a066A4D52DD29ffB418B319819176b89610}"
VAULT_ACTIVATION_BATCHER="${VAULT_ACTIVATION_BATCHER:-0x6552C6AF7a76646E938C0FBf549c5ec9a22c5bcA}"
LOTTERY_MANAGER="${LOTTERY_MANAGER:-0xB45E68a5867935a5734E4185977F81c528006650}"
VRF_CONSUMER="${VRF_CONSUMER:-0x98fb5e0af3120B32E2E03400B6E51d0bde433670}"
UNIVERSAL_BYTECODE_STORE="${UNIVERSAL_BYTECODE_STORE:-0xF9622613682a12E46b914c7498716F42E44c4d36}"
UNIVERSAL_CREATE2_DEPLOYER="${UNIVERSAL_CREATE2_DEPLOYER:-0xe2a8aA094EAf0f9ED05C030E6FcB90B9d139b0e2}"
DEPLOYMENT_BATCHER="${DEPLOYMENT_BATCHER:-0xa18169caf37fa0347285B16aAFC2B09eCB43F145}"
VAULT_AUXILIARY_DEPLOY_BATCHER="${VAULT_AUXILIARY_DEPLOY_BATCHER:-0xaA9229c1649a7eC6DA85a76097E0910B24F9408e}"
EPOCH="${DEPLOYMENT_EPOCH_TAG:-v1.19.1}"

declare -A SERVER_ENV=(
  [REGISTRY_4626]="$REGISTRY"
  [REGISTRY]="$REGISTRY"
  [OVAULT_FACTORY]="$OVAULT_FACTORY"
  [VAULT_ACTIVATION_BATCHER]="$VAULT_ACTIVATION_BATCHER"
  [LOTTERY_MANAGER]="$LOTTERY_MANAGER"
  [VRF_CONSUMER]="$VRF_CONSUMER"
  [UNIVERSAL_BYTECODE_STORE]="$UNIVERSAL_BYTECODE_STORE"
  [UNIVERSAL_CREATE2_DEPLOYER]="$UNIVERSAL_CREATE2_DEPLOYER"
  [UNIVERSAL_CREATE2_FROM_STORE]="$UNIVERSAL_CREATE2_DEPLOYER"
  [DEPLOYMENT_BATCHER]="$DEPLOYMENT_BATCHER"
  [DEPLOYMENT_BATCHER_AUTO_HANDOFF]="$DEPLOYMENT_BATCHER"
  [VAULT_AUXILIARY_DEPLOY_BATCHER]="$VAULT_AUXILIARY_DEPLOY_BATCHER"
  [LOTTERY_AMOE_ROUTER]="$AMOE_ROUTER"
  [DEPLOYMENT_EPOCH_TAG]="$EPOCH"
)

declare -A CLIENT_ENV=(
  [VITE_REGISTRY]="$REGISTRY"
  [VITE_FACTORY]="$OVAULT_FACTORY"
  [VITE_VAULT_ACTIVATION_BATCHER]="$VAULT_ACTIVATION_BATCHER"
  [VITE_LOTTERY_MANAGER]="$LOTTERY_MANAGER"
  [VITE_VRF_CONSUMER]="$VRF_CONSUMER"
  [VITE_UNIVERSAL_BYTECODE_STORE]="$UNIVERSAL_BYTECODE_STORE"
  [VITE_UNIVERSAL_CREATE2_DEPLOYER]="$UNIVERSAL_CREATE2_DEPLOYER"
  [VITE_DEPLOYMENT_BATCHER]="$DEPLOYMENT_BATCHER"
  [VITE_DEPLOYMENT_BATCHER_AUTO_HANDOFF]="$DEPLOYMENT_BATCHER"
  [VITE_VAULT_AUXILIARY_DEPLOY_BATCHER]="$VAULT_AUXILIARY_DEPLOY_BATCHER"
  [VITE_LOTTERY_AMOE_ROUTER]="$AMOE_ROUTER"
  [VITE_DEPLOYMENT_VERSION]="$EPOCH"
)

declare -A PRIVY_ENV=(
  [PRIVY_WALLET_AUTHORIZATION_KEY]="${PRIVY_WALLET_AUTHORIZATION_KEY:-}"
  [PRIVY_WALLET_OWNER_ID]="${PRIVY_WALLET_OWNER_ID:-}"
  [AMOE_LEDGER_PUBLISHER_PRIVY_WALLET_ID]="${CANONICAL_CSW_PRIVY_WALLET_ID:-${AMOE_LEDGER_PUBLISHER_PRIVY_WALLET_ID:-}}"
  [AMOE_LEDGER_PUBLISHER_OWNER_ADDRESS]="${AMOE_LEDGER_PUBLISHER_OWNER_ADDRESS:-0x858c01556EC5a8531fA4118d595430AC7fD0baF0}"
)

VERCEL_TEAM_ID="${VERCEL_TEAM_ID:-akita-llc}"
VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-prj_OepP5CKsVckpdLIGi1zRCZdiUPJ7}"

vercel_auth_token() {
  python3 -c "import json; print(json.load(open('${HOME}/.local/share/com.vercel.cli/auth.json'))['token'])"
}

vercel_preview_env_create_via_api() {
  local key="$1"
  local value="$2"
  local token
  token="$(vercel_auth_token)"
  curl -fsS -X POST "https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"${key}\",\"value\":\"${value}\",\"type\":\"encrypted\",\"target\":[\"preview\"]}" \
    >/tmp/vercel-env-api.log 2>&1
}

upsert_env() {
  local target="$1"
  local key="$2"
  local value="$3"
  local preview_branch="${VERCEL_PREVIEW_GIT_BRANCH:-}"
  local cmd=(vercel env add "$key" "$target" --force --yes --value "$value")
  if [[ "$target" == "preview" ]]; then
    # Preview add prompts for git branch in non-interactive CLI; update existing keys instead.
    cmd=(vercel env update "$key" preview --yes --value "$value")
    if [[ -n "$preview_branch" ]]; then
      cmd=(vercel env update "$key" preview "$preview_branch" --yes --value "$value")
    fi
  fi
  ( "${cmd[@]}" >/tmp/vercel-env-add.log 2>&1 ) &
  local pid=$!
  local i=0
  while kill -0 "$pid" 2>/dev/null && (( i < 20 )); do
    if grep -qE "Overrode Environment Variable|Updated Environment Variable" /tmp/vercel-env-add.log 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      echo "  $target $key"
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  if grep -qE "Overrode Environment Variable|Updated Environment Variable" /tmp/vercel-env-add.log 2>/dev/null; then
    echo "  $target $key"
    return 0
  fi
  if [[ "$target" == "preview" ]] && grep -q "env_not_found" /tmp/vercel-env-add.log 2>/dev/null; then
    if vercel_preview_env_create_via_api "$key" "$value"; then
      echo "  preview $key (created via API)"
      return 0
    fi
    cat /tmp/vercel-env-api.log >&2
  fi
  echo "  FAIL $target $key" >&2
  cat /tmp/vercel-env-add.log >&2
  return 1
}

cd "$ROOT_DIR/frontend"

preview_label="all preview branches"
if [[ -n "${VERCEL_PREVIEW_GIT_BRANCH:-}" ]]; then
  preview_label="preview@${VERCEL_PREVIEW_GIT_BRANCH}"
fi
IFS=',' read -r -a SYNC_TARGETS <<< "${VERCEL_SYNC_TARGETS:-production,development,preview}"
echo "==> Syncing Vercel env for project 4626 (${SYNC_TARGETS[*]})"
SYNC_FAILURES=0
for target in "${SYNC_TARGETS[@]}"; do
  for key in "${!SERVER_ENV[@]}"; do
    upsert_env "$target" "$key" "${SERVER_ENV[$key]}" || SYNC_FAILURES=$((SYNC_FAILURES + 1))
  done
  for key in "${!CLIENT_ENV[@]}"; do
    upsert_env "$target" "$key" "${CLIENT_ENV[$key]}" || SYNC_FAILURES=$((SYNC_FAILURES + 1))
  done
  for key in "${!PRIVY_ENV[@]}"; do
    value="${PRIVY_ENV[$key]}"
    if [[ -z "$value" ]]; then
      echo "  skip $target $key (empty locally)" >&2
      continue
    fi
    upsert_env "$target" "$key" "$value" || SYNC_FAILURES=$((SYNC_FAILURES + 1))
  done
done

if (( SYNC_FAILURES > 0 )); then
  echo "==> Env sync finished with ${SYNC_FAILURES} failure(s)" >&2
  exit 1
fi

if [[ " ${SYNC_TARGETS[*]} " == *" production "* ]]; then
cd "$ROOT_DIR/frontend"
echo "==> Redeploy latest production (picks up env + VITE_* build vars)"
if vercel redeploy 4626.fun --target=production --no-wait 2>&1 | tail -5; then
  :
else
  echo "    warn: vercel redeploy 4626.fun failed; retry from dashboard if needed" >&2
fi
fi

echo "==> Trigger AMOE publish-cron (best-effort)"
if [[ -n "${CRON_SECRET:-}" ]]; then
  curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" \
    "https://4626.fun/api/v1/lottery/amoe/publish-cron" || true
  curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" \
    "https://app.4626.fun/api/v1/lottery/amoe/publish-cron" || true
else
  echo "    skip: CRON_SECRET not set locally"
fi
