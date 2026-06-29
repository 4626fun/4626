#!/usr/bin/env tsx
/**
 * One-shot operator script: verify X OAuth 1.0a user context and subscribe
 * @4626fun to Account Activity webhooks (all event types).
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/x-account-activity-subscribe.ts
 *   pnpm -C frontend exec tsx scripts/x-account-activity-subscribe.ts --webhook-id=2071556562561179649
 *   pnpm -C frontend exec tsx scripts/x-account-activity-subscribe.ts --check-only
 */
import { createHmac, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

declare const process: {
  env: Record<string, string | undefined>
  argv: string[]
  exit(code?: number): never
}

const DEFAULT_WEBHOOK_ID = '2071556562561179649'
const EXPECTED_SCREEN_NAME = '4626fun'

function loadEnvFile(): void {
  const envPath = resolve(process.cwd(), '.env')
  try {
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = value
      }
    }
  } catch {
    // optional — rely on exported env when .env is absent
  }
}

function readCreds() {
  const apiKey = String(process.env.X_API_KEY ?? process.env.TWITTER_API_KEY ?? '').trim()
  const apiSecret = String(process.env.X_API_SECRET ?? process.env.TWITTER_API_SECRET ?? '').trim()
  const accessToken = String(process.env.X_ACCESS_TOKEN ?? process.env.TWITTER_ACCESS_TOKEN ?? '').trim()
  const accessSecret = String(process.env.X_ACCESS_SECRET ?? process.env.TWITTER_ACCESS_SECRET ?? '').trim()
  const bearer = String(process.env.X_BEARER_TOKEN ?? process.env.TWITTER_BEARER_TOKEN ?? '').trim()
  return { apiKey, apiSecret, accessToken, accessSecret, bearer }
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`)
}

function oauth1AuthorizationHeader(params: {
  method: 'GET' | 'POST' | 'DELETE'
  url: string
  creds: ReturnType<typeof readCreds>
}): string {
  const endpoint = new URL(params.url)
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: params.creds.apiKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1_000)),
    oauth_token: params.creds.accessToken,
    oauth_version: '1.0',
  }

  const signaturePairs: Array<[string, string]> = []
  for (const [key, value] of endpoint.searchParams.entries()) {
    signaturePairs.push([key, value])
  }
  for (const [key, value] of Object.entries(oauthParams)) {
    signaturePairs.push([key, value])
  }
  signaturePairs.sort((a, b) => {
    const keyA = percentEncode(a[0])
    const keyB = percentEncode(b[0])
    if (keyA !== keyB) return keyA < keyB ? -1 : 1
    const valueA = percentEncode(a[1])
    const valueB = percentEncode(b[1])
    if (valueA !== valueB) return valueA < valueB ? -1 : 1
    return 0
  })

  const normalizedParams = signaturePairs
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join('&')
  const baseUrl = `${endpoint.protocol}//${endpoint.host}${endpoint.pathname}`
  const signatureBaseString = `${params.method.toUpperCase()}&${percentEncode(baseUrl)}&${percentEncode(normalizedParams)}`
  const signingKey = `${percentEncode(params.creds.apiSecret)}&${percentEncode(params.creds.accessSecret)}`
  const signature = createHmac('sha1', signingKey).update(signatureBaseString).digest('base64')

  const headerParams: Record<string, string> = { ...oauthParams, oauth_signature: signature }
  const authValue = Object.entries(headerParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
    .join(', ')
  return `OAuth ${authValue}`
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text.slice(0, 500) }
  }
}

function parseArg(name: string): string | null {
  const prefix = `--${name}=`
  for (const arg of process.argv.slice(2)) {
    if (arg === `--${name}`) return 'true'
    if (arg.startsWith(prefix)) return arg.slice(prefix.length)
  }
  return null
}

