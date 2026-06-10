import { createHmac, randomBytes } from 'node:crypto'

import type { Address } from 'viem'

import { buildAlfaRoomChart } from '../_lib/alfaclub/roomCharts.js'
import { logger } from '../_lib/infra/logger.js'
import {
  hasAnyHermitTwitterOauth1EnvConfigured,
  isHermitTwitterStrictModeEnabled,
  missingTwitterOauth1EnvKeys,
  readTwitterOauth1Credentials,
  type TwitterOauth1Credentials,
} from './twitterEnv.js'

export type TwitterRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export type TwitterCommandFailure = { ok: false; response: string; action?: any }

export type TwitterCommandResult =
  | { ok: true; response: string; action?: any }
  | TwitterCommandFailure

const TWITTER_POST_COOLDOWN_MS = 60_000
const TWITTER_POST_PREVIEW_TTL_SECONDS = 90
const tweetRateLimits = new Map<string, number>()
const DASH_PREFIX_RE = /^[-\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]+/
const CHART_KIND_ALIASES = new Set([
  'top',
  'top-volume',
  'volume',
  'tier',
  'tier-mix',
  'mix',
  'pnl',
  'pnl-distribution',
  'distribution',
])

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
    '- /x chart [kind] [limit] <message> --confirm - Post a live AlfaClub chart image tweet',
    '- /tweet <message> --confirm - Alias for /x post',
    '',
    'Chart kinds:',
    '- top-volume · tier-mix · pnl-distribution',
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

function formatTwitterChartPreview(params: {
  kindRaw: string | null
  limit: number | null
  tweetText: string
}): string {
  const kind = params.kindRaw?.trim() || 'top-volume'
  const limit = params.limit ? ` ${params.limit}` : ''
  return [
    'Twitter/X chart post preview',
    '',
    `chart: ${kind}${limit}`,
    '',
    params.tweetText,
    '',
    `Rerun with \`/x chart ${kind}${limit} ${params.tweetText} --confirm\`.`,
    `Preview expires in ${TWITTER_POST_PREVIEW_TTL_SECONDS}s.`,
  ].join('\n')
}

function parseTwitterChartArgs(args: string[]): {
  hasConfirm: boolean
  kindRaw: string | null
  limit: number | null
  tweetText: string
} {
  const hasConfirm = args.some((arg) => isConfirmFlag(arg))
  const filtered = args.filter((arg) => !isConfirmFlag(arg))
  let idx = 0
  let kindRaw: string | null = null
  let limit: number | null = null
  const first = String(filtered[0] ?? '').trim().toLowerCase()
  if (CHART_KIND_ALIASES.has(first)) {
    kindRaw = filtered[0] ?? null
    idx = 1
  }
  const maybeLimit = String(filtered[idx] ?? '').trim()
  if (/^\d+$/.test(maybeLimit)) {
    limit = Number.parseInt(maybeLimit, 10)
    idx += 1
  }
  const tweetText = filtered.slice(idx).join(' ').trim()
  return { hasConfirm, kindRaw, limit, tweetText }
}

type TwitterOauthConfig = TwitterOauth1Credentials

type TweetMediaInput = {
  url: string
  filename?: string | null
  contentType?: string | null
}

type TwitterVerifiedAccount = {
  screenName: string | null
  userId: string | null
  accessLevel: string | null
  canWrite: boolean | null
}

function readTwitterOauthConfig(options: {
  strictHermitOnly?: boolean
} = {}): { ok: true; config: TwitterOauthConfig } | { ok: false; response: string } {
  const strictHermitOnly = options.strictHermitOnly ?? isHermitTwitterStrictModeEnabled()
  const config = readTwitterOauth1Credentials({ strictHermitOnly })
  const missing = missingTwitterOauth1EnvKeys(config, strictHermitOnly)

  if (missing.length > 0) {
    return {
      ok: false,
      response: `Twitter posting is not configured. Missing: ${missing.join(', ')}`,
    }
  }

  return {
    ok: true,
    config,
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

export function isTweetMediaDownloadFailure(response: string): boolean {
  return /Failed to download Twitter media/i.test(String(response ?? ''))
}

const TWEET_MEDIA_FETCH_HEADERS = {
  accept: 'image/png,image/jpeg,image/webp,image/gif,*/*',
  'user-agent':
    'Mozilla/5.0 (compatible; 4626Hermit/1.0; +https://4626.fun) TwitterMediaFetcher',
} as const

async function downloadTweetMedia(input: TweetMediaInput): Promise<
  | { ok: true; bytes: Uint8Array; filename: string; contentType: string }
  | { ok: false; response: string }
> {
  const url = String(input.url ?? '').trim()
  if (!/^https:\/\//i.test(url)) {
    return { ok: false, response: 'Twitter media URL must be a public HTTPS URL.' }
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: TWEET_MEDIA_FETCH_HEADERS,
      redirect: 'follow',
    })
    if (!response.ok) {
      return { ok: false, response: `Failed to download Twitter media (${response.status}).` }
    }
    const arrayBuffer = await response.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    if (bytes.byteLength === 0) {
      return { ok: false, response: 'Downloaded Twitter media was empty.' }
    }
    const contentType = String(input.contentType ?? response.headers.get('content-type') ?? 'image/png')
      .split(';', 1)[0]
      .trim()
      .toLowerCase()
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'].includes(contentType)) {
      return { ok: false, response: `Unsupported Twitter media content-type: ${contentType || 'unknown'}` }
    }
    const pathName = (() => {
      try {
        return new URL(url).pathname.split('/').pop() ?? ''
      } catch {
        return ''
      }
    })()
    const ext =
      contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : contentType === 'image/gif'
            ? 'gif'
            : 'jpg'
    const filename =
      String(input.filename ?? '').trim() ||
      (pathName && /\.[A-Za-z0-9]+$/.test(pathName) ? pathName : `twitter-media.${ext}`)
    return { ok: true, bytes, filename, contentType: contentType === 'image/jpg' ? 'image/jpeg' : contentType }
  } catch (error) {
    logger.error('[x/media] download error', error)
    return { ok: false, response: 'Failed to download Twitter media due to a network/runtime error.' }
  }
}

