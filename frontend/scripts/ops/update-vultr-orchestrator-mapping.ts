#!/usr/bin/env tsx
/**
 * Merge a Solana mint → Base ShareOFT mapping on Vultr orchestrator env + restart.
 * Also ensures SOLANA_CREATOR_MINTS contains the provided mint.
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
import { getDb, isDbConfigured } from '../../server/_lib/db/postgres.js'

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

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function hexToBytes(hex: string): Uint8Array | null {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex
  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length % 2 !== 0) return null
  const bytes = new Uint8Array(normalized.length / 2)
  for (let i = 0; i < normalized.length; i += 2) {
    const byte = Number.parseInt(normalized.slice(i, i + 2), 16)
    if (!Number.isFinite(byte)) return null
    bytes[i / 2] = byte
  }
  return bytes
}

function bytesToBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''
  let value = 0n
  for (const b of bytes) value = value * 256n + BigInt(b)
  let encoded = ''
  while (value > 0n) {
    const mod = Number(value % 58n)
    encoded = BASE58_ALPHABET[mod] + encoded
    value /= 58n
  }
  let leadingZeroes = 0
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1
  const prefix = '1'.repeat(leadingZeroes)
  return encoded ? prefix + encoded : prefix || '1'
}

function bytes32ToBase58(value: string): string | null {
  const lower = value.toLowerCase()
  if (!/^0x[0-9a-f]{64}$/.test(lower)) return null
  if (lower === `0x${'0'.repeat(64)}`) return null
  const bytes = hexToBytes(lower)
  if (!bytes || bytes.length !== 32) return null
  return bytesToBase58(bytes)
}

function looksLikeSolanaPubkey(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
}

function deepFindString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>
  for (const key of keys) {
    const candidate = obj[key]
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  for (const nested of Object.values(obj)) {
    const found = deepFindString(nested, keys)
    if (found) return found
  }
  return null
}

async function resolveFromDeploySession(params: {
  sessionId?: string
  latestCompleted?: boolean
}): Promise<{ mint: string; shareOft: Address; sessionId: string }> {
  if (!isDbConfigured()) throw new Error('DATABASE_URL is required for --from-session / --from-latest-completed')
  const db = await getDb()
  if (!db) throw new Error('DB unavailable')

  let row: any = null
  if (params.sessionId) {
    const result = await db.sql`
      SELECT id, step, payload, updated_at
      FROM deploys
      WHERE id = ${params.sessionId}
      LIMIT 1
    `
    row = Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : null
    if (!row) throw new Error(`No deploy session found for id ${params.sessionId}`)
    if (String(row.step ?? '').trim() !== 'completed') {
      throw new Error(`Session ${params.sessionId} is not completed (step=${String(row.step ?? 'unknown')})`)
    }
  } else if (params.latestCompleted) {
    const result = await db.sql`
      SELECT id, step, payload, updated_at
      FROM deploys
      WHERE step = 'completed'
      ORDER BY updated_at DESC
      LIMIT 25
    `
    const rows = Array.isArray(result.rows) ? result.rows : []
    row = rows[0] ?? null
    if (!row) throw new Error('No completed deploy sessions found')
  } else {
    throw new Error('resolveFromDeploySession requires sessionId or latestCompleted')
  }

  const payload = row?.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : {}
  const shareOftRaw =
    deepFindString(payload, ['launchImageShareOft']) ??
    deepFindString(payload, ['shareOFT']) ??
    deepFindString(payload, ['shareOft'])
  if (!shareOftRaw || !isAddress(shareOftRaw)) {
    throw new Error(`Could not resolve final shareOFT from session ${String(row.id)}`)
  }
  const shareOft = getAddress(shareOftRaw as Address).toLowerCase() as Address

  const mintPubkeyRaw =
    deepFindString(payload, ['shareMeshMint']) ??
    deepFindString(payload, ['mintPubkey']) ??
    deepFindString(payload, ['solanaMintPubkey'])
  const mintBytes32Raw =
    deepFindString(payload, ['solanaMint']) ??
    deepFindString(payload, ['mintBytes32']) ??
    deepFindString(payload, ['solanaMintBytes32'])
  const mintFromBytes32 = mintBytes32Raw ? bytes32ToBase58(mintBytes32Raw) : null
  const mintCandidate = mintPubkeyRaw && looksLikeSolanaPubkey(mintPubkeyRaw) ? mintPubkeyRaw : mintFromBytes32
  if (!mintCandidate) {
    throw new Error(
      `Could not resolve share-mesh mint from session ${String(row.id)} payload. Pass --mint explicitly with --share-oft.`,
    )
  }

  return { mint: mintCandidate, shareOft, sessionId: String(row.id) }
}

function main(): void {
  const fromSession = getArg('--from-session')
  const fromLatestCompleted = process.argv.includes('--from-latest-completed')
  const mintArg = getArg('--mint')
  const shareOftArg = getArg('--share-oft')
  if (!fromSession && !fromLatestCompleted && (!mintArg || !shareOftArg)) {
    process.stdout.write(
      'Usage:\n' +
        '  pnpm -C frontend ops:update-vultr-mapping --mint <solana-pubkey> --share-oft 0x...\n' +
        '  pnpm -C frontend ops:update-vultr-mapping --from-session <deploy-session-id>\n' +
        '  pnpm -C frontend ops:update-vultr-mapping --from-latest-completed\n',
    )
    process.exit(1)
  }
  const run = async () => {
    let mint = mintArg
    let shareOftRaw = shareOftArg
    if (fromSession || fromLatestCompleted) {
      const resolved = await resolveFromDeploySession({
        sessionId: fromSession || undefined,
        latestCompleted: fromLatestCompleted && !fromSession,
      })
      mint = resolved.mint
      shareOftRaw = resolved.shareOft
      process.stdout.write(`Resolved from session ${resolved.sessionId}: mint=${mint} shareOFT=${shareOftRaw}\n`)
    }
    if (!mint || !shareOftRaw) {
      throw new Error('Missing mint/shareOFT after resolution')
    }
    if (!isAddress(shareOftRaw)) throw new Error(`Invalid --share-oft: ${shareOftRaw}`)
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

# Keep SOLANA_CREATOR_MINTS in sync for keeper workflows.
mints_match = re.search(r'^SOLANA_CREATOR_MINTS=(.*)$', text, re.M)
mints_raw = ""
if mints_match:
    mints_raw = mints_match.group(1).strip()
if mints_raw.startswith("'") and mints_raw.endswith("'"):
    mints_raw = mints_raw[1:-1]
if mints_raw.startswith('"') and mints_raw.endswith('"'):
    mints_raw = mints_raw[1:-1]
mint_list = [v.strip() for v in mints_raw.split(",") if v.strip()]
if mint not in mint_list:
    mint_list.append(mint)
creator_mints_line = f"SOLANA_CREATOR_MINTS={','.join(mint_list)}"
if mints_match:
    text = re.sub(r'^SOLANA_CREATOR_MINTS=.*$', creator_mints_line, text, count=1, flags=re.M)
else:
    text = text.rstrip() + "\\n" + creator_mints_line + "\\n"

env_path.write_text(text)
print("UPDATED", new_val)
print("CREATOR_MINTS", ",".join(mint_list))
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
          `  SOLANA_CREATOR_MINTS=${mint}\n` +
          '  sudo systemctl restart solana-keeper-orchestrator\n\n',
      )
      process.exit(1)
    }
    process.stdout.write('\n✓ Vultr orchestrator mapping updated and service restarted.\n\n')
  }
  run().catch((err) => {
    const message = err instanceof Error ? err.message : String(err ?? 'unknown_error')
    process.stdout.write(`${message}\n`)
    process.exit(1)
  })
}

main()
