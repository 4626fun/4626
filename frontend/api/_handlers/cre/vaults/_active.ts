/**
 * GET /api/cre/vaults/active
 *
 * Returns all registered vaults with their contract addresses for CRE workflows.
 * Protected by KEEPR_API_KEY Bearer token.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { getDb, isDbConfigured } from '../../../../server/_lib/postgres.js'
import { ensureKeeprSchema } from '../../../../server/_lib/keeprSchema.js'

export interface VaultConfig {
  vaultAddress: `0x${string}`
  chainId: number
  creatorCoinAddress: `0x${string}`
  ccaStrategyAddress?: `0x${string}`
  oracleAddress?: `0x${string}`
  vrfHubAddress?: `0x${string}`
  groupId: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Auth check
  const secret = process.env.KEEPR_API_KEY
  if (!secret) {
    return res.status(500).json({ success: false, error: 'KEEPR_API_KEY not configured' } satisfies ApiEnvelope<never>)
  }

  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== secret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }

  try {
    await ensureKeeprSchema()
    const db = await getDb()
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
    }

    const chainId = req.query.chainId ? Number(req.query.chainId) : null

    const result = chainId
      ? await db.sql`
          SELECT vault_address, chain_id, creator_coin_address, group_id, config_json
          FROM keepr_vaults
          WHERE chain_id = ${chainId}
          ORDER BY created_at ASC;
        `
      : await db.sql`
          SELECT vault_address, chain_id, creator_coin_address, group_id, config_json
          FROM keepr_vaults
          ORDER BY created_at ASC;
        `

    const vaults: VaultConfig[] = result.rows.map((row: any) => {
      const configJson = typeof row.config_json === 'string'
        ? JSON.parse(row.config_json)
        : row.config_json ?? {}
      const contracts = configJson.contracts ?? {}

      return {
        vaultAddress: row.vault_address as `0x${string}`,
        chainId: Number(row.chain_id),
        creatorCoinAddress: row.creator_coin_address as `0x${string}`,
        groupId: String(row.group_id),
        ...(contracts.ccaStrategy ? { ccaStrategyAddress: contracts.ccaStrategy } : {}),
        ...(contracts.oracle ? { oracleAddress: contracts.oracle } : {}),
        ...(contracts.vrfHub ? { vrfHubAddress: contracts.vrfHub } : {}),
      }
    })

    return res.status(200).json({
      success: true,
      data: { vaults, count: vaults.length },
    } satisfies ApiEnvelope<{ vaults: VaultConfig[]; count: number }>)
  } catch (err) {
    console.error('[cre/vaults/active] Error:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    } satisfies ApiEnvelope<never>)
  }
}
