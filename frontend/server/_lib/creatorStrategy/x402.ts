/**
 * x402 (HTTP 402 Payment Required) support for creator strategy
 * feature activation.
 *
 * x402 is an open payment protocol where the server responds with 402
 * Payment Required and a JSON body describing the payment. The client
 * signs an EIP-3009 `TransferWithAuthorization` message (gasless for
 * the signer) and resubmits with the signature in an `X-PAYMENT`
 * header. The server (or a facilitator) then broadcasts
 * `usdc.transferWithAuthorization(...)` on Base, landing the USDC to
 * the protocol treasury; after the tx confirms, the feature activates.
 *
 * This module implements self-facilitation — we broadcast the transfer
 * ourselves using a relayer key (`X402_RELAYER_PRIVATE_KEY`, or falling
 * back to `PRIVATE_KEY` if unset). We pay the (tiny) Base gas so the
 * creator doesn't need ETH on Base.
 *
 * Spec:
 *   402 response shape:
 *     { accepts: [{ scheme, network, asset, pay_to, max_amount_required,
 *                    max_timeout_seconds, mime_type }],
 *       x402_version: 1,
 *       error: string | null }
 *
 *   X-PAYMENT header: base64(JSON) of
 *     { scheme: 'exact', network: 'base', x402_version: 1,
 *       payload: { authorization: { from, to, value, validAfter,
 *                                    validBefore, nonce },
 *                  signature: { v, r, s } } }
 *
 * We accept only `scheme=exact` on `network=base` for the USDC contract.
 */

import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  getAddress,
  hexToSignature,
  http,
  parseAbi,
  type Account,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { BASE_USDC_ADDRESS, USDC_TRANSFER_EVENT_ABI } from './usdcPayment.js'

export const X402_VERSION = 1
export const X402_NETWORK = 'base'
export const X402_SCHEME = 'exact'

/**
 * Minimal EIP-3009 ABI for `transferWithAuthorization`. USDC on Base
 * exposes this function; calling it executes an ERC-20 transfer whose
 * authorization was signed (EIP-712) by `from` off-chain.
 */
export const USDC_EIP3009_ABI = parseAbi([
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
])

/**
 * The JSON body returned with HTTP 402 to tell the client what it must
 * pay + how. Serialized directly into the response.
 */
export type X402PaymentRequirements = {
  x402_version: typeof X402_VERSION
  accepts: {
    scheme: typeof X402_SCHEME
    network: typeof X402_NETWORK
    asset: Address
    pay_to: Address
    max_amount_required: string // decimal string of USDC base units
    max_timeout_seconds: number
    mime_type: 'application/json'
    description?: string
    resource?: string
  }[]
  error?: string
}

export function buildPaymentRequirements(params: {
  payTo: Address
  maxAmountRequired: bigint
  description: string
  resource: string
}): X402PaymentRequirements {
  return {
    x402_version: X402_VERSION,
    accepts: [
      {
        scheme: X402_SCHEME,
        network: X402_NETWORK,
        asset: getAddress(BASE_USDC_ADDRESS),
        pay_to: getAddress(params.payTo),
        max_amount_required: params.maxAmountRequired.toString(),
        max_timeout_seconds: 300,
        mime_type: 'application/json',
        description: params.description,
        resource: params.resource,
      },
    ],
  }
}

/**
 * Decoded X-PAYMENT header contents. Parsed and validated from the
 * base64 JSON the client sends.
 */
export type X402PaymentPayload = {
  scheme: typeof X402_SCHEME
  network: typeof X402_NETWORK
  x402_version: typeof X402_VERSION
  payload: {
    authorization: {
      from: Address
      to: Address
      value: bigint
      validAfter: bigint
      validBefore: bigint
      nonce: Hex // 32-byte hex
    }
    signature: Hex // 65-byte compact sig
  }
}

export type ParseXPaymentResult =
  | { ok: true; payment: X402PaymentPayload }
  | { ok: false; reason: string }

