import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  getSessionAddress,
} from '../../../../packages/server-core/src/index.js'

import {
  disableKeeprVaultAutomation,
  getKeeprVaultAutomationByVaultAddress,
  type KeeprVaultAutomationRow,
  upsertKeeprVaultAutomation,
} from '../../../../server/_lib/keeprAutomation.js'
import { getKeeprVaultByVaultAddress } from '../../../../server/_lib/keeprRegistry.js'
import { resolvePersistedWalletIdentity } from '../../../../server/_lib/canonicalWalletResolver.js'


type AutomationBody = {
  vaultAddress?: string
  cswAddress?: string
  embeddedEoaAddress?: string
  privyWalletId?: string
}

type PersistedIdentity = NonNullable<Awaited<ReturnType<typeof resolvePersistedWalletIdentity>>>

const DEFAULT_AUTOMATION_SCOPE = 'ajna_min_bucket_only'

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return isAddressLike(normalized) ? (normalized as `0x${string}`) : null
}

function firstQueryValue(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const first = value[0]
    return typeof first === 'string' ? first : null
  }
  return null
}

async function requireOwnerContext(
  req: VercelRequest,
  vaultAddress: `0x${string}`,
): Promise<
  | { ok: true; actor: string; identity: PersistedIdentity }
  | { ok: false; status: number; error: string }
> {
  const actor = getSessionAddress(req)
  if (!actor) {
    return { ok: false, status: 401, error: 'Sign in required' }
  }

  const identity = await resolvePersistedWalletIdentity(actor)
  if (!identity?.profileId || !identity.canonicalSmartWallet) {
    return { ok: false, status: 403, error: 'OWNER authorization required' }
  }

  const vault = await getKeeprVaultByVaultAddress(vaultAddress)
  if (!vault) {
    return { ok: false, status: 404, error: 'Vault not registered' }
  }

  if (vault.canonicalOwnerAddress.toLowerCase() !== identity.canonicalSmartWallet.toLowerCase()) {
    return { ok: false, status: 403, error: 'OWNER authorization required' }
  }

  return { ok: true, actor, identity }
}

function respondOk(
  res: VercelResponse,
  data: KeeprVaultAutomationRow | null,
) {
  return res.status(200).json({
    success: true,
    data,
  } satisfies ApiEnvelope<KeeprVaultAutomationRow | null>)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (!['GET', 'POST', 'DELETE'].includes(req.method ?? '')) {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  try {
    if (req.method === 'GET') {
      const vaultAddress = normalizeAddress(firstQueryValue(req.query?.vaultAddress ?? req.query?.vault))
      if (!vaultAddress) {
        return res.status(400).json({ success: false, error: 'Invalid vaultAddress' } satisfies ApiEnvelope<never>)
      }

      const ownerContext = await requireOwnerContext(req, vaultAddress)
      if (!ownerContext.ok) {
        return res.status(ownerContext.status).json({ success: false, error: ownerContext.error } satisfies ApiEnvelope<never>)
      }

      const row = await getKeeprVaultAutomationByVaultAddress(vaultAddress)
      return respondOk(res, row)
    }

    const body = (await readJsonBody<AutomationBody>(req)) ?? {}

    if (req.method === 'DELETE') {
      const vaultAddress =
        normalizeAddress(body.vaultAddress) ??
        normalizeAddress(firstQueryValue(req.query?.vaultAddress ?? req.query?.vault))
      if (!vaultAddress) {
        return res.status(400).json({ success: false, error: 'Invalid vaultAddress' } satisfies ApiEnvelope<never>)
      }

      const ownerContext = await requireOwnerContext(req, vaultAddress)
      if (!ownerContext.ok) {
        return res.status(ownerContext.status).json({ success: false, error: ownerContext.error } satisfies ApiEnvelope<never>)
      }

      const row = await disableKeeprVaultAutomation({
        vaultAddress,
        revokedAt: new Date(),
      })
      if (!row) {
        return res.status(404).json({ success: false, error: 'Automation status not found' } satisfies ApiEnvelope<never>)
      }
      return respondOk(res, row)
    }

    const vaultAddressRaw = typeof body.vaultAddress === 'string' ? body.vaultAddress.trim() : ''
    const cswAddressRaw = typeof body.cswAddress === 'string' ? body.cswAddress.trim() : ''
    const embeddedEoaAddressRaw = typeof body.embeddedEoaAddress === 'string' ? body.embeddedEoaAddress.trim() : ''
    const privyWalletId = typeof body.privyWalletId === 'string' ? body.privyWalletId.trim() : ''

    if (!vaultAddressRaw || !cswAddressRaw || !embeddedEoaAddressRaw || !privyWalletId) {
      return res.status(400).json({
        success: false,
        error: 'vaultAddress, cswAddress, embeddedEoaAddress, and privyWalletId are required',
      } satisfies ApiEnvelope<never>)
    }

    const vaultAddress = normalizeAddress(vaultAddressRaw)
    if (!vaultAddress) {
      return res.status(400).json({ success: false, error: 'Invalid vaultAddress' } satisfies ApiEnvelope<never>)
    }

    const cswAddress = normalizeAddress(cswAddressRaw)
    if (!cswAddress) {
      return res.status(400).json({ success: false, error: 'Invalid cswAddress' } satisfies ApiEnvelope<never>)
    }

    const embeddedEoaAddress = normalizeAddress(embeddedEoaAddressRaw)
    if (!embeddedEoaAddress) {
      return res.status(400).json({ success: false, error: 'Invalid embeddedEoaAddress' } satisfies ApiEnvelope<never>)
    }

    const ownerContext = await requireOwnerContext(req, vaultAddress)
    if (!ownerContext.ok) {
      return res.status(ownerContext.status).json({ success: false, error: ownerContext.error } satisfies ApiEnvelope<never>)
    }

    const canonicalSmartWallet = ownerContext.identity.canonicalSmartWallet
    if (!canonicalSmartWallet || canonicalSmartWallet.toLowerCase() !== cswAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'cswAddress must match the stored canonical smart wallet for the actor',
      } satisfies ApiEnvelope<never>)
    }

    const embeddedEoa = ownerContext.identity.embeddedEoa
    if (!embeddedEoa || embeddedEoa.toLowerCase() !== embeddedEoaAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'embeddedEoaAddress must match the stored embedded EOA for the actor',
      } satisfies ApiEnvelope<never>)
    }

    const row = await upsertKeeprVaultAutomation({
      vaultAddress,
      profileId: ownerContext.identity.profileId,
      canonicalCswAddress: cswAddress,
      embeddedEoaAddress,
      privyWalletId,
      authorizationSource: 'owner_session',
      automationEnabled: true,
      automationScope: DEFAULT_AUTOMATION_SCOPE,
      lastOwnerCheckAt: new Date(),
      revokedAt: null,
      metadata: {},
    })

    return respondOk(res, row)
  } catch (error) {
    console.error('keepr/vault/automation handler failed', error)
    return res.status(500).json({ success: false, error: 'Internal server error' } satisfies ApiEnvelope<never>)
  }
}
