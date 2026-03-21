#!/usr/bin/env bash
set -euo pipefail

# Installs/updates systemd unit + env file for solana route provisioner.
#
# Usage:
#   sudo ./install-systemd.sh \
#     --repo-root /opt/4626 \
#     --service-user <repo-access-user> \
#     --env-dir /etc/4626

REPO_ROOT=""
# Dedicated service user for the provisioner.
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

FRONTEND_DIR="${REPO_ROOT}/frontend"
DEPLOY_DIR="${FRONTEND_DIR}/server/solana-provisioner/deploy"
UNIT_SRC="${DEPLOY_DIR}/solana-route-provisioner.service"
UNIT_DST="/etc/systemd/system/solana-route-provisioner.service"
ENV_DST="${ENV_DIR}/solana-provisioner.env"
ENV_TEMPLATE="${DEPLOY_DIR}/solana-provisioner.env.example"

if [[ ! -d "${FRONTEND_DIR}" ]]; then
  echo "frontend directory not found: ${FRONTEND_DIR}" >&2
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

if ! su -s /bin/sh -c "test -r \"${FRONTEND_DIR}/package.json\" && test -x \"${FRONTEND_DIR}\"" "${SERVICE_USER}" 2>/dev/null; then
  echo "error: service user '${SERVICE_USER}' cannot access ${FRONTEND_DIR}" >&2
  echo "       choose a service user that can traverse/read the repo path" >&2
  echo "       (for home directories with 750 perms, use the repo owner user)." >&2
  exit 1
fi

install -d -m 0755 "${ENV_DIR}"
if [[ ! -f "${ENV_DST}" ]]; then
  install -m 0640 "${ENV_TEMPLATE}" "${ENV_DST}"
  echo "created ${ENV_DST}; edit it before starting service"
else
  echo "keeping existing ${ENV_DST}"
fi

sed \
  -e "s#^User=.*#User=${SERVICE_USER}#" \
  -e "s#^Group=.*#Group=${SERVICE_USER}#" \
  -e "s#^WorkingDirectory=.*#WorkingDirectory=${FRONTEND_DIR}#" \
  -e "s#^EnvironmentFile=.*#EnvironmentFile=${ENV_DST}#" \
  -e "s#^ExecStart=.*#ExecStart=/usr/bin/env pnpm --dir ${FRONTEND_DIR} solana-provisioner:start#" \
  "${UNIT_SRC}" > "${UNIT_DST}"

chmod 0644 "${UNIT_DST}"

systemctl daemon-reload
systemctl enable solana-route-provisioner.service

echo
echo "Installed unit: ${UNIT_DST}"
echo "Env file:       ${ENV_DST}"
echo
echo "Next:"
echo "  1) Edit ${ENV_DST}"
echo "  2) systemctl restart solana-route-provisioner"
echo "  3) systemctl status solana-route-provisioner --no-pager"
echo "  4) source ${ENV_DST} && curl -fsS -H \"Authorization: Bearer \$PROVISIONER_BEARER_TOKEN\" http://127.0.0.1:8788/healthz"
