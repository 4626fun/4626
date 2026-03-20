import type { VercelRequest } from '@vercel/node'
import { PrivyClient } from '@privy-io/server-auth'
import { createPublicClient, getAddress, http, type Address } from 'viem'
import { base } from 'viem/chains'

import { resolveBaseAppInviteUrl } from './baseAppInvite.js'
import { isOwner } from './coinbaseSmartWalletOwner.js'
import { ensureWaitlistSchema } from './waitlistSchema.js'
import { classifyLinkedAccounts, type PrivyUserLike } from './walletMapping.js'
import { syncUserWallets } from './walletSync.js'

declare const process: { env: Record<string, string | undefined> }

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

type PrivyRequestContext = {
  privyToken: string
  privyUserId: string
  privyUser: PrivyUserLike
}

type PersistedDelegationState = {
  profileId: number
  canonicalCswAddress: string | null
  canonicalSource: string | null
  privyEmbeddedEoaAddress: string | null
  privyIsOwner: boolean
  lastCheckedAt: string | null
}

export type BootstrapDelegationState = {
  chainId: 8453
  profileId: number
  privyUserId: string
  canonicalCswAddress: string
  privyEmbeddedEoaAddress: string
  privyIsOwner: boolean
}

type StructuredDelegationError = Error & {
  needsEmbeddedWallet?: boolean
  needsBaseAppSetup?: boolean
  baseAppUrl?: string
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const DEFAULT_BASE_RPCS = ['https://mainnet.base.org', 'https://base.llamarpc.com'] as const

let delegationColumnsEnsured = false

function normalizeAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!ADDRESS_RE.test(raw)) return null
  return getAddress(raw).toLowerCase()
}

function toAddress(value: string, fieldName: string): Address {
  const normalized = normalizeAddress(value)
  if (!normalized) throw new Error(`Invalid ${fieldName} address`)
  return getAddress(normalized) as Address
}

function readHeader(req: VercelRequest, name: string): string {
  const key = name.toLowerCase()
  const raw = (req.headers?.[key] ?? req.headers?.[name]) as string | string[] | undefined
  if (Array.isArray(raw)) return String(raw[0] ?? '').trim()
  return typeof raw === 'string' ? raw.trim() : ''
}

function getPrivyServerAuth(): { appId: string; appSecret: string } {
  const appId = String(process.env.PRIVY_APP_ID ?? '').trim()
  const appSecret = String(process.env.PRIVY_APP_SECRET ?? '').trim()
  if (!appId || !appSecret) {
    throw new Error('Privy server auth is not configured (missing PRIVY_APP_ID / PRIVY_APP_SECRET).')
  }
  return { appId, appSecret }
}

function getPrivyTokenFromRequest(req: VercelRequest): string {
  const fromHeader = readHeader(req, 'x-privy-token')
  if (fromHeader) return fromHeader
  const auth = readHeader(req, 'authorization')
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice('bearer '.length).trim()
    if (token) return token
  }
  throw new Error('Missing Privy auth token')
}

function buildStructuredError(
  message: string,
  opts: {
    needsEmbeddedWallet?: boolean
    needsBaseAppSetup?: boolean
    baseAppUrl?: string | null
  } = {},
): StructuredDelegationError {
  const error = new Error(message) as StructuredDelegationError
  if (opts.needsEmbeddedWallet === true) error.needsEmbeddedWallet = true
  if (opts.needsBaseAppSetup === true) error.needsBaseAppSetup = true
  if (typeof opts.baseAppUrl === 'string' && opts.baseAppUrl.trim()) error.baseAppUrl = opts.baseAppUrl.trim()
  return error
}

function normalizeCanonicalSource(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  return raw || fallback
}

function getBaseRpcUrls(): string[] {
  const raw = String(process.env.BASE_RPC_URL ?? '').trim()
  if (!raw) return [...DEFAULT_BASE_RPCS]
  const urls = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return [...new Set([...urls, ...DEFAULT_BASE_RPCS])]
}

function createBasePublicClient(rpcUrl: string) {
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 12_000 }),
  }) as any
}

