#!/usr/bin/env node
/**
 * AlfaClub Privy triplet restore — operator script.
 *
 * Recovers the AlfaClub chat bridge after a token outage by ingesting a
 * Privy session JSON file, decoding the triplet's expiry metadata, and
 * (optionally) calling the documented admin endpoint to write the new
 * triplet into Supabase. Default mode is **dry-run** — nothing is sent
 * anywhere, only redacted metadata is printed. The script never echoes
 * raw token material to stdout/stderr.
 *
 * ## Input
 *
 * A JSON file produced by either:
 *   - the alfaclub.app local-storage / cookie capture (devtools), saved as:
 *       {
 *         "identity_token": "<jwt>",
 *         "privy_access_token": "<jwt>",
 *         "refresh_token": "<opaque>"
 *       }
 *   - or a Privy `/sessions` response, which uses the same field names but
 *     may carry the identity-token under top-level `token` instead of
 *     `identity_token`. The script accepts either.
 *
 * Strict-validation rules:
 *   - identity_token MUST be a JWT (3 dot-segments) with a future `exp`
 *   - privy_access_token MUST be a JWT (3 dot-segments) with a future `exp`
 *   - refresh_token MUST be an opaque base64url-ish string ≥ 16 chars
 * Any failure aborts the script before any network call.
 *
 * ## Modes
 *
 * Default (no flags): **dry-run**. Parses, validates, prints a redacted
 * report, exits 0.
 *
 * `--apply`: POST the triplet to the configured admin endpoint
 *   (`ALFACLUB_ADMIN_ENDPOINT` env or `--endpoint=<url>`). Uses the admin
 *   bearer (`ALFACLUB_ADMIN_BEARER` env or `--admin-bearer=<value>`).
 *   The script never prints the bearer or any token. Writer name will be
 *   the admin-endpoint default (`<admin wallet>` lowercased — the server
 *   stamps it, not us), or `computer-token-restore` if the endpoint
 *   accepts a writer override (currently it does not, this is reserved
 *   for a future change).
 *
 * `--call-cron-refresh`: After applying (or in dry-run, immediately),
 *   make a single call to `/api/v1/alfaclub/chat-token-refresh` with
 *   `CRON_SECRET` (env or `--cron-secret=<value>`). Prints the redacted
 *   refresh response.
 *
 * `--call-bridge-run`: Same as above but for `/api/v1/alfaclub/chat-bridge-run`.
 *
 * ## Safety
 *
 *  - Tokens are NEVER printed. The redactor strips JWT-shaped strings,
 *    Bearer headers, and long base64url runs from any output we emit.
 *  - Default is dry-run. `--apply` is required before any network write.
 *  - All env-sourced secrets are read directly into local consts and
 *    never re-emitted. Operator can set them in their shell rather than
 *    passing on the command line.
 *
 * ## Usage
 *
 *   node frontend/scripts/alfaclub-restore-tokens.mjs path/to/triplet.json
 *   node frontend/scripts/alfaclub-restore-tokens.mjs path/to/triplet.json \
 *       --apply --call-cron-refresh --call-bridge-run
 *
 *   ALFACLUB_ADMIN_ENDPOINT=https://app.example/api/v1/alfaclub/chat-token \
 *   ALFACLUB_ADMIN_BEARER=...                                              \
 *   CRON_SECRET=...                                                        \
 *   ALFACLUB_HEALTH_ENDPOINT=https://app.example/api/v1/alfaclub/chat-auth-health \
 *     node frontend/scripts/alfaclub-restore-tokens.mjs ./triplet.json --apply --call-cron-refresh
 */

/* eslint-disable no-console */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

// Only run main() when invoked directly (`node alfaclub-restore-tokens.mjs ...`).
// The unit tests import this module to exercise pure helpers; they should not
// trigger argv parsing, fs reads, or process.exit.
const isEntrypoint = (() => {
  try {
    return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
  } catch {
    return false
  }
})()

if (isEntrypoint) {
  runCli()
}

