import { normalizeEthosUserkey } from '../chat/ethosClient.js'

declare const process: { env: Record<string, string | undefined> }

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows?: any[]; rowCount?: number }>
}

const ETHOS_API_BASE = 'https://api.ethos.network/api/v2'
const SCORE_UPDATES_SYNC_KEY = 'score_updates_v2'
const SCORE_MATCHED_TTL_MS = 6 * 60 * 60 * 1000
const SCORE_NOT_FOUND_TTL_MS = 24 * 60 * 60 * 1000
const SCORE_ERROR_TTL_MS = 60 * 60 * 1000

const ETHOS_IDENTITY_PRIORITY: Record<string, number> = {
  profile_id: 10,
  x_id: 20,
  address_external_eoa: 30,
  address_embedded_eoa: 40,
  address_canonical_smart_wallet: 50,
  x_username: 60,
  farcaster: 70,
  telegram: 80,
  discord: 90,
}

type IdentitySeedRow = {
  canonicalUserId: number
  ethosUserkey: string
  identityType: string
  priority: number
  source: string
  verifiedAt: string | null
}

type EthosScoreRecord = {
  userkey: string
  score: number | null
  level: string | null
  status: 'matched' | 'not_found' | 'error'
  raw: unknown
}

function nowIso(): string {
  return new Date().toISOString()
}

function parseEnvBool(value: string | undefined): boolean {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function normalizeAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^0x[a-f0-9]{40}$/.test(raw) ? raw : null
}

function normalizeHandle(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().replace(/^@+/, '') : ''
  if (!raw) return null
  if (/[\s<>]/.test(raw)) return null
  return raw
}

function parseTwitterUserkey(value: unknown): { userkey: string; identityType: 'x_id' | 'x_username' } | null {
  const handle = normalizeHandle(value)
  if (!handle) return null
  if (/^\d+$/.test(handle)) {
    const userkey = normalizeEthosUserkey(`service:x.com:${handle}`)
    return userkey ? { userkey, identityType: 'x_id' } : null
  }
  const userkey = normalizeEthosUserkey(`service:x.com:username:${handle.toLowerCase()}`)
  return userkey ? { userkey, identityType: 'x_username' } : null
}

function parseServiceUserkey(prefix: 'service:farcaster:' | 'service:telegram:' | 'service:discord:', value: unknown): string | null {
  const normalized = normalizeHandle(value)
  if (!normalized) return null
  return normalizeEthosUserkey(`${prefix}${normalized}`)
}

function toFiniteScore(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return null
  if (numeric < 0 || numeric > 2800) return null
  return Math.round(numeric)
}

function toStatusFromScore(score: number | null): 'matched' | 'not_found' {
  return score === null ? 'not_found' : 'matched'
}

function toIdentityPriority(identityType: string): number {
  return ETHOS_IDENTITY_PRIORITY[identityType] ?? 999
}

function pushIdentitySeed(
  map: Map<string, IdentitySeedRow>,
  candidate: IdentitySeedRow,
): void {
  const existing = map.get(candidate.ethosUserkey)
  if (!existing) {
    map.set(candidate.ethosUserkey, candidate)
    return
  }
  if (candidate.priority < existing.priority) {
    map.set(candidate.ethosUserkey, candidate)
    return
  }
  if (candidate.priority === existing.priority && (candidate.verifiedAt ?? '') > (existing.verifiedAt ?? '')) {
    map.set(candidate.ethosUserkey, candidate)
  }
}

export function ethosCanonicalReadEnabled(): boolean {
  return parseEnvBool(process.env.ETHOS_CANONICAL_SCORE_READS_ENABLED)
}

