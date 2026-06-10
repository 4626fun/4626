import { createPublicClient, http, type Address } from 'viem'
import { base } from 'viem/chains'

import {
  hasContractBytecode,
  isAllowedOwnerEoa,
} from '../../../src/wallet/canonicalWalletPolicy.js'
import { resolveStoredCanonicalCswAddress } from './canonicalCswPersistence.js'
import { repointCanonicalCswOnProfile } from './repointCanonicalCsw.js'
import type { Db } from './walletSync.js'

export type CswMixupReason =
  | 'csw_is_allowed_owner_eoa'
  | 'csw_has_no_bytecode'
  | 'csw_equals_embedded_eoa'
  | 'csw_mismatch_primary_smart_wallet'
  | 'profile_wallet_canonical_flag_on_eoa'
  | 'zora_signal_canonical_is_eoa'
  | 'policy_resolved_csw_differs'

export type ProfileCswAuditRow = {
  profileId: number
  email: string | null
  privyUserId: string | null
  currentCsw: string | null
  currentPrimarySmartWallet: string | null
  embeddedEoa: string | null
  primaryWallet: string | null
  expectedCsw: string | null
  reasons: CswMixupReason[]
}

export type ProfileCswRepairResult = {
  profileId: number
  applied: boolean
  beforeCsw: string | null
  afterCsw: string | null
  reasons: CswMixupReason[]
  profileWalletFlagsFixed: number
  zoraSignalUpdated: boolean
}

function normalizeAddress(value: unknown): string | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(raw)) return null
  return raw
}

function createBytecodeReader(rpcUrl: string) {
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const cache = new Map<string, boolean>()
  return async (address: string | null | undefined): Promise<boolean> => {
    const normalized = normalizeAddress(address)
    if (!normalized) return false
    if (cache.has(normalized)) return cache.get(normalized)!
    const bytecode = await client.getBytecode({ address: normalized as Address })
    const deployed = hasContractBytecode(bytecode)
    cache.set(normalized, deployed)
    return deployed
  }
}

export async function auditProfileCswRow(params: {
  row: {
    id: unknown
    email?: unknown
    privy_user_id?: unknown
    csw_address?: unknown
    primary_smart_wallet?: unknown
    primary_embedded_eoa?: unknown
    embedded_wallet?: unknown
    primary_wallet?: unknown
  }
  hasDeployedBytecode: (address: string | null | undefined) => Promise<boolean>
  zoraCanonicalCsw?: string | null
  canonicalWalletRows?: Array<{ address: unknown }>
}): Promise<ProfileCswAuditRow | null> {
  const profileId = Number(params.row.id)
  if (!Number.isInteger(profileId) || profileId <= 0) return null

  const currentCsw = normalizeAddress(params.row.csw_address)
  const currentPrimarySmartWallet = normalizeAddress(params.row.primary_smart_wallet)
  const embeddedEoa =
    normalizeAddress(params.row.primary_embedded_eoa) ?? normalizeAddress(params.row.embedded_wallet)
  const primaryWallet = normalizeAddress(params.row.primary_wallet)
  const expectedCsw = resolveStoredCanonicalCswAddress({
    candidate: currentCsw ?? currentPrimarySmartWallet,
    embeddedEoa,
    activeOwnerEoa: primaryWallet,
  })

  const reasons: CswMixupReason[] = []

  if (currentCsw && isAllowedOwnerEoa(currentCsw)) {
    reasons.push('csw_is_allowed_owner_eoa')
  }
  if (currentCsw && !(await params.hasDeployedBytecode(currentCsw))) {
    reasons.push('csw_has_no_bytecode')
  }
  if (currentCsw && embeddedEoa && currentCsw === embeddedEoa) {
    reasons.push('csw_equals_embedded_eoa')
  }
  if (
    currentCsw &&
    currentPrimarySmartWallet &&
    currentCsw !== currentPrimarySmartWallet
  ) {
    reasons.push('csw_mismatch_primary_smart_wallet')
  }
  if (expectedCsw !== currentCsw) {
    reasons.push('policy_resolved_csw_differs')
  }

  for (const walletRow of params.canonicalWalletRows ?? []) {
    const address = normalizeAddress(walletRow.address)
    if (!address) continue
    if (!(await params.hasDeployedBytecode(address))) {
      reasons.push('profile_wallet_canonical_flag_on_eoa')
      break
    }
  }

  const zoraCanonical = normalizeAddress(params.zoraCanonicalCsw)
  if (zoraCanonical && isAllowedOwnerEoa(zoraCanonical)) {
    reasons.push('zora_signal_canonical_is_eoa')
  } else if (zoraCanonical && !(await params.hasDeployedBytecode(zoraCanonical))) {
    reasons.push('zora_signal_canonical_is_eoa')
  }

  const uniqueReasons = [...new Set(reasons)]
  if (uniqueReasons.length === 0) return null

  return {
    profileId,
    email: typeof params.row.email === 'string' ? params.row.email : null,
    privyUserId: typeof params.row.privy_user_id === 'string' ? params.row.privy_user_id : null,
    currentCsw,
    currentPrimarySmartWallet,
    embeddedEoa,
    primaryWallet,
    expectedCsw,
    reasons: uniqueReasons,
  }
}