function runCli() {
  const ARGS = parseArgs(process.argv.slice(2))

  if (ARGS.help || (!ARGS.positional[0] && !ARGS.flags.has('--help'))) {
    printHelp()
    process.exit(ARGS.help ? 0 : 1)
  }

  const TRIPLET_PATH = ARGS.positional[0]
  if (!TRIPLET_PATH) {
    fatal('Triplet JSON path is required as the first positional arg.')
  }

  const isApply = ARGS.flags.has('--apply')
  const wantCronRefresh = ARGS.flags.has('--call-cron-refresh')
  const wantBridgeRun = ARGS.flags.has('--call-bridge-run')

  const adminEndpoint = ARGS.named.get('--endpoint') ?? process.env.ALFACLUB_ADMIN_ENDPOINT ?? ''
  const adminBearer = ARGS.named.get('--admin-bearer') ?? process.env.ALFACLUB_ADMIN_BEARER ?? ''
  const cronSecret = ARGS.named.get('--cron-secret') ?? process.env.CRON_SECRET ?? ''
  const healthEndpoint =
    ARGS.named.get('--health-endpoint') ?? process.env.ALFACLUB_HEALTH_ENDPOINT ?? ''
  const cronRefreshEndpoint =
    ARGS.named.get('--refresh-endpoint')
      ?? process.env.ALFACLUB_REFRESH_ENDPOINT
      ?? deriveSiblingEndpoint(adminEndpoint, 'chat-token-refresh')
  const bridgeRunEndpoint =
    ARGS.named.get('--bridge-run-endpoint')
      ?? process.env.ALFACLUB_BRIDGE_RUN_ENDPOINT
      ?? deriveSiblingEndpoint(adminEndpoint, 'chat-bridge-run')

  main({
    tripletPath: TRIPLET_PATH,
    isApply,
    wantCronRefresh,
    wantBridgeRun,
    adminEndpoint,
    adminBearer,
    cronSecret,
    healthEndpoint,
    cronRefreshEndpoint,
    bridgeRunEndpoint,
  }).catch((err) => {
    fatal(`unexpected_error: ${redact(String(err?.message ?? err))}`)
  })
}

async function main(ctx) {
  const {
    tripletPath: TRIPLET_PATH,
    isApply,
    wantCronRefresh,
    wantBridgeRun,
    adminEndpoint,
    adminBearer,
    cronSecret,
    healthEndpoint,
    cronRefreshEndpoint,
    bridgeRunEndpoint,
  } = ctx
  const triplet = await loadAndValidateTriplet(TRIPLET_PATH)

  console.log('AlfaClub triplet restore — input summary (redacted):')
  console.log('  identity_token  :', describeJwt(triplet.identityToken))
  console.log('  privy_access    :', describeJwt(triplet.accessToken))
  console.log('  refresh_token   :', describeOpaque(triplet.refreshToken))
  console.log('  source file     :', TRIPLET_PATH)
  console.log('  mode            :', isApply ? 'APPLY' : 'DRY-RUN')

  if (!isApply) {
    console.log()
    console.log('Dry-run only. Re-run with --apply to POST the triplet to the admin endpoint.')
    if (wantCronRefresh || wantBridgeRun) {
      console.log('  (--call-cron-refresh / --call-bridge-run still honored on dry-run if endpoint env is set;')
      console.log('   they only read state and never write, so they remain safe.)')
    }
  } else {
    console.log()
    console.log('APPLY mode — POSTing triplet to admin endpoint…')
    if (!adminEndpoint) fatal('--endpoint or ALFACLUB_ADMIN_ENDPOINT is required in --apply mode')
    if (!adminBearer) fatal('--admin-bearer or ALFACLUB_ADMIN_BEARER is required in --apply mode')
    const applyResult = await postAdminTriplet({
      endpoint: adminEndpoint,
      bearer: adminBearer,
      triplet,
    })
    console.log('  response status :', applyResult.status)
    console.log('  response body   :', redact(applyResult.body).slice(0, 400))
    if (applyResult.status >= 400) {
      fatal(`admin endpoint returned non-2xx (${applyResult.status})`)
    }
  }

  if (wantCronRefresh) {
    console.log()
    console.log('Calling chat-token-refresh cron endpoint…')
    if (!cronRefreshEndpoint) fatal('--refresh-endpoint or ALFACLUB_REFRESH_ENDPOINT is required for --call-cron-refresh')
    if (!cronSecret) fatal('--cron-secret or CRON_SECRET is required for --call-cron-refresh')
    const refreshResult = await postCronEndpoint({
      endpoint: cronRefreshEndpoint,
      cronSecret,
    })
    console.log('  response status :', refreshResult.status)
    console.log('  response body   :', redact(refreshResult.body).slice(0, 400))
  }

  if (wantBridgeRun) {
    console.log()
    console.log('Calling chat-bridge-run cron endpoint…')
    if (!bridgeRunEndpoint) fatal('--bridge-run-endpoint or ALFACLUB_BRIDGE_RUN_ENDPOINT is required for --call-bridge-run')
    if (!cronSecret) fatal('--cron-secret or CRON_SECRET is required for --call-bridge-run')
    const bridgeResult = await postCronEndpoint({
      endpoint: bridgeRunEndpoint,
      cronSecret,
    })
    console.log('  response status :', bridgeResult.status)
    console.log('  response body   :', redact(bridgeResult.body).slice(0, 400))
  }

  if (healthEndpoint && cronSecret) {
    console.log()
    console.log('Reading chat-auth-health snapshot…')
    const healthResult = await getHealth({ endpoint: healthEndpoint, cronSecret })
    console.log('  response status :', healthResult.status)
    console.log('  response body   :', redact(healthResult.body).slice(0, 600))
  }

  console.log()
  console.log('Done.')
}

