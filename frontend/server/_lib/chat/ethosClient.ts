import { getDb } from '../db/postgres.js'
import { ensureChatSchema } from '../db/schemaBootstrap.js'

export type EthosScore = {
  score: number | null
  level: string | null
}

export type EthosProfileSummary = EthosScore & {
  userkey: string
  displayName: string | null
  username: string | null
  avatarUrl: string | null
  description: string | null
  profileUrl: string | null
  stats: {
    reviews: {
      positive: number
      neutral: number
      negative: number
      total: number
      positivePct: number | null
    }
    vouches: {
      receivedCount: number
      receivedAmountWeiTotal: string | null
    }
  }
}

const ETHOS_API_BASE = 'https://api.ethos.network/api/v2'
function readDurationMs(raw: string | undefined, fallbackMs: number, minMs = 30_000, maxMs = 24 * 60 * 60 * 1000): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallbackMs
  return Math.max(minMs, Math.min(maxMs, Math.floor(parsed)))
}

const SCORE_CACHE_TTL_MS = readDurationMs(
  process.env.ETHOS_SCORE_CACHE_TTL_MS,
  15 * 60 * 1000,
)
const PROFILE_CACHE_TTL_MS = readDurationMs(
  process.env.ETHOS_PROFILE_CACHE_TTL_MS,
  60 * 60 * 1000,
)
const USERKEY_SCORE_CACHE = new Map<string, { value: EthosScore | null; expiresAt: number }>()
const USERKEY_PROFILE_CACHE = new Map<string, { value: EthosProfileSummary | null; expiresAt: number }>()
const SUPPORTED_USERKEY_PREFIXES = [
  'profileId:',
  'address:',
  'service:discord:',
  'service:farcaster:',
  'service:telegram:',
  'service:x.com:',
  'service:x.com:username:',
] as const

function ethosClientName(): string {
  return (process.env.ETHOS_CLIENT_NAME ?? process.env.X_ETHOS_CLIENT ?? '4626.fun@1').trim() || '4626.fun@1'
}

function isAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeAddress(value: string): `0x${string}` | null {
  const normalized = value.trim().toLowerCase()
  return isAddress(normalized) ? (normalized as `0x${string}`) : null
}

export function normalizeEthosUserkey(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!SUPPORTED_USERKEY_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) return null
  if (/[\s<>]/.test(trimmed)) return null
  if (trimmed.startsWith('address:')) {
    const address = normalizeAddress(trimmed.slice('address:'.length))
    return address ? `address:${address}` : null
  }
  return trimmed
}

function parseScorePayload(payload: unknown): EthosScore {
  const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const rawScore = Number(obj.score)
  const level = typeof obj.level === 'string' ? obj.level : null
  return {
    score: Number.isFinite(rawScore) ? rawScore : null,
    level,
  }
}