export async function repairProfileCswMixup(params: {
  db: Db
  audit: ProfileCswAuditRow
  hasDeployedBytecode: (address: string | null | undefined) => Promise<boolean>
  apply: boolean
}): Promise<ProfileCswRepairResult> {
  const { db, audit, apply } = params
  const beforeCsw = audit.currentCsw
  let afterCsw = audit.expectedCsw
  let profileWalletFlagsFixed = 0
  let zoraSignalUpdated = false

  if (!apply) {
    return {
      profileId: audit.profileId,
      applied: false,
      beforeCsw,
      afterCsw,
      reasons: audit.reasons,
      profileWalletFlagsFixed: 0,
      zoraSignalUpdated: false,
    }
  }

  if (afterCsw) {
    await repointCanonicalCswOnProfile({
      db,
      profileId: audit.profileId,
      canonicalCswAddress: afterCsw,
      embeddedEoaAddress: audit.embeddedEoa,
      clearBaseSubAccount: audit.currentCsw !== null && !(await params.hasDeployedBytecode(audit.currentCsw)),
    })
  } else if (beforeCsw) {
    await db.sql`
      UPDATE profiles
      SET
        csw_address = NULL,
        primary_smart_wallet = NULL,
        base_sub_account = CASE
          WHEN lower(base_sub_account) = lower(${beforeCsw}) THEN NULL
          ELSE base_sub_account
        END,
        updated_at = NOW()
      WHERE id = ${audit.profileId};
    `
    await db.sql`
      UPDATE profile_wallets
      SET is_canonical_smart_wallet = false, updated_at = NOW()
      WHERE profile_id = ${audit.profileId}
        AND is_canonical_smart_wallet = true;
    `
  }

  const canonicalWalletRows = await db.sql`
    SELECT address
    FROM profile_wallets
    WHERE profile_id = ${audit.profileId}
      AND is_canonical_smart_wallet = true;
  `
  for (const walletRow of canonicalWalletRows.rows ?? []) {
    const address = normalizeAddress(walletRow.address)
    if (!address) continue
    if (await params.hasDeployedBytecode(address)) continue
    await db.sql`
      UPDATE profile_wallets
      SET is_canonical_smart_wallet = false, updated_at = NOW()
      WHERE profile_id = ${audit.profileId}
        AND lower(address) = ${address};
    `
    profileWalletFlagsFixed += 1
  }

  if (audit.privyUserId) {
    const zoraRow = await db.sql`
      SELECT canonical_csw_address
      FROM account_zora_signals
      WHERE privy_user_id = ${audit.privyUserId}
      LIMIT 1;
    `.catch(() => ({ rows: [] as any[] }))
    const currentZora = normalizeAddress(zoraRow.rows?.[0]?.canonical_csw_address)
    const shouldUpdateZora =
      audit.reasons.includes('zora_signal_canonical_is_eoa') ||
      (currentZora && isAllowedOwnerEoa(currentZora)) ||
      (currentZora && !(await params.hasDeployedBytecode(currentZora))) ||
      (afterCsw !== null && currentZora !== afterCsw) ||
      (afterCsw === null && currentZora !== null && audit.reasons.includes('policy_resolved_csw_differs'))
    if (shouldUpdateZora) {
      await db.sql`
        UPDATE account_zora_signals
        SET canonical_csw_address = ${afterCsw}, updated_at = NOW()
        WHERE privy_user_id = ${audit.privyUserId};
      `.catch(() => undefined)
      zoraSignalUpdated = true
    }
  }

  const afterRow = await db.sql`
    SELECT csw_address FROM profiles WHERE id = ${audit.profileId} LIMIT 1;
  `
  afterCsw = normalizeAddress(afterRow.rows?.[0]?.csw_address)

  return {
    profileId: audit.profileId,
    applied: true,
    beforeCsw,
    afterCsw,
    reasons: audit.reasons,
    profileWalletFlagsFixed,
    zoraSignalUpdated,
  }
}

