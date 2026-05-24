import { type Address, type Hex, getAddress, http, type PublicClient } from 'viem'
import { createBundlerClient } from 'viem/account-abstraction'

import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import { verifyRelayPart1DepositTxHint } from '@/lib/relay/relayPart1DepositLookup'
import { ENTRY_POINT_V06_BASE } from '@/lib/wallet/cswOwnerAbi'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
/** EntryPoint v0.6 `UserOperationEvent` — topic3 is paymaster. */
export const ENTRY_POINT_USER_OPERATION_EVENT_TOPIC =
  '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f' as const

export type RelayPart1CallsResolution = {
  transactionHash: `0x${string}` | null
  userOperationHash: `0x${string}` | null
}

export function resolveRelayBundlerUrl(): string {
  const bundlerEnv =
    (import.meta.env.VITE_CDP_BUNDLER_URL as string | undefined) ??
    (import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined)
  return resolveCdpPaymasterUrl(bundlerEnv) || '/api/paymaster'
}

/** Resolve the on-chain bundle tx hash that Relay `/transactions/index` accepts. */
export async function resolveBundleTxFromUserOperationHash(params: {
  userOperationHash: Hex
  bundlerUrl?: string
}): Promise<`0x${string}` | null> {
  const bundlerUrl = params.bundlerUrl ?? resolveRelayBundlerUrl()
  try {
    const bundlerClient = createBundlerClient({
      transport: http(bundlerUrl),
    })
    const receipt = await bundlerClient.getUserOperationReceipt({
      hash: params.userOperationHash,
    })
    const txHash = receipt?.receipt?.transactionHash
    if (typeof txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return txHash as `0x${string}`
    }
  } catch {
    /* fall through — caller may retry or surface a clearer error */
  }
  return null
}

/** Read paymaster from a landed UserOp via bundler receipt (null = self-funded). */
export async function readLandedUserOpPaymasterAddress(params: {
  userOperationHash: Hex
  bundlerUrl?: string
}): Promise<Address | null> {
  const bundlerUrl = params.bundlerUrl ?? resolveRelayBundlerUrl()
  try {
    const bundlerClient = createBundlerClient({
      transport: http(bundlerUrl),
    })
    const receipt = await bundlerClient.getUserOperationReceipt({
      hash: params.userOperationHash,
    })
    const paymaster = receipt?.paymaster
    if (!paymaster || paymaster.toLowerCase() === ZERO_ADDRESS) return null
    return getAddress(paymaster)
  } catch {
    return null
  }
}

export async function readPaymasterFromBundleReceipt(params: {
  publicClient: PublicClient
  transactionHash: `0x${string}`
  /** When set, only consider UserOperationEvent logs for this CSW sender (topic2). */
  sender?: Address
}): Promise<Address | null> {
  try {
    const receipt = await params.publicClient.getTransactionReceipt({
      hash: params.transactionHash,
    })
    const senderLower = params.sender?.toLowerCase()
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== ENTRY_POINT_V06_BASE.toLowerCase()) continue
      if (log.topics[0]?.toLowerCase() !== ENTRY_POINT_USER_OPERATION_EVENT_TOPIC) continue
      if (senderLower) {
        const logSender = log.topics[2]
        if (!logSender || logSender.slice(-40).toLowerCase() !== senderLower.slice(2)) continue
      }
      const paymasterTopic = log.topics[3]
      if (!paymasterTopic || paymasterTopic.length < 66) continue
      const paymaster = getAddress(`0x${paymasterTopic.slice(-40)}`)
      if (paymaster.toLowerCase() === ZERO_ADDRESS) continue
      return paymaster
    }
  } catch {
    /* fall through */
  }
  return null
}

/**
 * Reject Part 1 when Base App landed a paymaster-sponsored UserOp — Relay Part 2
 * stalls unless paymaster is zero (golden Part 1 / Part 2 shape).
 */