function numberFromUnknown(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0
  return Number.isFinite(n) ? n : 0
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function parseEthosUserPayload(payload: unknown, userkey: string): EthosProfileSummary | null {
  if (!payload || typeof payload !== 'object') return null
  const user = payload as Record<string, unknown>
  const score = parseScorePayload(user)
  const stats = user.stats && typeof user.stats === 'object' ? user.stats as Record<string, unknown> : {}
  const review = stats.review && typeof stats.review === 'object' ? stats.review as Record<string, unknown> : {}
  const received = review.received && typeof review.received === 'object' ? review.received as Record<string, unknown> : {}
  const vouch = stats.vouch && typeof stats.vouch === 'object' ? stats.vouch as Record<string, unknown> : {}
  const vouchReceived = vouch.received && typeof vouch.received === 'object' ? vouch.received as Record<string, unknown> : {}
  const links = user.links && typeof user.links === 'object' ? user.links as Record<string, unknown> : {}
  const positive = numberFromUnknown(received.positive)
  const neutral = numberFromUnknown(received.neutral)
  const negative = numberFromUnknown(received.negative)
  const total = positive + neutral + negative

  return {
    userkey,
    score: score.score,
    level: score.level,
    displayName: stringFromUnknown(user.displayName),
    username: stringFromUnknown(user.username),
    avatarUrl: stringFromUnknown(user.avatarUrl),
    description: stringFromUnknown(user.description),
    profileUrl: stringFromUnknown(links.profile),
    stats: {
      reviews: {
        positive,
        neutral,
        negative,
        total,
        positivePct: total > 0 ? Math.round((positive / total) * 100) : null,
      },
      vouches: {
        receivedCount: numberFromUnknown(vouchReceived.count),
        receivedAmountWeiTotal: stringFromUnknown(vouchReceived.amountWeiTotal),
      },
    },
  }
}

function searchParamsForUserkey(userkey: string): { query: string; userKeyType: string } | null {
  if (userkey.startsWith('address:')) return { query: userkey.slice('address:'.length), userKeyType: 'ADDRESS' }
  if (userkey.startsWith('profileId:')) return { query: userkey.slice('profileId:'.length), userKeyType: 'PROFILE' }
  if (userkey.startsWith('service:x.com:username:')) return { query: userkey.slice('service:x.com:username:'.length), userKeyType: 'TWITTER' }
  if (userkey.startsWith('service:x.com:')) return { query: userkey.slice('service:x.com:'.length), userKeyType: 'TWITTER' }
  if (userkey.startsWith('service:farcaster:')) return { query: userkey.slice('service:farcaster:'.length), userKeyType: 'FARCASTER' }
  if (userkey.startsWith('service:discord:')) return { query: userkey.slice('service:discord:'.length), userKeyType: 'DISCORD' }
  if (userkey.startsWith('service:telegram:')) return { query: userkey.slice('service:telegram:'.length), userKeyType: 'TELEGRAM' }
  return null
}

async function fetchEthosScoreByAddress(address: `0x${string}`): Promise<EthosScore | null> {
  const url = new URL(`${ETHOS_API_BASE}/score/address`)
  url.searchParams.set('address', address)

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Ethos-Client': ethosClientName(),
    },
  })
  if (res.status === 404) return { score: null, level: null }
  if (!res.ok) throw new Error(`ethos_score_failed:${res.status}`)
  return parseScorePayload(await res.json())
}

async function fetchEthosScoreByUserkey(userkey: string): Promise<EthosScore | null> {
  const url = new URL(`${ETHOS_API_BASE}/score/userkey`)
  url.searchParams.set('userkey', userkey)

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Ethos-Client': ethosClientName(),
    },
  })
  if (res.status === 404) return { score: null, level: null }
  if (!res.ok) throw new Error(`ethos_score_userkey_failed:${res.status}`)
  return parseScorePayload(await res.json())
}

async function fetchEthosScoresByUserkeys(userkeys: string[]): Promise<Map<string, EthosScore | null>> {
  if (userkeys.length === 0) return new Map()

  const res = await fetch(`${ETHOS_API_BASE}/score/userkeys`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Ethos-Client': ethosClientName(),
    },
    body: JSON.stringify({ userkeys }),
  })
  if (!res.ok) throw new Error(`ethos_score_userkeys_failed:${res.status}`)

  const payload = await res.json()
  const scores = new Map<string, EthosScore | null>()
  const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  for (const userkey of userkeys) {
    const value = obj[userkey]
    scores.set(userkey, value && typeof value === 'object' ? parseScorePayload(value) : null)
  }
  return scores
}

export async function fetchFreshEthosScoresByUserkeys(rawUserkeys: string[]): Promise<Map<string, EthosScore | null>> {
  const userkeys = Array.from(
    new Set(
      rawUserkeys
        .map((raw) => normalizeEthosUserkey(raw))
        .filter((value): value is string => Boolean(value)),
    ),
  )
  const out = new Map<string, EthosScore | null>()
  for (let i = 0; i < userkeys.length; i += 100) {
    const chunk = userkeys.slice(i, i + 100)
    const scores = await fetchEthosScoresByUserkeys(chunk)
    for (const userkey of chunk) {
      const value = scores.get(userkey) ?? null
      USERKEY_SCORE_CACHE.set(userkey, {
        value,
        expiresAt: Date.now() + SCORE_CACHE_TTL_MS,
      })
      out.set(userkey, value)
    }
  }
  return out
}

async function fetchEthosProfileByUserkey(userkey: string): Promise<EthosProfileSummary | null> {
  const search = searchParamsForUserkey(userkey)
  if (!search) return null

  const url = new URL(`${ETHOS_API_BASE}/users/search`)
  url.searchParams.set('query', search.query)
  url.searchParams.set('userKeyType', search.userKeyType)
  url.searchParams.set('limit', '5')

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Ethos-Client': ethosClientName(),
    },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`ethos_user_search_failed:${res.status}`)

  const payload = await res.json()
  const values = payload && typeof payload === 'object' && Array.isArray((payload as { values?: unknown }).values)
    ? (payload as { values: unknown[] }).values
    : []
  const exact = values.find((value) => {
    if (!value || typeof value !== 'object') return false
    const keys = (value as { userkeys?: unknown }).userkeys
    return Array.isArray(keys) && keys.includes(userkey)
  }) ?? values[0]
  return parseEthosUserPayload(exact, userkey)
}