export async function auditAllProfileCswMixups(params: {
  db: Db
  rpcUrl: string
  limit?: number
}): Promise<ProfileCswAuditRow[]> {
  const hasDeployedBytecode = createBytecodeReader(params.rpcUrl)
  const limit = params.limit && params.limit > 0 ? params.limit : null

  const profiles = limit
    ? await params.db.sql`
        SELECT id, email, privy_user_id, csw_address, primary_smart_wallet, primary_embedded_eoa, embedded_wallet, primary_wallet
        FROM profiles
        WHERE merged_into_profile_id IS NULL
          AND (
            csw_address IS NOT NULL
            OR primary_smart_wallet IS NOT NULL
          )
        ORDER BY id ASC
        LIMIT ${limit};
      `
    : await params.db.sql`
        SELECT id, email, privy_user_id, csw_address, primary_smart_wallet, primary_embedded_eoa, embedded_wallet, primary_wallet
        FROM profiles
        WHERE merged_into_profile_id IS NULL
          AND (
            csw_address IS NOT NULL
            OR primary_smart_wallet IS NOT NULL
          )
        ORDER BY id ASC;
      `

  const audits: ProfileCswAuditRow[] = []
  for (const row of profiles.rows ?? []) {
    const profileId = Number(row.id)
    const canonicalWalletRows = await params.db.sql`
      SELECT address
      FROM profile_wallets
      WHERE profile_id = ${profileId}
        AND is_canonical_smart_wallet = true;
    `
    let zoraCanonicalCsw: string | null = null
    if (typeof row.privy_user_id === 'string' && row.privy_user_id.trim()) {
      const zora = await params.db.sql`
        SELECT canonical_csw_address
        FROM account_zora_signals
        WHERE privy_user_id = ${row.privy_user_id}
        LIMIT 1;
      `.catch(() => ({ rows: [] as any[] }))
      zoraCanonicalCsw = normalizeAddress(zora.rows?.[0]?.canonical_csw_address)
    }

    const audit = await auditProfileCswRow({
      row,
      hasDeployedBytecode,
      zoraCanonicalCsw,
      canonicalWalletRows: canonicalWalletRows.rows ?? [],
    })
    if (audit) audits.push(audit)
  }
  return audits
}

export async function repairAllProfileCswMixups(params: {
  db: Db
  rpcUrl: string
  apply: boolean
  limit?: number
}): Promise<{ audits: ProfileCswAuditRow[]; repairs: ProfileCswRepairResult[] }> {
  const hasDeployedBytecode = createBytecodeReader(params.rpcUrl)
  const audits = await auditAllProfileCswMixups({
    db: params.db,
    rpcUrl: params.rpcUrl,
    limit: params.limit,
  })
  const repairs: ProfileCswRepairResult[] = []
  for (const audit of audits) {
    repairs.push(
      await repairProfileCswMixup({
        db: params.db,
        audit,
        hasDeployedBytecode,
        apply: params.apply,
      }),
    )
  }
  return { audits, repairs }
}