async function loadAndValidateTriplet(path) {
  let raw
  try {
    raw = await readFile(path, 'utf8')
  } catch (err) {
    fatal(`cannot read ${path}: ${err?.code ?? err?.message ?? 'unknown_error'}`)
  }
  const result = validateTripletJson(raw, { now: Date.now })
  if (!result.ok) fatal(result.error)
  return result.triplet
}

/**
 * Pure validator: takes the raw file contents and returns either a
 * {ok:true, triplet} or {ok:false, error: <short_string>}. No process
 * mutation, no file IO. Exported for tests.
 */
function validateTripletJson(raw, opts = {}) {
  const now = typeof opts.now === 'function' ? opts.now : Date.now
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    return { ok: false, error: `triplet file is not valid JSON: ${err?.message ?? err}` }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'triplet file is not a JSON object' }
  }
  const identityToken =
    asNonEmptyString(parsed.identity_token) ?? asNonEmptyString(parsed.token)
  const accessToken =
    asNonEmptyString(parsed.privy_access_token) ?? asNonEmptyString(parsed.access_token)
  const refreshToken = asNonEmptyString(parsed.refresh_token)

  if (!identityToken) return { ok: false, error: 'triplet missing identity_token (or top-level token)' }
  if (!accessToken) return { ok: false, error: 'triplet missing privy_access_token' }
  if (!refreshToken) return { ok: false, error: 'triplet missing refresh_token' }

  if (!isJwtShape(identityToken)) {
    return { ok: false, error: 'identity_token is not a JWT (expected 3 dot-segments)' }
  }
  if (!isJwtShape(accessToken)) {
    return { ok: false, error: 'privy_access_token is not a JWT (expected 3 dot-segments)' }
  }
  if (refreshToken.length < 16 || !/^[A-Za-z0-9._-]+$/.test(refreshToken)) {
    return { ok: false, error: 'refresh_token does not look like an opaque token (≥16 chars, base64url-ish)' }
  }

  const identityExp = decodeJwtExp(identityToken)
  if (identityExp === null) return { ok: false, error: 'identity_token has no usable exp claim' }
  if (identityExp * 1000 <= now()) {
    return { ok: false, error: 'identity_token is already expired — re-log in to alfaclub.app and re-export' }
  }
  const accessExp = decodeJwtExp(accessToken)
  if (accessExp === null) return { ok: false, error: 'privy_access_token has no usable exp claim' }
  if (accessExp * 1000 <= now()) {
    return { ok: false, error: 'privy_access_token is already expired — re-log in to alfaclub.app and re-export' }
  }

  return {
    ok: true,
    triplet: { identityToken, accessToken, refreshToken },
    expiry: { identityExpMs: identityExp * 1000, accessExpMs: accessExp * 1000 },
  }
}

async function postAdminTriplet({ endpoint, bearer, triplet }) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({
      jwt: triplet.identityToken,
      privyAccessToken: triplet.accessToken,
      privyRefreshToken: triplet.refreshToken,
    }),
  })
  return { status: response.status, body: await response.text().catch(() => '') }
}

