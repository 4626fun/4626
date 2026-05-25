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
 * IMPLEMENTATION STATUS: plain-bridge path is LIVE; Meteora-ixs path is
 * stubbed (requires an Alpha Vault deposit-ix builder we haven't shipped
 * yet; tracked as follow-up in `docs/operations/solana-bridge-naming-invariant.md`).
 *
 * Actual on-chain dispatch is gated behind the
 * `KPR_SOLANA_REBALANCE_EXECUTE=1` env so dry-running the keeper
 * produces only a plan, never an onchain write. Set that env to `1` AND
 * configure the destination map before enabling in production.
 */

import { getAddress, isAddress, parseAbi, type Abi, type Address } from 'viem'

import { requireEnv, SOLANA_BRIDGE_ADAPTER_ABI } from '../config.js'
import { alertCritical, alertInfo, alertWarning } from '../utils/alerts.js'
import { getPublicClient, writeContract } from '../utils/onchain.js'
import {
  normalizeSolanaBridgeAdapter,
  readLegacySolanaBridgeAdaptersFromEnv,
} from '../utils/solanaCanonicalAddresses.js'
import { solanaPubkeyToBytes32 } from '../utils/solana.js'

const WORKFLOW_NAME = 'keepr-solana-rebalance'

/** Minimum adapter-held balance (in CREATOR token base units) before we
 *  consider it worth paying bridge gas for a rebalance. Per-creator
 *  override via `KPR_SOLANA_REBALANCE_MIN_AMOUNT_MAP_JSON`. */
const DEFAULT_MIN_REBALANCE_AMOUNT = 1_000_000_000_000_000_000n // 1 token @ 18 decimals

/**
 * ERC-20 ABI fragment — minimum needed to read the adapter's held balance
 * of each creator's coin.
 */
const ERC20_BALANCE_ABI = parseAbi([
  'function balanceOf(address owner) external view returns (uint256)',
])

/**
 * Extended bridge ABI. `SOLANA_BRIDGE_ADAPTER_ABI` in `kpr/config.ts`
 * covers the lottery + fee relay surface; here we add the outbound
 * bridge calls this keeper dispatches. Written as explicit JSON rather
 * than `parseAbi` so the nested struct for Meteora ixs is
 * unambiguous.
 */
