import type { VercelRequest } from '@vercel/node'

import { getAddress } from 'viem'

import { verifyPrivyRequest } from './canonicalCswDelegation.js'
import { assertNoEmailPrivyCollision } from './identityRecovery.js'
import { ensureWaitlistSchema } from './waitlistSchema.js'
import { classifyLinkedAccounts, type PrivyUserLike } from './walletMapping.js'
import { resolveCanonicalZoraCSW } from './canonicalCswDelegation.js'
import { fetchZoraProfile } from './zoraProfile.js'

declare const process: { env: Record<string, string | undefined> }

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type AccountLinkProvider =
  | 'google'
  | 'apple'
  | 'twitter'
  | 'telegram'
  | 'tiktok'
  | 'external_eoa'
  | 'email'
  | 'zora_cross_app'

export type AccountScore = {
  points: number
  tier: number
  multipliers?: Record<string, number>
}

export type AccountsMePayload = {
  privyUserId: string
  email: string | null
  appAccessStatus: string | null
  linkedMethods: Record<string, string[]>
  zora: {
    linked: boolean
    canonicalCswAddress: string | null
    creatorCoin: { address: string } | null
    zoraHandle: string | null
    lastResolvedAt: string | null
  }
  score: AccountScore
}

type ZoraSignalRow = {
  zoraLinked: boolean
  canonicalCswAddress: string | null
  creatorCoinAddress: string | null
  zoraHandle: string | null
  lastResolvedAt: string | null
}

type PointEventResult = {
  awarded: boolean
  score: AccountScore
}

type CoinSummary = {
  address: string
  name: string | null
  symbol: string | null
  imageUrl: string | null
}

type ResolveZoraSignalsResult = {
  zoraLinked: boolean
  canonicalCswAddress: string | null
  creatorCoin: CoinSummary | null
  zoraHandle: string | null
  lastResolvedAt: string | null
}

type PrivyRequestContext = Awaited<ReturnType<typeof verifyPrivyRequest>>

const ZORA_PRIVY_APP_ID = String(process.env.ZORA_PRIVY_APP_ID ?? 'clpgf04wn04hnkw0fv1m11mnb').trim() || 'clpgf04wn04hnkw0fv1m11mnb'
const EVM_RE = /^0x[a-fA-F0-9]{40}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const LINK_POINTS: Partial<Record<AccountLinkProvider, number>> = {
  email: 10,
  zora_cross_app: 40,
  google: 20,
  apple: 20,
  external_eoa: 10,
  twitter: 15,
  telegram: 15,
  tiktok: 15,
}

let accountsIdentitySchemaEnsured = false

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeEmail(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!raw || !EMAIL_RE.test(raw)) return null
  return raw
}

function normalizeEvmAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!EVM_RE.test(raw)) return null
  try {
    return getAddress(raw).toLowerCase()
  } catch {
    return null
  }
}

function normalizeString(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  return raw.length > 0 ? raw : null
}

function toScoreTier(points: number): number {
  if (points >= 250) return 3
  if (points >= 120) return 2
  if (points >= 40) return 1
  return 0
}

function linkedAccounts(user: unknown): any[] {
  const record = user && typeof user === 'object' ? (user as Record<string, unknown>) : null
  if (!record) return []
  const camel = Array.isArray(record.linkedAccounts) ? (record.linkedAccounts as any[]) : []
  const snake = Array.isArray(record.linked_accounts) ? (record.linked_accounts as any[]) : []
  return [...camel, ...snake]
}

function providerAppId(account: any): string {
  return normalizeLower(
    account?.providerAppId ??
      account?.provider_app_id ??
      account?.providerApp?.id ??
      account?.provider_app?.id ??
      account?.appId ??
      account?.app_id,
  )
}

function readAccountIdentifier(account: any): string | null {
  return (
    normalizeEmail(account?.address) ??
    normalizeString(account?.address) ??
    normalizeString(account?.subject) ??
    normalizeString(account?.userId) ??
    normalizeString(account?.id) ??
    normalizeString(account?.username) ??
    normalizeString(account?.fid)
  )
}

