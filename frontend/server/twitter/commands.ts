import { createHmac, randomBytes } from 'node:crypto'

import type { Address } from 'viem'

import { logger } from '../_lib/infra/logger.js'

declare const process: { env: Record<string, string | undefined> }

export type TwitterRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export type TwitterCommandFailure = { ok: false; response: string; action?: any }

export type TwitterCommandResult =
  | { ok: true; response: string; action?: any }
  | TwitterCommandFailure

const TWITTER_POST_COOLDOWN_MS = 60_000
const TWITTER_POST_PREVIEW_TTL_SECONDS = 90
const tweetRateLimits = new Map<string, number>()
const DASH_PREFIX_RE = /^[-\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]+/

function canPostTweet(groupId: string): boolean {
  const lastPost = tweetRateLimits.get(groupId)
  if (!lastPost) return true
  return Date.now() - lastPost >= TWITTER_POST_COOLDOWN_MS
}

function recordTweetPost(groupId: string): void {
  tweetRateLimits.set(groupId, Date.now())
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`)
}

function parseTwitterApiError(body: string): string | null {
  const raw = String(body ?? '').trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as any
    const detail = parsed?.detail
    if (typeof detail === 'string' && detail.trim()) return detail.trim()

    const firstError =
      (Array.isArray(parsed?.errors) && parsed.errors[0]) ||
      (Array.isArray(parsed?.detail) && parsed.detail[0]) ||
      null
    if (firstError) {
      const msg = firstError?.message ?? firstError?.detail ?? firstError?.title
      if (typeof msg === 'string' && msg.trim()) return msg.trim()
    }

    const title = parsed?.title
    if (typeof title === 'string' && title.trim()) return title.trim()
    return null
  } catch {
    return raw.slice(0, 240)
  }
}

function normalizeTwitterFlagToken(value: string): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const prefix = raw.match(DASH_PREFIX_RE)?.[0] ?? ''
  if (!prefix) return raw

  const normalizedPrefix = prefix === '-' ? '-' : '--'
  return `${normalizedPrefix}${raw.slice(prefix.length)}`
}

function isConfirmFlag(value: string): boolean {
  return normalizeTwitterFlagToken(value).toLowerCase() === '--confirm'
}

function canWriteWithAccessLevel(accessLevel: string | null): boolean | null {
  if (!accessLevel) return null
  return /\bwrite\b/i.test(accessLevel)
}

function formatWritePermissionGuidance(params?: {
  accessLevel?: string | null
  screenName?: string | null
}): string {
  const lines = [
    'Twitter posting is authenticated, but this X app does not have OAuth 1.0a write permission.',
  ]

  if (params?.screenName) {
    lines.push(`- account: @${params.screenName}`)
  }
  if (params?.accessLevel) {
    lines.push(`- oauth1 access-level: ${params.accessLevel}`)
  }

  lines.push('Set the app permissions to "Read and write" (or higher), then regenerate or re-authorize the access token and secret.')
  return lines.join('\n')
}

function isOauth1WritePermissionError(detail: string | null): boolean {
  return typeof detail === 'string' && /appropriate oauth1 app permissions/i.test(detail)
}

function formatHelp(): string {
  return [
    'Twitter/X commands',
    '',
    '- /x help - Show this help',
    '- /x status - Verify posting account config',
    '- /x post <message> --confirm - Post a tweet (ADMIN/OWNER)',
    '- /tweet <message> --confirm - Alias for /x post',
    '',
    'Notes:',
    '- Posts are rate-limited to 1 per minute per group.',
    '- Use --confirm to avoid accidental posts.',
  ].join('\n')
}

function formatTwitterPostPreview(tweetText: string): string {
  return [
    'Twitter/X post preview',
    '',
    tweetText,
    '',
    `Tap Post below in Telegram, or rerun with \`/x post ${tweetText} --confirm\`.`,
    `Preview expires in ${TWITTER_POST_PREVIEW_TTL_SECONDS}s.`,
  ].join('\n')
}

type TwitterOauthConfig = {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessSecret: string
}

type TwitterVerifiedAccount = {
  screenName: string | null
  userId: string | null
  accessLevel: string | null
  canWrite: boolean | null
}

