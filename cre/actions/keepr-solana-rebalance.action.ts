/**
 * Keepr Solana Rebalance Action — bridge liquid CREATOR tokens from the
 * Base-side SolanaStrategy / SolanaBridgeAdapter to the creator's
 * Solana-side destination.
 *
 * This is the post-`rebalanceToSolana` hop. `SolanaStrategy.rebalanceToSolana`
 * only moves tokens from the strategy contract to the adapter on Base; it
 * does NOT cross the bridge. This keeper polls adapter-held balances and
 * dispatches the actual bridge + (optional) Meteora Alpha Vault deposit.
 *
 * Routing policy per creator (driven by `creator_meteora_alpha_vaults` DB
 * row, falling back to env config):
 *
 *   - If `enabled=true` and the row has a valid `meteora_alpha_vault`
 *     pubkey and `deposit_accounts`, call
 *     `SolanaBridgeAdapter.bridgeToSolanaWithIxs(token, amount, dest, ixs)`
 *     so the bridge + Alpha Vault deposit land atomically.
 *   - Otherwise, call `SolanaBridgeAdapter.bridgeToSolana(token, amount, dest)`
 *     where `dest` is the creator's Solana custody wallet (from
 *     `SOLANA_REBALANCE_DESTINATION_MAP_JSON` env or the keeper's own
 *     pubkey). Tokens land in that wallet and can be deployed into
 *     Meteora later once a pool exists.
 *
 * IMPLEMENTATION STATUS: STUB.
 *
 * The action currently iterates creators, checks adapter-held balances,
 * and LOGS what it would dispatch. Actual on-chain dispatch is gated
 * behind the `KEEPR_SOLANA_REBALANCE_EXECUTE=1` env so we don't run
 * half-implemented bridge logic in production. Unblock this by:
 *
 *   1. Wiring `SolanaBridgeAdapter.bridgeToSolana` / `bridgeToSolanaWithIxs`
 *      calls via `writeContract` (see `keepr-solana-settle-fees.action.ts`
 *      for the pattern).
 *   2. Fetching Meteora deposit ix bytes via
 *      `/api/deploy/registerSolanaBridgeToken` with
 *      `creatorToken` + `expectedSolanaAmount` set (the handler already
 *      calls `/meteora-ixs` internally when Meteora config exists).
 *   3. Adding a per-creator daily spend cap + minimum-balance threshold
 *      so we don't thrash the bridge on tiny balances.
 *
 * Design rationale: see `docs/operations/solana-bridge-naming-invariant.md`
 * sections "End-to-end flow" and "Meteora integration runbook".
 */

import { isAddress, type Address, type Hex } from 'viem'

import { requireEnv, CHAINS } from '../config.js'
import { alertInfo } from '../utils/alerts.js'

const WORKFLOW_NAME = 'keepr-solana-rebalance'

/** Minimum adapter-held balance (in CREATOR token base units) before we
 *  consider it worth paying bridge gas for a rebalance. Per-creator
 *  override via `KEEPR_SOLANA_REBALANCE_MIN_AMOUNT_MAP_JSON`. */
const DEFAULT_MIN_REBALANCE_AMOUNT = 1_000_000_000_000_000_000n // 1 token @ 18 decimals

export type RebalancePlanEntry = {
  creatorToken: Address
  adapterBalance: string
  dispatchMode: 'skip_below_threshold' | 'bridge_plain' | 'bridge_with_meteora_ixs'
  destination: string | null
  meteoraAlphaVault: string | null
  notes: string
}

export type RebalanceResult = {
  creatorsScanned: number
  creatorsWithAdapterBalance: number
  plan: RebalancePlanEntry[]
  executed: boolean
}

type CreatorRegistration = {
  creatorToken: Address
  /** Optional Solana custody destination to bridge to when Meteora isn't
   *  configured. Base58 Solana pubkey. */
  destinationPubkey: string | null
  /** If a Meteora Alpha Vault mapping exists for this creator, the
   *  downstream path in step 1 will layer the Alpha Vault deposit ixs in
   *  the same bridge tx via `bridgeToSolanaWithIxs`. */
  meteoraAlphaVault: string | null
}

