#!/usr/bin/env bash
set -euo pipefail

# Installs/updates systemd unit + env file for solana-keeper-orchestrator.
#
# Usage:
#   sudo ./install-systemd.sh \
#     --repo-root /opt/4626 \
#     --service-user app4626 \
#     --env-dir /etc/4626

REPO_ROOT=""
SERVICE_USER="app4626"
ENV_DIR="/etc/4626"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-root)
      REPO_ROOT="${2:-}"
      shift 2
      ;;
    --service-user)
      SERVICE_USER="${2:-}"
      shift 2
      ;;
    --env-dir)
      ENV_DIR="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${REPO_ROOT}" ]]; then
  echo "--repo-root is required" >&2
  exit 1
fi

KPR_DIR="${REPO_ROOT}/kpr"
DEPLOY_DIR="${KPR_DIR}/deploy"
UNIT_SRC="${DEPLOY_DIR}/solana-keeper-orchestrator.service"
UNIT_DST="/etc/systemd/system/solana-keeper-orchestrator.service"
ENV_DST="${ENV_DIR}/solana-keeper-orchestrator.env"
ENV_TEMPLATE="${DEPLOY_DIR}/solana-keeper-orchestrator.env.example"
KPR_ENV="${KPR_DIR}/.env"

if [[ ! -d "${KPR_DIR}" ]]; then
  echo "kpr directory not found: ${KPR_DIR}" >&2
  exit 1
fi
if [[ ! -f "${UNIT_SRC}" ]]; then
  echo "unit template missing: ${UNIT_SRC}" >&2
  exit 1
fi
if [[ ! -f "${ENV_TEMPLATE}" ]]; then
  echo "env template missing: ${ENV_TEMPLATE}" >&2
  exit 1
fi

id "${SERVICE_USER}" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "${SERVICE_USER}"

if ! su -s /bin/sh -c "test -r \"${KPR_DIR}/package.json\" && test -x \"${KPR_DIR}\"" "${SERVICE_USER}" 2>/dev/null; then
  echo "error: service user '${SERVICE_USER}' cannot access ${KPR_DIR}" >&2
  exit 1
fi

install -d -m 0755 "${ENV_DIR}"
if [[ ! -f "${ENV_DST}" ]]; then
  install -m 0640 "${ENV_TEMPLATE}" "${ENV_DST}"
  echo "created ${ENV_DST}"
  if [[ -f "${KPR_ENV}" ]]; then
    echo "tip: merge secrets from ${KPR_ENV} into ${ENV_DST}"
  fi
else
  echo "keeping existing ${ENV_DST}"
fi

sed \
  -e "s#^User=.*#User=${SERVICE_USER}#" \
  -e "s#^Group=.*#Group=${SERVICE_USER}#" \
  -e "s#^WorkingDirectory=.*#WorkingDirectory=${KPR_DIR}#" \
  -e "s#^EnvironmentFile=.*#EnvironmentFile=${ENV_DST}#" \
  -e "s#^ExecStart=.*#ExecStart=/usr/bin/env pnpm --dir ${KPR_DIR} start:solana-orchestrator#" \
  "${UNIT_SRC}" > "${UNIT_DST}"

chmod 0644 "${UNIT_DST}"

systemctl daemon-reload
systemctl enable solana-keeper-orchestrator.service

echo
echo "Installed unit: ${UNIT_DST}"
echo "Env file:       ${ENV_DST}"
echo
echo "Next:"
echo "  1) Edit ${ENV_DST} (API key + keeper secrets; see kpr/secrets.example.env)"
echo "  2) cd ${KPR_DIR} && pnpm install"
echo "  3) systemctl restart solana-keeper-orchestrator"
echo "  4) curl -fsS http://127.0.0.1:8789/healthz"
echo "  5) Expose via Caddy: kpr/deploy/Caddyfile.orchestrator.example"
