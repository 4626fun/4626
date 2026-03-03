import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { enqueueKeeprAction } from '../../../../server/_lib/keeprRegistry.js'

declare const process: { env: Record<string, string | undefined> }

type EnqueueBody = {
  vaultAddress?: string
  groupId?: string
  actionType?: string | null
  dedupeKey?: string | null
  action?: Record<string, unknown>
}

type EnqueueResponse = {
  id: number
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const secret = process.env.KEEPR_API_KEY
  if (!secret) {
    return res.status(500).json({ success: false, error: 'Server misconfigured' } satisfies ApiEnvelope<never>)
  }
  if ((req.headers.authorization ?? '') !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<EnqueueBody>(req)) ?? {}
  const vaultAddressRaw = typeof body.vaultAddress === 'string' ? body.vaultAddress.trim().toLowerCase() : ''
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : ''
  const actionType = typeof body.actionType === 'string' ? body.actionType.trim() : null
  const dedupeKey = typeof body.dedupeKey === 'string' ? body.dedupeKey.trim() : null
  const action =
    body.action && typeof body.action === 'object' && !Array.isArray(body.action)
      ? body.action
      : null

  if (!isAddressLike(vaultAddressRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid vaultAddress' } satisfies ApiEnvelope<never>)
  }
  if (!groupId) {
    return res.status(400).json({ success: false, error: 'Invalid groupId' } satisfies ApiEnvelope<never>)
  }
  if (!action) {
    return res.status(400).json({ success: false, error: 'Invalid action payload' } satisfies ApiEnvelope<never>)
  }
  if (!actionType) {
    return res.status(400).json({ success: false, error: 'Invalid actionType' } satisfies ApiEnvelope<never>)
  }
  if (dedupeKey !== null && dedupeKey.length === 0) {
    return res.status(400).json({ success: false, error: 'Invalid dedupeKey' } satisfies ApiEnvelope<never>)
  }

  try {
    const { id } = await enqueueKeeprAction({
      vaultAddress: vaultAddressRaw,
      groupId,
      action,
      actionType,
      dedupeKey: dedupeKey || null,
    })
    return res.status(200).json({
      success: true,
      data: { id },
    } satisfies ApiEnvelope<EnqueueResponse>)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}

