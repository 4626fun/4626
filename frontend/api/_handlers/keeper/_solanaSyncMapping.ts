import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
  getDbForCron,
  isDbConfigured,
} from '@4626/server-core'

import { ensureSolanaShareMeshMappingsSchema } from '../../../server/_lib/db/schemaBootstrap.js'
import {
  markSolanaShareMeshMappingApplied,
  markSolanaShareMeshMappingFailed,
  upsertSolanaShareMeshMapping,
} from '../../../server/_lib/onchain/solanaShareMeshMappings.js'

type SyncBody = {
  creatorToken?: string
  shareOft?: string
  shareMeshMint?: string
  sourceSessionId?: string
}

type SyncResult = {
  status: 'completed' | 'failed' | 'skipped_unconfigured'
  mappingId?: number
  reason?: string
  upstreamStatusCode?: number
  upstreamResponse?: unknown
}

function isHexAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

function isSolanaAddress(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const s = value.trim()
  return s.length >= 32 && s.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  if (!requireKeeprApiKey(req, res)) return
  if (!isDbConfigured()) {
    return res.status(200).json({
      success: true,
      data: { status: 'skipped_unconfigured', reason: 'database_not_configured' } satisfies SyncResult,
    } satisfies ApiEnvelope<SyncResult>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as SyncBody | null
  if (!body || !isHexAddress(body.creatorToken) || !isHexAddress(body.shareOft) || !isSolanaAddress(body.shareMeshMint)) {
    return res.status(400).json({
      success: false,
      error: 'creatorToken, shareOft, shareMeshMint are required and must be valid',
    } satisfies ApiEnvelope<never>)
  }

  try {
    const db = await getDbForCron()
    if (!db) {
      return res.status(200).json({
        success: true,
        data: { status: 'skipped_unconfigured', reason: 'database_unavailable' } satisfies SyncResult,
      } satisfies ApiEnvelope<SyncResult>)
    }
    await ensureSolanaShareMeshMappingsSchema(db as any)

    const mapping = await upsertSolanaShareMeshMapping({
      db: db as any,
      creatorToken: body.creatorToken,
      shareOft: body.shareOft,
      shareMeshMint: body.shareMeshMint,
      sourceSessionId: body.sourceSessionId ?? null,
    })

    const orchestratorUrl = String(process.env.SOLANA_ORCHESTRATOR_URL ?? '').trim().replace(/\/$/, '')
    if (!orchestratorUrl) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'skipped_unconfigured',
          mappingId: mapping.id,
          reason: 'solana_orchestrator_not_configured',
        } satisfies SyncResult,
      } satisfies ApiEnvelope<SyncResult>)
    }

    const upstream = await fetch(`${orchestratorUrl}/reconcile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.SOLANA_ORCHESTRATOR_API_KEY
          ? { Authorization: `Bearer ${process.env.SOLANA_ORCHESTRATOR_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        workflow: 'solana-share-mesh-sync',
        action: 'sync_mapping',
        checkpointKey: `shareoft:${String(body.shareOft).toLowerCase()}`,
        payload: {
          creatorToken: String(body.creatorToken).toLowerCase(),
          shareOft: String(body.shareOft).toLowerCase(),
          shareMeshMint: body.shareMeshMint.trim(),
          sourceSessionId: body.sourceSessionId ?? null,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    })
    const upstreamResponse = await upstream.json().catch(async () => {
      const text = await upstream.text().catch(() => '')
      return { text }
    })

    if (upstream.ok) {
      await markSolanaShareMeshMappingApplied({ db: db as any, shareOft: body.shareOft })
      return res.status(200).json({
        success: true,
        data: {
          status: 'completed',
          mappingId: mapping.id,
          upstreamStatusCode: upstream.status,
          upstreamResponse,
        } satisfies SyncResult,
      } satisfies ApiEnvelope<SyncResult>)
    }

    const errorMessage =
      typeof upstreamResponse === 'string' ? upstreamResponse : JSON.stringify(upstreamResponse ?? {})
    await markSolanaShareMeshMappingFailed({
      db: db as any,
      shareOft: body.shareOft,
      error: `orchestrator_sync_failed:${upstream.status}:${errorMessage}`,
    })
    return res.status(200).json({
      success: true,
      data: {
        status: 'failed',
        mappingId: mapping.id,
        upstreamStatusCode: upstream.status,
        upstreamResponse,
      } satisfies SyncResult,
    } satisfies ApiEnvelope<SyncResult>)
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    } satisfies ApiEnvelope<never>)
  }
}