async function readProfileIdByPrivyUserId(db: Db, privyUserId: string): Promise<number | null> {
  const result = await db.sql`
    SELECT id
    FROM profiles
    WHERE privy_user_id = ${privyUserId}
    LIMIT 1;
  `
  const idRaw = result.rows?.[0]?.id
  const id = typeof idRaw === 'number' ? idRaw : Number(idRaw)
  return Number.isFinite(id) && id > 0 ? id : null
}

async function readPersistedDelegationState(db: Db, profileId: number): Promise<PersistedDelegationState> {
  const rows = await db.sql`
    SELECT
      pw.profile_id,
      pw.chain_id,
      pw.canonical_zora_csw_address,
      pw.canonical_source,
      pw.privy_embedded_eoa_address,
      pw.privy_is_owner,
      pw.last_checked_at,
      pw.address,
      pw.is_canonical_smart_wallet
    FROM profile_wallets pw
    WHERE pw.profile_id = ${profileId}
      AND (pw.chain_id = 8453 OR pw.chain_id IS NULL)
    ORDER BY
      CASE WHEN pw.canonical_zora_csw_address IS NOT NULL THEN 0 ELSE 1 END ASC,
      CASE WHEN pw.is_canonical_smart_wallet = true THEN 0 ELSE 1 END ASC,
      pw.updated_at DESC
    LIMIT 1;
  `
  const row = rows.rows?.[0] ?? null
  const canonicalFromColumns = normalizeAddress(row?.canonical_zora_csw_address)
  const canonicalFromAddress = row?.is_canonical_smart_wallet === true ? normalizeAddress(row?.address) : null
  const canonicalCswAddress = canonicalFromColumns ?? canonicalFromAddress ?? null
  const embedded = normalizeAddress(row?.privy_embedded_eoa_address)
  const isOwnerFlag = row?.privy_is_owner === true
  return {
    profileId,
    canonicalCswAddress,
    canonicalSource: typeof row?.canonical_source === 'string' ? row.canonical_source : null,
    privyEmbeddedEoaAddress: embedded,
    privyIsOwner: isOwnerFlag,
    lastCheckedAt:
      typeof row?.last_checked_at === 'string'
        ? row.last_checked_at
        : row?.last_checked_at instanceof Date
          ? row.last_checked_at.toISOString()
          : null,
  }
}

async function ensureCanonicalWalletRow(params: {
  db: Db
  profileId: number
  canonicalCswAddress: string
  canonicalSource: string
  privyEmbeddedEoaAddress: string | null
}): Promise<void> {
  const { db, profileId, canonicalCswAddress, canonicalSource, privyEmbeddedEoaAddress } = params
  const canonical = normalizeAddress(canonicalCswAddress)
  if (!canonical) throw new Error('Invalid canonical CSW address')
  const embedded = normalizeAddress(privyEmbeddedEoaAddress)

  await db.sql`
    INSERT INTO wallets (address, chain, wallet_type, provider)
    VALUES (${canonical}, ${'evm'}, ${'smart_wallet'}, ${'coinbase_wallet'})
    ON CONFLICT (address) DO UPDATE
    SET
      chain = COALESCE(EXCLUDED.chain, wallets.chain),
      wallet_type = COALESCE(EXCLUDED.wallet_type, wallets.wallet_type),
      provider = CASE
        WHEN wallets.provider = 'unknown' THEN EXCLUDED.provider
        ELSE wallets.provider
      END;
  `

  await db.sql`
    UPDATE profile_wallets
    SET is_canonical_smart_wallet = false, updated_at = NOW()
    WHERE profile_id = ${profileId}
      AND LOWER(address) <> ${canonical}
      AND is_canonical_smart_wallet = true;
  `

  await db.sql`
    INSERT INTO profile_wallets (
      profile_id,
      address,
      is_canonical_smart_wallet,
      verified_at,
      updated_at,
      chain_id,
      canonical_zora_csw_address,
      canonical_source,
      privy_embedded_eoa_address
    )
    VALUES (
      ${profileId},
      ${canonical},
      true,
      NOW(),
      NOW(),
      8453,
      ${canonical},
      ${canonicalSource},
      ${embedded}
    )
    ON CONFLICT (profile_id, address) DO UPDATE
    SET
      is_canonical_smart_wallet = true,
      verified_at = COALESCE(profile_wallets.verified_at, NOW()),
      updated_at = NOW(),
      chain_id = 8453,
      canonical_zora_csw_address = EXCLUDED.canonical_zora_csw_address,
      canonical_source = EXCLUDED.canonical_source,
      privy_embedded_eoa_address = COALESCE(EXCLUDED.privy_embedded_eoa_address, profile_wallets.privy_embedded_eoa_address);
  `
}

