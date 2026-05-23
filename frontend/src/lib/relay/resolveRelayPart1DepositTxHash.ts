import { type Hex, http, type PublicClient } from 'viem'
import { createBundlerClient } from 'viem/account-abstraction'

import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import { verifyRelayPart1DepositTxHint } from '@/lib/relay/relayPart1DepositLookup'

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