async function uploadTweetMedia(params: {
  config: TwitterOauthConfig
  media: TweetMediaInput
}): Promise<{ ok: true; mediaId: string } | TwitterCommandFailure> {
  const downloaded = await downloadTweetMedia(params.media)
  if (!downloaded.ok) return downloaded

  const url = 'https://upload.twitter.com/1.1/media/upload.json'
  try {
    const authHeader = oauth1AuthorizationHeader({
      method: 'POST',
      url,
      config: params.config,
    })
    const form = new FormData()
    // Copy into a plain ArrayBuffer so BlobPart typing stays compatible
    // across Node/DOM lib combinations (ArrayBufferLike can include SAB).
    const mediaBytes = new Uint8Array(downloaded.bytes.byteLength)
    mediaBytes.set(downloaded.bytes)
    const mediaBuffer = mediaBytes.buffer
    const blob = new Blob([mediaBuffer], { type: downloaded.contentType })
    form.append('media', blob, downloaded.filename)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: form,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      const detail = parseTwitterApiError(errorBody)
      logger.error('[x/media] upload failed', { status: response.status, detail })
      return {
        ok: false,
        response: detail
          ? `Twitter media upload failed (${response.status}): ${detail}`
          : `Twitter media upload failed (${response.status}).`,
      }
    }

    const body = (await response.json()) as any
    const mediaId =
      typeof body?.media_id_string === 'string'
        ? body.media_id_string
        : typeof body?.media_id === 'number'
          ? String(body.media_id)
          : null
    if (!mediaId) {
      logger.warn('[x/media] upload response missing media id', { body })
      return { ok: false, response: 'Twitter media upload succeeded, but no media id was returned.' }
    }

    return { ok: true, mediaId }
  } catch (error) {
    logger.error('[x/media] upload error', error)
    return { ok: false, response: 'Failed to upload Twitter media due to a network/runtime error.' }
  }
}

async function postTweet(params: {
  text: string
  groupId: string
  senderWallet: Address
  media?: TweetMediaInput | null
  strictHermitOnly?: boolean
}): Promise<TwitterCommandResult> {
  const cfg = readTwitterOauthConfig({ strictHermitOnly: params.strictHermitOnly })
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

    let mediaIds: string[] | undefined
    if (params.media) {
      const uploaded = await uploadTweetMedia({
        config: cfg.config,
        media: params.media,
      })
      if (!uploaded.ok) {
        if (isTweetMediaDownloadFailure(uploaded.response)) {
          logger.warn('[x/post] media download failed; posting text-only', {
            url: params.media.url,
            detail: uploaded.response,
          })
        } else {
          return uploaded
        }
      } else {
        mediaIds = [uploaded.mediaId]
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: tweetText,
        ...(mediaIds ? { media: { media_ids: mediaIds } } : {}),
      }),
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
        mediaUrl: params.media?.url ?? null,
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
  media?: TweetMediaInput | null
}): Promise<TwitterCommandResult> {
  const strictHermitOnly = isHermitTwitterStrictModeEnabled() || hasAnyHermitTwitterOauth1EnvConfigured()
  return postTweet({
    ...params,
    strictHermitOnly,
  })
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

    case 'chart': {
      if (params.role === 'MEMBER') {
        return { ok: false, response: 'Denied: ADMIN or OWNER only.' }
      }

      const parsed = parseTwitterChartArgs(args)
      if (!parsed.tweetText) {
        return { ok: false, response: 'Usage: /x chart [kind] [limit] <message> --confirm' }
      }
      if (!parsed.hasConfirm) {
        return {
          ok: false,
          response: formatTwitterChartPreview(parsed),
          action: {
            action: 'twitter.preview_post',
            tweetText: parsed.tweetText,
            ttlSeconds: TWITTER_POST_PREVIEW_TTL_SECONDS,
            chartKind: parsed.kindRaw ?? 'top-volume',
            chartLimit: parsed.limit,
          },
        }
      }

      const chartResult = await buildAlfaRoomChart({
        kindRaw: parsed.kindRaw,
        limit: parsed.limit,
      })
      if (!chartResult.ok) {
        return { ok: false, response: chartResult.error }
      }

      const posted = await postTweet({
        text: parsed.tweetText,
        groupId: params.groupId,
        senderWallet: params.senderWallet,
        media: {
          url: chartResult.chart.attachment.url,
          filename: chartResult.chart.attachment.filename,
          contentType: chartResult.chart.attachment.mime_type,
        },
      })
      if (!posted.ok) return posted
      return {
        ...posted,
        response: `${posted.response}\n- chart: ${chartResult.chart.title}`,
        action: {
          ...(posted.action ?? {}),
          chartKind: chartResult.chart.kind,
          chartTitle: chartResult.chart.title,
          chartUrl: chartResult.chart.attachment.url,
        },
      }
    }

    default:
      return { ok: false, response: `Unknown /x command: ${cmd}. Try \`/x help\`.` }
  }
}
