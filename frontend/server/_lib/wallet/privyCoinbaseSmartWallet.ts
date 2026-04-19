import { createBundlerClient, createPaymasterClient, sendUserOperation, toCoinbaseSmartAccount } from 'viem/account-abstraction'
import { encodeAbiParameters, getAddress, http, type Address, type Hex, type SignableMessage } from 'viem'
import { toAccount } from 'viem/accounts'

import { getWalletById, secp256k1SignHash, walletRpc } from './privyWalletApi.js'

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'nextOwnerIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

export type CoinbaseSmartWalletCall = {
  to: Address
  value?: bigint
  data?: Hex
}

export class CoinbaseSmartWalletHelperError extends Error {
  code: string
  retryable: boolean
  /**
   * Optional original message from the underlying error that caused this
   * helper error. Kept separate from `message` so `message` remains the
   * stable short code callers match against, while operators still see the
   * raw bundler/paymaster/RPC text in logs.
   */
  causeMessage?: string

  constructor(
    code: string,
    retryable: boolean,
    messageOrOptions?: string | { message?: string; causeMessage?: string; cause?: unknown },
  ) {
    const options =
      typeof messageOrOptions === 'string'
        ? { message: messageOrOptions }
        : (messageOrOptions ?? {})
    super(options.message ?? code)
    this.name = 'CoinbaseSmartWalletHelperError'
    this.code = code
    this.retryable = retryable
    if (options.causeMessage) this.causeMessage = options.causeMessage
    if (options.cause !== undefined) {
      // Attach the original error for logging/debug without polluting the
      // short `message`. Supported natively on Error via the `cause` option,
      // but we also assign explicitly for older runtimes.
      try {
        ;(this as unknown as { cause?: unknown }).cause = options.cause
      } catch {
        // Some runtimes freeze Error instances; ignore.
      }
    }
  }
}

export function isCoinbaseSmartWalletHelperError(error: unknown): error is CoinbaseSmartWalletHelperError {
  return (
    error instanceof CoinbaseSmartWalletHelperError ||
    (typeof error === 'object' &&
      error !== null &&
      typeof (error as { code?: unknown }).code === 'string' &&
      typeof (error as { retryable?: unknown }).retryable === 'boolean')
  )
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function isRetryableInfraError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()
  if (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('network') ||
    message.includes('temporar') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('429') ||
    message.includes('503') ||
    message.includes('502') ||
    message.includes('504') ||
    message.includes('gateway') ||
    message.includes('socket hang up') ||
    message.includes('connection reset') ||
    message.includes('fetch failed') ||
    // Paymaster / bundler upstream transient failures. The CDP paymaster RPC
    // surfaces `internal error - error communicating with paymaster` when the
    // bundler cannot reach its paymaster backend; that's infrastructure, not
    // a deterministic UserOp validation failure, so it should retry.
    message.includes('error communicating with paymaster') ||
    message.includes('paymaster service') ||
    message.includes('paymaster unavailable') ||
    // JSON-RPC generic internal error (-32000 / -32603) from bundler or RPC.
    // Deterministic validation rejections use different codes (-32602, -32500
    // range) which we keep as non-retryable.
    message.includes('-32000') ||
    message.includes('-32603')
  ) {
    return true
  }

  // Inspect structured JSON-RPC error codes if present on the thrown error
  // (viem/ox attach `.code` or `.cause.code` on RpcRequestError).
  const structuredCode = extractStructuredRpcErrorCode(error)
  if (structuredCode !== null) {
    if (structuredCode === -32000 || structuredCode === -32603) return true
  }

  const privyStatusMatch = message.match(/privy_http_(\d+)/)
  if (!privyStatusMatch) return false

  const status = Number(privyStatusMatch[1])
  return status === 408 || status === 429 || status >= 500
}

/** Walks the error chain looking for a numeric JSON-RPC `code` field. */
function extractStructuredRpcErrorCode(error: unknown): number | null {
  const seen = new Set<unknown>()
  let cursor: unknown = error
  while (cursor && typeof cursor === 'object' && !seen.has(cursor)) {
    seen.add(cursor)
    const candidate = (cursor as { code?: unknown }).code
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate
    cursor = (cursor as { cause?: unknown }).cause
  }
  return null
}