export async function assertRelayPart1LandedSelfFunded(params: {
  resolution: RelayPart1CallsResolution
  publicClient?: PublicClient
  /** CSW sender — scopes on-chain UserOperationEvent paymaster reads. */
  fundingCsw?: Address
  appendEvent: (row: string) => void
}): Promise<void> {
  const bundleTx =
    params.resolution.transactionHash ??
    (params.resolution.userOperationHash
      ? await resolveBundleTxFromUserOperationHash({
          userOperationHash: params.resolution.userOperationHash,
        })
      : null)

  let paymaster: Address | null = null

  if (params.resolution.userOperationHash) {
    paymaster = await readLandedUserOpPaymasterAddress({
      userOperationHash: params.resolution.userOperationHash,
    })
    if (paymaster) {
      params.appendEvent(`relay_part1:landed_userop_paymaster=${paymaster}`)
    }
  }

  if (!paymaster && bundleTx && params.publicClient) {
    const receiptPaymaster = await readPaymasterFromBundleReceipt({
      publicClient: params.publicClient,
      transactionHash: bundleTx,
      sender: params.fundingCsw,
    })
    if (receiptPaymaster) {
      paymaster = receiptPaymaster
      params.appendEvent(`relay_part1:landed_bundle_paymaster=${paymaster}`)
    }
  }

  if (!paymaster && !params.resolution.userOperationHash && bundleTx && !params.publicClient) {
    throw new Error(
      'Relay Part 1 landed but paymaster verification requires a public RPC client. Reload and retry Enable 4626 signing.',
    )
  }

  if (
    !paymaster &&
    !params.resolution.userOperationHash &&
    !bundleTx &&
    !params.publicClient
  ) {
    params.appendEvent('relay_part1:paymaster_check_skipped=no_user_op_or_public_client')
    return
  }

  if (paymaster) {
    throw new Error(
      'Base App submitted this deposit with a USDC paymaster. Relay Part 2 (addOwnerAddress) requires a self-funded UserOp (paymaster = 0). Retrying with prepare/bundler…',
    )
  }

  params.appendEvent('relay_part1:landed_userop_paymaster=0x0')
}

/** Final on-chain gate before Relay `/transactions/index` — rejects paymaster Part 1. */
export async function assertRelayPart1TxHashSelfFunded(params: {
  transactionHash: `0x${string}`
  userOperationHash?: Hex | null
  publicClient: PublicClient
  fundingCsw: Address
  appendEvent: (row: string) => void
}): Promise<void> {
  await assertRelayPart1LandedSelfFunded({
    resolution: {
      transactionHash: params.transactionHash,
      userOperationHash: params.userOperationHash ?? null,
    },
    publicClient: params.publicClient,
    fundingCsw: params.fundingCsw,
    appendEvent: params.appendEvent,
  })
}

export async function resolveRelayPart1DepositTxHash(params: {
  resolution: RelayPart1CallsResolution
  appendEvent?: (row: string) => void
  bundlerUrl?: string
}): Promise<`0x${string}`> {
  if (params.resolution.transactionHash) {
    return params.resolution.transactionHash
  }

  const userOpHash = params.resolution.userOperationHash
  if (!userOpHash) {
    throw new Error('wallet_sendCalls completed without a transaction or UserOp hash.')
  }

  params.appendEvent?.('relay_part1:resolve_bundle_from_user_op=start')
  const bundleTx = await resolveBundleTxFromUserOperationHash({
    userOperationHash: userOpHash,
    bundlerUrl: params.bundlerUrl,
  })
  if (bundleTx) {
    params.appendEvent?.(`relay_part1:resolve_bundle_from_user_op=${bundleTx}`)
    return bundleTx
  }

  throw new Error(
    'Relay Part 1 returned only a UserOp hash; could not resolve the bundle transaction hash required for solver indexing.',
  )
}

/**
 * Ensure the hash we pass to Relay notify/index is the bundle tx (not the AA UserOp hash).
 * Also upgrades persisted hints when a prior run stored the UserOp hash only.
 */
export async function ensureRelayIndexablePart1TxHash(params: {
  depositTxHash: `0x${string}`
  publicClient?: PublicClient
  fundingCsw: `0x${string}`
  orderId: `0x${string}`
  appendEvent?: (row: string) => void
}): Promise<`0x${string}`> {
  if (params.publicClient) {
    try {
      const verified = await verifyRelayPart1DepositTxHint({
        publicClient: params.publicClient,
        txHash: params.depositTxHash,
        fundingCsw: params.fundingCsw,
        orderId: params.orderId,
      })
      if (verified) return params.depositTxHash
    } catch {
      params.appendEvent?.(
        `relay_part1:index_tx_hint_not_bundle user_op_or_missing=${params.depositTxHash.slice(0, 12)}…`,
      )
    }
  }

  const resolved = await resolveBundleTxFromUserOperationHash({
    userOperationHash: params.depositTxHash,
  })
  if (!resolved) return params.depositTxHash

  if (params.publicClient) {
    try {
      const verified = await verifyRelayPart1DepositTxHint({
        publicClient: params.publicClient,
        txHash: resolved,
        fundingCsw: params.fundingCsw,
        orderId: params.orderId,
      })
      if (verified) {
        params.appendEvent?.(`relay_part1:index_tx=${resolved}`)
        return resolved
      }
    } catch {
      /* keep resolved if verification RPC fails */
    }
  }

  params.appendEvent?.(`relay_part1:index_tx=${resolved}`)
  return resolved
}
