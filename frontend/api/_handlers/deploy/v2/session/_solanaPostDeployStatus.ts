import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAddress } from 'viem'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getDbForCron,
  isDbConfigured,
} from '@4626/server-core'

import { getDeploySessionById } from '../../../../../server/_lib/deploy/deploySessions.js'
import { readSolanaPostDeployStatus } from '../../../../../server/_lib/deploy/solanaPostDeployStatus.js'
import { bytes32HexToSolanaPubkey } from '../../../../../server/_lib/onchain/solanaBridgePubkey.js'
import {
  DeploySessionAccessError,
  loadAuthorizedDeploySession,
  normalizeDeploySessionId,
} from './_sessionAccess.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

function readString(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim() : ''
  return s.length > 0 ? s : null
}

function readOvaultEnabled(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return true
  const ovault = (payload as Record<string, unknown>).ovault
  if (!ovault || typeof ovault !== 'object' || Array.isArray(ovault)) return true
  if ((ovault as Record<string, unknown>).enabled === false) return false
  return true
}

function readShareMeshMintHint(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const ovault = (payload as Record<string, unknown>).ovault
  if (!ovault || typeof ovault !== 'object' || Array.isArray(ovault)) return null
  return readString((ovault as Record<string, unknown>).shareMeshMint)
}

function readOvaultString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const ovault = (payload as Record<string, unknown>).ovault
  if (!ovault || typeof ovault !== 'object' || Array.isArray(ovault)) return null
  return readString((ovault as Record<string, unknown>)[key])
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<null>)
  }

  const body = await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })
  const sessionId = normalizeDeploySessionId(body?.sessionId)
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'Missing or invalid sessionId' } satisfies ApiEnvelope<null>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<null>)
  }

  try {
    const access = await loadAuthorizedDeploySession({
      req,
      sessionId,
      getDeploySessionById,
    })
    const rec = access.rec
    const payload = rec.payload && typeof rec.payload === 'object' ? rec.payload : {}
    const artifacts =
      rec.artifacts && typeof rec.artifacts === 'object' && !Array.isArray(rec.artifacts)
        ? (rec.artifacts as Record<string, unknown>)
        : {}

    const creatorToken =
      readString(artifacts.creatorToken) ??
      readString(artifacts.creatorCoin) ??
      readString(body?.creatorToken)
    const shareOft = readString(artifacts.shareOFT) ?? readString(artifacts.shareOft) ?? readString(body?.shareOft)
    if (creatorToken && !isAddress(creatorToken)) {
      return res.status(400).json({ success: false, error: 'Invalid creatorToken' } satisfies ApiEnvelope<null>)
    }
    if (shareOft && !isAddress(shareOft)) {
      return res.status(400).json({ success: false, error: 'Invalid shareOft' } satisfies ApiEnvelope<null>)
    }

    const db = await getDbForCron()
    if (!db) {
      return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<null>)
    }

    const status = await readSolanaPostDeployStatus({
      db: db as any,
      sessionId,
      deployStep: rec.step,
      deployState: rec.state,
      creatorToken,
      shareOft,
      shareMeshMintHint: readShareMeshMintHint(payload),
      shareMeshOftStoreHint: readOvaultString(payload, 'shareMeshOftStore'),
      hookMintHint: readOvaultString(payload, 'hookMint') ?? readOvaultString(payload, 'transferHookMint'),
      meteoraAlphaVaultHint:
        readOvaultString(payload, 'meteoraAlphaVaultPubkey') ??
        bytes32HexToSolanaPubkey(readOvaultString(payload, 'meteoraAlphaVault')),
      ovaultEnabled: readOvaultEnabled(payload),
    })

    return res.status(200).json({ success: true, data: status } satisfies ApiEnvelope<typeof status>)
  } catch (error) {
    if (error instanceof DeploySessionAccessError) {
      return res.status(error.status).json({ success: false, error: error.message } satisfies ApiEnvelope<null>)
    }
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    } satisfies ApiEnvelope<null>)
  }
}