export async function ensureEthosCanonicalSchema(db: Db): Promise<void> {
  const preflight = await db.sql`
    SELECT
      to_regclass('public.user_ethos_identity_keys') IS NOT NULL AS has_identity_keys,
      to_regclass('public.ethos_userkey_scores') IS NOT NULL AS has_userkey_scores,
      to_regclass('public.canonical_ethos_scores') IS NOT NULL AS has_canonical_scores,
      to_regclass('public.ethos_score_sync_state') IS NOT NULL AS has_sync_state;
  `
  const row = preflight.rows?.[0] ?? {}
  if (row.has_identity_keys && row.has_userkey_scores && row.has_canonical_scores && row.has_sync_state) return
  throw new Error('ethos_canonical_score_schema_migration_required')
}

function deriveIdentitySeedsForProfile(input: {
  canonicalUserId: number
  profilePrimaryWallet: string | null
  profileEmbeddedEoa: string | null
  profileCanonicalCsw: string | null
  walletRows: Array<{
    address: string
    is_primary: boolean
    is_embedded_eoa: boolean
    is_canonical_smart_wallet: boolean
  }>
  linkedMethodRows: Array<{ type: string; value: string }>
}): IdentitySeedRow[] {
  const out = new Map<string, IdentitySeedRow>()
  const canonicalUserId = input.canonicalUserId

  const addAddressSeed = (addressLike: unknown, identityType: string, source: string, verifiedAt: string | null) => {
    const address = normalizeAddress(addressLike)
    if (!address) return
    const userkey = normalizeEthosUserkey(`address:${address}`)
    if (!userkey) return
    pushIdentitySeed(out, {
      canonicalUserId,
      ethosUserkey: userkey,
      identityType,
      priority: toIdentityPriority(identityType),
      source,
      verifiedAt,
    })
  }

  addAddressSeed(input.profilePrimaryWallet, 'address_external_eoa', 'profiles.primary_wallet', null)
  addAddressSeed(input.profileEmbeddedEoa, 'address_embedded_eoa', 'profiles.primary_embedded_eoa', null)
  addAddressSeed(input.profileCanonicalCsw, 'address_canonical_smart_wallet', 'profiles.csw_address', null)

  for (const wallet of input.walletRows) {
    if (wallet.is_canonical_smart_wallet) {
      addAddressSeed(wallet.address, 'address_canonical_smart_wallet', 'profile_wallets.canonical', null)
      continue
    }
    if (wallet.is_embedded_eoa) {
      addAddressSeed(wallet.address, 'address_embedded_eoa', 'profile_wallets.embedded', null)
      continue
    }
    if (wallet.is_primary) {
      addAddressSeed(wallet.address, 'address_external_eoa', 'profile_wallets.primary', null)
      continue
    }
    addAddressSeed(wallet.address, 'address_external_eoa', 'profile_wallets.address', null)
  }

  for (const method of input.linkedMethodRows) {
    if (method.type === 'twitter') {
      const parsed = parseTwitterUserkey(method.value)
      if (!parsed) continue
      pushIdentitySeed(out, {
        canonicalUserId,
        ethosUserkey: parsed.userkey,
        identityType: parsed.identityType,
        priority: toIdentityPriority(parsed.identityType),
        source: 'account_linked_methods.twitter',
        verifiedAt: null,
      })
      continue
    }
    if (method.type === 'farcaster') {
      const userkey = parseServiceUserkey('service:farcaster:', method.value)
      if (!userkey) continue
      pushIdentitySeed(out, {
        canonicalUserId,
        ethosUserkey: userkey,
        identityType: 'farcaster',
        priority: toIdentityPriority('farcaster'),
        source: 'account_linked_methods.farcaster',
        verifiedAt: null,
      })
      continue
    }
    if (method.type === 'telegram') {
      const userkey = parseServiceUserkey('service:telegram:', method.value)
      if (!userkey) continue
      pushIdentitySeed(out, {
        canonicalUserId,
        ethosUserkey: userkey,
        identityType: 'telegram',
        priority: toIdentityPriority('telegram'),
        source: 'account_linked_methods.telegram',
        verifiedAt: null,
      })
      continue
    }
    if (method.type === 'discord') {
      const userkey = parseServiceUserkey('service:discord:', method.value)
      if (!userkey) continue
      pushIdentitySeed(out, {
        canonicalUserId,
        ethosUserkey: userkey,
        identityType: 'discord',
        priority: toIdentityPriority('discord'),
        source: 'account_linked_methods.discord',
        verifiedAt: null,
      })
    }
  }

  return Array.from(out.values())
}

