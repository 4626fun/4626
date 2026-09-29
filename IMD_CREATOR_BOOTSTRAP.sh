#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 - <<'PYTHON'
from pathlib import Path
import base64,hashlib,zipfile,io
b=base64.b64decode(Path('IMD_CREATOR_VAULTS_ARCHIVE.b64').read_bytes())
assert hashlib.sha256(b).hexdigest() == "5fe22f0051ea176b88f0d36147efd60890e39b211ed9aab83783cdf476d8fa2e", 'Archive hash mismatch'
if not Path('imd-creator-vaults/SOURCE_MANIFEST.json').exists():
    with zipfile.ZipFile(io.BytesIO(b)) as z:
        for n in z.namelist():
            assert n.startswith('imd-creator-vaults/') and '..' not in Path(n).parts
        z.extractall('.')
PYTHON
cd imd-creator-vaults
python3 verify_manifest.py
npm ci --ignore-scripts --no-audit --no-fund
mkdir -p lib
if [ ! -d lib/forge-std/.git ]; then
  git clone https://github.com/foundry-rs/forge-std.git lib/forge-std
fi
git -C lib/forge-std checkout 7117c90c8cf6c68e5acce4f09a6b24715cea4de6
python3 verify_manifest.py
printf '%s\n' 'Ready: cd imd-creator-vaults && node_modules/@foundry-rs/forge-linux-amd64/bin/forge test --summary'