function isHex32(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

function isHex65(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{130}$/.test(value)
}

export function parseXPaymentHeader(headerValue: string): ParseXPaymentResult {
  let decoded: string
  try {
    decoded = Buffer.from(headerValue, 'base64').toString('utf8')
  } catch (e) {
    return { ok: false, reason: 'x402_invalid_base64' }
  }
  let raw: any
  try {
    raw = JSON.parse(decoded)
  } catch (e) {
    return { ok: false, reason: 'x402_invalid_json' }
  }
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'x402_not_object' }
  if (raw.scheme !== X402_SCHEME) return { ok: false, reason: 'x402_unsupported_scheme' }
  if (raw.network !== X402_NETWORK) return { ok: false, reason: 'x402_unsupported_network' }
  if (raw.x402_version !== X402_VERSION) return { ok: false, reason: 'x402_unsupported_version' }
  const payload = raw.payload
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'x402_missing_payload' }
  const { authorization, signature } = payload
  if (!authorization || typeof authorization !== 'object') {
    return { ok: false, reason: 'x402_missing_authorization' }
  }
  const { from, to, value, validAfter, validBefore, nonce } = authorization
  if (typeof from !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(from)) {
    return { ok: false, reason: 'x402_invalid_authorization_from' }
  }
  if (typeof to !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(to)) {
    return { ok: false, reason: 'x402_invalid_authorization_to' }
  }
  let valueBig: bigint
  let validAfterBig: bigint
  let validBeforeBig: bigint
  try {
    valueBig = BigInt(value as string | number | bigint)
    validAfterBig = BigInt(validAfter as string | number | bigint)
    validBeforeBig = BigInt(validBefore as string | number | bigint)
  } catch {
    return { ok: false, reason: 'x402_invalid_authorization_numbers' }
  }
  if (!isHex32(nonce)) return { ok: false, reason: 'x402_invalid_nonce' }
  if (!isHex65(signature)) return { ok: false, reason: 'x402_invalid_signature' }

  return {
    ok: true,
    payment: {
      scheme: X402_SCHEME,
      network: X402_NETWORK,
      x402_version: X402_VERSION,
      payload: {
        authorization: {
          from: getAddress(from as Address),
          to: getAddress(to as Address),
          value: valueBig,
          validAfter: validAfterBig,
          validBefore: validBeforeBig,
          nonce,
        },
        signature: signature as Hex,
      },
    },
  }
}

export type X402ValidateInput = {
  payment: X402PaymentPayload
  expectedFrom: Address
  expectedTo: Address
  minAmount: bigint
  now?: number // seconds, injectable for tests
}

export type X402ValidateResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'x402_from_mismatch'
        | 'x402_to_mismatch'
        | 'x402_value_below_minimum'
        | 'x402_not_yet_valid'
        | 'x402_expired'
    }

/**
 * Purely static validation of the authorization (no RPC, no settle).
 * Run this BEFORE trying to settle so a malformed request gets a clean
 * 400 response instead of a wasted on-chain tx.
 */
export function validateX402Authorization(input: X402ValidateInput): X402ValidateResult {
  const { authorization } = input.payment.payload
  if (getAddress(authorization.from) !== getAddress(input.expectedFrom)) {
    return { ok: false, reason: 'x402_from_mismatch' }
  }
  if (getAddress(authorization.to) !== getAddress(input.expectedTo)) {
    return { ok: false, reason: 'x402_to_mismatch' }
  }
  if (authorization.value < input.minAmount) {
    return { ok: false, reason: 'x402_value_below_minimum' }
  }
  const nowSec = BigInt(input.now ?? Math.floor(Date.now() / 1000))
  if (authorization.validAfter > nowSec) return { ok: false, reason: 'x402_not_yet_valid' }
  if (authorization.validBefore <= nowSec) return { ok: false, reason: 'x402_expired' }
  return { ok: true }
}

type SettleDeps = {
  /** Optional override for tests. */
  publicClient?: {
    waitForTransactionReceipt: (args: { hash: Hex }) => Promise<{
      status: 'success' | 'reverted'
      blockNumber: bigint
      logs: readonly { address: Address; data: Hex; topics: readonly Hex[] }[]
    }>
  }
  walletClient?: {
    sendTransaction: (args: { to: Address; data: Hex; account: Account }) => Promise<Hex>
  }
  relayer?: Account
}