export async function seedEthosIdentityKeys(params: {
  db: Db
  limit?: number
  offset?: number
  canonicalUserIds?: number[]
}): Promise<{
  profilesProcessed: number
  keysUpserted: number
  keysDerived: number
}> {
  const limit = Math.max(1, Math.min(5000, Math.floor(params.limit ?? 1000)))
  const offset = Math.max(0, Math.floor(params.offset ?? 0))
  await ensureEthosCanonicalSchema(params.db)

  const explicitIds = Array.from(new Set((params.canonicalUserIds ?? []).map((id) => Math.trunc(id)).filter((id) => id > 0)))
  const profilesResult = explicitIds.length > 0
    ? await params.db.sql`
        SELECT id, privy_user_id, primary_wallet, primary_embedded_eoa, csw_address
        FROM profiles
        WHERE id = ANY(${explicitIds}::bigint[])
          AND merged_into_profile_id IS NULL
        ORDER BY id ASC;
      `
    : await params.db.sql`
        SELECT id, privy_user_id, primary_wallet, primary_embedded_eoa, csw_address
        FROM profiles
        WHERE merged_into_profile_id IS NULL
        ORDER BY id ASC
        LIMIT ${limit}
        OFFSET ${offset};
      `
  const profiles = (profilesResult.rows ?? []) as Array<{
    id: number
    privy_user_id: string | null
    primary_wallet: string | null
    primary_embedded_eoa: string | null
    csw_address: string | null
  }>
  if (profiles.length === 0) {
    return { profilesProcessed: 0, keysUpserted: 0, keysDerived: 0 }
  }

  const profileIds = profiles.map((row) => row.id)
  const privyIds = Array.from(new Set(profiles.map((row) => row.privy_user_id).filter((id): id is string => typeof id === 'string' && id.length > 0)))

  const walletRowsResult = await params.db.sql`
    SELECT profile_id, address, is_primary, is_embedded_eoa, is_canonical_smart_wallet
    FROM profile_wallets
    WHERE profile_id = ANY(${profileIds}::bigint[]);
  `
  const walletRows = (walletRowsResult.rows ?? []) as Array<{
    profile_id: number
    address: string
    is_primary: boolean
    is_embedded_eoa: boolean
    is_canonical_smart_wallet: boolean
  }>

  const linkedMethodRows = privyIds.length > 0
    ? await params.db.sql`
        SELECT privy_user_id, type, value
        FROM account_linked_methods
        WHERE privy_user_id = ANY(${privyIds}::text[])
          AND type = ANY(${['twitter', 'farcaster', 'telegram', 'discord']}::text[]);
      `
    : { rows: [] }
  const linkedMethodRowsTyped = (linkedMethodRows.rows ?? []) as Array<{
    privy_user_id: string
    type: string
    value: string
  }>

  const walletMap = new Map<number, Array<{ address: string; is_primary: boolean; is_embedded_eoa: boolean; is_canonical_smart_wallet: boolean }>>()
  for (const wallet of walletRows) {
    const current = walletMap.get(wallet.profile_id) ?? []
    current.push({
      address: wallet.address,
      is_primary: wallet.is_primary === true,
      is_embedded_eoa: wallet.is_embedded_eoa === true,
      is_canonical_smart_wallet: wallet.is_canonical_smart_wallet === true,
    })
    walletMap.set(wallet.profile_id, current)
  }

  const linkedMap = new Map<string, Array<{ type: string; value: string }>>()
  for (const row of linkedMethodRowsTyped) {
    const current = linkedMap.get(row.privy_user_id) ?? []
    current.push({ type: String(row.type ?? '').trim().toLowerCase(), value: String(row.value ?? '') })
    linkedMap.set(row.privy_user_id, current)
  }

  const seeds: IdentitySeedRow[] = []
  for (const profile of profiles) {
    seeds.push(
      ...deriveIdentitySeedsForProfile({
        canonicalUserId: Number(profile.id),
        profilePrimaryWallet: profile.primary_wallet,
        profileEmbeddedEoa: profile.primary_embedded_eoa,
        profileCanonicalCsw: profile.csw_address,
        walletRows: walletMap.get(Number(profile.id)) ?? [],
        linkedMethodRows: profile.privy_user_id ? (linkedMap.get(profile.privy_user_id) ?? []) : [],
      }),
    )
  }

  let keysUpserted = 0
  for (const seed of seeds) {
    const result = await params.db.sql`
      INSERT INTO user_ethos_identity_keys (
        canonical_user_id,
        ethos_userkey,
        identity_type,
        priority,
        source,
        verified_at,
        created_at,
        updated_at
      ) VALUES (
        ${seed.canonicalUserId},
        ${seed.ethosUserkey},
        ${seed.identityType},
        ${seed.priority},
        ${seed.source},
        ${seed.verifiedAt},
        NOW(),
        NOW()
      )
      ON CONFLICT (canonical_user_id, ethos_userkey) DO UPDATE
      SET
        identity_type = EXCLUDED.identity_type,
        priority = EXCLUDED.priority,
        source = EXCLUDED.source,
        verified_at = COALESCE(EXCLUDED.verified_at, user_ethos_identity_keys.verified_at),
        updated_at = NOW();
    `
    keysUpserted += Number(result.rowCount ?? 0) > 0 ? 1 : 0
  }

  return {
    profilesProcessed: profiles.length,
    keysUpserted,
    keysDerived: seeds.length,
  }
}

