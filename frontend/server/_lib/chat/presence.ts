import { createHash } from 'node:crypto'

import { getDb } from '../db/postgres.js'
import { ensureChatSchema } from '../db/schemaBootstrap.js'
import { shouldSampleEvent } from '../infra/telemetrySampling.js'
import { getCachedEthosScoreByAddress } from './ethosClient.js'
import {
  ethosCanonicalReadEnabled,
  getCanonicalEthosScoresByUserkeys,
} from '../identity/ethosCanonicalScores.js'

export type ChatAvailabilityUser = {
  address: `0x${string}`
  displayName: string | null
  avatarUrl: string | null
  ethosScore: number | null
  ethosLevel: string | null
  status: 'available' | 'recent'
  lastSeenAt: string | null
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

function isAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function normalizeChatAddress(value: unknown): `0x${string}` | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return isAddress(normalized) ? (normalized as `0x${string}`) : null
}

export async function recordPresenceHeartbeat(params: {
  address: `0x${string}`
  status?: string | null
  ip?: string | null
  userAgent?: string | null
}): Promise<void> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureChatSchema(db)

  const status = params.status === 'recent' ? 'recent' : 'available'
  const sessionIdHash = sha256(`${params.address}:${params.ip ?? ''}:${params.userAgent ?? ''}`)
  const userAgentHash = params.userAgent ? sha256(params.userAgent) : null

  // High-volume telemetry: presence heartbeats. Deterministic sampling keeps
  // per-user consistency while cutting write volume when TELEMETRY_SAMPLE_RATE < 1.
  if (!shouldSampleEvent('chat_presence_sessions', params.address)) {
    return
  }

  await db.sql`
    INSERT INTO chat_presence_sessions (
      session_id_hash,
      canonical_wallet,
      status,
      privacy_visible,
      last_seen_at,
      available_until,
      user_agent_hash,
      updated_at
    ) VALUES (
      ${sessionIdHash},
      ${params.address},
      ${status},
      ${true},
      NOW(),
      NOW() + INTERVAL '2 minutes',
      ${userAgentHash},
      NOW()
    )
    ON CONFLICT (session_id_hash) DO UPDATE SET
      canonical_wallet = EXCLUDED.canonical_wallet,
      status = EXCLUDED.status,
      privacy_visible = TRUE,
      last_seen_at = NOW(),
      available_until = NOW() + INTERVAL '2 minutes',
      user_agent_hash = EXCLUDED.user_agent_hash,
      updated_at = NOW();
  `

  let score: Awaited<ReturnType<typeof getCachedEthosScoreByAddress>> = null
  if (ethosCanonicalReadEnabled()) {
    try {
      const mapped = await getCanonicalEthosScoresByUserkeys({
        db,
        userkeys: [`address:${params.address}`],
      })
      score = mapped.get(`address:${params.address}`) ?? null
    } catch {
      score = null
    }
  } else {
    try {
      score = await getCachedEthosScoreByAddress(params.address)
    } catch {
      score = null
    }
  }

  await db.sql`
    INSERT INTO chat_directory_profiles (
      canonical_wallet,
      ethos_userkey,
      ethos_score,
      ethos_level,
      ethos_score_updated_at,
      last_seen_at,
      updated_at
    ) VALUES (
      ${params.address},
      ${`address:${params.address}`},
      ${score?.score ?? null},
      ${score?.level ?? null},
      ${score ? new Date() : null},
      NOW(),
      NOW()
    )
    ON CONFLICT (canonical_wallet) DO UPDATE SET
      ethos_userkey = COALESCE(chat_directory_profiles.ethos_userkey, EXCLUDED.ethos_userkey),
      ethos_score = COALESCE(EXCLUDED.ethos_score, chat_directory_profiles.ethos_score),
      ethos_level = COALESCE(EXCLUDED.ethos_level, chat_directory_profiles.ethos_level),
      ethos_score_updated_at = COALESCE(EXCLUDED.ethos_score_updated_at, chat_directory_profiles.ethos_score_updated_at),
      last_seen_at = NOW(),
      updated_at = NOW();
  `
}

export async function listAvailableChatUsers(params: {
  viewerAddress?: `0x${string}` | null
  limit?: number
}): Promise<ChatAvailabilityUser[]> {
  const db = await getDb()
  if (!db) return []
  await ensureChatSchema(db)
  const limit = Math.max(1, Math.min(100, Math.floor(params.limit ?? 40)))
  const viewer = params.viewerAddress ? String(params.viewerAddress).toLowerCase() : null

  const res = await db.sql`
    WITH latest_presence AS (
      SELECT DISTINCT ON (canonical_wallet)
        canonical_wallet,
        status,
        last_seen_at,
        available_until
      FROM chat_presence_sessions
      WHERE privacy_visible = TRUE
        AND last_seen_at > NOW() - INTERVAL '7 days'
        AND (${viewer}::text IS NULL OR canonical_wallet <> ${viewer})
      ORDER BY canonical_wallet, available_until DESC, last_seen_at DESC
    )
    SELECT
      p.canonical_wallet,
      CASE WHEN p.available_until > NOW() THEN 'available' ELSE 'recent' END AS resolved_status,
      p.last_seen_at,
      d.display_name,
      d.avatar_url,
      d.ethos_score,
      d.ethos_level
    FROM latest_presence p
    LEFT JOIN chat_directory_profiles d ON d.canonical_wallet = p.canonical_wallet
    ORDER BY
      CASE WHEN p.available_until > NOW() THEN 0 ELSE 1 END,
      d.ethos_score DESC NULLS LAST,
      p.last_seen_at DESC
    LIMIT ${limit};
  `

  return (res.rows ?? []).flatMap((row: any) => {
    const address = normalizeChatAddress(row.canonical_wallet)
    if (!address) return []
    return [{
      address,
      displayName: row.display_name ? String(row.display_name) : null,
      avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
      ethosScore: row.ethos_score === null || row.ethos_score === undefined ? null : Number(row.ethos_score),
      ethosLevel: row.ethos_level ? String(row.ethos_level) : null,
      status: row.resolved_status === 'available' ? 'available' : 'recent',
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
    }]
  })
}