function readCreatorRegistrations(): CreatorRegistration[] {
  // For stub purposes read from env. Production implementation should
  // query Supabase for every creator in `allowlist` whose vault exists in
  // `CreatorRegistry.getVaultForToken`, then join on
  // `creator_meteora_alpha_vaults` for Meteora destination.
  const raw = String(process.env.KEEPR_SOLANA_REBALANCE_CREATORS_JSON ?? '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Array<Partial<CreatorRegistration>>
    return parsed
      .filter((entry): entry is CreatorRegistration =>
        typeof entry?.creatorToken === 'string' && isAddress(entry.creatorToken),
      )
      .map((entry) => ({
        creatorToken: entry.creatorToken as Address,
        destinationPubkey: entry.destinationPubkey ?? null,
        meteoraAlphaVault: entry.meteoraAlphaVault ?? null,
      }))
  } catch {
    return []
  }
}

function readMinAmount(creatorToken: Address): bigint {
  const mapRaw = String(process.env.KEEPR_SOLANA_REBALANCE_MIN_AMOUNT_MAP_JSON ?? '').trim()
  if (mapRaw) {
    try {
      const map = JSON.parse(mapRaw) as Record<string, string>
      const key = creatorToken.toLowerCase()
      const value = map[key] ?? map[creatorToken]
      if (value) {
        const parsed = BigInt(value)
        if (parsed > 0n) return parsed
      }
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_MIN_REBALANCE_AMOUNT
}

export async function executeSolanaRebalance(): Promise<RebalanceResult> {
  const executeWrites = String(process.env.KEEPR_SOLANA_REBALANCE_EXECUTE ?? '').trim() === '1'
  const adapterAddress = requireEnv('SOLANA_BRIDGE_ADAPTER')
  if (!isAddress(adapterAddress)) {
    throw new Error(`invalid SOLANA_BRIDGE_ADAPTER: ${adapterAddress}`)
  }
  const registrations = readCreatorRegistrations()
  const result: RebalanceResult = {
    creatorsScanned: registrations.length,
    creatorsWithAdapterBalance: 0,
    plan: [],
    executed: false,
  }

  // Minimal ERC20 balanceOf read via the shared onchain helpers. Keeping
  // this as a stub so we don't ship half-wired bridge dispatch; the
  // real iteration + writeContract calls belong here.
  for (const entry of registrations) {
    const minAmount = readMinAmount(entry.creatorToken)
    // TODO (stub): read adapter CREATOR balance for entry.creatorToken via publicClient.
    // Placeholder shape:
    const adapterBalance = 0n
    if (adapterBalance <= minAmount) {
      result.plan.push({
        creatorToken: entry.creatorToken,
        adapterBalance: adapterBalance.toString(),
        dispatchMode: 'skip_below_threshold',
        destination: entry.destinationPubkey,
        meteoraAlphaVault: entry.meteoraAlphaVault,
        notes: `below threshold ${minAmount.toString()}`,
      })
      continue
    }
    result.creatorsWithAdapterBalance += 1
    if (entry.meteoraAlphaVault) {
      result.plan.push({
        creatorToken: entry.creatorToken,
        adapterBalance: adapterBalance.toString(),
        dispatchMode: 'bridge_with_meteora_ixs',
        destination: entry.destinationPubkey ?? entry.meteoraAlphaVault,
        meteoraAlphaVault: entry.meteoraAlphaVault,
        notes:
          'would call adapter.bridgeToSolanaWithIxs(creator, amount, meteoraAlphaVault, ixs[]) — ixs built via /api/deploy/registerSolanaBridgeToken',
      })
    } else {
      result.plan.push({
        creatorToken: entry.creatorToken,
        adapterBalance: adapterBalance.toString(),
        dispatchMode: 'bridge_plain',
        destination: entry.destinationPubkey,
        meteoraAlphaVault: null,
        notes:
          'would call adapter.bridgeToSolana(creator, amount, destination) — no Meteora destination configured for this creator',
      })
    }
  }

  if (executeWrites) {
    // Intentionally not implemented. When wiring the real dispatch,
    // follow the pattern in keepr-solana-settle-fees: writeContract for
    // each non-skip plan entry, alertInfo on success, alertWarning on
    // partial failure. Keep per-tx size bounded so one creator's failure
    // doesn't block the others.
    await alertInfo(WORKFLOW_NAME, 'Rebalance execution requested but handler is a stub; no onchain writes dispatched', {
      planEntries: result.plan.length,
    })
  }

  // Sanity: avoid unused-import warnings in the stub.
  void CHAINS

  return result
}
