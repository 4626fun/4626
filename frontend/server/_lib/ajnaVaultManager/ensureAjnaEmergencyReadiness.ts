/**
 * Day-0 / emergency readiness for nested Ajna sleeves:
 * - ensure protocol automation Safe is AjnaVaultAuth keeper
 * - optionally drain bucket LP → inner buffer (legacy adapters lacking drainBucketsToBuffer)
 *
 * HEAD adapters already drain buckets inside emergencyWithdraw(); vault-level
 * emergencyWithdrawFromStrategies is then enough. Legacy adapters need the
 * keeper moveToBuffer path first.
 */
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  toFunctionSelector,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'

import { scanVaultStrategyDetails } from '../onchain/vaultStrategyOnchain.js'
import {
  executeViaProtocolAutomationSafe,
  resolveProtocolAutomationAddress,
} from '../wallet/protocolTreasurySafe.js'

const AUTH_ABI = [
  {
    type: 'function',
    name: 'admin',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'pendingAdmin',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'isKeeper',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setKeeper',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address' },
      { type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'acceptAdmin',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const

const INNER_ABI = [
  {
    type: 'function',
    name: 'getBuckets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256[]' }],
  },
  {
    type: 'function',
    name: 'bucketLp',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'moveToBuffer',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'uint256' },
      { type: 'uint256' },
    ],
    outputs: [
      { type: 'uint256' },
      { type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'bufferAssets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

const DRAIN_SELECTOR = toFunctionSelector('drainBucketsToBuffer()')
const MOVE_TO_BUFFER_SELECTOR = toFunctionSelector('moveToBuffer(uint256,uint256)')
const MOVE_FROM_BUFFER_SELECTOR = toFunctionSelector('moveFromBuffer(uint256,uint256)')

export type AjnaEmergencyReadinessReport = {
  vault: Address
  adapter: Address
  innerVault: Address
  auth: Address
  automationSafe: Address
  adapterSelectors: {
    drainBucketsToBuffer: boolean
    moveToBuffer: boolean
    moveFromBuffer: boolean
  }
  /** When true, vault emergencyWithdrawFromStrategies alone should pull Ajna. */
  adapterEmergencySelfDrains: boolean
  automationIsKeeper: boolean
  acceptedAdmin: boolean
  drainedBuckets: Array<{ bucket: string; lp: string; txHash?: Hex }>
  dryRun: boolean
  notes: string[]
  txs: Array<{ label: string; txHash: Hex }>
}

function bytecodeHasSelector(code: Hex, selector: Hex): boolean {
  return code.toLowerCase().includes(selector.slice(2).toLowerCase())
}

async function resolveNestedAjnaSleeve(params: {
  publicClient: PublicClient
  vault: Address
  adapter?: Address
}): Promise<{ adapter: Address; innerVault: Address; auth: Address }> {
  const rows = await scanVaultStrategyDetails({ client: params.publicClient, vault: params.vault })
  const match = rows.find((row) => {
    if (!row.ajna?.innerVault || !row.ajna?.auth) return false
    if (params.adapter) return getAddress(row.strategy) === getAddress(params.adapter)
    return true
  })
  if (!match?.ajna?.innerVault || !match.ajna.auth) {
    throw new Error(`ajna_sleeve_not_found:vault=${params.vault}`)
  }
  return {
    adapter: getAddress(match.strategy),
    innerVault: getAddress(match.ajna.innerVault),
    auth: getAddress(match.ajna.auth),
  }
}

export async function ensureAjnaEmergencyReadiness(params: {
  publicClient: PublicClient
  rpcUrl: string
  vault: Address
  adapter?: Address
  /** When true, only report / simulate intent — no Safe txs. */
  dryRun?: boolean
  /**
   * Drain bucket LP into the inner buffer when the adapter cannot self-drain
   * on emergencyWithdraw. Default true.
   */
  drainBuckets?: boolean
  env?: Record<string, string | undefined>
}): Promise<AjnaEmergencyReadinessReport> {
  const env = params.env ?? process.env
  const dryRun = Boolean(params.dryRun)
  const drainBuckets = params.drainBuckets !== false

  const automationSafeRaw = resolveProtocolAutomationAddress(env)
  if (!automationSafeRaw || !isAddress(automationSafeRaw)) {
    throw new Error('protocol_automation_safe_not_configured')
  }
  const automationSafe = getAddress(automationSafeRaw)
  const vault = getAddress(params.vault)

  const sleeve = await resolveNestedAjnaSleeve({
    publicClient: params.publicClient,
    vault,
    adapter: params.adapter,
  })

  const adapterCode = (await params.publicClient.getBytecode({ address: sleeve.adapter })) as Hex | undefined
  if (!adapterCode || adapterCode === '0x') {
    throw new Error(`adapter_no_code:${sleeve.adapter}`)
  }

  const adapterSelectors = {
    drainBucketsToBuffer: bytecodeHasSelector(adapterCode, DRAIN_SELECTOR),
    moveToBuffer: bytecodeHasSelector(adapterCode, MOVE_TO_BUFFER_SELECTOR),
    moveFromBuffer: bytecodeHasSelector(adapterCode, MOVE_FROM_BUFFER_SELECTOR),
  }
  const adapterEmergencySelfDrains = adapterSelectors.drainBucketsToBuffer

  const txs: Array<{ label: string; txHash: Hex }> = []
  const notes: string[] = []
  let acceptedAdmin = false

  const [admin, pendingAdmin, automationIsKeeperBefore] = await Promise.all([
    params.publicClient.readContract({ address: sleeve.auth, abi: AUTH_ABI, functionName: 'admin' }),
    params.publicClient.readContract({ address: sleeve.auth, abi: AUTH_ABI, functionName: 'pendingAdmin' }),
    params.publicClient.readContract({
      address: sleeve.auth,
      abi: AUTH_ABI,
      functionName: 'isKeeper',
      args: [automationSafe],
    }),
  ])

  if (getAddress(admin) !== automationSafe && getAddress(pendingAdmin) === automationSafe) {
    if (!dryRun) {
      const data = encodeFunctionData({ abi: AUTH_ABI, functionName: 'acceptAdmin' })
      const r = await executeViaProtocolAutomationSafe({
        publicClient: params.publicClient as never,
        rpcUrl: params.rpcUrl,
        to: sleeve.auth,
        data: data as Hex,
        env,
      })
      txs.push({ label: 'acceptAdmin', txHash: r.txHash })
    }
    acceptedAdmin = true
  } else if (getAddress(admin) !== automationSafe) {
    const msg = `ajna_auth_admin_not_automation:admin=${admin};pending=${pendingAdmin};expected=${automationSafe}`
    if (!dryRun) throw new Error(msg)
    notes.push(msg)
  }

  let automationIsKeeper = Boolean(automationIsKeeperBefore)
  if (!automationIsKeeper) {
    if (!dryRun) {
      const data = encodeFunctionData({
        abi: AUTH_ABI,
        functionName: 'setKeeper',
        args: [automationSafe, true],
      })
      const r = await executeViaProtocolAutomationSafe({
        publicClient: params.publicClient as never,
        rpcUrl: params.rpcUrl,
        to: sleeve.auth,
        data: data as Hex,
        env,
      })
      txs.push({ label: 'setKeeper(automation,true)', txHash: r.txHash })
      automationIsKeeper = true
    }
    // dry-run: leave automationIsKeeper=false so the report reflects chain state
  }

  const drainedBuckets: AjnaEmergencyReadinessReport['drainedBuckets'] = []
  const needsLegacyDrain = drainBuckets && !adapterEmergencySelfDrains
  if (needsLegacyDrain) {
    const buckets = (await params.publicClient.readContract({
      address: sleeve.innerVault,
      abi: INNER_ABI,
      functionName: 'getBuckets',
    })) as readonly bigint[]

    for (const bucket of buckets) {
      const lp = (await params.publicClient.readContract({
        address: sleeve.innerVault,
        abi: INNER_ABI,
        functionName: 'bucketLp',
        args: [bucket],
      })) as bigint
      if (lp === 0n) continue

      const entry: AjnaEmergencyReadinessReport['drainedBuckets'][number] = {
        bucket: bucket.toString(),
        lp: lp.toString(),
      }
      if (!dryRun) {
        const data = encodeFunctionData({
          abi: INNER_ABI,
          functionName: 'moveToBuffer',
          args: [bucket, lp],
        })
        const r = await executeViaProtocolAutomationSafe({
          publicClient: params.publicClient as never,
          rpcUrl: params.rpcUrl,
          to: sleeve.innerVault,
          data: data as Hex,
          env,
        })
        entry.txHash = r.txHash
        txs.push({ label: `moveToBuffer(${bucket})`, txHash: r.txHash })
      }
      drainedBuckets.push(entry)
    }
  }

  const automationIsKeeperAfter = dryRun
    ? automationIsKeeper
    : Boolean(
        await params.publicClient.readContract({
          address: sleeve.auth,
          abi: AUTH_ABI,
          functionName: 'isKeeper',
          args: [automationSafe],
        }),
      )

  return {
    vault,
    adapter: sleeve.adapter,
    innerVault: sleeve.innerVault,
    auth: sleeve.auth,
    automationSafe,
    adapterSelectors,
    adapterEmergencySelfDrains,
    automationIsKeeper: automationIsKeeperAfter,
    acceptedAdmin,
    drainedBuckets,
    dryRun,
    notes,
    txs,
  }
}
