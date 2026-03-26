import type { VercelRequest } from '@vercel/node'

import { getKeeprVaultByVaultAddress, type KeeprVaultRow } from '../keeprRegistry.js'
import { readRequestPrincipal, resolveAuthorizedRequestPrincipal } from '../requestPrincipal.js'
import { isServerAdminAddress } from '../trust.js'

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER'
export type WorkspacePermission =
  | 'read'
  | 'strategy_manage'
  | 'tasks_manage'
  | 'settings_manage'
  | 'rooms_manage'
  | 'action_execute_low_risk'
  | 'action_execute_high_risk'

type PermissionResult =
  | {
      ok: true
      role: WorkspaceRole
      principalAddress: `0x${string}`
      vault: KeeprVaultRow
      profileId: number | null
      canonicalSmartWalletAddress: `0x${string}` | null
      activeOwnerWalletAddress: `0x${string}` | null
      signerRole: 'canonical_smart_wallet' | 'active_owner_wallet' | null
    }
  | {
      ok: false
      status: number
      error: string
    }

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return isAddressLike(normalized) ? (normalized as `0x${string}`) : null
}

function inferWorkspaceRole(params: {
  wallet: `0x${string}`
  vault: KeeprVaultRow
  fallbackAdmin: boolean
}): WorkspaceRole {
  if (params.fallbackAdmin) return 'ADMIN'

  const wallet = params.wallet
  const owner =
    normalizeAddress(params.vault.canonicalOwnerAddress) ??
    normalizeAddress((params.vault as any).config?.roles?.owner)
  if (owner && owner === wallet) return 'OWNER'

  const adminsRaw = Array.isArray(params.vault.config?.roles?.admins)
    ? params.vault.config.roles.admins
    : []
  for (const adminRaw of adminsRaw) {
    const admin = normalizeAddress(adminRaw)
    if (admin && admin === wallet) return 'ADMIN'
  }

  const operatorsRaw = Array.isArray(params.vault.config?.roles?.operators)
    ? params.vault.config.roles.operators
    : []
  for (const operatorRaw of operatorsRaw) {
    const operator = normalizeAddress(operatorRaw)
    if (operator && operator === wallet) return 'OPERATOR'
  }

  return 'VIEWER'
}

export function roleCan(params: { role: WorkspaceRole; permission: WorkspacePermission }): boolean {
  const { role, permission } = params
  if (permission === 'read') return true

  if (permission === 'settings_manage' || permission === 'rooms_manage' || permission === 'action_execute_high_risk') {
    return role === 'OWNER' || role === 'ADMIN'
  }

  if (
    permission === 'strategy_manage' ||
    permission === 'tasks_manage' ||
    permission === 'action_execute_low_risk'
  ) {
    return role === 'OWNER' || role === 'ADMIN' || role === 'OPERATOR'
  }

  return false
}

export async function requireWorkspacePermission(params: {
  req: VercelRequest
  vaultAddress: `0x${string}`
  permission: WorkspacePermission
}): Promise<PermissionResult> {
  const vault = await getKeeprVaultByVaultAddress(params.vaultAddress)
  if (!vault) {
    return { ok: false, status: 404, error: 'Vault is not registered for workspace access' }
  }

  const principal = readRequestPrincipal(params.req, { lowercase: true })
  if (!principal || !isAddressLike(principal.address)) {
    return { ok: false, status: 401, error: 'Authentication required' }
  }

  const principalAddress = principal.address.toLowerCase() as `0x${string}`
  const fallbackAdmin = isServerAdminAddress(principalAddress)
  const role = inferWorkspaceRole({
    wallet: principalAddress,
    vault,
    fallbackAdmin,
  })

  if (!roleCan({ role, permission: params.permission })) {
    return { ok: false, status: 403, error: `Role ${role} cannot perform ${params.permission}` }
  }

  // For mutating actions, require canonical identity resolution unless caller is a server admin.
  const requiresIdentityProof = params.permission !== 'read' && !fallbackAdmin
  if (requiresIdentityProof) {
    const authorized = await resolveAuthorizedRequestPrincipal(params.req, { lowercase: true })
    if (!authorized) {
      return { ok: false, status: 403, error: 'Canonical identity resolution required for workspace mutations' }
    }
    return {
      ok: true,
      role,
      principalAddress,
      vault,
      profileId: authorized.profileId,
      canonicalSmartWalletAddress: normalizeAddress(authorized.canonicalSmartWalletAddress),
      activeOwnerWalletAddress: normalizeAddress(authorized.activeOwnerWalletAddress),
      signerRole: authorized.signerRole,
    }
  }

  return {
    ok: true,
    role,
    principalAddress,
    vault,
    profileId: null,
    canonicalSmartWalletAddress: null,
    activeOwnerWalletAddress: null,
    signerRole: null,
  }
}