async function ensureDelegationColumns(db: Db): Promise<void> {
  if (delegationColumnsEnsured) return
  try {
    await db.sql`ALTER TABLE profile_wallets ADD COLUMN IF NOT EXISTS chain_id INT NOT NULL DEFAULT 8453;`
    await db.sql`ALTER TABLE profile_wallets ADD COLUMN IF NOT EXISTS canonical_zora_csw_address TEXT NULL;`
    await db.sql`ALTER TABLE profile_wallets ADD COLUMN IF NOT EXISTS canonical_source TEXT NOT NULL DEFAULT 'wallet_sync';`
    await db.sql`ALTER TABLE profile_wallets ADD COLUMN IF NOT EXISTS privy_embedded_eoa_address TEXT NULL;`
    await db.sql`ALTER TABLE profile_wallets ADD COLUMN IF NOT EXISTS privy_is_owner BOOLEAN NOT NULL DEFAULT false;`
    await db.sql`ALTER TABLE profile_wallets ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ NULL;`
    delegationColumnsEnsured = true
  } catch {
    delegationColumnsEnsured = false
    throw new Error('canonical_csw_delegation_columns_ensure_failed')
  }
}

export async function getPrivyUserIdFromRequest(req: VercelRequest): Promise<string> {
  const context = await verifyPrivyRequest(req)
  return context.privyUserId
}

export async function verifyPrivyRequest(req: VercelRequest): Promise<PrivyRequestContext> {
  const token = getPrivyTokenFromRequest(req)
  const auth = getPrivyServerAuth()
  const client = new PrivyClient(auth.appId, auth.appSecret)
  const claims = await client.verifyAuthToken(token)
  const privyUserId = typeof (claims as any)?.userId === 'string' ? String((claims as any).userId).trim() : ''
  if (!privyUserId) throw new Error('Privy user ID missing from auth token')
  const privyUser = (await client.getUserById(privyUserId)) as PrivyUserLike
  return {
    privyToken: token,
    privyUserId,
    privyUser,
  }
}

export async function resolveCanonicalZoraCSW(params: {
  db: Db
  privyUserId: string
  privyUser: PrivyUserLike
}): Promise<{ profileId: number; canonicalCswAddress: string; canonicalSource: string }> {
  const { db, privyUserId, privyUser } = params
  await ensureWaitlistSchema(db)
  await ensureDelegationColumns(db)

  let profileId = await readProfileIdByPrivyUserId(db, privyUserId)

  // Existing persisted canonical must win to avoid canonical flip-flop.
  if (profileId) {
    const persisted = await readPersistedDelegationState(db, profileId)
    if (persisted.canonicalCswAddress) {
      return {
        profileId,
        canonicalCswAddress: persisted.canonicalCswAddress,
        canonicalSource: normalizeCanonicalSource(persisted.canonicalSource, 'wallet_sync'),
      }
    }
  }

  const syncResult = await syncUserWallets(db, privyUser)
  profileId = syncResult.profileId
  const syncedCanonical = normalizeAddress(syncResult.canonicalSmartWallet?.address ?? null)
  const syncedCanonicalSource = syncedCanonical
    ? syncResult.canonicalSmartWallet?.provider === 'coinbase_wallet'
      ? 'base_account'
      : 'wallet_sync'
    : null

  let fallbackCanonical: string | null = null
  if (!syncedCanonical) {
    const profileRow = await db.sql`
      SELECT primary_smart_wallet, csw_address, base_sub_account
      FROM profiles
      WHERE id = ${profileId}
      LIMIT 1;
    `
    const row = profileRow.rows?.[0] ?? null
    fallbackCanonical =
      normalizeAddress(row?.primary_smart_wallet) ??
      normalizeAddress(row?.csw_address) ??
      normalizeAddress(row?.base_sub_account)
  }
  const fallbackCanonicalSource = fallbackCanonical ? 'profile_seed' : null

  const canonical = syncedCanonical ?? fallbackCanonical
  if (!canonical) {
    throw buildStructuredError('No canonical Coinbase Smart Wallet is linked to this account yet.', {
      needsBaseAppSetup: true,
      baseAppUrl: resolveBaseAppInviteUrl(),
    })
  }
  const canonicalSource = syncedCanonicalSource ?? fallbackCanonicalSource ?? 'wallet_sync'

  await ensureCanonicalWalletRow({
    db,
    profileId,
    canonicalCswAddress: canonical,
    canonicalSource,
    privyEmbeddedEoaAddress: null,
  })

  await db.sql`
    UPDATE profiles
    SET
      privy_user_id = COALESCE(privy_user_id, ${privyUserId}),
      csw_address = COALESCE(csw_address, ${canonical}),
      primary_smart_wallet = COALESCE(primary_smart_wallet, ${canonical}),
      base_sub_account = COALESCE(base_sub_account, ${canonical}),
      updated_at = NOW()
    WHERE id = ${profileId};
  `

  return {
    profileId,
    canonicalCswAddress: canonical,
    canonicalSource,
  }
}