function isHermitTwitterStrictModeEnabled(): boolean {
  const raw = String(process.env.HERMIT_TWITTER_STRICT ?? '')
    .trim()
    .toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function readEnvWithPrefix(baseKey: string, strictHermitOnly: boolean): string {
  const hermitScoped = String(process.env[`HERMIT_${baseKey}`] ?? '').trim()
  if (hermitScoped) return hermitScoped
  if (strictHermitOnly) return ''
  return String(process.env[baseKey] ?? '').trim()
}

function readTwitterOauthConfig(): { ok: true; config: TwitterOauthConfig } | { ok: false; response: string } {
  const strictHermitOnly = isHermitTwitterStrictModeEnabled()
  const apiKey = readEnvWithPrefix('TWITTER_API_KEY', strictHermitOnly)
  const apiSecret = readEnvWithPrefix('TWITTER_API_SECRET', strictHermitOnly)
  const accessToken = readEnvWithPrefix('TWITTER_ACCESS_TOKEN', strictHermitOnly)
  const accessSecret = readEnvWithPrefix('TWITTER_ACCESS_SECRET', strictHermitOnly)

  const missing: string[] = []
  if (!apiKey) missing.push(strictHermitOnly ? 'HERMIT_TWITTER_API_KEY' : 'TWITTER_API_KEY')
  if (!apiSecret) missing.push(strictHermitOnly ? 'HERMIT_TWITTER_API_SECRET' : 'TWITTER_API_SECRET')
  if (!accessToken) missing.push(strictHermitOnly ? 'HERMIT_TWITTER_ACCESS_TOKEN' : 'TWITTER_ACCESS_TOKEN')
  if (!accessSecret) missing.push(strictHermitOnly ? 'HERMIT_TWITTER_ACCESS_SECRET' : 'TWITTER_ACCESS_SECRET')

  if (missing.length > 0) {
    return {
      ok: false,
      response: `Twitter posting is not configured. Missing: ${missing.join(', ')}`,
    }
  }

  return {
    ok: true,
    config: {
      apiKey,
      apiSecret,
      accessToken,
      accessSecret,
    },
  }
}

function oauth1AuthorizationHeader(params: {
  method: 'GET' | 'POST'
  url: string
  config: TwitterOauthConfig
}): string {
  const endpoint = new URL(params.url)
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: params.config.apiKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1_000)),
    oauth_token: params.config.accessToken,
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
    if (keyA < keyB) return -1
    if (keyA > keyB) return 1
    const valueA = percentEncode(a[1])
    const valueB = percentEncode(b[1])
    if (valueA < valueB) return -1
    if (valueA > valueB) return 1
    return 0
  })

  const normalizedParams = signaturePairs
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join('&')

  const baseUrl = `${endpoint.protocol}//${endpoint.host}${endpoint.pathname}`
  const signatureBaseString = `${params.method.toUpperCase()}&${percentEncode(baseUrl)}&${percentEncode(normalizedParams)}`
  const signingKey = `${percentEncode(params.config.apiSecret)}&${percentEncode(params.config.accessSecret)}`
  const signature = createHmac('sha1', signingKey).update(signatureBaseString).digest('base64')

  const headerParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  }

  const authValue = Object.entries(headerParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
    .join(', ')

  return `OAuth ${authValue}`
}

async function verifyTwitterAccount(config: TwitterOauthConfig): Promise<{ ok: true; account: TwitterVerifiedAccount } | TwitterCommandFailure> {
  const url = 'https://api.twitter.com/1.1/account/verify_credentials.json?include_entities=false&skip_status=true'
  try {
    const authHeader = oauth1AuthorizationHeader({
      method: 'GET',
      url,
      config,
    })

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      const detail = parseTwitterApiError(errorBody)
      logger.warn('[x/status] verify_credentials failed', { status: response.status, detail })
      return {
        ok: false,
        response: detail ? `Twitter config check failed (${response.status}): ${detail}` : `Twitter config check failed (${response.status}).`,
      }
    }

    const data = (await response.json()) as any
    const screenName = typeof data?.screen_name === 'string' ? data.screen_name : null
    const userId = typeof data?.id_str === 'string' ? data.id_str : typeof data?.id === 'number' ? String(data.id) : null
    const accessLevel =
      typeof response.headers?.get === 'function' ? response.headers.get('x-access-level')?.trim() || null : null

    return {
      ok: true,
      account: {
        screenName,
        userId,
        accessLevel,
        canWrite: canWriteWithAccessLevel(accessLevel),
      },
    }
  } catch (error) {
    logger.error('[x/status] verify_credentials error', error)
    return { ok: false, response: 'Twitter config check failed due to a network/runtime error.' }
  }
}

async function verifyTwitterConfig(config: TwitterOauthConfig): Promise<TwitterCommandResult> {
  const verified = await verifyTwitterAccount(config)
  if (!verified.ok) return verified

  const { screenName, userId, accessLevel, canWrite } = verified.account
  const lines = [
    'Twitter/X status',
    '',
    '- oauth1 user-context: ok',
    `- account: ${screenName ? `@${screenName}` : 'unknown'}`,
    `- userId: ${userId ?? 'unknown'}`,
    `- oauth1 access-level: ${accessLevel ?? 'unknown'}`,
  ]

  if (canWrite === false) {
    lines.push('- post capability: blocked (app permissions are read-only)')
    lines.push('', formatWritePermissionGuidance({ accessLevel, screenName }))
    return {
      ok: false,
      response: lines.join('\n'),
    }
  }

  lines.push(`- post capability: ${canWrite === true ? 'ok' : 'unknown'}`)
  return {
    ok: true,
    response: lines.join('\n'),
  }
}

