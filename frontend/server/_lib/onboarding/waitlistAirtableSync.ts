type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows?: any[] }> }

type AirtableFetch = typeof fetch
type SupabaseLike = { from: (table: string) => any }

type AirtableTableKey = 'applicants' | 'referrals' | 'tasks' | 'onboarding'

type AirtableTableConfig = {
  key: AirtableTableKey
  label: string
  table: string
  mergeField: string
}

export type WaitlistAirtableSyncConfig = {
  token: string
  baseId: string
  limit: number
  tables: Record<AirtableTableKey, AirtableTableConfig>
}

type AirtableRecord = {
  fields: Record<string, string | number | boolean | null>
}

export type WaitlistAirtableTableResult = {
  key: AirtableTableKey
  label: string
  table: string
  mergeField: string
  attempted: number
  upserted: number
  errors: string[]
}

export type WaitlistAirtableSyncResult = {
  dryRun: boolean
  baseId: string
  tables: WaitlistAirtableTableResult[]
}

const AIRTABLE_BATCH_SIZE = 10
const DEFAULT_SYNC_LIMIT = 500
const MAX_SYNC_LIMIT = 2000
const DEFAULT_AIRTABLE_BASE_ID = 'apppGxObBZlGy0AAo'
const DEFAULT_TABLES: Record<AirtableTableKey, Omit<AirtableTableConfig, 'key'>> = {
  applicants: {
    label: 'WAITLIST APPLICANTS',
    table: 'tblCWAvEXya2mSMU6',
    mergeField: 'email',
  },
  referrals: {
    label: 'WAITLIST REFERRALS',
    table: 'tblb1hAx5w3S7hnGM',
    mergeField: 'notes',
  },
  tasks: {
    label: 'WAITLIST TASKS',
    table: 'tblJZKc3ZxWgifQ0f',
    mergeField: 'title',
  },
  onboarding: {
    label: 'WAITLIST ONBOARDING',
    table: 'tbl48bNOWQ8yN3xRr',
    mergeField: 'canonical_wallet',
  },
}

export function readWaitlistAirtableSyncConfig(env: Record<string, string | undefined>): {
  config: WaitlistAirtableSyncConfig | null
  missing: string[]
} {
  const token = String(env.AIRTABLE_PERSONAL_ACCESS_TOKEN ?? '').trim()
  const baseId = String(env.AIRTABLE_WAITLIST_BASE_ID ?? env.AIRTABLE_BASE_ID ?? DEFAULT_AIRTABLE_BASE_ID).trim()
  const limitRaw = Number(String(env.AIRTABLE_WAITLIST_SYNC_LIMIT ?? '').trim())
  const limit = Number.isFinite(limitRaw)
    ? Math.min(MAX_SYNC_LIMIT, Math.max(1, Math.floor(limitRaw)))
    : DEFAULT_SYNC_LIMIT
  const tables: Record<AirtableTableKey, AirtableTableConfig> = {
    applicants: {
      key: 'applicants',
      ...DEFAULT_TABLES.applicants,
      table: String(
        env.AIRTABLE_WAITLIST_APPLICANTS_TABLE_ID ??
        env.AIRTABLE_WAITLIST_TABLE_ID ??
        env.AIRTABLE_WAITLIST_TABLE_NAME ??
        DEFAULT_TABLES.applicants.table,
      ).trim(),
    },
    referrals: {
      key: 'referrals',
      ...DEFAULT_TABLES.referrals,
      table: String(env.AIRTABLE_WAITLIST_REFERRALS_TABLE_ID ?? DEFAULT_TABLES.referrals.table).trim(),
    },
    tasks: {
      key: 'tasks',
      ...DEFAULT_TABLES.tasks,
      table: String(env.AIRTABLE_WAITLIST_TASKS_TABLE_ID ?? DEFAULT_TABLES.tasks.table).trim(),
    },
    onboarding: {
      key: 'onboarding',
      ...DEFAULT_TABLES.onboarding,
      table: String(env.AIRTABLE_WAITLIST_ONBOARDING_TABLE_ID ?? DEFAULT_TABLES.onboarding.table).trim(),
    },
  }

  const missing: string[] = []
  if (!token) missing.push('AIRTABLE_PERSONAL_ACCESS_TOKEN')
  if (!baseId) missing.push('AIRTABLE_WAITLIST_BASE_ID')
  for (const table of Object.values(tables)) {
    if (!table.table) missing.push(`AIRTABLE_WAITLIST_${table.key.toUpperCase()}_TABLE_ID`)
  }

  if (missing.length > 0) return { config: null, missing }
  return { config: { token, baseId, limit, tables }, missing: [] }
}

