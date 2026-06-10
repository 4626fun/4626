import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  checkRateLimit,
  getClientIp,
  handleOptions,
  RATE_LIMITS,
  readBoundedJsonObjectBody,
  rateLimitKey,
  setCors,
  setNoStore,
  getDb,
  readRequestPrincipalAddress,
} from '@4626/server-core'

import { resolveOnchainIdentityProfile } from '../../../server/_lib/identity/onchainIdentityProfile.js'


import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'

type WalletItem = {
  address: string
  walletType: string | null
  provider: string | null
  chain: string | null
  isPrimary: boolean
  isCanonicalSmartWallet: boolean
  isEmbeddedEoa: boolean
  verifiedAt: string | null
}

type FieldProvenance = { value: string | null; source: string; updated_at: string }
type ProfileFieldsMap = Record<string, FieldProvenance>

type PortfolioProfile = {
  profileId: number
  primarySmartWallet: string | null
  primaryEmbeddedEoa: string | null
  displayName: string | null
  bio: string | null
  website: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  avatarLensUri: string | null
  bannerLensUri: string | null
  profileFields: ProfileFieldsMap
  appAccessStatus: string | null
  updatedAt: string | null
}

type PortfolioMeResponse = {
  mode: 'self' | 'public'
  profile: PortfolioProfile
  wallets: WalletItem[]
  onchainSummary: {
    totalUsdValue: number | null
    asOf: string | null
  }
  onchainIdentity: {
    source: 'ens' | 'basename'
    address: string
    ensName: string | null
    basename: string | null
    displayName: string | null
    bio: string | null
    avatarUrl: string | null
    website: string | null
    twitter: string | null
    github: string | null
    discord: string | null
  } | null
}

type PatchBody = {
  displayName?: string | null
  bio?: string | null
  website?: string | null
  avatarUrl?: string | null
  bannerUrl?: string | null
  avatarLensUri?: string | null
  bannerLensUri?: string | null
}

const MANUAL_FIELD_KEYS = [
  'display_name',
  'bio',
  'website',
  'avatar_url',
  'banner_url',
  'avatar_lens_uri',
  'banner_lens_uri',
] as const

const PUBLIC_PORTFOLIO_RATE_LIMIT = { windowMs: 60_000, maxRequests: 40 } as const
const PUBLIC_PORTFOLIO_SUMMARY_CACHE_TTL_MS = 30_000
const PUBLIC_PORTFOLIO_SUMMARY_CACHE_MAX_ENTRIES = 500

type OnchainSummary = { totalUsdValue: number | null; asOf: string | null }
type SummaryCacheEntry = {
  value: OnchainSummary
  expiresAt: number
}

const publicOnchainSummaryCache = new Map<string, SummaryCacheEntry>()

function trimPublicOnchainSummaryCache(now = Date.now()): void {
  for (const [key, entry] of publicOnchainSummaryCache) {
    if (entry.expiresAt <= now) publicOnchainSummaryCache.delete(key)
  }
  while (publicOnchainSummaryCache.size > PUBLIC_PORTFOLIO_SUMMARY_CACHE_MAX_ENTRIES) {
    const firstKey = publicOnchainSummaryCache.keys().next().value
    if (!firstKey) break
    publicOnchainSummaryCache.delete(firstKey)
  }
}

function readCachedPublicOnchainSummary(address: string): OnchainSummary | null {
  const now = Date.now()
  trimPublicOnchainSummaryCache(now)
  const key = address.toLowerCase()
  const cached = publicOnchainSummaryCache.get(key)
  if (!cached || cached.expiresAt <= now) {
    if (cached) publicOnchainSummaryCache.delete(key)
    return null
  }
  return cached.value
}

function writeCachedPublicOnchainSummary(address: string, value: OnchainSummary): void {
  const now = Date.now()
  const key = address.toLowerCase()
  publicOnchainSummaryCache.set(key, {
    value,
    expiresAt: now + PUBLIC_PORTFOLIO_SUMMARY_CACHE_TTL_MS,
  })
  trimPublicOnchainSummaryCache(now)
}

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function readStringQuery(req: VercelRequest, key: string): string | null {
  const value = req.query?.[key]
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0].trim()
  return null
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeManualText(value: unknown, maxLen: number): string | null {
  if (value === null) return null
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  return text.slice(0, maxLen)
}