function ttlCutoffIso(ttlMs: number): string {
  return new Date(Date.now() - ttlMs).toISOString()
}

async function fetchBulkEthosScores(userkeys: string[]): Promise<Map<string, EthosScoreRecord>> {
  if (userkeys.length === 0) return new Map()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Ethos-Client': (process.env.ETHOS_CLIENT_NAME ?? process.env.X_ETHOS_CLIENT ?? '4626.fun@1').trim() || '4626.fun@1',
  }
  const apiKey = String(process.env.ETHOS_API_KEY ?? '').trim()
  if (apiKey) headers['X-Ethos-Api-Key'] = apiKey

  const response = await fetch(`${ETHOS_API_BASE}/score/userkeys`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userkeys }),
  })
  if (!response.ok) {
    throw new Error(`ethos_score_userkeys_failed:${response.status}`)
  }
  const payload = await response.json() as Record<string, unknown>
  const out = new Map<string, EthosScoreRecord>()
  for (const userkey of userkeys) {
    const raw = payload?.[userkey] ?? null
    const score = raw && typeof raw === 'object' ? toFiniteScore((raw as Record<string, unknown>).score) : null
    const level = raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).level === 'string'
      ? String((raw as Record<string, unknown>).level)
      : null
    out.set(userkey, {
      userkey,
      score,
      level,
      status: toStatusFromScore(score),
      raw,
    })
  }
  return out
}

async function upsertEthosScoreRecord(db: Db, record: EthosScoreRecord): Promise<void> {
  await db.sql`
    INSERT INTO ethos_userkey_scores (
      ethos_userkey,
      score,
      level,
      status,
      ethos_last_updated_at,
      fetched_at,
      raw,
      updated_at
    ) VALUES (
      ${record.userkey},
      ${record.score},
      ${record.level},
      ${record.status},
      NOW(),
      NOW(),
      ${record.raw},
      NOW()
    )
    ON CONFLICT (ethos_userkey) DO UPDATE
    SET
      score = EXCLUDED.score,
      level = EXCLUDED.level,
      status = EXCLUDED.status,
      ethos_last_updated_at = EXCLUDED.ethos_last_updated_at,
      fetched_at = EXCLUDED.fetched_at,
      raw = EXCLUDED.raw,
      updated_at = NOW();
  `
}