async function postTweet(params: {
  text: string
  groupId: string
  senderWallet: Address
}): Promise<TwitterCommandResult> {
  const cfg = readTwitterOauthConfig()
  if (!cfg.ok) return cfg

  if (!canPostTweet(params.groupId)) {
    return { ok: false, response: 'Rate limited. Wait 1 minute between posts.' }
  }

  const tweetText = params.text.trim()
  if (!tweetText) {
    return { ok: false, response: 'Usage: /x post <message> --confirm' }
  }
  if (tweetText.length > 280) {
    return { ok: false, response: 'Tweet too long. Max 280 characters.' }
  }

  const verified = await verifyTwitterAccount(cfg.config)
  if (!verified.ok) return verified
  if (verified.account.canWrite === false) {
    return {
      ok: false,
      response: formatWritePermissionGuidance({
        accessLevel: verified.account.accessLevel,
        screenName: verified.account.screenName,
      }),
    }
  }

  const url = 'https://api.twitter.com/2/tweets'
  try {
    const authHeader = oauth1AuthorizationHeader({
      method: 'POST',
      url,
      config: cfg.config,
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: tweetText }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      const detail = parseTwitterApiError(errorBody)
      logger.error('[x/post] tweet failed', { status: response.status, detail })
      if (response.status === 403 && isOauth1WritePermissionError(detail)) {
        return {
          ok: false,
          response: formatWritePermissionGuidance({
            accessLevel: verified.account.accessLevel,
            screenName: verified.account.screenName,
          }),
        }
      }
      return {
        ok: false,
        response: detail ? `Tweet failed (${response.status}): ${detail}` : `Tweet failed (${response.status}).`,
      }
    }

    const body = (await response.json()) as any
    const id = body?.data?.id
    if (typeof id !== 'string' || !id) {
      logger.warn('[x/post] tweet response missing id', { body })
      return { ok: false, response: 'Tweet API returned success, but no tweet id was returned.' }
    }

    recordTweetPost(params.groupId)
    const tweetUrl = `https://x.com/i/web/status/${id}`
    return {
      ok: true,
      response: `Tweet posted.\n- id: ${id}\n- url: ${tweetUrl}`,
      action: {
        action: 'twitter.posted',
        tweetId: id,
        tweetUrl,
        text: tweetText,
        actor: params.senderWallet,
      },
    }
  } catch (error) {
    logger.error('[x/post] tweet error', error)
    return { ok: false, response: 'Failed to post tweet due to a network/runtime error.' }
  }
}

export async function postTweetFromSystem(params: {
  text: string
  groupId: string
  senderWallet: Address
}): Promise<TwitterCommandResult> {
  return postTweet(params)
}

function parseTwitterCommand(raw: string): { cmd: string; args: string[] } {
  const parts = raw.split(/\s+/g).filter(Boolean)
  const prefix = String(parts[0] ?? '').toLowerCase()

  if (prefix === '/tweet' || prefix === 'tweet') {
    return { cmd: 'post', args: parts.slice(1) }
  }

  if (prefix === '/x' || prefix === 'x') {
    return {
      cmd: String(parts[1] ?? 'help').toLowerCase(),
      args: parts.slice(2),
    }
  }

  return { cmd: '', args: [] }
}

/**
 * Handle Twitter/X commands from Keepr chats.
 */
export async function handleTwitterCommand(params: {
  groupId: string
  senderWallet: Address
  text: string
  role: TwitterRole
}): Promise<TwitterCommandResult> {
  const raw = String(params.text ?? '').trim()
  const lower = raw.toLowerCase()
  const looksLikeX = /^(\/x|x)(\s|$)/.test(lower)
  const looksLikeTweet = /^(\/tweet|tweet)(\s|$)/.test(lower)
  if (!looksLikeX && !looksLikeTweet) {
    return { ok: false, response: '' }
  }

  const { cmd, args } = parseTwitterCommand(raw)
  logger.info('[x/command]', { groupId: params.groupId, cmd, role: params.role })

  switch (cmd) {
    case 'help':
      return { ok: true, response: formatHelp() }

    case 'status': {
      const cfg = readTwitterOauthConfig()
      if (!cfg.ok) return cfg
      return verifyTwitterConfig(cfg.config)
    }

    case 'post': {
      if (params.role === 'MEMBER') {
        return { ok: false, response: 'Denied: ADMIN or OWNER only.' }
      }

      const hasConfirm = args.some((arg) => isConfirmFlag(arg))
      const tweetText = args.filter((arg) => !isConfirmFlag(arg)).join(' ').trim()
      if (!tweetText) {
        return { ok: false, response: 'Usage: /x post <message> --confirm' }
      }
      if (!hasConfirm) {
        return {
          ok: false,
          response: formatTwitterPostPreview(tweetText),
          action: {
            action: 'twitter.preview_post',
            tweetText,
            ttlSeconds: TWITTER_POST_PREVIEW_TTL_SECONDS,
          },
        }
      }

      return postTweet({
        text: tweetText,
        groupId: params.groupId,
        senderWallet: params.senderWallet,
      })
    }

    default:
      return { ok: false, response: `Unknown /x command: ${cmd}. Try \`/x help\`.` }
  }
}
