import { getKeeprVaultByVaultAddress } from '../keepr/keeprRegistry.js'
import { isCswOwner } from '../wallet/cswOwner.js'
import { isWaitlistSubaccountFlowEnabled } from '../wallet/waitlistSubaccountFlowEnv.js'
import {
  resolveWaitlistChatEligibilitySnapshot,
  type WaitlistChatEligibilitySnapshot,
} from './waitlistXmtpChatEligibility.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export const WAITLIST_CHAT_VAULT_ADDRESS = '0x0000000000000000000000000000000000004626' as const

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export function normalizeWaitlistChatAddress(value: unknown): `0x${string}` | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!ADDRESS_RE.test(raw)) return null
  return raw as `0x${string}`
}

export function getWaitlistGroupId(): string | null {
  const groupId = String(process.env.WAITLIST_XMTP_GROUP_ID ?? '').trim()
  return groupId.length > 0 ? groupId : null
}



export type WaitlistGroupIdResolution = {
  groupId: string | null
  source: 'vault' | 'env' | null
  envGroupId: string | null
  vaultGroupId: string | null
  mismatched: boolean
}

/** Keepr executes against the vault row's group_id; prefer that over env drift. */
export async function resolveWaitlistGroupId(): Promise<WaitlistGroupIdResolution> {
  const envGroupId = getWaitlistGroupId()
  const vault = await getKeeprVaultByVaultAddress(WAITLIST_CHAT_VAULT_ADDRESS)
  const vaultGroupId = vault?.groupId?.trim() ? vault.groupId.trim() : null

  if (vaultGroupId) {
    return {
      groupId: vaultGroupId,
      source: 'vault',
      envGroupId,
      vaultGroupId,
      mismatched: Boolean(envGroupId && envGroupId !== vaultGroupId),
    }
  }

  return {
    groupId: envGroupId,
    source: envGroupId ? 'env' : null,
    envGroupId,
    vaultGroupId: null,
    mismatched: false,
  }
}

export function getWaitlistGroupName(): string {
  const configured = String(process.env.WAITLIST_XMTP_GROUP_NAME ?? '').trim()
  return configured.length > 0 ? configured : 'Waitlist chat'
}

export async function isWaitlistChatVaultConfigured(): Promise<boolean> {
  const vault = await getKeeprVaultByVaultAddress(WAITLIST_CHAT_VAULT_ADDRESS)
  return Boolean(vault)
}

export type WaitlistChatEligibility = WaitlistChatEligibilitySnapshot

export async function resolveWaitlistChatEligibility(
  db: Db,
  profileId: number,
): Promise<WaitlistChatEligibility> {
  const profileResult = await db.sql`
    SELECT csw_address, primary_embedded_eoa, base_sub_account
    FROM profiles
    WHERE id = ${profileId}
    LIMIT 1;
  `
  const row = profileResult.rows?.[0] ?? null
  const canonicalCswAddress = normalizeWaitlistChatAddress(row?.csw_address)
  const embeddedEoaAddress = normalizeWaitlistChatAddress(row?.primary_embedded_eoa)
  const baseSubAccountAddress = normalizeWaitlistChatAddress(row?.base_sub_account)

  if (!canonicalCswAddress || !embeddedEoaAddress) {
    return resolveWaitlistChatEligibilitySnapshot({
      canonicalCswAddress,
      embeddedEoaAddress,
      baseSubAccountAddress,
      embeddedIsOwnerOfParent: false,
    })
  }

  try {
    const embeddedIsOwnerOfParent = await isCswOwner(embeddedEoaAddress, canonicalCswAddress)
    return resolveWaitlistChatEligibilitySnapshot({
      canonicalCswAddress,
      embeddedEoaAddress,
      baseSubAccountAddress,
      embeddedIsOwnerOfParent,
      subAccountFlowEnabled: isWaitlistSubaccountFlowEnabled(),
    })
  } catch {
    return resolveWaitlistChatEligibilitySnapshot({
      canonicalCswAddress,
      embeddedEoaAddress,
      baseSubAccountAddress,
      embeddedIsOwnerOfParent: false,
      ownerCheckFailed: true,
      subAccountFlowEnabled: isWaitlistSubaccountFlowEnabled(),
    })
  }
}