export async function syncEthosUserkeyScores(params: {
  db: Db
  limit?: number
  chunkSize?: number
  forceUserkeys?: string[]
}): Promise<{
  attempted: number
  updated: number
  failed: number
  processedUserkeys: string[]
}> {
  await ensureEthosCanonicalSchema(params.db)
  const chunkSize = Math.max(1, Math.min(100, Math.floor(params.chunkSize ?? 100)))
  const normalizedForce = Array.from(
    new Set((params.forceUserkeys ?? [])
      .map((value) => normalizeEthosUserkey(value))
      .filter((value): value is string => Boolean(value))),
  )

  const userkeys = normalizedForce.length > 0
    ? normalizedForce
    : ((await params.db.sql`
        SELECT DISTINCT k.ethos_userkey
        FROM user_ethos_identity_keys k
        LEFT JOIN ethos_userkey_scores s ON s.ethos_userkey = k.ethos_userkey
        WHERE s.ethos_userkey IS NULL
           OR (s.status = 'stale')
           OR (s.status = 'matched' AND s.fetched_at < ${ttlCutoffIso(SCORE_MATCHED_TTL_MS)})
           OR (s.status = 'not_found' AND s.fetched_at < ${ttlCutoffIso(SCORE_NOT_FOUND_TTL_MS)})
           OR (s.status = 'error' AND s.fetched_at < ${ttlCutoffIso(SCORE_ERROR_TTL_MS)})
           OR (s.status = 'unknown')
        ORDER BY k.ethos_userkey ASC
        LIMIT ${Math.max(1, Math.min(5000, Math.floor(params.limit ?? 1000)))};
      `).rows ?? []).map((row: any) => String(row.ethos_userkey))

  if (userkeys.length === 0) {
    return { attempted: 0, updated: 0, failed: 0, processedUserkeys: [] }
  }

  let attempted = 0
  let updated = 0
  let failed = 0

  for (let i = 0; i < userkeys.length; i += chunkSize) {
    const chunk = userkeys.slice(i, i + chunkSize)
    attempted += chunk.length
    try {
      const records = await fetchBulkEthosScores(chunk)
      for (const userkey of chunk) {
        const record = records.get(userkey) ?? {
          userkey,
          score: null,
          level: null,
          status: 'not_found' as const,
          raw: null,
        }
        await upsertEthosScoreRecord(params.db, record)
        updated += 1
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error'
      for (const userkey of chunk) {
        await upsertEthosScoreRecord(params.db, {
          userkey,
          score: null,
          level: null,
          status: 'error',
          raw: { error: message, at: nowIso() },
        })
      }
      failed += chunk.length
    }
  }

  return { attempted, updated, failed, processedUserkeys: userkeys }
}

async function listCanonicalUsersForRollup(db: Db, params: {
  canonicalUserIds?: number[]
  userkeys?: string[]
  limit?: number
}): Promise<number[]> {
  const explicitIds = Array.from(new Set((params.canonicalUserIds ?? []).map((id) => Math.trunc(id)).filter((id) => id > 0)))
  if (explicitIds.length > 0) return explicitIds

  const fromUserkeys = Array.from(new Set((params.userkeys ?? [])
    .map((value) => normalizeEthosUserkey(value))
    .filter((value): value is string => Boolean(value))))
  if (fromUserkeys.length > 0) {
    const rows = await db.sql`
      SELECT DISTINCT canonical_user_id
      FROM user_ethos_identity_keys
      WHERE ethos_userkey = ANY(${fromUserkeys}::text[])
      ORDER BY canonical_user_id ASC;
    `
    return (rows.rows ?? [])
      .map((row: any) => Number(row.canonical_user_id))
      .filter((id: number) => Number.isFinite(id) && id > 0)
  }

  const fallback = await db.sql`
    SELECT DISTINCT canonical_user_id
    FROM user_ethos_identity_keys
    ORDER BY canonical_user_id ASC
    LIMIT ${Math.max(1, Math.min(5000, Math.floor(params.limit ?? 1000)))};
  `
  return (fallback.rows ?? [])
    .map((row: any) => Number(row.canonical_user_id))
    .filter((id: number) => Number.isFinite(id) && id > 0)
}

export async function materializeCanonicalEthosScores(params: {
  db: Db
  canonicalUserIds?: number[]
  userkeys?: string[]
  limit?: number
}): Promise<{
  processed: number
  updated: number
}> {
  await ensureEthosCanonicalSchema(params.db)
  const canonicalUserIds = await listCanonicalUsersForRollup(params.db, params)
  if (canonicalUserIds.length === 0) return { processed: 0, updated: 0 }

  const winnersResult = await params.db.sql`
    WITH ranked AS (
      SELECT
        k.canonical_user_id,
        k.ethos_userkey,
        k.identity_type,
        k.priority,
        s.score,
        s.level,
        s.fetched_at,
        ROW_NUMBER() OVER (
          PARTITION BY k.canonical_user_id
          ORDER BY
            k.priority ASC,
            s.score DESC NULLS LAST,
            k.ethos_userkey ASC
        ) AS rn
      FROM user_ethos_identity_keys k
      JOIN ethos_userkey_scores s
        ON s.ethos_userkey = k.ethos_userkey
      WHERE k.canonical_user_id = ANY(${canonicalUserIds}::bigint[])
        AND s.status = 'matched'
        AND s.score IS NOT NULL
    )
    SELECT
      canonical_user_id,
      ethos_userkey,
      identity_type,
      score,
      level,
      fetched_at
    FROM ranked
    WHERE rn = 1;
  `

  const winnerMap = new Map<number, {
    selectedUserkey: string
    sourceIdentityType: string
    score: number
    level: string | null
    fetchedAt: string | null
  }>()
  for (const row of winnersResult.rows ?? []) {
    const canonicalUserId = Number(row.canonical_user_id)
    if (!Number.isFinite(canonicalUserId) || canonicalUserId <= 0) continue
    winnerMap.set(canonicalUserId, {
      selectedUserkey: String(row.ethos_userkey),
      sourceIdentityType: String(row.identity_type),
      score: Number(row.score),
      level: row.level == null ? null : String(row.level),
      fetchedAt: row.fetched_at == null ? null : new Date(row.fetched_at).toISOString(),
    })
  }

  let updated = 0
  for (const canonicalUserId of canonicalUserIds) {
    const winner = winnerMap.get(canonicalUserId)
    const result = await params.db.sql`
      INSERT INTO canonical_ethos_scores (
        canonical_user_id,
        selected_userkey,
        score,
        level,
        source_identity_type,
        score_fetched_at,
        updated_at
      ) VALUES (
        ${canonicalUserId},
        ${winner?.selectedUserkey ?? null},
        ${winner?.score ?? null},
        ${winner?.level ?? null},
        ${winner?.sourceIdentityType ?? null},
        ${winner?.fetchedAt ?? null},
        NOW()
      )
      ON CONFLICT (canonical_user_id) DO UPDATE
      SET
        selected_userkey = EXCLUDED.selected_userkey,
        score = EXCLUDED.score,
        level = EXCLUDED.level,
        source_identity_type = EXCLUDED.source_identity_type,
        score_fetched_at = EXCLUDED.score_fetched_at,
        updated_at = NOW();
    `
    if (Number(result.rowCount ?? 0) > 0) updated += 1
  }

  return {
    processed: canonicalUserIds.length,
    updated,
  }
}

function parseUpdateItems(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const candidates = [root.updates, root.values, root.items, root.data]
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    return candidate.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
  }
  return []
}