function extractPrivyEmail(user: PrivyUserLike): string | null {
  const direct = normalizeEmail((user as any)?.email?.address)
  if (direct) return direct

  const linked = linkedAccounts(user)
  for (const account of linked) {
    const type = normalizeLower((account as any)?.type)
    if (!type.includes('email')) continue
    const email = normalizeEmail((account as any)?.address ?? (account as any)?.email ?? (account as any)?.emailAddress)
    if (email) return email
  }
  return null
}

function valuesForProviderFromPrivy(user: PrivyUserLike, provider: AccountLinkProvider): string[] {
  const linked = linkedAccounts(user)
  const seen = new Set<string>()
  const out: string[] = []
  const push = (value: string | null) => {
    const normalized = normalizeString(value)
    if (!normalized) return
    const key = normalized.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(normalized)
  }

  if (provider === 'email') {
    push(extractPrivyEmail(user))
    return out
  }

  if (provider === 'external_eoa') {
    const classification = classifyLinkedAccounts(user)
    for (const wallet of classification.allWallets) {
      if (wallet.chain !== 'evm') continue
      if (wallet.walletType !== 'external_eoa') continue
      push(normalizeEvmAddress(wallet.address))
    }
    return out
  }

  if (provider === 'zora_cross_app') {
    for (const account of linked) {
      const type = normalizeLower((account as any)?.type)
      if (type !== 'cross_app') continue
      if (providerAppId(account) !== ZORA_PRIVY_APP_ID.toLowerCase()) continue
      push(normalizeEvmAddress((account as any)?.address))
      const smartWallets = Array.isArray((account as any)?.smartWallets)
        ? ((account as any).smartWallets as any[])
        : Array.isArray((account as any)?.smart_wallets)
          ? ((account as any).smart_wallets as any[])
          : []
      const embeddedWallets = Array.isArray((account as any)?.embeddedWallets)
        ? ((account as any).embeddedWallets as any[])
        : Array.isArray((account as any)?.embedded_wallets)
          ? ((account as any).embedded_wallets as any[])
          : []
      for (const wallet of [...smartWallets, ...embeddedWallets]) {
        push(normalizeEvmAddress((wallet as any)?.address))
      }
    }
    return out
  }

  const typeMatchers: Record<Exclude<AccountLinkProvider, 'external_eoa' | 'email' | 'zora_cross_app'>, (type: string) => boolean> = {
    google: (type) => type.includes('google'),
    apple: (type) => type.includes('apple'),
    twitter: (type) => type.includes('twitter') || type === 'x',
    telegram: (type) => type.includes('telegram'),
    tiktok: (type) => type.includes('tiktok'),
  }

  const matches = typeMatchers[provider]
  for (const account of linked) {
    const type = normalizeLower((account as any)?.type)
    if (!matches(type)) continue
    push(readAccountIdentifier(account))
  }
  return out
}