export async function getPrivyEmbeddedEOA(params: {
  db: Db
  profileId: number
  privyUser: PrivyUserLike
}): Promise<string> {
  const classification = classifyLinkedAccounts(params.privyUser)
  const embedded = normalizeAddress(classification.embeddedEoa?.address ?? null)
  if (embedded) return embedded

  const result = await params.db.sql`
    SELECT primary_embedded_eoa, embedded_wallet
    FROM profiles
    WHERE id = ${params.profileId}
    LIMIT 1;
  `
  const row = result.rows?.[0] ?? null
  const persisted = normalizeAddress(row?.primary_embedded_eoa) ?? normalizeAddress(row?.embedded_wallet)
  if (persisted) return persisted

  throw buildStructuredError('Privy embedded EOA is not ready for this account yet. Retry in a moment.', {
    needsEmbeddedWallet: true,
  })
}

async function checkOwnerAcrossRpcs(params: {
  cswAddress: string
  ownerAddress: string
}): Promise<boolean> {
  const csw = toAddress(params.cswAddress, 'csw')
  const owner = toAddress(params.ownerAddress, 'owner')
  let lastError: unknown = null
  for (const rpc of getBaseRpcUrls()) {
    try {
      const client = createBasePublicClient(rpc)
      const ownerInstalled = await isOwner(client, csw, owner)
      return ownerInstalled
    } catch (error) {
      lastError = error
    }
  }
  if (lastError) throw lastError
  return false
}

export async function loadCanonicalDelegationState(params: {
  db: Db
  privyUserId: string
}): Promise<PersistedDelegationState | null> {
  const profileId = await readProfileIdByPrivyUserId(params.db, params.privyUserId)
  if (!profileId) return null
  return readPersistedDelegationState(params.db, profileId)
}

