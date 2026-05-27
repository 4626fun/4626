#!/usr/bin/env tsx
/**
 * Merge a Solana mint → Base ShareOFT mapping on Vultr orchestrator env + restart.
 *
 *   pnpm -C frontend ops:update-vultr-mapping \
 *     --mint 5puVV8bQZp4YoEfGq4RitQFRVC3SJiHBSydFuFZUXHQv \
 *     --share-oft 0xNewShareOFT
 *
 * Requires VULTR_USERNAME + VULTR_IP_ADDRESS (or VULTR_SSH) in frontend/.env.
 * Uses sshpass when available + VULTR_ROOT_PASSWORD; otherwise OpenSSH key auth.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getAddress, isAddress, type Address } from 'viem'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../..')
const ENV_FILE = '/etc/4626/solana-keeper-orchestrator.env'

function getArg(name: string): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return ''
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return ''
  return String(next).trim()
}

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(resolve(FRONTEND_ROOT, '.env.local'))
loadEnvFile(resolve(FRONTEND_ROOT, '.env'))

function resolveSshTarget(): string {
  const explicit = process.env.VULTR_SSH?.trim()
  if (explicit) return explicit
  const user = process.env.VULTR_USERNAME?.trim()
  const host = process.env.VULTR_IP_ADDRESS?.trim()
  if (user && host) return `${user}@${host}`
  throw new Error('Set VULTR_SSH or VULTR_USERNAME + VULTR_IP_ADDRESS in frontend/.env')
}

function runSsh(target: string, remoteScript: string): { ok: boolean; output: string } {
  const sshOpts = ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=20']
  const password = process.env.VULTR_ROOT_PASSWORD?.trim()
  const hasSshpass = spawnSync('sh', ['-c', 'command -v sshpass'], { encoding: 'utf8' }).stdout.trim()

  let result
  if (password && hasSshpass) {
    result = spawnSync('sshpass', ['-e', 'ssh', ...sshOpts, target, 'bash', '-s'], {
      input: remoteScript,
      encoding: 'utf8',
      env: { ...process.env, SSHPASS: password },
    })
  } else {
    result = spawnSync('ssh', [...sshOpts, target, 'bash', '-s'], {
      input: remoteScript,
      encoding: 'utf8',
    })
  }

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  return { ok: result.status === 0, output }
}

function main(): void {
  const mint = getArg('--mint')
  const shareOftRaw = getArg('--share-oft')
  if (!mint || !shareOftRaw) {
    process.stdout.write(
      'Usage: pnpm -C frontend ops:update-vultr-mapping --mint <solana-pubkey> --share-oft 0x...\n',
    )
    process.exit(1)
  }
  if (!isAddress(shareOftRaw)) {
    process.stdout.write(`Invalid --share-oft: ${shareOftRaw}\n`)
    process.exit(1)
  }
  const shareOft = getAddress(shareOftRaw as Address).toLowerCase()

  const target = resolveSshTarget()
  const remoteScript = `
set -euo pipefail
ENV_FILE="${ENV_FILE}"
MINT="${mint}"
SHARE_OFT="${shareOft}"

if [[ ! -f "\$ENV_FILE" ]]; then
  echo "MISSING \$ENV_FILE" >&2
  exit 1
fi

python3 <<'PY'
import json, re, sys
from pathlib import Path

env_path = Path("${ENV_FILE}")
mint = "${mint}"
share_oft = "${shareOft}".lower()
text = env_path.read_text()
match = re.search(r'^SOLANA_SHARE_OFT_MAPPING=(.*)$', text, re.M)
mapping = {}
if match:
    raw = match.group(1).strip()
    if raw.startswith("'") and raw.endswith("'"):
        raw = raw[1:-1]
    if raw.startswith('"') and raw.endswith('"'):
        raw = raw[1:-1]
    if raw:
        try:
            mapping = json.loads(raw)
        except json.JSONDecodeError:
            mapping = {}
mapping[mint] = share_oft
new_val = json.dumps(mapping, separators=(',', ':'))
new_line = f"SOLANA_SHARE_OFT_MAPPING='{new_val}'"
if match:
    text = re.sub(r'^SOLANA_SHARE_OFT_MAPPING=.*$', new_line, text, count=1, flags=re.M)
else:
    text = text.rstrip() + "\\n" + new_line + "\\n"
env_path.write_text(text)
print("UPDATED", new_val)
PY

systemctl restart solana-keeper-orchestrator
sleep 1
systemctl is-active solana-keeper-orchestrator
curl -fsS http://127.0.0.1:8789/healthz
echo
`

  process.stdout.write(`Updating Vultr orchestrator mapping via ${target}...\n`)
  const { ok, output } = runSsh(target, remoteScript)
  process.stdout.write(`${output}\n`)
  if (!ok) {
    process.stdout.write(
      '\nVultr update failed. Install sshpass + VULTR_ROOT_PASSWORD, or configure SSH keys.\n' +
        'Manual merge on host:\n' +
        `  SOLANA_SHARE_OFT_MAPPING='{"${mint}":"${shareOft}"}'\n` +
        '  sudo systemctl restart solana-keeper-orchestrator\n\n',
    )
    process.exit(1)
  }
  process.stdout.write('\n✓ Vultr orchestrator mapping updated and service restarted.\n\n')
}

main()
