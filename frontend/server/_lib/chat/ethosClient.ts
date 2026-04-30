import { getDb } from '../db/postgres.js'
import { ensureChatSchema } from './schema.js'

export type EthosScore = {
  score: number | null
  level: string | null
}

const ETHOS_API_BASE = 'https://api.ethos.network/api/v2'
const SCORE_CACHE_TTL_MS = 6 * 60 * 60 * 1000

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

function parseScorePayload(payload: unknown): EthosScore {
  const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const rawScore = Number(obj.score)
  const level = typeof obj.level === 'string' ? obj.level : null
  return {
    score: Number.isFinite(rawScore) ? rawScore : null,
    level,
  }
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

export async function getCachedEthosScoreByAddress(rawAddress: string): Promise<EthosScore | null> {
  const address = normalizeAddress(rawAddress)
  if (!address) return null

  const db = await getDb()
  if (!db) return null
  await ensureChatSchema()

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
