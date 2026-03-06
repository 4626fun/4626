import type { VercelRequest, VercelResponse } from '@vercel/node'
import { type ApiEnvelope, handleOptions, setCors } from '../../../server/auth/_shared.js'
import { getDb, isDbConfigured } from '../../../server/_lib/postgres.js'
import { ensureKeeprSchema } from '../../../server/_lib/keeprSchema.js'

export interface VaultConfig {
  vaultAddress: `0x${string}`
  chainId: number
  creatorCoinAddress: `0x${string}`
  ccaStrategyAddress?: `0x${string}`
  oracleAddress?: `0x${string}`
  vrfHubAddress?: `0x${string}`
  gaugeControllerAddress?: `0x${string}`
  burnStreamAddress?: `0x${string}`
  groupId: string
  graduatedAt?: string | null
  settledAt?: string | null
}

function setCache(res: VercelResponse, seconds: number = 60) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setCache(res, 60)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
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

    const chainIdRaw = req.query.chainId ? Number(req.query.chainId) : null
    const chainId = chainIdRaw && Number.isFinite(chainIdRaw) ? chainIdRaw : null
    const settledFilter = req.query.settled as string | undefined

    const hasChainFilter = chainId !== null
    const hasSettledFalse = settledFilter === 'false'
    const hasSettledTrue = settledFilter === 'true'

    let result
    if (hasChainFilter && hasSettledFalse) {
      result = await db.sql`
        SELECT vault_address, chain_id, creator_coin_address, group_id, config_json,
               graduated_at, settled_at
        FROM keepr_vaults
        WHERE chain_id = ${chainId} AND settled_at IS NULL
        ORDER BY created_at ASC;
      `
    } else if (hasChainFilter && hasSettledTrue) {
      result = await db.sql`
        SELECT vault_address, chain_id, creator_coin_address, group_id, config_json,
               graduated_at, settled_at
        FROM keepr_vaults
        WHERE chain_id = ${chainId} AND settled_at IS NOT NULL
        ORDER BY created_at ASC;
      `
    } else if (hasChainFilter) {
      result = await db.sql`
        SELECT vault_address, chain_id, creator_coin_address, group_id, config_json,
               graduated_at, settled_at
        FROM keepr_vaults
        WHERE chain_id = ${chainId}
        ORDER BY created_at ASC;
      `
    } else if (hasSettledFalse) {
      result = await db.sql`
        SELECT vault_address, chain_id, creator_coin_address, group_id, config_json,
               graduated_at, settled_at
        FROM keepr_vaults
        WHERE settled_at IS NULL
        ORDER BY created_at ASC;
      `
    } else if (hasSettledTrue) {
      result = await db.sql`
        SELECT vault_address, chain_id, creator_coin_address, group_id, config_json,
               graduated_at, settled_at
        FROM keepr_vaults
        WHERE settled_at IS NOT NULL
        ORDER BY created_at ASC;
      `
    } else {
      result = await db.sql`
        SELECT vault_address, chain_id, creator_coin_address, group_id, config_json,
               graduated_at, settled_at
        FROM keepr_vaults
        ORDER BY created_at ASC;
      `
    }

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
        graduatedAt: row.graduated_at ? new Date(row.graduated_at).toISOString() : null,
        settledAt: row.settled_at ? new Date(row.settled_at).toISOString() : null,
        ...(contracts.ccaStrategy ? { ccaStrategyAddress: contracts.ccaStrategy } : {}),
        ...(contracts.oracle ? { oracleAddress: contracts.oracle } : {}),
        ...(contracts.vrfHub ? { vrfHubAddress: contracts.vrfHub } : {}),
        ...(contracts.gaugeController ? { gaugeControllerAddress: contracts.gaugeController } : {}),
        ...(contracts.burnStream ? { burnStreamAddress: contracts.burnStream } : {}),
      }
    })

    return res.status(200).json({
      success: true,
      data: { vaults, count: vaults.length },
    } satisfies ApiEnvelope<{ vaults: VaultConfig[]; count: number }>)
  } catch (err) {
    console.error('[vaults/active] Error:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    } satisfies ApiEnvelope<never>)
  }
}