export async function bootstrapCanonicalDelegationState(params: {
  db: Db
  req: VercelRequest
}): Promise<BootstrapDelegationState> {
  const { db, req } = params
  const context = await verifyPrivyRequest(req)
  const canonical = await resolveCanonicalZoraCSW({
    db,
    privyUserId: context.privyUserId,
    privyUser: context.privyUser,
  })
  const privyEmbeddedEoaAddress = await getPrivyEmbeddedEOA({
    db,
    profileId: canonical.profileId,
    privyUser: context.privyUser,
  })

  await ensureCanonicalWalletRow({
    db,
    profileId: canonical.profileId,
    canonicalCswAddress: canonical.canonicalCswAddress,
    canonicalSource: canonical.canonicalSource,
    privyEmbeddedEoaAddress,
  })

  const privyIsOwner = await checkOwnerAcrossRpcs({
    cswAddress: canonical.canonicalCswAddress,
    ownerAddress: privyEmbeddedEoaAddress,
  })

  await db.sql`
    UPDATE profile_wallets
    SET
      chain_id = 8453,
      canonical_zora_csw_address = ${canonical.canonicalCswAddress},
      canonical_source = ${canonical.canonicalSource},
      privy_embedded_eoa_address = ${privyEmbeddedEoaAddress},
      privy_is_owner = ${privyIsOwner},
      last_checked_at = NOW(),
      updated_at = NOW()
    WHERE profile_id = ${canonical.profileId}
      AND LOWER(address) = ${canonical.canonicalCswAddress};
  `

  await db.sql`
    UPDATE profiles
    SET
      primary_embedded_eoa = COALESCE(primary_embedded_eoa, ${privyEmbeddedEoaAddress}),
      embedded_wallet = COALESCE(embedded_wallet, ${privyEmbeddedEoaAddress}),
      updated_at = NOW()
    WHERE id = ${canonical.profileId};
  `

  return {
    chainId: 8453,
    profileId: canonical.profileId,
    privyUserId: context.privyUserId,
    canonicalCswAddress: canonical.canonicalCswAddress,
    privyEmbeddedEoaAddress,
    privyIsOwner,
  }
}

export async function confirmOwnerState(params: {
  db: Db
  req: VercelRequest
  ownerAddress?: string | null
  cswAddress?: string | null
}): Promise<{ isOwner: boolean; canonicalCswAddress: string; ownerAddress: string }> {
  const { db, req } = params
  const bootstrap = await bootstrapCanonicalDelegationState({ db, req })
  const canonicalFromInput = normalizeAddress(params.cswAddress)
  const canonicalCswAddress = canonicalFromInput ?? bootstrap.canonicalCswAddress

  const requestedOwner = normalizeAddress(params.ownerAddress)
  const ownerAddress = requestedOwner ?? bootstrap.privyEmbeddedEoaAddress

  const isOwnerNow = await checkOwnerAcrossRpcs({
    cswAddress: canonicalCswAddress,
    ownerAddress,
  })

  if (ownerAddress === bootstrap.privyEmbeddedEoaAddress) {
    await db.sql`
      UPDATE profile_wallets
      SET
        privy_is_owner = ${isOwnerNow},
        last_checked_at = NOW(),
        updated_at = NOW()
      WHERE profile_id = ${bootstrap.profileId}
        AND LOWER(address) = ${canonicalCswAddress};
    `
  } else if (isOwnerNow) {
    const metadataKey = `advanced_owner_${ownerAddress.toLowerCase()}`
    await db.sql`
      UPDATE profile_wallets
      SET
        metadata = COALESCE(metadata, '{}'::jsonb) ||
          jsonb_build_object(
            ${metadataKey},
            jsonb_build_object('status', 'active', 'ownerAddress', ${ownerAddress}, 'updatedAt', NOW())
          ),
        last_checked_at = NOW(),
        updated_at = NOW()
      WHERE profile_id = ${bootstrap.profileId}
        AND LOWER(address) = ${canonicalCswAddress};
    `
  }

  await db.sql`
    UPDATE profiles
    SET privy_user_id = COALESCE(privy_user_id, ${bootstrap.privyUserId}), updated_at = NOW()
    WHERE id = ${bootstrap.profileId};
  `

  return {
    isOwner: isOwnerNow,
    canonicalCswAddress,
    ownerAddress,
  }
}

export function extractDelegationFlags(error: unknown): {
  needsEmbeddedWallet?: boolean
  needsBaseAppSetup?: boolean
  baseAppUrl?: string
} {
  const structured = error as StructuredDelegationError
  return {
    ...(structured?.needsEmbeddedWallet === true ? { needsEmbeddedWallet: true } : null),
    ...(structured?.needsBaseAppSetup === true ? { needsBaseAppSetup: true } : null),
    ...(typeof structured?.baseAppUrl === 'string' && structured.baseAppUrl.trim()
      ? { baseAppUrl: structured.baseAppUrl.trim() }
      : null),
  }
}