function extractUpdateUserkey(item: Record<string, unknown>): string | null {
  const userkey = typeof item.userkey === 'string'
    ? item.userkey
    : typeof item.userKey === 'string'
      ? item.userKey
      : typeof item.key === 'string'
        ? item.key
        : null
  if (!userkey) return null
  return normalizeEthosUserkey(userkey)
}

function extractUpdateCursor(item: Record<string, unknown>): string | null {
  const value = typeof item.updatedAt === 'string'
    ? item.updatedAt
    : typeof item.lastUpdatedAt === 'string'
      ? item.lastUpdatedAt
    : typeof item.timestamp === 'string'
      ? item.timestamp
      : typeof item.createdAt === 'string'
        ? item.createdAt
        : null
  return value && value.trim() ? value : null
}

function normalizeCursorIso(value: string | null): string | null {
  if (!value) return null
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

async function fetchEthosScoreUpdates(params: {
  after: string | null
  limit: number
}): Promise<{
  userkeys: string[]
  maxCursor: string | null
  count: number
}> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Ethos-Client': (process.env.ETHOS_CLIENT_NAME ?? process.env.X_ETHOS_CLIENT ?? '4626.fun@1').trim() || '4626.fun@1',
  }
  const apiKey = String(process.env.ETHOS_API_KEY ?? '').trim()
  if (apiKey) headers['X-Ethos-Api-Key'] = apiKey

  const url = new URL(`${ETHOS_API_BASE}/score/updates`)
  if (params.after) url.searchParams.set('after', params.after)
  url.searchParams.set('limit', String(params.limit))

  const response = await fetch(url, { headers })
  if (!response.ok) {
    let detail = ''
    try {
      const payload = await response.json() as Record<string, unknown>
      detail = typeof payload?.error === 'string'
        ? payload.error
        : typeof payload?.message === 'string'
          ? payload.message
          : ''
    } catch {
      detail = ''
    }
    const suffix = detail ? `:${detail.slice(0, 120)}` : ''
    throw new Error(`ethos_score_updates_failed:${response.status}${suffix}`)
  }
  const payload = await response.json()
  const items = parseUpdateItems(payload)
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  let maxCursor: string | null = null
  const userkeys: string[] = []
  for (const item of items) {
    const userkey = extractUpdateUserkey(item)
    if (userkey) userkeys.push(userkey)
    const cursor = extractUpdateCursor(item)
    if (cursor && (!maxCursor || cursor > maxCursor)) maxCursor = cursor
  }
  const payloadCursor = typeof root.after === 'string'
    ? root.after
    : typeof root.nextAfter === 'string'
      ? root.nextAfter
      : typeof root.cursor === 'string'
        ? root.cursor
        : null
  if (payloadCursor && (!maxCursor || payloadCursor > maxCursor)) {
    maxCursor = payloadCursor
  }
  return {
    userkeys: Array.from(new Set(userkeys)),
    maxCursor,
    count: items.length,
  }
}