const SOLANA_BRIDGE_OUTBOUND_ABI = [
  {
    type: 'function',
    name: 'bridgeToSolana',
    stateMutability: 'payable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'solanaDestination', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'bridgeToSolanaWithIxs',
    stateMutability: 'payable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'solanaDestination', type: 'bytes32' },
      {
        name: 'ixs',
        type: 'tuple[]',
        components: [
          { name: 'programId', type: 'bytes32' },
          { name: 'serializedAccounts', type: 'bytes' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
] as const

const SOLANA_STRATEGY_BRIDGE_ABI = [
  {
    type: 'function',
    name: 'bridgeAdapter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

export type RebalancePlanEntry = {
  creatorToken: Address
  adapterBalance: string
  /** Adapter that holds the balance and receives bridgeToSolana. */
  bridgeAdapter?: Address
  dispatchMode: 'skip_below_threshold' | 'bridge_plain' | 'bridge_with_meteora_ixs'
  destination: string | null
  meteoraAlphaVault: string | null
  notes: string
  /** Populated after a broadcast attempt when `executeWrites=true`. */
  txHash?: string
  /** Populated when a broadcast attempt failed. */
  txError?: string
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
   *  downstream path will layer the Alpha Vault deposit ixs in the same
   *  bridge tx via `bridgeToSolanaWithIxs`. */
  meteoraAlphaVault: string | null
  /** Override bridge adapter when the vault strategy still points at legacy infra. */
  bridgeAdapter?: Address | null
  /** Optional on-chain SolanaStrategy address — bridgeAdapter() is read when set. */
  solanaStrategyAddress?: Address | null
}

function uniqueAddresses(values: Array<Address | null | undefined>): Address[] {
  const out: Address[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (!value || !isAddress(value)) continue
    const normalized = getAddress(value).toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    out.push(getAddress(value))
  }
  return out
}

export async function resolveBridgeAdapterCandidates(params: {
  canonicalAdapter: Address
  registration: CreatorRegistration
  publicClient: ReturnType<typeof getPublicClient>
}): Promise<Address[]> {
  const { canonicalAdapter, registration, publicClient } = params
  let strategyAdapter: Address | null = null
  if (registration.solanaStrategyAddress && isAddress(registration.solanaStrategyAddress)) {
    try {
      strategyAdapter = getAddress(
        (await publicClient.readContract({
          address: getAddress(registration.solanaStrategyAddress),
          abi: SOLANA_STRATEGY_BRIDGE_ABI,
          functionName: 'bridgeAdapter',
        })) as Address,
      )
    } catch {
      strategyAdapter = null
    }
  }

  return uniqueAddresses([
    registration.bridgeAdapter ?? null,
    strategyAdapter,
    canonicalAdapter,
    ...readLegacySolanaBridgeAdaptersFromEnv(),
  ])
}

export async function findLargestAdapterBalance(params: {
  creatorToken: Address
  adapters: Address[]
  publicClient: ReturnType<typeof getPublicClient>
}): Promise<{ adapter: Address; balance: bigint } | null> {
  let best: { adapter: Address; balance: bigint } | null = null
  for (const adapter of params.adapters) {
    try {
      const balance = (await params.publicClient.readContract({
        address: params.creatorToken,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf',
        args: [adapter],
      })) as bigint
      if (!best || balance > best.balance) {
        best = { adapter, balance }
      }
    } catch {
      // skip unreadable adapter
    }
  }
  return best
}

function readCreatorRegistrations(): CreatorRegistration[] {
  // Stub reads from env. Production will query Supabase for every creator
  // in `allowlist` whose vault exists in `CreatorRegistry.getVaultForToken`,
  // then join on `creator_meteora_alpha_vaults` for the Meteora destination.
  const raw = String(process.env.KPR_SOLANA_REBALANCE_CREATORS_JSON ?? '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Array<Partial<CreatorRegistration>>
    return parsed
      .filter((entry): entry is CreatorRegistration =>
        typeof entry?.creatorToken === 'string' && isAddress(entry.creatorToken),
      )
      .map((entry) => ({
        creatorToken: getAddress(entry.creatorToken as Address),
        destinationPubkey: entry.destinationPubkey ?? null,
        meteoraAlphaVault: entry.meteoraAlphaVault ?? null,
        bridgeAdapter:
          typeof entry.bridgeAdapter === 'string' && isAddress(entry.bridgeAdapter)
            ? getAddress(entry.bridgeAdapter)
            : null,
        solanaStrategyAddress:
          typeof entry.solanaStrategyAddress === 'string' && isAddress(entry.solanaStrategyAddress)
            ? getAddress(entry.solanaStrategyAddress)
            : null,
      }))
  } catch {
    return []
  }
}

function readMinAmount(creatorToken: Address): bigint {
  const mapRaw = String(process.env.KPR_SOLANA_REBALANCE_MIN_AMOUNT_MAP_JSON ?? '').trim()
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

/**
 * Bridge-fee override in wei. Most Base-side LayerZero-backed bridges
 * can run with `msg.value = 0` when the fee is either baked into the
 * bridge config or pre-paid. If the bridge starts rejecting 0-value,
 * set this env (e.g. "100000000000000" for 0.0001 ETH).
 */
function readBridgeFeeValueWei(): bigint {
  const raw = String(process.env.KPR_SOLANA_REBALANCE_FEE_WEI ?? '0').trim()
  try {
    const parsed = BigInt(raw)
    return parsed >= 0n ? parsed : 0n
  } catch {
    return 0n
  }
}

export async function executeSolanaRebalance(): Promise<RebalanceResult> {
  const executeWrites = String(process.env.KPR_SOLANA_REBALANCE_EXECUTE ?? '').trim() === '1'
  const adapterAddressRaw = requireEnv('SOLANA_BRIDGE_ADAPTER')
  if (!isAddress(adapterAddressRaw)) {
    throw new Error(`invalid SOLANA_BRIDGE_ADAPTER: ${adapterAddressRaw}`)
  }
  const canonicalAdapter = getAddress(normalizeSolanaBridgeAdapter(adapterAddressRaw))
  const publicClient = getPublicClient()
  const bridgeFeeValue = readBridgeFeeValueWei()
  const registrations = readCreatorRegistrations()

  const result: RebalanceResult = {
    creatorsScanned: registrations.length,
    creatorsWithAdapterBalance: 0,
    plan: [],
    executed: false,
  }

  for (const entry of registrations) {
    const minAmount = readMinAmount(entry.creatorToken)
    const adapterCandidates = await resolveBridgeAdapterCandidates({
      canonicalAdapter,
      registration: entry,
      publicClient,
    })

    let adapterBalance: bigint
    let adapterAddress: Address
    try {
      const largest = await findLargestAdapterBalance({
        creatorToken: entry.creatorToken,
        adapters: adapterCandidates,
        publicClient,
      })
      if (!largest) {
        result.plan.push({
          creatorToken: entry.creatorToken,
          adapterBalance: '0',
          dispatchMode: 'skip_below_threshold',
          destination: entry.destinationPubkey,
          meteoraAlphaVault: entry.meteoraAlphaVault,
          notes: 'no adapter balance readable',
        })
        continue
      }
      adapterBalance = largest.balance
      adapterAddress = largest.adapter
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.plan.push({
        creatorToken: entry.creatorToken,
        adapterBalance: '0',
        dispatchMode: 'skip_below_threshold',
        destination: entry.destinationPubkey,
        meteoraAlphaVault: entry.meteoraAlphaVault,
        notes: `adapter balance scan failed: ${message}`,
      })
      continue
    }

    if (adapterBalance <= minAmount) {
      result.plan.push({
        creatorToken: entry.creatorToken,
        adapterBalance: adapterBalance.toString(),
        bridgeAdapter: adapterAddress,
        dispatchMode: 'skip_below_threshold',
        destination: entry.destinationPubkey,
        meteoraAlphaVault: entry.meteoraAlphaVault,
        notes: `below threshold ${minAmount.toString()} (scanned ${adapterCandidates.length} adapter(s))`,
      })
      continue
    }

    result.creatorsWithAdapterBalance += 1

    // Meteora routing is declared when the creator has an `enabled=true`
    // row in `creator_meteora_alpha_vaults`. The Meteora-ixs builder
    // (Alpha Vault deposit tuple) is not yet implemented, so we push a
    // plan entry with clear notes + don't broadcast. Creators with
    // Meteora configured will end up held at the adapter until the
    // Meteora-ixs builder ships.
    if (entry.meteoraAlphaVault) {
      result.plan.push({
        creatorToken: entry.creatorToken,
        adapterBalance: adapterBalance.toString(),
        bridgeAdapter: adapterAddress,
        dispatchMode: 'bridge_with_meteora_ixs',
        destination: entry.destinationPubkey ?? entry.meteoraAlphaVault,
        meteoraAlphaVault: entry.meteoraAlphaVault,
        notes:
          'Meteora ixs builder not yet implemented. Tokens remain at adapter; ' +
          'use plain bridge by removing `meteoraAlphaVault` from this creator\'s registration, ' +
          'or run the manual Meteora bridge flow once the builder ships.',
      })
      continue
    }

    // Plain bridge. `destination` must be a Solana pubkey in base58. If
    // the registration didn't set one, bail for this creator — we don't
    // silently send to a default.
    if (!entry.destinationPubkey) {
      result.plan.push({
        creatorToken: entry.creatorToken,
        adapterBalance: adapterBalance.toString(),
        dispatchMode: 'bridge_plain',
        destination: null,
        meteoraAlphaVault: null,
        notes:
          'destinationPubkey missing in registration; set KPR_SOLANA_REBALANCE_CREATORS_JSON entry.destinationPubkey',
      })
      continue
    }

    let destinationBytes32: `0x${string}`
    try {
      destinationBytes32 = solanaPubkeyToBytes32(entry.destinationPubkey)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.plan.push({
        creatorToken: entry.creatorToken,
        adapterBalance: adapterBalance.toString(),
        dispatchMode: 'bridge_plain',
        destination: entry.destinationPubkey,
        meteoraAlphaVault: null,
        notes: `destinationPubkey decode failed: ${message}`,
      })
      continue
    }

    const planEntry: RebalancePlanEntry = {
      creatorToken: entry.creatorToken,
      adapterBalance: adapterBalance.toString(),
      bridgeAdapter: adapterAddress,
      dispatchMode: 'bridge_plain',
      destination: entry.destinationPubkey,
      meteoraAlphaVault: null,
      notes: `bridgeToSolana(${adapterAddress}, ${entry.creatorToken}, ${adapterBalance.toString()}, ${destinationBytes32})`,
    }

    if (executeWrites) {
      try {
        const tx = await writeContract({
          address: adapterAddress,
          abi: [...SOLANA_BRIDGE_ADAPTER_ABI, ...SOLANA_BRIDGE_OUTBOUND_ABI] as Abi,
          functionName: 'bridgeToSolana',
          args: [entry.creatorToken, adapterBalance, destinationBytes32],
          ...(bridgeFeeValue > 0n ? { value: bridgeFeeValue } : {}),
        })
        if (tx.success) {
          planEntry.txHash = tx.txHash
          await alertInfo(WORKFLOW_NAME, 'Bridged CREATOR to Solana', {
            creatorToken: entry.creatorToken,
            amount: adapterBalance.toString(),
            destination: entry.destinationPubkey,
            txHash: tx.txHash,
          })
        } else {
          planEntry.txError = tx.error ?? 'unknown writeContract error'
          await alertWarning(WORKFLOW_NAME, 'bridgeToSolana dispatch failed', {
            creatorToken: entry.creatorToken,
            amount: adapterBalance.toString(),
            error: planEntry.txError,
          })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        planEntry.txError = message
        await alertCritical(WORKFLOW_NAME, 'bridgeToSolana writeContract threw', {
          creatorToken: entry.creatorToken,
          error: message,
        })
      }
    }

    result.plan.push(planEntry)
  }

  if (executeWrites) {
    result.executed = true
    const succeeded = result.plan.filter((p) => p.txHash).length
    const failed = result.plan.filter((p) => p.txError).length
    await alertInfo(WORKFLOW_NAME, 'Rebalance pass complete', {
      scanned: result.creatorsScanned,
      withBalance: result.creatorsWithAdapterBalance,
      succeeded,
      failed,
    })
  }

  return result
}
