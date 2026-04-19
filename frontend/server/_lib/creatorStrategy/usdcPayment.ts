/**
 * USDC payment verifier for creator strategy feature activations.
 *
 * Given a Base mainnet transaction hash, verifies that the transaction:
 *   1. Exists and was successful.
 *   2. Contains a USDC ERC-20 Transfer event matching the expected
 *      (from, to, minAmount) triple.
 *   3. Transfer is to the protocol treasury (authoritative USDC sink for
 *      feature activations).
 *
 * The verifier is intentionally permissive about transaction SHAPE
 * (multicall, Uniswap route, swap-and-transfer bundles are all fine) as
 * long as at least one log entry satisfies the expected Transfer. It
 * returns a structured result with the verified transfer so the caller
 * can persist it in `creator_strategy_features.payment_{tx_hash,from,to}`
 * and re-verify on read without another RPC round trip.
 */

import {
  createPublicClient,
  decodeEventLog,
  getAddress,
  http,
  parseAbi,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

/** Canonical Base USDC (6 decimals). */
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const

/** Minimum USDC decimals we assume (ERC-20 standard read). */
export const USDC_DECIMALS = 6

export const USDC_TRANSFER_EVENT_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

/**
 * Minimal public-client surface we actually use. Typing against this
 * shape instead of viem's `PublicClient` avoids the deeply-generic
 * chain-type variance issues when tests inject a fake client.
 */
type VerifierPublicClient = {
  getTransactionReceipt: (args: { hash: Hex }) => Promise<{
    status: 'success' | 'reverted'
    blockNumber: bigint
    logs: readonly {
      address: Address
      data: Hex
      topics: readonly Hex[]
    }[]
  }>
}

type VerifyInput = {
  txHash: Hex
  expectedFrom: Address
  expectedTo: Address
  minAmount: bigint
  /** Optional override, primarily for tests. Defaults to BASE_USDC_ADDRESS. */
  usdcAddress?: Address
  /** Optional viem-compatible client (injectable for tests). Falls back to
   *  `BASE_RPC_URL`-backed default when omitted. */
  publicClient?: VerifierPublicClient
}

export type VerifyUsdcPaymentResult =
  | {
      ok: true
      txHash: Hex
      blockNumber: bigint
      from: Address
      to: Address
      value: bigint
      usdcAddress: Address
    }
  | {
      ok: false
      reason:
        | 'tx_not_found'
        | 'tx_reverted'
        | 'transfer_not_found'
        | 'rpc_error'
      message: string
    }

function defaultPublicClient(): VerifierPublicClient {
  const rpcUrl = (process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').split(',')[0].trim()
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 20_000 }),
  }) as unknown as VerifierPublicClient
}

/**
 * Verify a USDC payment transaction by reading its receipt on Base
 * mainnet and matching logs against the expected Transfer.
 *
 * Matching is intentionally on-chain-authoritative: we do NOT trust the
 * tx sender (msg.sender != Transfer.from in the multicall case); we
 * only trust the decoded Transfer event from the USDC contract.
 */
export async function verifyUsdcPayment(input: VerifyInput): Promise<VerifyUsdcPaymentResult> {
  const usdcAddress = getAddress(input.usdcAddress ?? BASE_USDC_ADDRESS)
  const expectedFrom = getAddress(input.expectedFrom)
  const expectedTo = getAddress(input.expectedTo)
  const publicClient = input.publicClient ?? defaultPublicClient()

  let receipt: Awaited<ReturnType<typeof publicClient.getTransactionReceipt>>
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: input.txHash })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/not found|could not be found/i.test(message)) {
      return { ok: false, reason: 'tx_not_found', message }
    }
    return { ok: false, reason: 'rpc_error', message }
  }

  if (!receipt) {
    return { ok: false, reason: 'tx_not_found', message: 'Receipt missing' }
  }
  if (receipt.status !== 'success') {
    return { ok: false, reason: 'tx_reverted', message: `status=${String(receipt.status)}` }
  }

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdcAddress.toLowerCase()) continue
    let decoded: { eventName: string; args: Record<string, unknown> } | null = null
    try {
      decoded = decodeEventLog({
        abi: USDC_TRANSFER_EVENT_ABI,
        data: log.data,
        topics: log.topics as unknown as [signature: Hex, ...args: Hex[]],
      }) as { eventName: string; args: Record<string, unknown> }
    } catch {
      // Non-Transfer logs on the USDC contract (e.g. Approval) fail to
      // decode against the Transfer-only ABI; skip them.
      continue
    }
    if (!decoded || decoded.eventName !== 'Transfer') continue
    const fromRaw = decoded.args.from
    const toRaw = decoded.args.to
    const valueRaw = decoded.args.value
    if (typeof fromRaw !== 'string' || typeof toRaw !== 'string') continue
    if (typeof valueRaw !== 'bigint') continue
    if (getAddress(fromRaw as Address) !== expectedFrom) continue
    if (getAddress(toRaw as Address) !== expectedTo) continue
    if (valueRaw < input.minAmount) continue
    return {
      ok: true,
      txHash: input.txHash,
      blockNumber: receipt.blockNumber,
      from: expectedFrom,
      to: expectedTo,
      value: valueRaw,
      usdcAddress,
    }
  }

  return {
    ok: false,
    reason: 'transfer_not_found',
    message: `No USDC Transfer(from=${expectedFrom}, to=${expectedTo}, value>=${input.minAmount.toString()}) in tx ${input.txHash}`,
  }
}

/**
 * Read the protocol treasury address for USDC deposits from env, falling
 * back to the canonical `protocolTreasury` Safe when unset. Keeping this
 * in one place so the API handler, docs, and tests all resolve the same
 * destination.
 */
export function resolveProtocolTreasuryForUsdcPayments(): Address {
  const raw = String(process.env.CREATOR_STRATEGY_FEATURE_USDC_TREASURY ?? '').trim()
  if (raw && /^0x[0-9a-fA-F]{40}$/.test(raw)) {
    return getAddress(raw as Address)
  }
  // Fallback: the same `protocolTreasury` address used by the
  // `DeploymentBatcher` / `SolanaBridgeAdapter` for all protocol custody.
  return getAddress('0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3')
}