async function readUpdatesCursor(db: Db, syncKey: string): Promise<string | null> {
  const result = await db.sql`
    SELECT cursor_after
    FROM ethos_score_sync_state
    WHERE sync_key = ${syncKey}
    LIMIT 1;
  `
  const value = result.rows?.[0]?.cursor_after
  return typeof value === 'string' && value.trim() ? value : null
}

async function writeUpdatesCursor(db: Db, syncKey: string, cursorAfter: string | null): Promise<void> {
  await db.sql`
    INSERT INTO ethos_score_sync_state (
      sync_key,
      cursor_after,
      last_synced_at,
      updated_at
    ) VALUES (
      ${syncKey},
      ${cursorAfter},
      NOW(),
      NOW()
    )
    ON CONFLICT (sync_key) DO UPDATE
    SET
      cursor_after = EXCLUDED.cursor_after,
      last_synced_at = NOW(),
      updated_at = NOW();
  `
}

export async function syncEthosScoreUpdates(params: {
  db: Db
  syncKey?: string
  pageLimit?: number
  maxPages?: number
  startAfter?: string | null
}): Promise<{
  pages: number
  updatesSeen: number
  refreshedUserkeys: number
  cursorAfter: string | null
}> {
  await ensureEthosCanonicalSchema(params.db)
  const syncKey = params.syncKey ?? SCORE_UPDATES_SYNC_KEY
  const pageLimit = Math.max(1, Math.min(1000, Math.floor(params.pageLimit ?? 500)))
  const maxPages = Math.max(1, Math.min(20, Math.floor(params.maxPages ?? 5)))
  let cursorAfter = normalizeCursorIso(params.startAfter ?? await readUpdatesCursor(params.db, syncKey))
  if (!cursorAfter) {
    cursorAfter = nowIso()
    await writeUpdatesCursor(params.db, syncKey, cursorAfter)
    return {
      pages: 0,
      updatesSeen: 0,
      refreshedUserkeys: 0,
      cursorAfter,
    }
  }
  let maxCursorSeen: string | null = cursorAfter
  let updatesSeen = 0
  let pages = 0
  const allUserkeys = new Set<string>()

  for (let page = 0; page < maxPages; page += 1) {
    pages += 1
    const pageResult = await fetchEthosScoreUpdates({
      after: cursorAfter,
      limit: pageLimit,
    })
    updatesSeen += pageResult.count
    for (const userkey of pageResult.userkeys) allUserkeys.add(userkey)
    const pageCursor = normalizeCursorIso(pageResult.maxCursor)
    if (pageCursor && (!maxCursorSeen || pageCursor > maxCursorSeen)) {
      maxCursorSeen = pageCursor
      cursorAfter = pageCursor
    }
    if (pageResult.count < pageLimit) break
    if (!pageCursor) break
  }

  const userkeys = Array.from(allUserkeys)
  if (userkeys.length > 0) {
    await syncEthosUserkeyScores({
      db: params.db,
      forceUserkeys: userkeys,
      chunkSize: 100,
    })
    await materializeCanonicalEthosScores({
      db: params.db,
      userkeys,
    })
  }

  const nextCursor = normalizeCursorIso(maxCursorSeen) ?? cursorAfter
  if (nextCursor !== cursorAfter) {
    cursorAfter = nextCursor
  }
  if (cursorAfter) {
    await writeUpdatesCursor(params.db, syncKey, cursorAfter)
  }

  return {
    pages,
    updatesSeen,
    refreshedUserkeys: userkeys.length,
    cursorAfter,
  }
}

