#!/usr/bin/env bash
# Remote-install solana-keeper-orchestrator on the Vultr (or any) host next to the provisioner.
#
# Usage (from repo root):
#   export VULTR_SSH=root@45.63.52.50   # or app4626@...
#   export REPO_ROOT_ON_HOST=/opt/4626
#   ./scripts/ops/remote-install-solana-orchestrator.sh
#
# Optional:
#   ORCHESTRATOR_PUBLIC_URL=https://orchestrator.4626.fun
#   SKIP_VERCEL_ENV=1
#   SKIP_GIT_PULL=1

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

VULTR_SSH="${VULTR_SSH:-}"
REPO_ROOT_ON_HOST="${REPO_ROOT_ON_HOST:-/opt/4626}"
SERVICE_USER="${SERVICE_USER:-app4626}"
ORCHESTRATOR_PUBLIC_URL="${ORCHESTRATOR_PUBLIC_URL:-https://orchestrator.4626.fun}"
LOCAL_ENV="${ROOT}/frontend/.env"

if [[ -z "${VULTR_SSH}" ]]; then
  if [[ -f "${LOCAL_ENV}" ]]; then
    # shellcheck disable=SC1090
    set -a && source "${LOCAL_ENV}" && set +a
    if [[ -n "${VULTR_IP_ADDRESS:-}" && -n "${VULTR_USERNAME:-}" ]]; then
      VULTR_SSH="${VULTR_USERNAME}@${VULTR_IP_ADDRESS}"
    fi
  fi
fi

if [[ -z "${VULTR_SSH}" ]]; then
  echo "Set VULTR_SSH=user@host (or VULTR_IP_ADDRESS + VULTR_USERNAME in frontend/.env)" >&2
  exit 1
fi

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
if [[ -n "${VULTR_ROOT_PASSWORD:-}" ]] && command -v sshpass >/dev/null 2>&1; then
  SSH_WRAP=(sshpass -e ssh "${SSH_OPTS[@]}")
  export SSHPASS="${VULTR_ROOT_PASSWORD}"
elif [[ -n "${VULTR_ROOT_PASSWORD:-}" ]]; then
  echo "Install sshpass for password auth, or configure SSH keys for ${VULTR_SSH}" >&2
  exit 1
else
  SSH_WRAP=(ssh "${SSH_OPTS[@]}")
fi

ORCH_API_KEY=""
if [[ -f "${LOCAL_ENV}" ]]; then
  ORCH_API_KEY="$(grep -E '^SOLANA_ORCHESTRATOR_API_KEY=' "${LOCAL_ENV}" | head -1 | cut -d= -f2- | tr -d '"' || true)"
fi
if [[ -z "${ORCH_API_KEY}" ]]; then
  ORCH_API_KEY="$(openssl rand -hex 32)"
  echo "Generated SOLANA_ORCHESTRATOR_API_KEY for this run (set on Vultr + Vercel)."
fi

echo "==> Target: ${VULTR_SSH} repo=${REPO_ROOT_ON_HOST}"

REMOTE_SCRIPT="$(cat <<'EOS'
set -euo pipefail
REPO_ROOT_ON_HOST="$1"
SERVICE_USER="$2"
ORCH_API_KEY="$3"
SKIP_GIT_PULL="$4"

KPR_DIR="${REPO_ROOT_ON_HOST}/kpr"
ENV_DST="/etc/4626/solana-keeper-orchestrator.env"

if [[ "${SKIP_GIT_PULL}" != "1" ]] && [[ -d "${REPO_ROOT_ON_HOST}/.git" ]]; then
  git -C "${REPO_ROOT_ON_HOST}" fetch origin main
  git -C "${REPO_ROOT_ON_HOST}" checkout main
  git -C "${REPO_ROOT_ON_HOST}" pull --ff-only origin main
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required on the host" >&2
  exit 1
fi

cd "${KPR_DIR}"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

if [[ -f "${KPR_DIR}/.env" ]] && [[ ! -f "${ENV_DST}" ]]; then
  install -d -m 0755 /etc/4626
  bash "${KPR_DIR}/deploy/seed-solana-orchestrator-env.sh" \
    --source "${KPR_DIR}/.env" \
    --dest "${ENV_DST}"
fi

bash "${KPR_DIR}/deploy/install-systemd.sh" --repo-root "${REPO_ROOT_ON_HOST}" --service-user "${SERVICE_USER}"

if [[ -f "${ENV_DST}" ]]; then
  if grep -q '^SOLANA_ORCHESTRATOR_API_KEY=' "${ENV_DST}"; then
    sed -i "s|^SOLANA_ORCHESTRATOR_API_KEY=.*|SOLANA_ORCHESTRATOR_API_KEY=${ORCH_API_KEY}|" "${ENV_DST}"
  else
    echo "SOLANA_ORCHESTRATOR_API_KEY=${ORCH_API_KEY}" >> "${ENV_DST}"
  fi
  if ! grep -q '^SOLANA_ORCHESTRATOR_EXECUTE=' "${ENV_DST}"; then
    echo "SOLANA_ORCHESTRATOR_EXECUTE=1" >> "${ENV_DST}"
  fi
  if ! grep -q '^SOLANA_ORCHESTRATOR_PORT=' "${ENV_DST}"; then
    echo "SOLANA_ORCHESTRATOR_PORT=8789" >> "${ENV_DST}"
  fi
fi

systemctl restart solana-keeper-orchestrator
sleep 1
systemctl is-active solana-keeper-orchestrator
curl -fsS http://127.0.0.1:8789/healthz
echo
EOS
)"

"${SSH_WRAP[@]}" "${VULTR_SSH}" "bash -s" -- "${REPO_ROOT_ON_HOST}" "${SERVICE_USER}" "${ORCH_API_KEY}" "${SKIP_GIT_PULL:-0}" <<< "${REMOTE_SCRIPT}"

echo "==> Local health via SSH tunnel check"
"${SSH_WRAP[@]}" "${VULTR_SSH}" "curl -fsS -H 'Authorization: Bearer ${ORCH_API_KEY}' http://127.0.0.1:8789/healthz && echo"

if [[ "${SKIP_VERCEL_ENV:-0}" != "1" ]] && command -v vercel >/dev/null 2>&1; then
  echo "==> Setting Vercel production env (akita-llc/4626)"
  cd "${ROOT}/frontend"
  printf '%s' "${ORCHESTRATOR_PUBLIC_URL}" | vercel env rm SOLANA_ORCHESTRATOR_URL production -y 2>/dev/null || true
  printf '%s' "${ORCHESTRATOR_PUBLIC_URL}" | vercel env add SOLANA_ORCHESTRATOR_URL production
  printf '%s' "${ORCH_API_KEY}" | vercel env rm SOLANA_ORCHESTRATOR_API_KEY production -y 2>/dev/null || true
  printf '%s' "${ORCH_API_KEY}" | vercel env add SOLANA_ORCHESTRATOR_API_KEY production
  echo "Vercel env updated. Redeploy production for API routes to pick up values."
fi

cat <<EOF

Done on host. Remaining manual steps:
  1) DNS: point orchestrator.4626.fun -> this Vultr host (or add Cloudflare tunnel).
  2) Caddy: merge kpr/deploy/Caddyfile.orchestrator.example and reload caddy.
  3) Regenerate ${ENV_DST} from kpr/.env if it still has CRE_* noise:
       sudo bash kpr/deploy/seed-solana-orchestrator-env.sh --source kpr/.env --dest ${ENV_DST}
  4) Vercel production redeploy after env change.

Public URL for Vercel: ${ORCHESTRATOR_PUBLIC_URL}
EOF