function toCoinbaseSmartWalletHelperError(params: {
  code: string
  retryable: boolean
  causeMessage?: string
  cause?: unknown
}): CoinbaseSmartWalletHelperError {
  return new CoinbaseSmartWalletHelperError(params.code, params.retryable, {
    causeMessage: params.causeMessage,
    cause: params.cause,
  })
}

export function wrapUnknownHelperError(code: string, error: unknown): CoinbaseSmartWalletHelperError {
  if (isCoinbaseSmartWalletHelperError(error)) return error
  return toCoinbaseSmartWalletHelperError({
    code,
    retryable: isRetryableInfraError(error),
    causeMessage: getErrorMessage(error),
    cause: error,
  })
}

function normalizeHexAddress(value: unknown): Address | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return getAddress(raw)
}

function ownerBytesToAddress(ownerBytes: Hex): Address | null {
  const hex = String(ownerBytes ?? '').toLowerCase()
  if (!/^0x[0-9a-f]+$/.test(hex) || hex.length < 42) return null
  return normalizeHexAddress(`0x${hex.slice(-40)}`)
}

function messageToHex(message: SignableMessage): string {
  if (typeof message === 'string') return message
  if (typeof message.raw === 'string') return message.raw
  return `0x${Buffer.from(message.raw).toString('hex')}`
}

async function getPrivyWalletAddress(walletId: string): Promise<Address> {
  try {
    const wallet = await getWalletById(walletId)
    return getAddress(wallet.address)
  } catch (error) {
    throw wrapUnknownHelperError('privy_wallet_lookup_failed', error)
  }
}

async function readCoinbaseSmartWalletOwnerAddressAtIndex(params: {
  publicClient: any
  smartWallet: Address
  ownerIndex: number
}): Promise<Address | null> {
  try {
    const ownerBytes = (await params.publicClient.readContract({
      address: params.smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'ownerAtIndex',
      args: [BigInt(params.ownerIndex)],
    })) as Hex
    return ownerBytesToAddress(ownerBytes)
  } catch {
    return null
  }
}

export function asCoinbaseSmartWalletOwnerBytes(ownerAddress: Address): Hex {
  return encodeAbiParameters([{ type: 'address' }], [getAddress(ownerAddress)]) as Hex
}

export async function findCoinbaseSmartWalletOwnerIndex(params: {
  publicClient: any
  smartWallet: Address
  ownerAddress: Address
  maxScan?: number
}): Promise<number | null> {
  const { publicClient, smartWallet, ownerAddress, maxScan = 512 } = params
  let countRaw: bigint
  try {
    countRaw = (await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'ownerCount',
    })) as bigint
  } catch (error) {
    throw wrapUnknownHelperError('csw_owner_count_read_failed', error)
  }

  const count = Number(countRaw)
  let upperBound = Number.isFinite(count) ? count : 0
  let nextOwnerIndexReadFailed = false
  try {
    const nextRaw = (await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'nextOwnerIndex',
    })) as bigint
    const next = Number(nextRaw)
    if (Number.isFinite(next) && next > 0) upperBound = Math.max(upperBound, next)
  } catch {
    nextOwnerIndexReadFailed = true
  }
  if (!Number.isFinite(upperBound) || upperBound <= 0) return null

  const expected = asCoinbaseSmartWalletOwnerBytes(ownerAddress).toLowerCase()
  const limit = Math.min(upperBound, Math.max(1, maxScan))
  const truncatedScan = upperBound > limit
  let slotReadFailed = false
  for (let i = 0; i < limit; i += 1) {
    let ownerBytes: Hex | null = null
    try {
      ownerBytes = (await publicClient.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      })) as Hex
    } catch {
      slotReadFailed = true
      continue
    }
    if (!ownerBytes) continue
    if (String(ownerBytes).toLowerCase() === expected) return i
  }
  if (slotReadFailed || nextOwnerIndexReadFailed || truncatedScan) {
    throw toCoinbaseSmartWalletHelperError({
      code: 'csw_owner_scan_incomplete',
      retryable: true,
    })
  }
  return null
}

