import type { VercelRequest } from '@vercel/node'

import type { WorkspacePermission } from '../../../../server/_lib/workspace/auth.js'
import { requireWorkspacePermission } from '../../../../server/_lib/workspace/auth.js'

export type WorkspaceAccessContext = Awaited<
  ReturnType<typeof requireWorkspacePermission>
> extends infer TResult
  ? TResult extends { ok: true }
    ? TResult
    : never
  : never

export function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function normalizeVaultAddressFromQuery(req: VercelRequest): `0x${string}` | null {
  const fromVault = typeof req.query.vault === 'string' ? req.query.vault : null
  const fromAddress = typeof req.query.address === 'string' ? req.query.address : null
  const raw = (fromVault ?? fromAddress ?? '').trim().toLowerCase()
  return isAddressLike(raw) ? (raw as `0x${string}`) : null
}

export function readStringQuery(req: VercelRequest, key: string): string | null {
  const value = req.query[key]
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  return null
}

export function readNumberQuery(req: VercelRequest, key: string): number | null {
  const value = readStringQuery(req, key)
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function requireWorkspaceAccess(params: {
  req: VercelRequest
  vaultAddress: `0x${string}`
  permission: WorkspacePermission
}): Promise<
  | { ok: true; context: WorkspaceAccessContext }
  | { ok: false; status: number; error: string }
> {
  const access = await requireWorkspacePermission({
    req: params.req,
    vaultAddress: params.vaultAddress,
    permission: params.permission,
  })
  if (!access.ok) {
    return {
      ok: false,
      status: access.status,
      error: access.error,
    }
  }
  return {
    ok: true,
    context: access,
  }
}
