import { getAddress } from 'viem'

import { getDb, isDbConfigured } from '../db/postgres.js'
import { resolveCommandIssuerContextByProfileId } from '@4626/server-core'
import { readProfileWalletAuthority } from './canonicalWalletResolver.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type CreatorInfrastructureContext = {
  /** Creator coin token address (lookup key in creator_infrastructure). */
  creatorAddress: `0x${string}`
  /** Parent Coinbase Smart Wallet — custody + execution + XMTP identity. */
  cswAddress: `0x${string}`
  /** Privy server wallet delegated as CSW owner (signer, not identity). */
  privyOwnerWalletId: string
  profileId: number | null
  /** XMTP inbox address — always the parent CSW. */
  xmtpAgentAddress: `0x${string}`
  agentType: 'csw'
}

export class CreatorInfrastructureNotProvisionedError extends Error {
  readonly code = 'creator_infrastructure_not_provisioned'

  constructor(message = 'Creator CSW infrastructure is not provisioned.') {
    super(message)
    this.name = 'CreatorInfrastructureNotProvisionedError'
  }
}

export class CreatorInfrastructureMismatchError extends Error {
  readonly code = 'creator_infrastructure_mismatch'

  constructor(message = 'Creator CSW infrastructure failed consistency checks.') {
    super(message)
    this.name = 'CreatorInfrastructureMismatchError'
  }
}

async function assertProfileCswAlignment(params: {
  db: Db
  profileId: number
  cswAddress: `0x${string}`
}): Promise<void> {
  const authority = await readProfileWalletAuthority({ db: params.db, profileId: params.profileId })
  const canonical = authority?.canonicalSmartWalletAddress
  if (!canonical) return
  const normalizedCanonical = getAddress(canonical).toLowerCase() as `0x${string}`
  if (normalizedCanonical !== params.cswAddress) {
    throw new CreatorInfrastructureMismatchError(
      'creator_infrastructure csw_address does not match profiles canonical CSW',
    )
  }
}

function normalizeCoin(value: string): `0x${string}` {
  return getAddress(value).toLowerCase() as `0x${string}`
}

function rowToContext(
  creatorAddress: `0x${string}`,
  row: {
    csw_address?: unknown
    privy_wallet_id?: unknown
    profile_id?: unknown
  },
): CreatorInfrastructureContext | null {
  const cswRaw = String(row.csw_address ?? '').trim()
  const privyWalletId = String(row.privy_wallet_id ?? '').trim()
  if (!cswRaw || !privyWalletId) return null
  const cswAddress = getAddress(cswRaw).toLowerCase() as `0x${string}`
  const profileIdRaw = row.profile_id
  const profileId =
    typeof profileIdRaw === 'number' && Number.isFinite(profileIdRaw) && profileIdRaw > 0
      ? Math.floor(profileIdRaw)
      : null
  return {
    creatorAddress,
    cswAddress,
    privyOwnerWalletId: privyWalletId,
    profileId,
    xmtpAgentAddress: cswAddress,
    agentType: 'csw',
  }
}

async function lookupInfrastructureRow(db: Db, creatorAddress: `0x${string}`) {
  const result = await db.sql`
    SELECT
      creator_address,
      csw_address,
      privy_wallet_id,
      agent_type
    FROM creator_infrastructure
    WHERE LOWER(creator_address) = ${creatorAddress}
      AND agent_type = 'csw'
      AND csw_address IS NOT NULL
      AND privy_wallet_id IS NOT NULL
    LIMIT 1;
  `
  return result.rows?.[0] ?? null
}

