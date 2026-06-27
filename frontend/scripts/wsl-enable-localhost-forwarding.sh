#!/usr/bin/env bash
# One-shot: apply mirrored WSL networking (Windows side) then restart deploy dry-run.
set -euo pipefail
WSLCFG='/mnt/c/Users/akita/.wslconfig'
mkdir -p "$(dirname "$WSLCFG")"
if ! grep -q 'networkingMode=mirrored' "$WSLCFG" 2>/dev/null; then
  cat >>"$WSLCFG" <<'EOF'
[wsl2]
networkingMode=mirrored
localhostForwarding=true
EOF
  echo "Wrote mirrored networking to $WSLCFG"
else
  echo "Mirrored networking already configured in $WSLCFG"
fi
echo ""
echo "Stopping WSL so mirrored networking takes effect..."
/mnt/c/Windows/System32/wsl.exe --shutdown || true
echo "Done. Re-open Cursor/WSL, then run: pnpm -C frontend run dev:deploy-dry-run"
echo "Open http://localhost:5174/waitlist in your Windows browser."
