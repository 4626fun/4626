#!/usr/bin/env node
/**
 * Mint a local dev session token for the deploy dry-run smoke test.
 *
 * The deploy dry-run handler (`frontend/api/_handlers/deploy/v2/session/_dryRunCore.ts`)
 * requires authenticated deploy auth (`readDeployAuthFromRequest`). The legacy
 * `X-Deploy-Dry-Run-Dev` dev-bypass header was deliberately removed (see
 * `deploySessionDryRun.test.ts` — "requires authenticated deploy auth even when
 * legacy dev-bypass header is present") and must not be reintroduced.
 *
 * Instead of bypassing auth, this helper mints a REAL session token using the same
 * `AUTH_SESSION_SECRET` the local dry-run server uses, so the smoke request
 * authenticates through the production auth path (`readSessionFromRequest` →
 * `readSessionToken`). No handler change, no auth-bypass surface.
 *
 * Token format replicates `makeSessionToken` in `frontend/server/auth/_shared.ts`:
 *   payloadB64.sigB64
 *   payload = { a: <address lowercase>, iat: <ms>, exp: <ms + 7d> }
 *   payloadB64 = base64url(JSON.stringify(payload))
 *   sigB64 = base64url(HMAC_SHA256(AUTH_SESSION_SECRET, payloadB64))
 *
 * If `makeSessionToken` ever changes format, update this helper to match.
 *
 * Usage:
 *   node scripts/mint-dev-session-token.mjs [address]
 *
 * Loads `AUTH_SESSION_SECRET` from frontend/.env then frontend/.env.deploy-dry-run.local
 * (preset overrides base .env). Prints the token to stdout.
 */
import { createHmac } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '..')

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const SESSION_TTL_MS = 60 * 60 * 24 * 7 * 1000 // 7d — keep in sync with _shared.ts SESSION_TTL_SECONDS

function base64UrlEncode(input) {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function loadEnvFile(path, into) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    // strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in into)) into[key] = value
    else into[key] = value // preset value overrides base .env (callers control load order)
  }
}

function main() {
  const address = (process.argv[2] ?? '0x0000000000000000000000000000000000000002').trim()
  if (!ADDRESS_RE.test(address)) {
    console.error(`Invalid address: ${address}`)
    process.exit(2)
  }

  const env = {}
  // Load base .env first, then preset so preset wins. Preset may carry its own
  // AUTH_SESSION_SECRET, but the server already proved the secret resolves (it
  // started), so either source is valid as long as it matches what the server read.
  loadEnvFile(resolve(FRONTEND_ROOT, '.env'), env)
  loadEnvFile(resolve(FRONTEND_ROOT, '.env.deploy-dry-run.local'), env)
  // Honour an exported shell value if present (highest precedence).
  if (process.env.AUTH_SESSION_SECRET) env.AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET

  const secret = (env.AUTH_SESSION_SECRET ?? '').trim()
  if (secret.length < 32) {
    console.error(
      'AUTH_SESSION_SECRET is missing or shorter than 32 characters. ' +
        'Set a stable secret in frontend/.env (the dry-run server requires it to start).',
    )
    process.exit(2)
  }

  const now = Date.now()
  const payload = { a: address.toLowerCase(), iat: now, exp: now + SESSION_TTL_MS }
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const sigB64 = base64UrlEncode(createHmac('sha256', secret).update(payloadB64).digest())
  process.stdout.write(`${payloadB64}.${sigB64}`)
}

main()