function toIso(value: unknown): string | null {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

function safeInt(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? Math.floor(parsed) : 0
}

function toBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function mapApplicantStatus(value: unknown): string {
  const status = toStringOrNull(value)?.toLowerCase()
  if (status === 'approved') return 'approved'
  if (status === 'denied' || status === 'rejected') return 'rejected'
  if (status === 'ready' || status === 'active' || status === 'onboarding' || status === 'reviewing') return status
  return 'new'
}

function weightedPoints(source: unknown, amount: unknown): number {
  const normalizedSource = String(source ?? '').trim()
  const normalizedAmount = safeInt(amount)
  if (normalizedSource === 'amoe_entry_spend') return normalizedAmount
  if (
    normalizedSource === 'amoe_twitter_daily' ||
    normalizedSource === 'amoe_checkin' ||
    normalizedSource === 'waitlist_signup' ||
    normalizedSource === 'referral_passthrough' ||
    normalizedSource === 'csw_link'
  ) {
    return normalizedAmount
  }
  if (
    normalizedSource === 'referral_signup' ||
    normalizedSource === 'referral_csw_link' ||
    normalizedSource === 'referral_qualified'
  ) {
    return Math.round(normalizedAmount * 0.6)
  }
  if (normalizedSource.startsWith('social_')) return Math.round(normalizedAmount * 0.5)
  if (normalizedSource.startsWith('bonus_') || normalizedSource === 'task') return Math.round(normalizedAmount * 0.3)
  if (
    normalizedSource === 'agent_feedback' ||
    normalizedSource === 'agent_reputation' ||
    normalizedSource === 'lens_identity' ||
    normalizedSource === 'grove_proof'
  ) {
    return Math.round(normalizedAmount * 0.4)
  }
  if (
    normalizedSource === 'link_email' ||
    normalizedSource === 'link_google' ||
    normalizedSource === 'link_apple' ||
    normalizedSource === 'link_twitter' ||
    normalizedSource === 'link_telegram' ||
    normalizedSource === 'link_tiktok' ||
    normalizedSource === 'link_external_eoa' ||
    normalizedSource === 'link_zora' ||
    normalizedSource === 'resolve_csw' ||
    normalizedSource === 'has_creator_coin'
  ) {
    return Math.round(normalizedAmount * 0.6)
  }
  return Math.round(normalizedAmount * 0.3)
}

function compactRecord(record: AirtableRecord): AirtableRecord {
  return {
    fields: Object.fromEntries(
      Object.entries(record.fields).filter(([, value]) => value !== null),
    ),
  }
}

function applicantRecordFromProfile(raw: any): AirtableRecord {
  return {
    fields: {
      name: toStringOrNull(raw?.persona) ?? toStringOrNull(raw?.email) ?? `profile ${safeInt(raw?.id ?? raw?.signup_id)}`,
      email: String(raw?.email ?? ''),
      wallet_address:
        toStringOrNull(raw?.csw_address) ??
        toStringOrNull(raw?.primary_smart_wallet) ??
        toStringOrNull(raw?.primary_wallet),
      referral_code: toStringOrNull(raw?.referral_code),
      status: mapApplicantStatus(raw?.app_access_status),
      email_verified_at: toIso(raw?.created_at),
      wallet_linked_at:
        toStringOrNull(raw?.csw_address) ||
        toStringOrNull(raw?.primary_smart_wallet) ||
        toStringOrNull(raw?.primary_wallet)
          ? toIso(raw?.updated_at)
          : null,
      onboarding_completed_at: toStringOrNull(raw?.app_access_status) === 'approved'
        ? toIso(raw?.app_access_decided_at)
        : null,
    },
  }
}

function taskRecordFromPoint(raw: any, profileById: Map<number, any> = new Map()): AirtableRecord {
  const profile = profileById.get(safeInt(raw?.signup_id))
  return {
    fields: {
      title: `point:${safeInt(raw?.point_id ?? raw?.id)}:${toStringOrNull(raw?.source) ?? 'waitlist_points'}`,
      description: toStringOrNull(raw?.source_id),
      status: 'Done',
      summary: `${safeInt(raw?.amount)} points${toStringOrNull(profile?.email) ? ` for ${toStringOrNull(profile?.email)}` : ''}`,
      priority: 'Low',
      completed_at: toIso(raw?.created_at),
      task_type: 'Other',
    },
  }
}

function referralRecordFromConversion(raw: any, profileById: Map<number, any> = new Map()): AirtableRecord {
  const referrer = profileById.get(safeInt(raw?.referrer_signup_id))
  const invitee = profileById.get(safeInt(raw?.invitee_signup_id))
  const referralId = safeInt(raw?.referral_conversion_id ?? raw?.id)
  return {
    fields: {
      status: raw?.qualified_at || toStringOrNull(raw?.status) === 'qualified' ? 'qualified' : 'pending',
      qualified_at: toIso(raw?.qualified_at),
      notes: [
        `referral:${referralId}`,
        toStringOrNull(raw?.referral_code) ? `code: ${toStringOrNull(raw?.referral_code)}` : null,
        toStringOrNull(referrer?.email) ? `referrer: ${toStringOrNull(referrer?.email)}` : null,
        toStringOrNull(invitee?.email) ? `referred: ${toStringOrNull(invitee?.email)}` : null,
        toBool(raw?.is_valid) ? null : `invalid: ${toStringOrNull(raw?.invalid_reason) ?? 'unknown'}`,
      ].filter(Boolean).join('\n') || null,
    },
  }
}

function onboardingRecordFromProfile(raw: any): AirtableRecord | null {
  const canonicalWallet =
    toStringOrNull(raw?.csw_address) ??
    toStringOrNull(raw?.primary_smart_wallet) ??
    toStringOrNull(raw?.primary_wallet)
  if (!canonicalWallet) return null
  const emailVerified = Boolean(toStringOrNull(raw?.email))
  const walletLinked = true
  const readiness = toStringOrNull(raw?.app_access_status) === 'denied'
    ? 'blocked'
    : emailVerified && walletLinked
      ? 'ready'
      : emailVerified || walletLinked
        ? 'in progress'
        : 'not started'
  return {
    fields: {
      email_verified: emailVerified,
      wallet_linked: walletLinked,
      canonical_wallet: canonicalWallet,
      last_synced_at: new Date().toISOString(),
      email_verified_at: emailVerified ? toIso(raw?.created_at) : null,
      wallet_linked_at: walletLinked ? toIso(raw?.updated_at) : null,
      readiness_status: readiness,
    },
  }
}

async function readSupabaseDataset(client: SupabaseLike, limit: number): Promise<{
  profiles: any[]
  points: any[]
  referrals: any[]
}> {
  const [profilesResult, pointsResult, referralsResult] = await Promise.all([
    client
      .from('profiles')
      .select([
        'id',
        'email',
        'persona',
        'primary_wallet',
        'csw_address',
        'primary_smart_wallet',
        'primary_embedded_eoa',
        'embedded_wallet',
        'referral_code',
        'app_access_status',
        'app_access_decided_at',
        'created_at',
        'updated_at',
      ].join(','))
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(limit),
    client
      .from('points')
      .select('id,signup_id,source,source_id,amount,created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    client
      .from('referral_conversions')
      .select('id,referral_code,referrer_signup_id,invitee_signup_id,is_valid,invalid_reason,status,qualified_at,created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])
  if (profilesResult.error) throw new Error(`supabase_profiles:${profilesResult.error.message}`)
  if (pointsResult.error) throw new Error(`supabase_points:${pointsResult.error.message}`)
  if (referralsResult.error) throw new Error(`supabase_referrals:${referralsResult.error.message}`)
  return {
    profiles: profilesResult.data ?? [],
    points: pointsResult.data ?? [],
    referrals: referralsResult.data ?? [],
  }
}

export async function readApplicantRecords(db: Db, limit: number): Promise<AirtableRecord[]> {
  const result = await db.sql`
    WITH point_totals AS (
      SELECT
        signup_id,
        COALESCE(
          ROUND(
            SUM(
              CASE
                WHEN source = 'amoe_entry_spend' THEN amount
                WHEN source IN ('amoe_twitter_daily', 'amoe_checkin') THEN amount * 1.00
                WHEN source IN ('waitlist_signup', 'referral_passthrough') THEN amount * 1.00
                WHEN source = 'csw_link' THEN amount * 1.00
                WHEN source IN ('referral_signup', 'referral_csw_link', 'referral_qualified') THEN amount * 0.60
                WHEN source LIKE 'social_%' THEN amount * 0.50
                WHEN source LIKE 'bonus_%' OR source = 'task' THEN amount * 0.30
                WHEN source IN ('agent_feedback', 'agent_reputation', 'lens_identity', 'grove_proof') THEN amount * 0.40
                WHEN source IN ('link_email', 'link_google', 'link_apple', 'link_twitter', 'link_telegram', 'link_tiktok', 'link_external_eoa', 'link_zora', 'resolve_csw', 'has_creator_coin') THEN amount * 0.60
                ELSE amount * 0.30
              END
            )
          ),
          0
        )::int AS points_total
      FROM points
      GROUP BY signup_id
    ),
    waitlist_rows AS (
      SELECT
        p.id::int AS signup_id,
        p.email,
        p.persona,
        p.primary_wallet,
        p.csw_address,
        p.primary_embedded_eoa,
        p.embedded_wallet,
        p.referral_code,
        p.contact_preference,
        p.app_access_status,
        p.app_access_decided_at,
        p.created_at,
        p.updated_at,
        COALESCE(pt.points_total, 0)::int AS points_total
      FROM profiles p
      LEFT JOIN point_totals pt ON pt.signup_id = p.id
      WHERE p.email IS NOT NULL
    ),
    ranked AS (
      SELECT
        *,
        ROW_NUMBER() OVER (ORDER BY points_total DESC, signup_id ASC)::int AS rank
      FROM waitlist_rows
    )
    SELECT *
    FROM ranked
    ORDER BY updated_at DESC NULLS LAST, signup_id DESC
    LIMIT ${limit};
  `
  return (result.rows ?? []).map((raw: any) => ({
    fields: applicantRecordFromProfile(raw).fields,
  }))
}

export async function readReferralRecords(db: Db, limit: number): Promise<AirtableRecord[]> {
  const result = await db.sql`
    SELECT
      rc.id::int AS referral_conversion_id,
      rc.referral_code,
      rc.referrer_signup_id::int,
      referrer.email AS referrer_email,
      referrer.primary_wallet AS referrer_wallet,
      rc.invitee_signup_id::int,
      invitee.email AS invitee_email,
      invitee.primary_wallet AS invitee_wallet,
      rc.attribution,
      rc.is_valid,
      rc.invalid_reason,
      rc.status,
      rc.qualified_at,
      rc.created_at
    FROM referral_conversions rc
    LEFT JOIN profiles referrer ON referrer.id = rc.referrer_signup_id
    LEFT JOIN profiles invitee ON invitee.id = rc.invitee_signup_id
    ORDER BY rc.created_at DESC
    LIMIT ${limit};
  `
  const profileById = new Map<number, any>()
  return (result.rows ?? []).map((raw: any) => ({
    fields: referralRecordFromConversion(raw, profileById).fields,
  }))
}

export async function readTaskRecords(db: Db, limit: number): Promise<AirtableRecord[]> {
  const result = await db.sql`
    SELECT
      points.id::int AS point_id,
      points.signup_id::int,
      profiles.email,
      profiles.primary_wallet,
      points.source,
      points.source_id,
      points.amount::int,
      points.created_at
    FROM points
    LEFT JOIN profiles ON profiles.id = points.signup_id
    ORDER BY points.created_at DESC, points.id DESC
    LIMIT ${limit};
  `
  const profileById = new Map<number, any>(
    (result.rows ?? []).map((raw: any) => [safeInt(raw?.signup_id), { email: raw?.email }]),
  )
  return (result.rows ?? []).map((raw: any) => ({
    fields: taskRecordFromPoint(raw, profileById).fields,
  }))
}

export async function readOnboardingRecords(db: Db, limit: number): Promise<AirtableRecord[]> {
  const result = await db.sql`
    SELECT
      id::int AS signup_id,
      email,
      primary_wallet,
      csw_address,
      primary_smart_wallet,
      primary_embedded_eoa,
      embedded_wallet,
      base_sub_account,
      solana_wallet,
      canonical_solana_wallet,
      operational_solana_wallet,
      privy_user_id,
      app_access_status,
      profile_completed_at,
      referral_claimed_at,
      preprovisioned_at,
      preprov_zora_handle,
      preprov_coin_symbol,
      created_at,
      updated_at
    FROM profiles
    WHERE email IS NOT NULL
    ORDER BY updated_at DESC NULLS LAST, id DESC
    LIMIT ${limit};
  `
  return (result.rows ?? [])
    .map((raw: any) => onboardingRecordFromProfile(raw))
    .filter((record): record is AirtableRecord => record !== null)
}

async function upsertAirtableBatch(params: {
  config: WaitlistAirtableSyncConfig
  table: AirtableTableConfig
  records: AirtableRecord[]
  fetchImpl: AirtableFetch
}): Promise<number> {
  const { config, table, records, fetchImpl } = params
  if (records.length === 0) return 0

  const url = `https://api.airtable.com/v0/${encodeURIComponent(config.baseId)}/${encodeURIComponent(table.table)}`
  const response = await fetchImpl(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      performUpsert: {
        fieldsToMergeOn: [table.mergeField],
      },
      typecast: true,
      records: records.map(compactRecord),
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`airtable_upsert_failed:${response.status}:${body.slice(0, 500)}`)
  }

  const body = await response.json().catch(() => ({}))
  const returnedRecords = Array.isArray((body as any)?.records) ? (body as any).records : []
  return returnedRecords.length || params.records.length
}

async function readRecordsForTable(db: Db, key: AirtableTableKey, limit: number): Promise<AirtableRecord[]> {
  switch (key) {
    case 'applicants':
      return readApplicantRecords(db, limit)
    case 'referrals':
      return readReferralRecords(db, limit)
    case 'tasks':
      return readTaskRecords(db, limit)
    case 'onboarding':
      return readOnboardingRecords(db, limit)
    default: {
      const _exhaustive: never = key
      return _exhaustive
    }
  }
}

async function syncOneTable(params: {
  db: Db
  config: WaitlistAirtableSyncConfig
  table: AirtableTableConfig
  dryRun: boolean
  fetchImpl: AirtableFetch
}): Promise<WaitlistAirtableTableResult> {
  const { db, config, table, dryRun, fetchImpl } = params
  const records = await readRecordsForTable(db, table.key, config.limit)
  if (dryRun) {
    return {
      key: table.key,
      label: table.label,
      table: table.table,
      mergeField: table.mergeField,
      attempted: records.length,
      upserted: 0,
      errors: [],
    }
  }

  let upserted = 0
  const errors: string[] = []
  for (let index = 0; index < records.length; index += AIRTABLE_BATCH_SIZE) {
    const batch = records.slice(index, index + AIRTABLE_BATCH_SIZE)
    try {
      upserted += await upsertAirtableBatch({ config, table, records: batch, fetchImpl })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_airtable_error'
      errors.push(message)
    }
  }

  return {
    key: table.key,
    label: table.label,
    table: table.table,
    mergeField: table.mergeField,
    attempted: records.length,
    upserted,
    errors,
  }
}

export async function syncWaitlistToAirtable(params: {
  db: Db
  config: WaitlistAirtableSyncConfig
  dryRun?: boolean
  fetchImpl?: AirtableFetch
}): Promise<WaitlistAirtableSyncResult> {
  const { db, config, dryRun = false, fetchImpl = fetch } = params
  const tables = await Promise.all(
    Object.values(config.tables).map(table => syncOneTable({
      db,
      config,
      table,
      dryRun,
      fetchImpl,
    })),
  )
  return {
    dryRun,
    baseId: config.baseId,
    tables,
  }
}

export async function syncWaitlistSupabaseToAirtable(params: {
  client: SupabaseLike
  config: WaitlistAirtableSyncConfig
  dryRun?: boolean
  fetchImpl?: AirtableFetch
}): Promise<WaitlistAirtableSyncResult> {
  const { client, config, dryRun = false, fetchImpl = fetch } = params
  const dataset = await readSupabaseDataset(client, config.limit)
  const profileById = new Map<number, any>(
    dataset.profiles.map((profile: any) => [safeInt(profile?.id), profile]),
  )
  const pointTotals = new Map<number, number>()
  for (const point of dataset.points) {
    const signupId = safeInt(point?.signup_id)
    pointTotals.set(signupId, (pointTotals.get(signupId) ?? 0) + weightedPoints(point?.source, point?.amount))
  }

  const recordsByKey: Record<AirtableTableKey, AirtableRecord[]> = {
    applicants: dataset.profiles
      .filter((profile: any) => Boolean(toStringOrNull(profile?.email)))
      .sort((a: any, b: any) => {
        const aPoints = pointTotals.get(safeInt(a?.id)) ?? 0
        const bPoints = pointTotals.get(safeInt(b?.id)) ?? 0
        return bPoints - aPoints || safeInt(a?.id) - safeInt(b?.id)
      })
      .map(applicantRecordFromProfile),
    referrals: dataset.referrals.map((referral: any) => referralRecordFromConversion(referral, profileById)),
    tasks: dataset.points.map((point: any) => taskRecordFromPoint(point, profileById)),
    onboarding: dataset.profiles
      .map(onboardingRecordFromProfile)
      .filter((record): record is AirtableRecord => record !== null),
  }

  const tables = await Promise.all(
    Object.values(config.tables).map(async table => {
      const records = recordsByKey[table.key]
      if (dryRun) {
        return {
          key: table.key,
          label: table.label,
          table: table.table,
          mergeField: table.mergeField,
          attempted: records.length,
          upserted: 0,
          errors: [],
        }
      }

      let upserted = 0
      const errors: string[] = []
      for (let index = 0; index < records.length; index += AIRTABLE_BATCH_SIZE) {
        const batch = records.slice(index, index + AIRTABLE_BATCH_SIZE)
        try {
          upserted += await upsertAirtableBatch({ config, table, records: batch, fetchImpl })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown_airtable_error'
          errors.push(message)
        }
      }
      return {
        key: table.key,
        label: table.label,
        table: table.table,
        mergeField: table.mergeField,
        attempted: records.length,
        upserted,
        errors,
      }
    }),
  )

  return {
    dryRun,
    baseId: config.baseId,
    tables,
  }
}