export async function getCachedEthosScoreByAddress(rawAddress: string): Promise<EthosScore | null> {
  const address = normalizeAddress(rawAddress)
  if (!address) return null

  const db = await getDb()
  if (!db) return null
  await ensureChatSchema(db)

  const cached = await db.sql`
    SELECT ethos_score, ethos_level, ethos_score_updated_at
    FROM chat_directory_profiles
    WHERE canonical_wallet = ${address}
    LIMIT 1;
  `
  const row = cached.rows?.[0]
  if (row?.ethos_score_updated_at) {
    const updatedAt = new Date(row.ethos_score_updated_at).getTime()
    if (Number.isFinite(updatedAt) && Date.now() - updatedAt < SCORE_CACHE_TTL_MS) {
      return {
        score: row.ethos_score === null || row.ethos_score === undefined ? null : Number(row.ethos_score),
        level: row.ethos_level ? String(row.ethos_level) : null,
      }
    }
  }

  const score = await fetchEthosScoreByAddress(address)
  await db.sql`
    INSERT INTO chat_directory_profiles (
      canonical_wallet,
      ethos_userkey,
      ethos_score,
      ethos_level,
      ethos_score_updated_at,
      updated_at
    ) VALUES (
      ${address},
      ${`address:${address}`},
      ${score?.score ?? null},
      ${score?.level ?? null},
      NOW(),
      NOW()
    )
    ON CONFLICT (canonical_wallet) DO UPDATE SET
      ethos_userkey = COALESCE(chat_directory_profiles.ethos_userkey, EXCLUDED.ethos_userkey),
      ethos_score = EXCLUDED.ethos_score,
      ethos_level = EXCLUDED.ethos_level,
      ethos_score_updated_at = NOW(),
      updated_at = NOW();
  `
  return score
}

export async function getCachedEthosScoreByUserkey(rawUserkey: string): Promise<EthosScore | null> {
  const userkey = normalizeEthosUserkey(rawUserkey)
  if (!userkey) return null

  if (userkey.startsWith('address:')) {
    return getCachedEthosScoreByAddress(userkey.slice('address:'.length))
  }

  const cached = USERKEY_SCORE_CACHE.get(userkey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const score = await fetchEthosScoreByUserkey(userkey)
  USERKEY_SCORE_CACHE.set(userkey, {
    value: score,
    expiresAt: Date.now() + SCORE_CACHE_TTL_MS,
  })
  return score
}

export async function getCachedEthosScoresByUserkeys(rawUserkeys: string[]): Promise<Map<string, EthosScore | null>> {
  const userkeys = Array.from(
    new Set(
      rawUserkeys
        .map((raw) => normalizeEthosUserkey(raw))
        .filter((value): value is string => Boolean(value))
        .slice(0, 100),
    ),
  )
  const out = new Map<string, EthosScore | null>()
  const misses: string[] = []

  for (const userkey of userkeys) {
    if (userkey.startsWith('address:')) {
      out.set(userkey, await getCachedEthosScoreByAddress(userkey.slice('address:'.length)))
      continue
    }

    const cached = USERKEY_SCORE_CACHE.get(userkey)
    if (cached && cached.expiresAt > Date.now()) {
      out.set(userkey, cached.value)
      continue
    }
    misses.push(userkey)
  }

  if (misses.length > 0) {
    const fresh = await fetchEthosScoresByUserkeys(misses)
    for (const userkey of misses) {
      const value = fresh.get(userkey) ?? null
      USERKEY_SCORE_CACHE.set(userkey, {
        value,
        expiresAt: Date.now() + SCORE_CACHE_TTL_MS,
      })
      out.set(userkey, value)
    }
  }

  return out
}

export async function getCachedEthosProfileByUserkey(rawUserkey: string): Promise<EthosProfileSummary | null> {
  const userkey = normalizeEthosUserkey(rawUserkey)
  if (!userkey) return null

  const cached = USERKEY_PROFILE_CACHE.get(userkey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const profile = await fetchEthosProfileByUserkey(userkey)
  USERKEY_PROFILE_CACHE.set(userkey, {
    value: profile,
    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
  })
  return profile
}