export async function resolvePrivyCoinbaseSmartWalletOwnerContext(params: {
  publicClient: any
  walletId: string
  smartWallet: Address
  expectedOwnerAddress?: Address | null
  configuredOwnerIndex?: number | null
  allowConfiguredOwnerIndexFallback?: boolean
  maxScan?: number
}): Promise<{ ownerAddress: Address; ownerIndex: number }> {
  const smartWallet = getAddress(params.smartWallet)
  const configuredOwnerIndex =
    Number.isFinite(params.configuredOwnerIndex) && Number(params.configuredOwnerIndex) >= 0
      ? Math.floor(Number(params.configuredOwnerIndex))
      : null
  const expectedOwnerAddress = params.expectedOwnerAddress ? getAddress(params.expectedOwnerAddress) : null

  let ownerAddress: Address | null = null
  try {
    ownerAddress = await getPrivyWalletAddress(params.walletId)
  } catch (error) {
    if (!params.allowConfiguredOwnerIndexFallback || configuredOwnerIndex === null) throw error
  }

  if (configuredOwnerIndex !== null) {
    const ownerAtConfiguredIndex = await readCoinbaseSmartWalletOwnerAddressAtIndex({
      publicClient: params.publicClient,
      smartWallet,
      ownerIndex: configuredOwnerIndex,
    })

    if (ownerAddress && ownerAtConfiguredIndex && ownerAtConfiguredIndex.toLowerCase() === ownerAddress.toLowerCase()) {
      if (expectedOwnerAddress && expectedOwnerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
        throw toCoinbaseSmartWalletHelperError({
          code: 'stored_owner_mismatch',
          retryable: false,
        })
      }
      return { ownerAddress, ownerIndex: configuredOwnerIndex }
    }

    if (!ownerAddress && params.allowConfiguredOwnerIndexFallback && ownerAtConfiguredIndex) {
      if (
        expectedOwnerAddress &&
        expectedOwnerAddress.toLowerCase() !== ownerAtConfiguredIndex.toLowerCase()
      ) {
        throw toCoinbaseSmartWalletHelperError({
          code: 'stored_owner_mismatch',
          retryable: false,
        })
      }
      return { ownerAddress: ownerAtConfiguredIndex, ownerIndex: configuredOwnerIndex }
    }
  }

  if (!ownerAddress) {
    throw toCoinbaseSmartWalletHelperError({
      code: 'privy_wallet_address_unavailable',
      retryable: true,
    })
  }
  if (expectedOwnerAddress && expectedOwnerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw toCoinbaseSmartWalletHelperError({
      code: 'stored_owner_mismatch',
      retryable: false,
    })
  }

  const ownerIndex = await findCoinbaseSmartWalletOwnerIndex({
    publicClient: params.publicClient,
    smartWallet,
    ownerAddress,
    maxScan: params.maxScan ?? 512,
  })
  if (ownerIndex === null) {
    throw toCoinbaseSmartWalletHelperError({
      code: 'privy_wallet_not_csw_owner',
      retryable: false,
    })
  }
  return { ownerAddress, ownerIndex }
}

export async function waitForUserOperationReceipt(params: {
  bundlerClient: any
  hash: `0x${string}`
  timeoutMs?: number
  intervalMs?: number
}): Promise<any> {
  const timeoutMs = params.timeoutMs ?? 180_000
  const intervalMs = params.intervalMs ?? 3_000
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const receipt = await params.bundlerClient.getUserOperationReceipt({ hash: params.hash }).catch(() => null)
    if (receipt?.receipt?.transactionHash) return receipt
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw toCoinbaseSmartWalletHelperError({
    code: 'userop_receipt_timeout',
    retryable: true,
  })
}

export function createPrivyWalletBackedAccount(params: {
  walletId: string
  address: Address
}): any {
  const address = getAddress(params.address)

  return toAccount({
    address,
    sign: async ({ hash }: { hash: Hex }) => {
      return (await secp256k1SignHash({ walletId: params.walletId, hash })) as Hex
    },
    signTransaction: async () => {
      throw new Error('privy_sign_transaction_unsupported')
    },
    signMessage: async ({ message }: { message: SignableMessage }) => {
      const result = await walletRpc<any>({
        walletId: params.walletId,
        method: 'personal_sign',
        rpcParams: { message: messageToHex(message), encoding: 'hex' },
      })
      const signature = String(result?.data?.signature ?? '').trim()
      if (!/^0x[0-9a-fA-F]+$/.test(signature)) {
        throw new Error('privy_personal_sign_invalid_signature')
      }
      return signature as Hex
    },
    signTypedData: async () => {
      throw new Error('privy_sign_typed_data_unsupported')
    },
  })
}

