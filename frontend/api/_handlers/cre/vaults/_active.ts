/**
 * GET /api/cre/vaults/active
 *
 * Returns all registered vaults with their contract addresses for CRE workflows.
 * Protected by KEEPR_API_KEY Bearer token.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { listKeeprVaultAutomationByVaultAddresses } from '../../../../server/_lib/keeprAutomation.js'
import { getDb, isDbConfigured } from '../../../../server/_lib/postgres.js'
import { ensureKeeprSchema } from '../../../../server/_lib/keeprSchema.js'
import { validateCreatorRegistryBinding } from '../../../../server/_lib/creatorRegistryVerification.js'

export interface VaultAutomationConfig {
  automationEnabled: boolean
  automationScope?: string
  canonicalCswAddress?: `0x${string}` | null
  embeddedEoaAddress?: `0x${string}` | null
  privyWalletId?: string | null
}

export interface VaultConfig {
  vaultAddress: `0x${string}`
  chainId: number
  creatorCoinAddress: `0x${string}`
  shareTokenAddress?: `0x${string}`
  ccaStrategyAddress?: `0x${string}`
  oracleAddress?: `0x${string}`
  vrfHubAddress?: `0x${string}`
  gaugeControllerAddress?: `0x${string}`
  burnStreamAddress?: `0x${string}`
  payoutRouterAddress?: `0x${string}`
  groupId: string
  graduatedAt?: string | null
  settledAt?: string | null
  settlementStage?: string | null
  automation: VaultAutomationConfig
}

function toHexAddressOrNull(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return null
  return normalized as `0x${string}`
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

    const chainIdRaw = req.query.chainId ? Number(req.query.chainId) : null
    const chainId = chainIdRaw && Number.isFinite(chainIdRaw) ? chainIdRaw : null
    const settledFilter = req.query.settled as string | undefined

    // Use parameterized queries — pick the right branch to avoid db.sql.unsafe()
    const hasChainFilter = chainId !== null
    const hasSettledFalse = settledFilter === 'false'
    const hasSettledTrue = settledFilter === 'true'

    let result
    if (hasChainFilter && hasSettledFalse) {
      result = await db.sql`
        SELECT vault_address, chain_id, creator_coin_address, share_token_address, group_id, config_json,
               graduated_at, settled_at, settlement_stage
        FROM keepr_vaults
        WHERE chain_id = ${chainId} AND settled_at IS NULL
        ORDER BY created_at ASC;
      `
    } else if (hasChainFilter && hasSettledTrue) {
      result = await db.sql`
        SELECT vault_address, chain_id, creator_coin_address, share_token_address, group_id, config_json,
               graduated_at, settled_at, settlement_stage
        FROM keepr_vaults
        WHERE chain_id = ${chainId} AND settled_at IS NOT NULL
        ORDER BY created_at ASC;
      `
    } else if (hasChainFilter) {
      result = await db.sql`
        SELECT vault_address, chain_id, creator_coin_address, share_token_address, group_id, config_json,
               graduated_at, settled_at, settlement_stage
        FROM keepr_vaults
        WHERE chain_id = ${chainId}
        ORDER BY created_at ASC;
      `
    } else if (hasSettledFalse) {
      result = await db.sql`
        SELECT vault_address, chain_id, creator_coin_address, share_token_address, group_id, config_json,
               graduated_at, settled_at, settlement_stage
        FROM keepr_vaults
        WHERE settled_at IS NULL
        ORDER BY created_at ASC;
      `
    } else if (hasSettledTrue) {
      result = await db.sql`
        SELECT vault_address, chain_id, creator_coin_address, share_token_address, group_id, config_json,
               graduated_at, settled_at, settlement_stage
        FROM keepr_vaults
        WHERE settled_at IS NOT NULL
        ORDER BY created_at ASC;
      `
    } else {
      result = await db.sql`
        SELECT vault_address, chain_id, creator_coin_address, share_token_address, group_id, config_json,
               graduated_at, settled_at, settlement_stage
        FROM keepr_vaults
        ORDER BY created_at ASC;
      `
    }

    type VerifiedVaultRow = {
      row: any
      configJson: Record<string, unknown>
      shareTokenAddress: string | null
    }

    const verifiedRows: VerifiedVaultRow[] = []
    for (const row of result.rows as any[]) {
      const configJson = typeof row.config_json === 'string'
        ? JSON.parse(row.config_json)
        : row.config_json ?? {}
      const configVault = (configJson as any)?.vault ?? {}
      const shareTokenAddress =
        typeof configVault.shareTokenAddress === 'string'
          ? String(configVault.shareTokenAddress).trim()
          : typeof row.share_token_address === 'string'
            ? String(row.share_token_address).trim()
            : null

      let registryValidation
      try {
        registryValidation = await validateCreatorRegistryBinding({
          creatorCoinAddress: String(row.creator_coin_address ?? ''),
          vaultAddress: String(row.vault_address ?? ''),
          shareTokenAddress,
        })
      } catch (err) {
        console.error('[cre/vaults/active] Registry verification unavailable:', err)
        return res.status(503).json({
          success: false,
          error: 'Onchain registry verification unavailable',
        } satisfies ApiEnvelope<never>)
      }

      if (!registryValidation.ok) {
        console.warn(
          '[cre/vaults/active] Skipping vault due to registry mismatch',
          {
            vaultAddress: String(row.vault_address ?? '').toLowerCase(),
            reason: registryValidation.reason,
          },
        )
        continue
      }

      verifiedRows.push({
        row,
        configJson: configJson as Record<string, unknown>,
        shareTokenAddress,
      })
    }

    const automationRows = await listKeeprVaultAutomationByVaultAddresses(
      verifiedRows.map((entry) => String(entry.row.vault_address).toLowerCase() as `0x${string}`),
    )
    const automationByVault = new Map(automationRows.map((row) => [row.vaultAddress, row]))

    const vaults: VaultConfig[] = verifiedRows.map(({ row, configJson, shareTokenAddress }) => {
      const contracts = ((configJson as any).contracts ?? {}) as Record<string, unknown>
      const vaultAddress = String(row.vault_address).toLowerCase() as `0x${string}`
      const automation = automationByVault.get(vaultAddress)
      const ccaStrategyAddress = toHexAddressOrNull(contracts.ccaStrategy)
      const oracleAddress = toHexAddressOrNull(contracts.oracle)
      const vrfHubAddress = toHexAddressOrNull(contracts.vrfHub)
      const gaugeControllerAddress = toHexAddressOrNull(contracts.gaugeController)
      const burnStreamAddress = toHexAddressOrNull(contracts.burnStream)
      const payoutRouterAddress = toHexAddressOrNull(contracts.payoutRouter)

      return {
        vaultAddress,
        chainId: Number(row.chain_id),
        creatorCoinAddress: row.creator_coin_address as `0x${string}`,
        ...(shareTokenAddress ? { shareTokenAddress: shareTokenAddress.toLowerCase() as `0x${string}` } : {}),
        groupId: String(row.group_id),
        graduatedAt: row.graduated_at ? new Date(row.graduated_at).toISOString() : null,
        settledAt: row.settled_at ? new Date(row.settled_at).toISOString() : null,
        settlementStage: typeof row.settlement_stage === 'string' ? row.settlement_stage : null,
        automation: automation
          ? {
              automationEnabled: automation.automationEnabled,
              ...(automation.automationScope ? { automationScope: automation.automationScope } : {}),
              canonicalCswAddress: automation.canonicalCswAddress ?? null,
              embeddedEoaAddress: automation.embeddedEoaAddress ?? null,
              privyWalletId: automation.privyWalletId ?? null,
            }
          : {
              automationEnabled: false,
            },
        ...(ccaStrategyAddress ? { ccaStrategyAddress } : {}),
        ...(oracleAddress ? { oracleAddress } : {}),
        ...(vrfHubAddress ? { vrfHubAddress } : {}),
        ...(gaugeControllerAddress ? { gaugeControllerAddress } : {}),
        ...(burnStreamAddress ? { burnStreamAddress } : {}),
        ...(payoutRouterAddress ? { payoutRouterAddress } : {}),
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