function hasDisallowedUrlScheme(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('//')) return true
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed)
  if (!schemeMatch) return false
  const scheme = schemeMatch[1].toLowerCase()
  return scheme !== 'http' && scheme !== 'https'
}

function readProfileFields(raw: unknown): ProfileFieldsMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const source = raw as Record<string, any>
  const out: ProfileFieldsMap = {}
  for (const key of Object.keys(source)) {
    const value = source[key]
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const entry = value as Record<string, unknown>
    out[key] = {
      value: typeof entry.value === 'string' ? entry.value : entry.value === null ? null : null,
      source: typeof entry.source === 'string' && entry.source.trim() ? entry.source.trim() : 'manual',
      updated_at: typeof entry.updated_at === 'string' ? entry.updated_at : new Date(0).toISOString(),
    }
  }
  return out
}

function getFieldValue(row: any, fields: ProfileFieldsMap, key: keyof PortfolioProfile): string | null {
  const snake =
    key === 'displayName'
      ? 'display_name'
      : key === 'avatarUrl'
        ? 'avatar_url'
        : key === 'bannerUrl'
          ? 'banner_url'
          : key === 'avatarLensUri'
            ? 'avatar_lens_uri'
            : key === 'bannerLensUri'
              ? 'banner_lens_uri'
          : key
  const fromProvenance = fields[snake]
  if (fromProvenance && Object.prototype.hasOwnProperty.call(fromProvenance, 'value')) return fromProvenance.value
  return asNullableString(row?.[snake])
}

function mapWalletRows(rows: any[]): WalletItem[] {
  return rows.map((row) => ({
    address: String(row.address || '').toLowerCase(),
    walletType: asNullableString(row.wallet_type),
    provider: asNullableString(row.provider),
    chain: asNullableString(row.chain),
    isPrimary: Boolean(row.is_primary),
    isCanonicalSmartWallet: Boolean(row.is_canonical_smart_wallet),
    isEmbeddedEoa: Boolean(row.is_embedded_eoa),
    verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null,
  }))
}

function applyOnchainFieldFallback(
  fields: ProfileFieldsMap,
  key: string,
  currentRowValue: unknown,
  fallbackValue: string | null | undefined,
  source: 'ens' | 'basename',
) {
  if (!hasText(fallbackValue)) return
  if (hasText(currentRowValue)) return
  if (fields[key]) return

  fields[key] = {
    value: String(fallbackValue).trim(),
    source,
    updated_at: new Date(0).toISOString(),
  }
}

async function fetchOnchainSummary(address: string | null): Promise<{ totalUsdValue: number | null; asOf: string | null }> {
  const accessKey = String(process.env.DEBANK_ACCESS_KEY ?? '').trim()
  if (!accessKey || !address) return { totalUsdValue: null, asOf: null }
  const normalizedAddress = address.toLowerCase()
  const cached = readCachedPublicOnchainSummary(normalizedAddress)
  if (cached) return cached

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(
      `https://pro-openapi.debank.com/v1/user/total_balance?id=${encodeURIComponent(normalizedAddress)}`,
      {
        headers: { Accept: 'application/json', AccessKey: accessKey },
        signal: controller.signal,
      },
    )
    if (!response.ok) {
      const fallback = { totalUsdValue: null, asOf: null }
      writeCachedPublicOnchainSummary(normalizedAddress, fallback)
      return fallback
    }
    const json = (await response.json().catch(() => null)) as { total_usd_value?: number } | null
    const total = typeof json?.total_usd_value === 'number' && Number.isFinite(json.total_usd_value) ? json.total_usd_value : null
    const result = { totalUsdValue: total, asOf: new Date().toISOString() }
    writeCachedPublicOnchainSummary(normalizedAddress, result)
    return result
  } catch {
    const fallback = { totalUsdValue: null, asOf: null }
    writeCachedPublicOnchainSummary(normalizedAddress, fallback)
    return fallback
  } finally {
    clearTimeout(timeout)
  }
}