export async function sendCoinbaseSmartWalletUserOperation(params: {
  publicClient: any
  bundlerUrl: string
  smartWallet: Address
  ownerAccount: any
  ownerIndex: number
  calls: CoinbaseSmartWalletCall[]
  simulate?: boolean
}): Promise<{
  userOpHash: `0x${string}`
  txHash: `0x${string}`
  smartWallet: `0x${string}`
  ownerIndex: number
}> {
  const smartWallet = getAddress(params.smartWallet)
  const calls = params.calls.map((call) => ({
    to: getAddress(call.to),
    value: call.value ?? 0n,
    data: call.data ?? '0x',
  }))

  if (params.simulate) {
    try {
      for (const call of calls) {
        await params.publicClient.call({
          account: smartWallet,
          to: call.to,
          data: call.data,
          value: call.value,
        })
      }
    } catch (error) {
      throw wrapUnknownHelperError('userop_simulation_failed', error)
    }
  }

  const transport = http(params.bundlerUrl, { timeout: 30_000 })
  const paymasterClient = createPaymasterClient({ transport })
  const bundlerClient = createBundlerClient({ client: params.publicClient as any, transport })
  let account: any
  try {
    account = await toCoinbaseSmartAccount({
      client: params.publicClient as any,
      address: smartWallet,
      owners: [params.ownerAccount as any],
      ownerIndex: params.ownerIndex,
      version: '1',
    })
  } catch (error) {
    throw wrapUnknownHelperError('coinbase_smart_account_init_failed', error)
  }

  let userOpHash: `0x${string}`
  try {
    userOpHash = (await sendUserOperation(bundlerClient, {
      account,
      calls,
      paymaster: {
        getPaymasterData: paymasterClient.getPaymasterData,
        getPaymasterStubData: paymasterClient.getPaymasterStubData,
      },
    })) as `0x${string}`
  } catch (error) {
    throw wrapUnknownHelperError('userop_submission_failed', error)
  }

  const userOpReceipt = await waitForUserOperationReceipt({
    bundlerClient,
    hash: userOpHash,
    timeoutMs: 180_000,
    intervalMs: 3_000,
  })
  const txHash = userOpReceipt?.receipt?.transactionHash as `0x${string}` | undefined
  if (!txHash) {
    throw toCoinbaseSmartWalletHelperError({
      code: 'userop_transaction_hash_missing',
      retryable: true,
    })
  }

  let txReceipt: { status: string }
  try {
    txReceipt = await params.publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 })
  } catch (error) {
    throw wrapUnknownHelperError('transaction_receipt_wait_failed', error)
  }
  if (txReceipt.status !== 'success') {
    throw toCoinbaseSmartWalletHelperError({
      code: 'transaction_reverted',
      retryable: false,
    })
  }

  return {
    userOpHash,
    txHash,
    smartWallet: smartWallet as `0x${string}`,
    ownerIndex: params.ownerIndex,
  }
}

export async function sendPrivyCoinbaseSmartWalletUserOperation(params: {
  publicClient: any
  bundlerUrl: string
  walletId: string
  smartWallet: Address
  ownerAddress: Address
  ownerIndex: number
  calls: CoinbaseSmartWalletCall[]
  simulate?: boolean
}): Promise<{
  userOpHash: `0x${string}`
  txHash: `0x${string}`
  smartWallet: `0x${string}`
  ownerAddress: `0x${string}`
  ownerIndex: number
}> {
  const ownerAddress = getAddress(params.ownerAddress)
  const ownerAccount = createPrivyWalletBackedAccount({
    walletId: params.walletId,
    address: ownerAddress,
  })
  const result = await sendCoinbaseSmartWalletUserOperation({
    publicClient: params.publicClient,
    bundlerUrl: params.bundlerUrl,
    smartWallet: params.smartWallet,
    ownerAccount,
    ownerIndex: params.ownerIndex,
    calls: params.calls,
    simulate: params.simulate ?? false,
  })
  return {
    ...result,
    ownerAddress: ownerAddress.toLowerCase() as `0x${string}`,
  }
}