async function verifyAccount(creds: ReturnType<typeof readCreds>) {
  const url = 'https://api.twitter.com/1.1/account/verify_credentials.json?include_entities=false&skip_status=true'
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: oauth1AuthorizationHeader({ method: 'GET', url, creds }) },
  })
  const body = await readJson(response)
  if (!response.ok) {
    throw new Error(`verify_credentials failed (${response.status}): ${JSON.stringify(body)}`)
  }
  const record = body as Record<string, unknown>
  const screenName = String(record.screen_name ?? '').trim().toLowerCase()
  const userId = String(record.id_str ?? record.id ?? '').trim()
  return { screenName, userId }
}

async function listWebhooks(bearer: string) {
  const response = await fetch('https://api.x.com/2/webhooks', {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearer}` },
  })
  const body = await readJson(response)
  if (!response.ok) {
    throw new Error(`list webhooks failed (${response.status}): ${JSON.stringify(body)}`)
  }
  return body
}

async function checkSubscription(creds: ReturnType<typeof readCreds>, webhookId: string) {
  const url = `https://api.x.com/2/account_activity/webhooks/${webhookId}/subscriptions/all`
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: oauth1AuthorizationHeader({ method: 'GET', url, creds }) },
  })
  const body = await readJson(response)
  return { ok: response.ok, status: response.status, body }
}

async function createSubscription(creds: ReturnType<typeof readCreds>, webhookId: string) {
  const url = `https://api.x.com/2/account_activity/webhooks/${webhookId}/subscriptions/all`
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: oauth1AuthorizationHeader({ method: 'POST', url, creds }) },
  })
  const body = await readJson(response)
  return { ok: response.ok, status: response.status, body }
}

async function listSubscriptions(bearer: string, webhookId: string) {
  const url = `https://api.x.com/2/account_activity/webhooks/${webhookId}/subscriptions/all/list`
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearer}` },
  })
  const body = await readJson(response)
  return { ok: response.ok, status: response.status, body }
}

async function main(): Promise<void> {
  loadEnvFile()
  const creds = readCreds()
  const missing = [
    !creds.apiKey && 'X_API_KEY',
    !creds.apiSecret && 'X_API_SECRET',
    !creds.accessToken && 'X_ACCESS_TOKEN',
    !creds.accessSecret && 'X_ACCESS_SECRET',
  ].filter(Boolean)
  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(', ')}`)
  }

  const checkOnly = process.argv.includes('--check-only')
  const webhookId = parseArg('webhook-id') ?? DEFAULT_WEBHOOK_ID

  console.log('[x/aaa] verifying OAuth user context…')
  const account = await verifyAccount(creds)
  console.log(`[x/aaa] authenticated as @${account.screenName} (user_id=${account.userId})`)
  if (account.screenName !== EXPECTED_SCREEN_NAME) {
    throw new Error(
      `OAuth tokens are for @${account.screenName}, not @${EXPECTED_SCREEN_NAME}. Regenerate access token while signed in as @${EXPECTED_SCREEN_NAME}.`,
    )
  }

  if (creds.bearer) {
    console.log('[x/aaa] listing registered webhooks…')
    const webhooks = await listWebhooks(creds.bearer)
    console.log(JSON.stringify(webhooks, null, 2))
  } else {
    console.log('[x/aaa] skipping webhook list — X_BEARER_TOKEN not set')
  }

  console.log(`[x/aaa] checking subscription on webhook ${webhookId}…`)
  const existing = await checkSubscription(creds, webhookId)
  console.log(JSON.stringify(existing, null, 2))

  if (checkOnly) return

  const alreadySubscribed =
    existing.ok &&
    typeof existing.body === 'object' &&
    existing.body != null &&
    (existing.body as { data?: { subscribed?: boolean } }).data?.subscribed === true

  if (alreadySubscribed) {
    console.log('[x/aaa] already subscribed — nothing to do')
  } else {
    console.log('[x/aaa] creating subscription (all account activity events)…')
    const created = await createSubscription(creds, webhookId)
    console.log(JSON.stringify(created, null, 2))
    if (!created.ok) {
      process.exit(1)
    }
  }

  if (creds.bearer) {
    console.log('[x/aaa] listing active subscriptions…')
    const subs = await listSubscriptions(creds.bearer, webhookId)
    console.log(JSON.stringify(subs, null, 2))
  }
}

main().catch((error) => {
  console.error('[x/aaa] failed:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
