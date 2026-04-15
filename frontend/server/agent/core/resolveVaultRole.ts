import type { Address } from 'viem'

import { getKeeprVaultByGroupId, type KeeprVaultRow } from '../../_lib/keeprRegistry.js'
import { isAddressLike } from '../../_lib/infra/trust.js'

export type VaultAccessRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export function normalizeRoleAddress(value: unknown): Address | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!isAddressLike(normalized)) return null
  return normalized as Address
}

export function resolveVaultAccessRoleFromVault(params: {
  wallet: string | null | undefined
  vault: Pick<KeeprVaultRow, 'canonicalOwnerAddress' | 'config'> | null | undefined
  fallbackAdmin?: boolean
}): VaultAccessRole {
  if (params.fallbackAdmin) return 'ADMIN'

  const wallet = normalizeRoleAddress(params.wallet)
  if (!wallet || !params.vault) return 'MEMBER'

  const ownerWallet = normalizeRoleAddress(
    params.vault.canonicalOwnerAddress ?? (params.vault as any)?.config?.roles?.owner,
  )
  if (ownerWallet && wallet === ownerWallet) return 'OWNER'

  const adminWalletsRaw = Array.isArray(params.vault.config?.roles?.admins)
    ? params.vault.config.roles.admins
    : []
  for (const adminWalletRaw of adminWalletsRaw) {
    const adminWallet = normalizeRoleAddress(adminWalletRaw)
    if (adminWallet && wallet === adminWallet) return 'ADMIN'
  }

  return 'MEMBER'
}

export async function resolveVaultAccessRoleByGroupId(params: {
  wallet: string | null | undefined
  groupId: string
  fallbackAdmin?: boolean
}): Promise<VaultAccessRole> {
  const vault = await getKeeprVaultByGroupId(params.groupId)
  return resolveVaultAccessRoleFromVault({
    wallet: params.wallet,
    vault,
    fallbackAdmin: params.fallbackAdmin,
  })
}