async function resolveProfileRow(db: any, mode: 'self' | 'public', address: string): Promise<any | null> {
  if (mode === 'public') {
    const publicRow = await db.sql`
      SELECT *
      FROM profiles
      WHERE LOWER(primary_smart_wallet) = ${address}
         OR LOWER(csw_address) = ${address}
         OR id IN (
           SELECT profile_id
           FROM profile_wallets
           WHERE LOWER(address) = ${address}
             AND is_canonical_smart_wallet = true
         )
      LIMIT 1;
    `
    return publicRow.rows?.[0] ?? null
  }

  const selfRow = await db.sql`
    SELECT *
    FROM profiles
    WHERE id IN (
      SELECT profile_id
      FROM profile_wallets
      WHERE LOWER(address) = ${address}
    )
       OR LOWER(primary_wallet) = ${address}
       OR LOWER(embedded_wallet) = ${address}
       OR LOWER(csw_address) = ${address}
       OR LOWER(base_sub_account) = ${address}
       OR LOWER(primary_smart_wallet) = ${address}
       OR LOWER(primary_embedded_eoa) = ${address}
    LIMIT 1;
  `
  return selfRow.rows?.[0] ?? null
}

async function buildResponse(db: any, mode: 'self' | 'public', row: any): Promise<PortfolioMeResponse> {
  const profileId = Number(row.id)
  const profileFields = readProfileFields(row.profile_fields)
  const walletsResult = await db.sql`
    SELECT
      pw.address,
      pw.is_primary,
      pw.is_canonical_smart_wallet,
      pw.is_embedded_eoa,
      pw.verified_at,
      w.wallet_type,
      w.provider,
      w.chain
    FROM profile_wallets pw
    LEFT JOIN wallets w ON LOWER(w.address) = LOWER(pw.address)
    WHERE pw.profile_id = ${profileId}
    ORDER BY pw.is_primary DESC, pw.is_canonical_smart_wallet DESC, pw.created_at ASC;
  `

  const canonicalAddress = normalizeLower(row.primary_smart_wallet) || normalizeLower(row.csw_address) || null
  const allWallets = mapWalletRows(Array.isArray(walletsResult.rows) ? walletsResult.rows : [])
  const wallets = mode === 'public'
    ? (() => {
      const canonicalOnly = allWallets
        .filter((wallet) => wallet.isCanonicalSmartWallet)
        .map((wallet) => ({
          ...wallet,
          walletType: null,
          provider: null,
          chain: null,
          isEmbeddedEoa: false,
        }))
      if (canonicalOnly.length > 0) return canonicalOnly
      if (!canonicalAddress) return canonicalOnly
      return [{
        address: canonicalAddress,
        walletType: null,
        provider: null,
        chain: null,
        isPrimary: true,
        isCanonicalSmartWallet: true,
        isEmbeddedEoa: false,
        verifiedAt: null,
      }]
    })()
    : allWallets

  const onchainSummary = await fetchOnchainSummary(canonicalAddress)
  const identityAddress =
    canonicalAddress ||
    normalizeLower(row.primary_wallet) ||
    normalizeLower(row.primary_embedded_eoa) ||
    normalizeLower(row.embedded_wallet) ||
    null
  const onchainIdentity = identityAddress ? await resolveOnchainIdentityProfile(identityAddress) : null
  const effectiveProfileFields: ProfileFieldsMap = { ...profileFields }

  if (onchainIdentity) {
    applyOnchainFieldFallback(
      effectiveProfileFields,
      'display_name',
      row.display_name,
      onchainIdentity.displayName,
      onchainIdentity.source,
    )
    applyOnchainFieldFallback(
      effectiveProfileFields,
      'bio',
      row.bio,
      onchainIdentity.bio,
      onchainIdentity.source,
    )
    applyOnchainFieldFallback(
      effectiveProfileFields,
      'website',
      row.website,
      onchainIdentity.website,
      onchainIdentity.source,
    )
    applyOnchainFieldFallback(
      effectiveProfileFields,
      'avatar_url',
      row.avatar_url,
      onchainIdentity.avatarUrl,
      onchainIdentity.source,
    )
  }

  const profile: PortfolioProfile = {
    profileId,
    primarySmartWallet: asNullableString(row.primary_smart_wallet) ?? asNullableString(row.csw_address),
    primaryEmbeddedEoa: mode === 'public' ? null : (asNullableString(row.primary_embedded_eoa) ?? asNullableString(row.embedded_wallet)),
    displayName: getFieldValue(row, effectiveProfileFields, 'displayName'),
    bio: getFieldValue(row, effectiveProfileFields, 'bio'),
    website: getFieldValue(row, effectiveProfileFields, 'website'),
    avatarUrl: getFieldValue(row, effectiveProfileFields, 'avatarUrl'),
    bannerUrl: getFieldValue(row, effectiveProfileFields, 'bannerUrl'),
    avatarLensUri: getFieldValue(row, effectiveProfileFields, 'avatarLensUri'),
    bannerLensUri: getFieldValue(row, effectiveProfileFields, 'bannerLensUri'),
    profileFields: effectiveProfileFields,
    appAccessStatus: asNullableString(row.app_access_status),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }

  return {
    mode,
    profile,
    wallets,
    onchainSummary,
    onchainIdentity,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }
  await ensureWaitlistSchema(db as any)

  if (req.method === 'GET') {
    const addressQuery = normalizeLower(readStringQuery(req, 'address'))
    if (addressQuery) {
      if (!isAddressLike(addressQuery)) {
        return res.status(400).json({ success: false, error: 'Invalid address' } satisfies ApiEnvelope<never>)
      }
      const publicRateLimit = checkRateLimit(
        rateLimitKey('portfolio-public', getClientIp(req)),
        PUBLIC_PORTFOLIO_RATE_LIMIT,
      )
      res.setHeader('X-RateLimit-Limit', String(PUBLIC_PORTFOLIO_RATE_LIMIT.maxRequests))
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, publicRateLimit.remaining)))
      res.setHeader('X-RateLimit-Reset', String(Math.floor(publicRateLimit.resetAt / 1000)))
      if (!publicRateLimit.allowed) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((publicRateLimit.resetAt - Date.now()) / 1000),
        )
        res.setHeader('Retry-After', String(retryAfterSeconds))
        return res
          .status(429)
          .json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
      }
      const row = await resolveProfileRow(db as any, 'public', addressQuery)
      if (!row) {
        return res.status(404).json({ success: false, error: 'Profile not found' } satisfies ApiEnvelope<never>)
      }
      const data = await buildResponse(db as any, 'public', row)
      return res.status(200).json({ success: true, data } satisfies ApiEnvelope<PortfolioMeResponse>)
    }

    const principalAddress = readRequestPrincipalAddress(req)
    if (!principalAddress) {
      return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<never>)
    }
    const row = await resolveProfileRow(db as any, 'self', principalAddress)
    if (!row) {
      return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<PortfolioMeResponse | null>)
    }
    const data = await buildResponse(db as any, 'self', row)
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<PortfolioMeResponse>)
  }

  const principalAddress = readRequestPrincipalAddress(req)
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<never>)
  }
  const patchLimiter = checkRateLimit(
    rateLimitKey('portfolio-self-patch', principalAddress.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.cswLink,
  )
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMITS.cswLink.maxRequests))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, patchLimiter.remaining)))
  res.setHeader('X-RateLimit-Reset', String(Math.floor(patchLimiter.resetAt / 1000)))
  if (!patchLimiter.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((patchLimiter.resetAt - Date.now()) / 1000))
    res.setHeader('Retry-After', String(retryAfterSeconds))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const profileRow = await resolveProfileRow(db as any, 'self', principalAddress)
  if (!profileRow) {
    return res.status(404).json({ success: false, error: 'Profile not found' } satisfies ApiEnvelope<never>)
  }

  const body: Partial<PatchBody> = (await readBoundedJsonObjectBody<PatchBody>(req, { maxBytes: 65_536 })) ?? {}
  const hasDisplayName = Object.prototype.hasOwnProperty.call(body, 'displayName')
  const hasBio = Object.prototype.hasOwnProperty.call(body, 'bio')
  const hasWebsite = Object.prototype.hasOwnProperty.call(body, 'website')
  const hasAvatarUrl = Object.prototype.hasOwnProperty.call(body, 'avatarUrl')
  const hasBannerUrl = Object.prototype.hasOwnProperty.call(body, 'bannerUrl')
  const hasAvatarLensUri = Object.prototype.hasOwnProperty.call(body, 'avatarLensUri')
  const hasBannerLensUri = Object.prototype.hasOwnProperty.call(body, 'bannerLensUri')
  const hasAny =
    hasDisplayName || hasBio || hasWebsite || hasAvatarUrl || hasBannerUrl || hasAvatarLensUri || hasBannerLensUri

  if (!hasAny) {
    return res.status(400).json({ success: false, error: 'No updatable fields provided' } satisfies ApiEnvelope<never>)
  }

  const currentFields = readProfileFields(profileRow.profile_fields)
  for (const key of MANUAL_FIELD_KEYS) {
    const source = currentFields[key]?.source
    if (!source) continue
    if (source !== 'manual') {
      if (
        (key === 'display_name' && hasDisplayName) ||
        (key === 'bio' && hasBio) ||
        (key === 'website' && hasWebsite) ||
        (key === 'avatar_url' && hasAvatarUrl) ||
        (key === 'banner_url' && hasBannerUrl) ||
        (key === 'avatar_lens_uri' && hasAvatarLensUri) ||
        (key === 'banner_lens_uri' && hasBannerLensUri)
      ) {
        return res.status(400).json({
          success: false,
          error: `Field ${key} is externally managed`,
        } satisfies ApiEnvelope<never>)
      }
    }
  }
  const displayName = hasDisplayName ? normalizeManualText(body.displayName, 64) : null
  const bio = hasBio ? normalizeManualText(body.bio, 480) : null
  const website = hasWebsite ? normalizeManualText(body.website, 280) : null
  const avatarUrl = hasAvatarUrl ? normalizeManualText(body.avatarUrl, 500) : null
  const bannerUrl = hasBannerUrl ? normalizeManualText(body.bannerUrl, 500) : null
  const avatarLensUri = hasAvatarLensUri ? normalizeManualText(body.avatarLensUri, 500) : null
  const bannerLensUri = hasBannerLensUri ? normalizeManualText(body.bannerLensUri, 500) : null

  if (hasAvatarLensUri && avatarLensUri && !avatarLensUri.startsWith('lens://')) {
    return res.status(400).json({ success: false, error: 'avatarLensUri must start with lens://' } satisfies ApiEnvelope<never>)
  }
  if (hasBannerLensUri && bannerLensUri && !bannerLensUri.startsWith('lens://')) {
    return res.status(400).json({ success: false, error: 'bannerLensUri must start with lens://' } satisfies ApiEnvelope<never>)
  }
  if (hasWebsite && website && hasDisallowedUrlScheme(website)) {
    return res.status(400).json({ success: false, error: 'website must be an http(s) URL' } satisfies ApiEnvelope<never>)
  }
  if (hasAvatarUrl && avatarUrl && hasDisallowedUrlScheme(avatarUrl)) {
    return res.status(400).json({ success: false, error: 'avatarUrl must be an http(s) URL' } satisfies ApiEnvelope<never>)
  }
  if (hasBannerUrl && bannerUrl && hasDisallowedUrlScheme(bannerUrl)) {
    return res.status(400).json({ success: false, error: 'bannerUrl must be an http(s) URL' } satisfies ApiEnvelope<never>)
  }

  const nowIso = new Date().toISOString()
  const mergedFields: ProfileFieldsMap = { ...currentFields }
  if (hasDisplayName) mergedFields.display_name = { value: displayName, source: 'manual', updated_at: nowIso }
  if (hasBio) mergedFields.bio = { value: bio, source: 'manual', updated_at: nowIso }
  if (hasWebsite) mergedFields.website = { value: website, source: 'manual', updated_at: nowIso }
  if (hasAvatarUrl) mergedFields.avatar_url = { value: avatarUrl, source: 'manual', updated_at: nowIso }
  if (hasBannerUrl) mergedFields.banner_url = { value: bannerUrl, source: 'manual', updated_at: nowIso }
  if (hasAvatarLensUri) mergedFields.avatar_lens_uri = { value: avatarLensUri, source: 'manual', updated_at: nowIso }
  if (hasBannerLensUri) mergedFields.banner_lens_uri = { value: bannerLensUri, source: 'manual', updated_at: nowIso }

  await db.sql`
    UPDATE profiles
    SET
      display_name = CASE WHEN ${hasDisplayName} THEN ${displayName} ELSE display_name END,
      bio = CASE WHEN ${hasBio} THEN ${bio} ELSE bio END,
      website = CASE WHEN ${hasWebsite} THEN ${website} ELSE website END,
      avatar_url = CASE WHEN ${hasAvatarUrl} THEN ${avatarUrl} ELSE avatar_url END,
      banner_url = CASE WHEN ${hasBannerUrl} THEN ${bannerUrl} ELSE banner_url END,
      profile_fields = ${mergedFields},
      updated_at = NOW()
    WHERE id = ${Number(profileRow.id)};
  `

  const freshRow = await db.sql`SELECT * FROM profiles WHERE id = ${Number(profileRow.id)} LIMIT 1;`
  const row = freshRow.rows?.[0]
  const data = await buildResponse(db as any, 'self', row)
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<PortfolioMeResponse>)
}

export const __testables = {
  clearPublicOnchainSummaryCacheForTests: () => {
    publicOnchainSummaryCache.clear()
  },
}