/**
 * Broadcast the signed EIP-3009 `transferWithAuthorization` and wait
 * for the receipt. Returns a tx-hash-and-transfer-event result that
 * matches what `verifyUsdcPayment` emits, so the caller can feed the
 * result straight into `insertPendingActivation`.
 */
export async function settleX402Payment(
  payment: X402PaymentPayload,
  deps: SettleDeps = {},
): Promise<
  | {
      ok: true
      txHash: Hex
      blockNumber: bigint
      from: Address
      to: Address
      value: bigint
    }
  | { ok: false; reason: 'x402_relayer_not_configured' | 'x402_settlement_reverted' | 'x402_rpc_error' | 'x402_transfer_not_found'; message: string }
> {
  const { authorization, signature } = payment.payload
  const { v, r, s } = hexToSignature(signature)

  const data = encodeFunctionData({
    abi: USDC_EIP3009_ABI,
    functionName: 'transferWithAuthorization',
    args: [
      authorization.from,
      authorization.to,
      authorization.value,
      authorization.validAfter,
      authorization.validBefore,
      authorization.nonce,
      Number(v),
      r,
      s,
    ],
  })

  const relayer =
    deps.relayer ?? resolveRelayerAccountFromEnv()
  if (!relayer) {
    return {
      ok: false,
      reason: 'x402_relayer_not_configured',
      message: 'Set X402_RELAYER_PRIVATE_KEY (or PRIVATE_KEY) to a funded Base EOA to settle x402 payments',
    }
  }

  const rpcUrl = (process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').split(',')[0].trim()
  const publicClient =
    deps.publicClient ??
    (createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) }) as unknown as NonNullable<
      SettleDeps['publicClient']
    >)
  const walletClient =
    deps.walletClient ??
    (createWalletClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) }) as unknown as NonNullable<
      SettleDeps['walletClient']
    >)

  let txHash: Hex
  try {
    txHash = await walletClient.sendTransaction({
      account: relayer,
      to: getAddress(BASE_USDC_ADDRESS),
      data,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, reason: 'x402_rpc_error', message: `sendTransaction: ${message}` }
  }

  let receipt: Awaited<ReturnType<NonNullable<SettleDeps['publicClient']>['waitForTransactionReceipt']>>
  try {
    receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, reason: 'x402_rpc_error', message: `waitForTransactionReceipt: ${message}` }
  }

  if (receipt.status !== 'success') {
    return {
      ok: false,
      reason: 'x402_settlement_reverted',
      message: `tx ${txHash} reverted on-chain (likely authorization replay, expiry, or bad signature)`,
    }
  }

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== BASE_USDC_ADDRESS.toLowerCase()) continue
    let decoded: { eventName: string; args: Record<string, unknown> } | null = null
    try {
      decoded = decodeEventLog({
        abi: USDC_TRANSFER_EVENT_ABI,
        data: log.data,
        topics: log.topics as unknown as [signature: Hex, ...args: Hex[]],
      }) as { eventName: string; args: Record<string, unknown> }
    } catch {
      continue
    }
    if (!decoded || decoded.eventName !== 'Transfer') continue
    const { from, to, value } = decoded.args
    if (typeof from !== 'string' || typeof to !== 'string' || typeof value !== 'bigint') continue
    if (getAddress(from as Address) !== getAddress(authorization.from)) continue
    if (getAddress(to as Address) !== getAddress(authorization.to)) continue
    if (value < authorization.value) continue
    return {
      ok: true,
      txHash,
      blockNumber: receipt.blockNumber,
      from: getAddress(from as Address),
      to: getAddress(to as Address),
      value,
    }
  }

  return {
    ok: false,
    reason: 'x402_transfer_not_found',
    message: `Transfer log not found in settled tx ${txHash}; investigate`,
  }
}

function resolveRelayerAccountFromEnv(): Account | null {
  const raw = (process.env.X402_RELAYER_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? '').trim()
  if (!raw) return null
  const withPrefix = (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex
  if (!/^0x[0-9a-fA-F]{64}$/.test(withPrefix)) return null
  return privateKeyToAccount(withPrefix)
}