function dedupe(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const value = normalizeString(raw)
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

export function extractZoraCrossAppAccounts(user: PrivyUserLike): Array<{ address: string; providerAppId: string }> {
  const linked = linkedAccounts(user)
  const out: Array<{ address: string; providerAppId: string }> = []
  for (const account of linked) {
    const type = normalizeLower((account as any)?.type)
    const appId = providerAppId(account)
    if (type !== 'cross_app') continue
    if (appId !== ZORA_PRIVY_APP_ID.toLowerCase()) continue

    const addresses = dedupe([
      normalizeEvmAddress((account as any)?.address),
      ...valuesForProviderFromPrivy({ linkedAccounts: [account] } as any, 'zora_cross_app').map((value) => normalizeEvmAddress(value)),
    ])
    for (const address of addresses) {
      out.push({ address, providerAppId: appId })
    }
  }
  return out
}

export function deriveLinkedMethodsFromPrivyUser(user: PrivyUserLike): Record<string, string[]> {
  const providers: AccountLinkProvider[] = ['email', 'google', 'apple', 'twitter', 'telegram', 'tiktok', 'external_eoa', 'zora_cross_app']
  const out: Record<string, string[]> = {}
  for (const provider of providers) {
    const values = valuesForProviderFromPrivy(user, provider)
    if (values.length > 0) out[provider] = values
  }
  return out
}

export async function ensureAccountsIdentitySchema(db: Db): Promise<void> {
  if (accountsIdentitySchemaEnsured) return
  try {
    await db.sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`
    await db.sql`
      CREATE TABLE IF NOT EXISTS accounts (
        privy_user_id TEXT PRIMARY KEY,
        email TEXT NULL,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS account_linked_methods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        privy_user_id TEXT NOT NULL REFERENCES accounts(privy_user_id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        verified BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (privy_user_id, type, value)
      );
    `
    await db.sql`CREATE INDEX IF NOT EXISTS account_linked_methods_type_value_idx ON account_linked_methods (type, value);`
    await db.sql`
      CREATE TABLE IF NOT EXISTS account_zora_signals (
        privy_user_id TEXT PRIMARY KEY REFERENCES accounts(privy_user_id) ON DELETE CASCADE,
        zora_linked BOOLEAN NOT NULL DEFAULT false,
        zora_handle TEXT NULL,
        canonical_zora_csw_address TEXT NULL,
        creator_coin_address TEXT NULL,
        last_resolved_at TIMESTAMPTZ NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS account_points (
        privy_user_id TEXT PRIMARY KEY REFERENCES accounts(privy_user_id) ON DELETE CASCADE,
        points INT NOT NULL DEFAULT 0,
        tier INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE TABLE IF NOT EXISTS account_point_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        privy_user_id TEXT NOT NULL REFERENCES accounts(privy_user_id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        event_key TEXT NOT NULL,
        points INT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (privy_user_id, event_key)
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS account_point_events_privy_created_idx
      ON account_point_events (privy_user_id, created_at DESC);
    `
    accountsIdentitySchemaEnsured = true
  } catch {
    accountsIdentitySchemaEnsured = false
    throw new Error('accounts_identity_schema_ensure_failed')
  }
}

export async function upsertAccount(params: {
  db: Db
  privyUserId: string
  email?: string | null
  emailVerified?: boolean
}): Promise<void> {
  const { db, privyUserId, email, emailVerified } = params
  const normalizedEmail = normalizeEmail(email) ?? null
  const verified = emailVerified === true
  await assertNoEmailPrivyCollision({
    db,
    email: normalizedEmail,
    privyUserId,
  })
  await db.sql`
    INSERT INTO accounts (
      privy_user_id,
      email,
      email_verified,
      created_at,
      updated_at
    )
    VALUES (
      ${privyUserId},
      ${normalizedEmail},
      ${verified},
      NOW(),
      NOW()
    )
    ON CONFLICT (privy_user_id) DO UPDATE
    SET
      email = COALESCE(EXCLUDED.email, accounts.email),
      email_verified = accounts.email_verified OR EXCLUDED.email_verified,
      updated_at = NOW();
  `
}

export async function upsertLinkedMethod(params: {
  db: Db
  privyUserId: string
  type: string
  value: string
  verified?: boolean
}): Promise<void> {
  const { db, privyUserId, type, value, verified } = params
  const normalizedType = normalizeLower(type)
  const normalizedValue =
    normalizedType === 'email'
      ? normalizeEmail(value)
      : normalizedType === 'external_eoa' || normalizedType === 'zora_cross_app'
        ? normalizeEvmAddress(value)
        : normalizeString(value)
  if (!normalizedType || !normalizedValue) return

  await db.sql`
    INSERT INTO account_linked_methods (
      privy_user_id,
      type,
      value,
      verified,
      created_at
    )
    VALUES (
      ${privyUserId},
      ${normalizedType},
      ${normalizedValue},
      ${verified === true},
      NOW()
    )
    ON CONFLICT (privy_user_id, type, value) DO UPDATE
    SET verified = account_linked_methods.verified OR EXCLUDED.verified;
  `
}

export async function removeLinkedMethod(params: {
  db: Db
  privyUserId: string
  type: string
  value?: string | null
}): Promise<void> {
  const { db, privyUserId, type, value } = params
  const normalizedType = normalizeLower(type)
  if (!normalizedType) return

  if (value) {
    await db.sql`
      DELETE FROM account_linked_methods
      WHERE privy_user_id = ${privyUserId}
        AND type = ${normalizedType}
        AND LOWER(value) = LOWER(${value});
    `
    return
  }

  await db.sql`
    DELETE FROM account_linked_methods
    WHERE privy_user_id = ${privyUserId}
      AND type = ${normalizedType};
  `
}

async function refreshScore(db: Db, privyUserId: string): Promise<AccountScore> {
  const totalResult = await db.sql`
    SELECT COALESCE(SUM(points), 0)::INT AS points
    FROM account_point_events
    WHERE privy_user_id = ${privyUserId};
  `
  const total = Number(totalResult.rows?.[0]?.points ?? 0) || 0
  const tier = toScoreTier(total)
  await db.sql`
    INSERT INTO account_points (privy_user_id, points, tier, updated_at)
    VALUES (${privyUserId}, ${total}, ${tier}, NOW())
    ON CONFLICT (privy_user_id) DO UPDATE
    SET points = EXCLUDED.points, tier = EXCLUDED.tier, updated_at = NOW();
  `
  return { points: total, tier }
}

export async function applyPointEvent(params: {
  db: Db
  privyUserId: string
  eventType: string
  eventKey: string
  points: number
}): Promise<PointEventResult> {
  const { db, privyUserId, eventType, eventKey, points } = params
  const normalizedType = normalizeLower(eventType)
  const normalizedKey = normalizeString(eventKey)
  const amount = Number(points)
  if (!normalizedType || !normalizedKey || !Number.isFinite(amount) || amount === 0) {
    return { awarded: false, score: await refreshScore(db, privyUserId) }
  }

  const inserted = await db.sql`
    INSERT INTO account_point_events (
      privy_user_id,
      event_type,
      event_key,
      points,
      created_at
    )
    VALUES (
      ${privyUserId},
      ${normalizedType},
      ${normalizedKey},
      ${Math.trunc(amount)},
      NOW()
    )
    ON CONFLICT (privy_user_id, event_key) DO NOTHING
    RETURNING id;
  `
  const awarded = Array.isArray(inserted.rows) && inserted.rows.length > 0
  const score = await refreshScore(db, privyUserId)
  return { awarded, score }
}

async function ensureZoraSignalsRow(db: Db, privyUserId: string): Promise<void> {
  await db.sql`
    INSERT INTO account_zora_signals (
      privy_user_id,
      zora_linked,
      updated_at
    )
    VALUES (${privyUserId}, false, NOW())
    ON CONFLICT (privy_user_id) DO NOTHING;
  `
}

async function readZoraSignals(db: Db, privyUserId: string): Promise<ZoraSignalRow> {
  const result = await db.sql`
    SELECT
      zora_linked,
      canonical_zora_csw_address,
      creator_coin_address,
      zora_handle,
      last_resolved_at
    FROM account_zora_signals
    WHERE privy_user_id = ${privyUserId}
    LIMIT 1;
  `
  const row = result.rows?.[0] ?? null
  return {
    zoraLinked: row?.zora_linked === true,
    canonicalCswAddress: normalizeEvmAddress(row?.canonical_zora_csw_address),
    creatorCoinAddress: normalizeEvmAddress(row?.creator_coin_address),
    zoraHandle: normalizeString(row?.zora_handle),
    lastResolvedAt:
      typeof row?.last_resolved_at === 'string'
        ? row.last_resolved_at
        : row?.last_resolved_at instanceof Date
          ? row.last_resolved_at.toISOString()
          : null,
  }
}

async function readLinkedMethods(db: Db, privyUserId: string): Promise<Record<string, string[]>> {
  const result = await db.sql`
    SELECT type, value
    FROM account_linked_methods
    WHERE privy_user_id = ${privyUserId}
    ORDER BY type ASC, created_at ASC, value ASC;
  `
  const out: Record<string, string[]> = {}
  for (const row of result.rows ?? []) {
    const type = normalizeLower(row?.type)
    const value = normalizeString(row?.value)
    if (!type || !value) continue
    if (!out[type]) out[type] = []
    if (!out[type].includes(value)) out[type].push(value)
  }
  return out
}

function mergeLinkedMethods(dbMethods: Record<string, string[]>, derivedMethods: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const keys = new Set<string>([...Object.keys(dbMethods), ...Object.keys(derivedMethods)])
  for (const key of keys) {
    const merged = dedupe([...(dbMethods[key] ?? []), ...(derivedMethods[key] ?? [])])
    if (merged.length > 0) out[key] = merged
  }
  return out
}

async function readScore(db: Db, privyUserId: string): Promise<AccountScore> {
  const pointsResult = await db.sql`
    SELECT points, tier
    FROM account_points
    WHERE privy_user_id = ${privyUserId}
    LIMIT 1;
  `
  const row = pointsResult.rows?.[0] ?? null
  const points = Number(row?.points ?? 0) || 0
  const tier = Number(row?.tier ?? toScoreTier(points)) || 0
  if (!row) return await refreshScore(db, privyUserId)
  return { points, tier }
}

export async function syncEmailIdentity(params: {
  db: Db
  privyUserId: string
  privyUser: PrivyUserLike
}): Promise<void> {
  const { db, privyUserId, privyUser } = params
  const email = extractPrivyEmail(privyUser)
  await upsertAccount({ db, privyUserId, email, emailVerified: Boolean(email) })
  if (!email) return
  await upsertLinkedMethod({
    db,
    privyUserId,
    type: 'email',
    value: email,
    verified: true,
  })
  await applyPointEvent({
    db,
    privyUserId,
    eventType: 'link_email',
    eventKey: `link_email:${email}`,
    points: LINK_POINTS.email ?? 0,
  })
}

async function fetchCreatorCoinSummary(address: string): Promise<CoinSummary | null> {
  const normalized = normalizeEvmAddress(address)
  if (!normalized) return null
  const key = String(process.env.ZORA_SERVER_API_KEY ?? '').trim()
  if (!key) return { address: normalized, name: null, symbol: null, imageUrl: null }
  try {
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)
    const response = await sdk.getCoin({ address: normalized, chain: 8453 })
    const coin = (response as any)?.data?.zora20Token ?? null
    const rawImage =
      normalizeString(coin?.mediaContent?.previewImage?.small) ??
      normalizeString(coin?.mediaContent?.previewImage?.medium) ??
      normalizeString(coin?.mediaContent?.originalUri) ??
      normalizeString(coin?.image) ??
      null
    return {
      address: normalized,
      name: normalizeString(coin?.name),
      symbol: normalizeString(coin?.symbol),
      imageUrl: rawImage,
    }
  } catch {
    return { address: normalized, name: null, symbol: null, imageUrl: null }
  }
}

export async function resolveAndPersistZoraSignals(params: {
  db: Db
  privyUserId: string
  privyUser: PrivyUserLike
  forceRefresh?: boolean
  refreshWindowMs?: number
}): Promise<ResolveZoraSignalsResult> {
  const { db, privyUserId, privyUser, forceRefresh = false, refreshWindowMs = 0 } = params
  await ensureAccountsIdentitySchema(db)
  await ensureWaitlistSchema(db)
  await ensureZoraSignalsRow(db, privyUserId)
  const existing = await readZoraSignals(db, privyUserId)

  if (forceRefresh && refreshWindowMs > 0 && existing.lastResolvedAt) {
    const lastMs = Date.parse(existing.lastResolvedAt)
    if (Number.isFinite(lastMs)) {
      const elapsed = Date.now() - lastMs
      if (elapsed >= 0 && elapsed < refreshWindowMs) {
        const retryAfterSec = Math.ceil((refreshWindowMs - elapsed) / 1000)
        const error = new Error(`zora_refresh_rate_limited:${retryAfterSec}`)
        ;(error as any).code = 'ZORA_REFRESH_RATE_LIMITED'
        ;(error as any).retryAfterSec = retryAfterSec
        throw error
      }
    }
  }

  const zoraCrossApp = extractZoraCrossAppAccounts(privyUser)
  let zoraLinked = zoraCrossApp.length > 0

  for (const account of zoraCrossApp) {
    await upsertLinkedMethod({
      db,
      privyUserId,
      type: 'zora_cross_app',
      value: account.address,
      verified: true,
    })
  }

  if (zoraLinked) {
    await applyPointEvent({
      db,
      privyUserId,
      eventType: 'link_zora',
      eventKey: 'link_zora',
      points: LINK_POINTS.zora_cross_app ?? 0,
    })
  }

  let canonical = existing.canonicalCswAddress
  let canonicalSource = existing.canonicalCswAddress ? 'persisted' : 'zora_readonly'
  if (!canonical) {
    try {
      const resolved = await resolveCanonicalZoraCSW({ db, privyUserId, privyUser })
      const resolvedCanonical = normalizeEvmAddress(resolved.canonicalCswAddress)
      if (resolvedCanonical) {
        canonical = resolvedCanonical
        canonicalSource = normalizeString(resolved.canonicalSource) ?? 'zora_readonly'
      }
    } catch {
      // best-effort; keep nullable canonical
    }
  }

  const classification = classifyLinkedAccounts(privyUser)
  const allEvmEoas = classification.allWallets
    .filter((w) => w.chain === 'evm' && w.walletType === 'external_eoa')
    .map((w) => w.address)
  const profileSeeds = dedupe([
    ...zoraCrossApp.map((item) => item.address),
    canonical,
    ...allEvmEoas,
    classification.primaryWalletAddress ?? null,
    classification.embeddedEoa?.address ?? null,
  ])

  let zoraProfile: any | null = null
  for (const seed of profileSeeds) {
    zoraProfile = await fetchZoraProfile(seed).catch(() => null)
    if (zoraProfile) break
  }

  if (zoraProfile) zoraLinked = true

  const zoraHandle = normalizeString((zoraProfile as any)?.handle)
  const creatorCoinAddress = normalizeEvmAddress((zoraProfile as any)?.creatorCoin?.address) ?? existing.creatorCoinAddress
  const creatorCoin = creatorCoinAddress ? await fetchCreatorCoinSummary(creatorCoinAddress) : null

  const nowIso = new Date().toISOString()
  await db.sql`
    INSERT INTO account_zora_signals (
      privy_user_id,
      zora_linked,
      zora_handle,
      canonical_zora_csw_address,
      creator_coin_address,
      last_resolved_at,
      updated_at
    )
    VALUES (
      ${privyUserId},
      ${zoraLinked},
      ${zoraHandle},
      ${canonical},
      ${creatorCoinAddress},
      ${nowIso},
      NOW()
    )
    ON CONFLICT (privy_user_id) DO UPDATE
    SET
      zora_linked = EXCLUDED.zora_linked,
      zora_handle = COALESCE(EXCLUDED.zora_handle, account_zora_signals.zora_handle),
      canonical_zora_csw_address = COALESCE(account_zora_signals.canonical_zora_csw_address, EXCLUDED.canonical_zora_csw_address),
      creator_coin_address = COALESCE(EXCLUDED.creator_coin_address, account_zora_signals.creator_coin_address),
      last_resolved_at = EXCLUDED.last_resolved_at,
      updated_at = NOW();
  `

  if (canonical) {
    await applyPointEvent({
      db,
      privyUserId,
      eventType: 'resolve_csw',
      eventKey: `resolve_csw:${canonical}`,
      points: 10,
    })
  }

  if (creatorCoinAddress) {
    await applyPointEvent({
      db,
      privyUserId,
      eventType: 'has_creator_coin',
      eventKey: `has_creator_coin:${creatorCoinAddress}`,
      points: 80,
    })
  }

  void canonicalSource

  return {
    zoraLinked,
    canonicalCswAddress: canonical,
    creatorCoin,
    zoraHandle,
    lastResolvedAt: nowIso,
  }
}

export async function buildAccountsMePayload(params: {
  db: Db
  privyUserId: string
  privyUser?: PrivyUserLike | null
}): Promise<AccountsMePayload> {
  const { db, privyUserId, privyUser } = params
  await ensureAccountsIdentitySchema(db)
  const accountRowResult = await db.sql`
    SELECT email
    FROM accounts
    WHERE privy_user_id = ${privyUserId}
    LIMIT 1;
  `
  const accountRow = accountRowResult.rows?.[0] ?? null
  const profileStatusResult = await db.sql`
    SELECT app_access_status
    FROM profiles
    WHERE privy_user_id = ${privyUserId}
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    LIMIT 1;
  `
  const profileStatusRow = profileStatusResult.rows?.[0] ?? null
  const dbMethods = await readLinkedMethods(db, privyUserId)
  const derivedMethods = privyUser ? deriveLinkedMethodsFromPrivyUser(privyUser) : {}
  const linkedMethods = mergeLinkedMethods(dbMethods, derivedMethods)
  const zoraRow = await readZoraSignals(db, privyUserId)
  const score = await readScore(db, privyUserId)

  return {
    privyUserId,
    email: normalizeEmail(accountRow?.email),
    appAccessStatus: normalizeString(profileStatusRow?.app_access_status),
    linkedMethods,
    zora: {
      linked: zoraRow.zoraLinked,
      canonicalCswAddress: zoraRow.canonicalCswAddress,
      creatorCoin: zoraRow.creatorCoinAddress ? { address: zoraRow.creatorCoinAddress } : null,
      zoraHandle: zoraRow.zoraHandle,
      lastResolvedAt: zoraRow.lastResolvedAt,
    },
    score,
  }
}

function toEventType(provider: AccountLinkProvider): string {
  switch (provider) {
    case 'google':
      return 'link_google'
    case 'apple':
      return 'link_apple'
    case 'twitter':
      return 'link_twitter'
    case 'telegram':
      return 'link_telegram'
    case 'tiktok':
      return 'link_tiktok'
    case 'external_eoa':
      return 'link_external_eoa'
    case 'email':
      return 'link_email'
    case 'zora_cross_app':
      return 'link_zora'
    default:
      return 'link_identity'
  }
}

export async function recordProviderLink(params: {
  db: Db
  privyUserId: string
  provider: AccountLinkProvider
  privyUser: PrivyUserLike
  value?: string | null
}): Promise<void> {
  const { db, privyUserId, provider, privyUser, value } = params
  const fromPrivy = valuesForProviderFromPrivy(privyUser, provider)
  const targetValues = dedupe([value ?? null, ...fromPrivy])
  if (targetValues.length === 0 && provider !== 'zora_cross_app') {
    throw new Error(`No linked value found for provider "${provider}".`)
  }

  if (provider === 'email') {
    const email = normalizeEmail(targetValues[0])
    if (!email) throw new Error('Email is not linked in Privy yet.')
    await upsertAccount({ db, privyUserId, email, emailVerified: true })
  }

  if (provider === 'zora_cross_app') {
    const zoraAccounts = extractZoraCrossAppAccounts(privyUser)
    if (zoraAccounts.length === 0) {
      throw new Error('Zora cross-app account is not linked yet.')
    }
    for (const account of zoraAccounts) {
      await upsertLinkedMethod({
        db,
        privyUserId,
        type: provider,
        value: account.address,
        verified: true,
      })
    }
    await ensureZoraSignalsRow(db, privyUserId)
    await db.sql`
      UPDATE account_zora_signals
      SET zora_linked = true, updated_at = NOW()
      WHERE privy_user_id = ${privyUserId};
    `
  } else {
    for (const methodValue of targetValues) {
      await upsertLinkedMethod({
        db,
        privyUserId,
        type: provider,
        value: methodValue,
        verified: true,
      })
    }
  }

  const points = LINK_POINTS[provider] ?? 0
  if (points > 0) {
    if (provider === 'zora_cross_app') {
      await applyPointEvent({
        db,
        privyUserId,
        eventType: toEventType(provider),
        eventKey: 'link_zora',
        points,
      })
    } else {
      for (const methodValue of targetValues) {
        await applyPointEvent({
          db,
          privyUserId,
          eventType: toEventType(provider),
          eventKey: `${toEventType(provider)}:${methodValue.toLowerCase()}`,
          points,
        })
      }
    }
  }
}

export async function recordProviderUnlink(params: {
  db: Db
  privyUserId: string
  provider: AccountLinkProvider
  value?: string | null
}): Promise<void> {
  const { db, privyUserId, provider, value } = params
  await removeLinkedMethod({
    db,
    privyUserId,
    type: provider,
    value,
  })
  if (provider === 'zora_cross_app') {
    await ensureZoraSignalsRow(db, privyUserId)
    await db.sql`
      UPDATE account_zora_signals
      SET zora_linked = false, updated_at = NOW()
      WHERE privy_user_id = ${privyUserId};
    `
  }
}

export async function verifyPrivyForAccounts(req: VercelRequest): Promise<PrivyRequestContext> {
  return await verifyPrivyRequest(req)
}