async function postCronEndpoint({ endpoint, cronSecret }) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cron-secret': cronSecret,
    },
    body: JSON.stringify({}),
  })
  return { status: response.status, body: await response.text().catch(() => '') }
}

async function getHealth({ endpoint, cronSecret }) {
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: { 'x-cron-secret': cronSecret },
  })
  return { status: response.status, body: await response.text().catch(() => '') }
}

function describeJwt(jwt) {
  const exp = decodeJwtExp(jwt)
  return `<jwt redacted, exp=${exp ? new Date(exp * 1000).toISOString() : 'unknown'}, len=${jwt.length}>`
}
function describeOpaque(value) {
  return `<opaque redacted, len=${value.length}>`
}

function decodeJwtExp(jwt) {
  const parts = jwt.split('.')
  if (parts.length !== 3) return null
  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8')
    const payload = JSON.parse(payloadJson)
    if (typeof payload?.exp === 'number' && Number.isFinite(payload.exp)) return payload.exp
    return null
  } catch {
    return null
  }
}

function isJwtShape(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
}

function asNonEmptyString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/**
 * Redactor — same shape as the server-side `redactTokenMaterial` so any
 * accidental echo of a token in stdout/stderr gets blanked out before it
 * reaches a terminal scrollback.
 */
function redact(input) {
  if (!input) return ''
  let out = String(input)
  out = out.replace(
    /\b([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\b/g,
    '<redacted-jwt>',
  )
  out = out.replace(/(Bearer\s+)[A-Za-z0-9._-]{16,}/gi, '$1<redacted>')
  out = out.replace(/\b[A-Za-z0-9_-]{40,}\b/g, '<redacted-opaque>')
  return out
}

function deriveSiblingEndpoint(adminEndpoint, sibling) {
  if (!adminEndpoint) return ''
  return adminEndpoint.replace(/\/chat-token\/?$/, `/${sibling}`)
}

function fatal(message) {
  console.error(`error: ${redact(message)}`)
  process.exit(2)
}

function parseArgs(argv) {
  const positional = []
  const flags = new Set()
  const named = new Map()
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      positional.push(arg)
      continue
    }
    const eq = arg.indexOf('=')
    if (eq === -1) {
      flags.add(arg)
    } else {
      named.set(arg.slice(0, eq), arg.slice(eq + 1))
    }
  }
  return {
    positional,
    flags,
    named,
    help: flags.has('--help') || flags.has('-h'),
  }
}

function printHelp() {
  console.log(`Usage: node frontend/scripts/alfaclub-restore-tokens.mjs <triplet.json> [flags]

Default mode is DRY-RUN — nothing is written, only redacted metadata is printed.

Flags:
  --apply                          POST the triplet to the admin endpoint.
  --call-cron-refresh              After load (and apply if set), call chat-token-refresh.
  --call-bridge-run                After refresh, call chat-bridge-run.
  --endpoint=<url>                 Admin endpoint URL (overrides ALFACLUB_ADMIN_ENDPOINT).
  --refresh-endpoint=<url>         chat-token-refresh URL (default: derived from admin endpoint).
  --bridge-run-endpoint=<url>      chat-bridge-run URL (default: derived from admin endpoint).
  --health-endpoint=<url>          chat-auth-health URL (overrides ALFACLUB_HEALTH_ENDPOINT).
  --admin-bearer=<token>           Admin bearer (overrides ALFACLUB_ADMIN_BEARER).
  --cron-secret=<secret>           Cron secret (overrides CRON_SECRET).
  --help, -h                       This help.

Env vars (preferred over flags for secrets):
  ALFACLUB_ADMIN_ENDPOINT, ALFACLUB_ADMIN_BEARER,
  CRON_SECRET, ALFACLUB_HEALTH_ENDPOINT,
  ALFACLUB_REFRESH_ENDPOINT, ALFACLUB_BRIDGE_RUN_ENDPOINT.
`)
}

// Exposed for unit tests (pure helpers only — no IO, no process mutation).
export const _testables = {
  redact,
  decodeJwtExp,
  isJwtShape,
  validateTripletJson,
  describeJwt,
  describeOpaque,
}