export async function getCanonicalEthosScoresByUserkeys(params: {
  db: Db
  userkeys: string[]
}): Promise<Map<string, { score: number | null; level: string | null }>> {
  await ensureEthosCanonicalSchema(params.db)
  const normalized = Array.from(new Set(params.userkeys
    .map((userkey) => normalizeEthosUserkey(userkey))
    .filter((userkey): userkey is string => Boolean(userkey))))
  const out = new Map<string, { score: number | null; level: string | null }>()
  if (normalized.length === 0) return out

  const rows = await params.db.sql`
    SELECT DISTINCT ON (k.ethos_userkey)
      k.ethos_userkey,
      c.score,
      c.level
    FROM user_ethos_identity_keys k
    JOIN canonical_ethos_scores c
      ON c.canonical_user_id = k.canonical_user_id
    WHERE k.ethos_userkey = ANY(${normalized}::text[])
    ORDER BY k.ethos_userkey ASC, c.score DESC NULLS LAST, c.updated_at DESC;
  `

  for (const row of rows.rows ?? []) {
    const userkey = String(row.ethos_userkey)
    out.set(userkey, {
      score: row.score == null ? null : Number(row.score),
      level: row.level == null ? null : String(row.level),
    })
  }

  return out
}

export const __testOnly = {
  deriveIdentitySeedsForProfile,
  parseTwitterUserkey,
  toIdentityPriority,
  parseUpdateItems,
  extractUpdateUserkey,
  extractUpdateCursor,
}