async function lookupProfileIdForCoin(db: Db, creatorAddress: `0x${string}`): Promise<number | null> {
  const byZoraSignal = await db.sql`
    SELECT p.id
    FROM account_zora_signals azs
    JOIN profiles p ON p.privy_user_id = azs.privy_user_id
    WHERE p.merged_into_profile_id IS NULL
      AND LOWER(azs.creator_coin_address) = ${creatorAddress}
    LIMIT 1;
  `
  const zoraProfileId = Number(byZoraSignal.rows?.[0]?.id ?? 0)
  if (Number.isFinite(zoraProfileId) && zoraProfileId > 0) return Math.floor(zoraProfileId)

  const byVault = await db.sql`
    SELECT p.id
    FROM keepr_vaults kv
    JOIN profiles p
      ON p.merged_into_profile_id IS NULL
      AND (
        LOWER(p.csw_address) = LOWER(kv.canonical_owner_address)
        OR LOWER(p.csw_address) = LOWER(kv.canonical_owner_address)
      )
    WHERE LOWER(kv.creator_coin_address) = ${creatorAddress}
    LIMIT 1;
  `
  const vaultProfileId = Number(byVault.rows?.[0]?.id ?? 0)
  if (Number.isFinite(vaultProfileId) && vaultProfileId > 0) return Math.floor(vaultProfileId)

  return null
}

async function lookupFromCommandIssuer(db: Db, profileId: number): Promise<CreatorInfrastructureContext | null> {
  const resolution = await resolveCommandIssuerContextByProfileId(profileId)
  if (resolution.status !== 'ready') return null
  const authority = await readProfileWalletAuthority({ db, profileId })
  const cswAddress = (authority?.canonicalSmartWalletAddress ??
    resolution.context.smartWallet) as `0x${string}` | null
  if (!cswAddress) return null
  const normalizedCsw = getAddress(cswAddress).toLowerCase() as `0x${string}`
  const issuerCsw = getAddress(resolution.context.smartWallet).toLowerCase() as `0x${string}`
  if (issuerCsw !== normalizedCsw) {
    throw new CreatorInfrastructureMismatchError(
      'command_issuer_execution_context smart_wallet does not match profile canonical CSW',
    )
  }
  return {
    creatorAddress: cswAddress,
    cswAddress: normalizedCsw,
    privyOwnerWalletId: resolution.context.privyOwnerWalletId,
    profileId,
    xmtpAgentAddress: normalizedCsw,
    agentType: 'csw',
  }
}

/**
 * Resolve a creator's unified CSW infrastructure for keeper/XMTP automation.
 * Does not mint EOAs — callers must provision CSW + delegated owner first.
 */
export async function resolveCreatorInfrastructure(params: {
  creatorToken: `0x${string}`
  db?: Db
}): Promise<CreatorInfrastructureContext> {
  const creatorAddress = normalizeCoin(params.creatorToken)
  if (!isDbConfigured()) throw new CreatorInfrastructureNotProvisionedError('db_not_configured')

  const db = params.db ?? ((await getDb()) as Db | null)
  if (!db) throw new CreatorInfrastructureNotProvisionedError('db_not_configured')

  const infraRow = await lookupInfrastructureRow(db, creatorAddress)
  if (infraRow) {
    const profileId = await lookupProfileIdForCoin(db, creatorAddress)
    const ctx = rowToContext(creatorAddress, { ...infraRow, profile_id: profileId })
    if (ctx) {
      if (profileId) {
        await assertProfileCswAlignment({ db, profileId, cswAddress: ctx.cswAddress })
      }
      return ctx
    }
  }

  const profileId = await lookupProfileIdForCoin(db, creatorAddress)
  if (profileId) {
    const authority = await readProfileWalletAuthority({ db, profileId })
    const cswAddress = authority?.canonicalSmartWalletAddress
    if (cswAddress) {
      const fromIssuer = await lookupFromCommandIssuer(db, profileId)
      if (fromIssuer) {
        return { ...fromIssuer, creatorAddress }
      }
    }
  }

  throw new CreatorInfrastructureNotProvisionedError(
    'Creator CSW is not provisioned for automation. Finish CSW owner install and agent-owner delegation (provision-agent-owner / enable CSW agent).',
  )
}

/** @deprecated Use resolveCreatorInfrastructure — returns CSW address as `address` for legacy call sites. */
export async function resolveCreatorExecutionWallet(params: {
  creatorToken: `0x${string}`
}): Promise<{ walletId: string; address: `0x${string}`; cswAddress: `0x${string}`; profileId: number | null }> {
  const ctx = await resolveCreatorInfrastructure(params)
  return {
    walletId: ctx.privyOwnerWalletId,
    address: ctx.cswAddress,
    cswAddress: ctx.cswAddress,
    profileId: ctx.profileId,
  }
}
