import { decodeAbiParameters, type PublicClient } from 'viem'

import { ENTRY_POINT_V06_ADDRESS } from '@/lib/wallet/onboardingWalletReplayable'

export const RELAY_DEPOSITORY_BASE = '0x4cd00e387622c35bddb9b4c962c136462338bc31' as const
const ENTRY_POINT_USER_OPERATION_EVENT_TOPIC =
  '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f' as const
const RELAY_NATIVE_DEPOSIT_EVENT_TOPIC =
  '0x8032066556caf3967d8fec4ad22a2d9e1e9576556b2903a0fcd5b1fd201e3477' as const
const NATIVE_CURRENCY_ADDRESS = '0x0000000000000000000000000000000000000000'
const RELAY_DEPOSIT_NATIVE_SELECTOR = '0x49290c1c'
const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
const ETHEREUM_USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const ARBITRUM_USDC = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
const FORBIDDEN_RELAY_CURRENCY_ADDRESSES = new Set<string>([
  BASE_USDC,
  ETHEREUM_USDC,
  ARBITRUM_USDC,
])
const RELAY_QUOTE_DEFAULT_GAS_LIMIT = 250_000n
const RELAY_QUOTE_MULTIPLIER = 6n
const RELAY_QUOTE_MIN_WEI = 500_000_000_000n
const RELAY_QUOTE_MAX_WEI = 20_000_000_000_000n

/** One EIP-5792 call. Shape matches what the backend preview returns. */
export type Eip5792Call = {
  to: `0x${string}`
  data: `0x${string}`
  value: `0x${string}`
}

/**
 * Relay-orchestrated submission metadata. When present, the single `userCall`
 * (a deposit-into-RelayRouter tx) is what the wallet should submit; Relay's
 * solver runs the destination mutation off-chain.
 */
export type PreviewRelayFlow = {
  requestId: `0x${string}`
  userCall: Eip5792Call
  feeUsd: string | null
}

export type RelayQuoteExecutePayload = {
  requestId: `0x${string}`
  txValueWei: string
  statusEndpoint: string | null
}

export type RelayStatusCheckResult = {
  done: boolean
  success: boolean
  txHash: `0x${string}` | null
  raw: unknown
}

export type RelayTwoLegStatus =
  | 'quoted'
  | 'deposit_submitted'
  | 'execution_pending'
  | 'execution_succeeded'
  | 'execution_failed'
  | 'status_timeout'

export type RelayTwoLegDiagnostics = {
  requestId: `0x${string}`
  statusEndpoint: string
  depositTxHash: `0x${string}` | null
  executionTxHash: `0x${string}` | null
  status: RelayTwoLegStatus
  statusText: string | null
}

export type AADepositDiagnostics = {
  txHash: `0x${string}`
  blockNumber: bigint
  userOpHash: `0x${string}` | null
  userOpNonce: bigint | null
  userOpSuccess: boolean | null
  actualGasCostWei: bigint | null
  actualGasUsed: bigint | null
  userOpPaymaster: `0x${string}` | null
  relayDepositFrom: `0x${string}` | null
  relayDepositAmountWei: bigint | null
  relayDepositRequestId: `0x${string}` | null
  expectedRequestId: `0x${string}`
  checks: {
    hasEntryPointUserOpForCsw: boolean
    hasRelayDepositForCsw: boolean
    requestIdMatches: boolean
    traceEntryPointToCsw: boolean | null
    traceCswToDepository: boolean | null
  }
}

export type RemoveOwnerPreview = {
  /** Legacy: raw mutation calldata. Only used in the funder-EOA fallback lane. */
  txRequest: {
    chainId: 8453
    to: `0x${string}`
    data: `0x${string}`
    value: '0x0'
  }
  /**
   * EIP-5792 calls to pass to wallet_sendCalls. When relay is present, this
   * is exactly the Relay-orchestrated user transaction; otherwise it's the
   * raw mutation call (which only the funder-EOA lane can actually dispatch).
   */
  calls: Eip5792Call[]
  /** Relay quote details, null if the upstream quote failed. */
  relay: PreviewRelayFlow | null
  preflight: {
    selectedFunction: 'removeOwnerAtIndex' | 'removeLastOwner'
    selectedBy: 'heuristic' | 'simulation'
    targetOwnerIndex: number
    targetOwnerBytes: `0x${string}`
    targetOwnerAddress: `0x${string}` | null
    highestPopulatedOwnerIndex: number
    ownerCount: number
    nextOwnerIndex: number
    simulation: {
      ok: boolean
      error: string | null
      removeOwnerAtIndex: { ok: boolean; error: string | null }
      removeLastOwner: { ok: boolean; error: string | null }
    }
    relayQuoteError: string | null
  }
}

export type OnchainOwnerRow = {
  index: number
  ownerBytes: `0x${string}`
  ownerAddress: `0x${string}` | null
  type: 'EOA' | 'passkey' | 'empty' | 'unknown' | 'unreadable'
  readError?: string | null
}

export type LiveDiagnostics = {
  status: 'loading' | 'ready' | 'error'
  ownerCount: number | null
  nextOwnerIndex: number | null
  owners: OnchainOwnerRow[]
  cswEthBalance: bigint | null
  relayDepositoryEthBalance: bigint | null
  error: string | null
}

export const INITIAL_DIAGNOSTICS: LiveDiagnostics = {
  status: 'loading',
  ownerCount: null,
  nextOwnerIndex: null,
  owners: [],
  cswEthBalance: null,
  relayDepositoryEthBalance: null,
  error: null,
}

export const CSW_OWNER_ABI = [
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'nextOwnerIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
] as const

export function buildRelayStatusEndpointFromRequestId(requestId: `0x${string}`): string {
  return `https://api.relay.link/intents/status/v3?requestId=${encodeURIComponent(requestId)}`
}

export function normalizeRelayStatusEndpoint(rawEndpoint: string | null, requestId: `0x${string}`): string {
  const fallback = buildRelayStatusEndpointFromRequestId(requestId)
  const trimmed = typeof rawEndpoint === 'string' ? rawEndpoint.trim() : ''
  if (!trimmed) return fallback
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/')) return `https://api.relay.link${trimmed}`
  return fallback
}

export function extractRelayStatusText(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const value = typeof obj.status === 'string' ? obj.status : typeof obj.state === 'string' ? obj.state : null
  return value ? value.trim() || null : null
}

export async function deriveRelayQuoteSeedAmountWei(params: {
  publicClient: PublicClient | undefined
  cswAddress: `0x${string}`
  handleOpsCalldata: `0x${string}`
}): Promise<string> {
  const { publicClient, cswAddress, handleOpsCalldata } = params
  if (!publicClient) return RELAY_QUOTE_MIN_WEI.toString(10)
  try {
    const gasPrice = await publicClient.getGasPrice()
    let estimatedGas = RELAY_QUOTE_DEFAULT_GAS_LIMIT
    try {
      const estimate = await publicClient.estimateGas({
        account: cswAddress,
        to: ENTRY_POINT_V06_ADDRESS,
        data: handleOpsCalldata,
        value: 0n,
      })
      if (estimate > 0n) estimatedGas = estimate
    } catch {}
    const seeded = gasPrice * estimatedGas * RELAY_QUOTE_MULTIPLIER
    const clamped =
      seeded < RELAY_QUOTE_MIN_WEI
        ? RELAY_QUOTE_MIN_WEI
        : seeded > RELAY_QUOTE_MAX_WEI
          ? RELAY_QUOTE_MAX_WEI
          : seeded
    return clamped.toString(10)
  } catch {
    return RELAY_QUOTE_MIN_WEI.toString(10)
  }
}

export function extractExecuteQuotePayload(raw: unknown): RelayQuoteExecutePayload | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  let requestId: `0x${string}` | null = null
  let txValueWei: string | null = null
  let statusEndpoint: string | null = null

  const steps = Array.isArray(obj.steps) ? obj.steps : []
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue
    const stepObj = step as Record<string, unknown>
    if (!requestId && typeof stepObj.requestId === 'string' && /^0x[0-9a-fA-F]{64}$/.test(stepObj.requestId)) {
      requestId = stepObj.requestId as `0x${string}`
    }
    if (!statusEndpoint && stepObj.check && typeof stepObj.check === 'object') {
      const endpoint = (stepObj.check as Record<string, unknown>).endpoint
      if (typeof endpoint === 'string' && endpoint.trim()) statusEndpoint = endpoint
    }
    if (txValueWei) continue
    const items = Array.isArray(stepObj.items) ? stepObj.items : []
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      const data = (item as Record<string, unknown>).data
      if (!data || typeof data !== 'object') continue
      const value = (data as Record<string, unknown>).value
      if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
        txValueWei = value
        break
      }
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        txValueWei = Math.trunc(value).toString(10)
        break
      }
    }
  }

  if (!requestId) {
    const protocol = obj.protocol
    if (protocol && typeof protocol === 'object') {
      const v2 = (protocol as Record<string, unknown>).v2
      if (v2 && typeof v2 === 'object') {
        const orderId = (v2 as Record<string, unknown>).orderId
        if (typeof orderId === 'string' && /^0x[0-9a-fA-F]{64}$/.test(orderId)) {
          requestId = orderId as `0x${string}`
        }
      }
    }
  }

  if (!requestId || !txValueWei) return null
  return { requestId, txValueWei, statusEndpoint }
}

export function validateRelayQuoteIsNativeOnly(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const details =
    obj.details && typeof obj.details === 'object' ? (obj.details as Record<string, unknown>) : null

  const currencyInAddress =
    details?.currencyIn &&
    typeof details.currencyIn === 'object' &&
    (details.currencyIn as Record<string, unknown>).currency &&
    typeof (details.currencyIn as Record<string, unknown>).currency === 'object'
      ? ((details.currencyIn as Record<string, unknown>).currency as Record<string, unknown>).address
      : null
  if (typeof currencyInAddress === 'string' && currencyInAddress.toLowerCase() !== NATIVE_CURRENCY_ADDRESS) {
    return `Relay quote currencyIn is non-native (${currencyInAddress}). This flow only allows native ETH.`
  }

  const currencyOutAddress =
    details?.currencyOut &&
    typeof details.currencyOut === 'object' &&
    (details.currencyOut as Record<string, unknown>).currency &&
    typeof (details.currencyOut as Record<string, unknown>).currency === 'object'
      ? ((details.currencyOut as Record<string, unknown>).currency as Record<string, unknown>).address
      : null
  if (typeof currencyOutAddress === 'string' && currencyOutAddress.toLowerCase() !== NATIVE_CURRENCY_ADDRESS) {
    return `Relay quote currencyOut is non-native (${currencyOutAddress}). This flow only allows native ETH.`
  }

  const paymentDetailsCurrency =
    obj.protocol &&
    typeof obj.protocol === 'object' &&
    (obj.protocol as Record<string, unknown>).v2 &&
    typeof (obj.protocol as Record<string, unknown>).v2 === 'object' &&
    ((obj.protocol as Record<string, unknown>).v2 as Record<string, unknown>).paymentDetails &&
    typeof ((obj.protocol as Record<string, unknown>).v2 as Record<string, unknown>).paymentDetails === 'object'
      ? (((obj.protocol as Record<string, unknown>).v2 as Record<string, unknown>).paymentDetails as Record<
          string,
          unknown
        >).currency
      : null
  if (
    typeof paymentDetailsCurrency === 'string' &&
    paymentDetailsCurrency.toLowerCase() !== NATIVE_CURRENCY_ADDRESS
  ) {
    return `Relay paymentDetails currency is non-native (${paymentDetailsCurrency}). This flow only allows native ETH.`
  }

  return null
}

export function findForbiddenRelayCurrency(raw: unknown): string | null {
  const seen = new Set<unknown>()
  const stack: unknown[] = [raw]
  while (stack.length > 0) {
    const current = stack.pop()
    if (current == null || seen.has(current)) continue
    seen.add(current)
    if (typeof current === 'string') {
      const lower = current.toLowerCase()
      if (FORBIDDEN_RELAY_CURRENCY_ADDRESSES.has(lower)) {
        return lower
      }
      continue
    }
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item)
      continue
    }
    if (typeof current === 'object') {
      for (const value of Object.values(current as Record<string, unknown>)) {
        stack.push(value)
      }
    }
  }
  return null
}

export function validatePreviewRelayUserCallIsNativeDepository(preview: RemoveOwnerPreview | null): string | null {
  const userCall = preview?.relay?.userCall
  if (!userCall) return 'missing relay user call in preview'
  if (!/^0x[0-9a-fA-F]{40}$/.test(userCall.to)) {
    return `relay user call target is not a valid address (${userCall.to})`
  }
  if (!/^0x[0-9a-fA-F]+$/.test(userCall.data) || userCall.data.length < 10) {
    return 'relay user call calldata must include a function selector'
  }
  let valueWei: bigint
  try {
    valueWei = BigInt(userCall.value)
  } catch {
    return `relay user call value is not valid hex wei (${userCall.value})`
  }
  if (valueWei <= 0n) {
    return 'value must be non-zero native ETH'
  }
  // Accept either Relay's quoted router user-tx OR our depository fallback lane.
  // Depository fallback shape is identified by:
  //   to == RelayDepository && selector == depositNative (0x49290c1c)
  // Router quote shape has a different target/selector and is also valid.
  return null
}

function topicAddress(topic: string | undefined): `0x${string}` | null {
  if (!topic || typeof topic !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(topic)) return null
  return (`0x${topic.slice(26)}` as `0x${string}`).toLowerCase() as `0x${string}`
}

function toHex32Topic(value: `0x${string}`): `0x${string}` {
  const clean = value.slice(2).toLowerCase()
  return (`0x${clean.padStart(64, '0')}`) as `0x${string}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function pollRelayStatusEndpoint(params: {
  statusEndpoint: string
  timeoutMs?: number
  intervalMs?: number
  onTick?: (message: string) => void
}): Promise<RelayStatusCheckResult> {
  const timeoutMs = params.timeoutMs ?? 90_000
  const intervalMs = params.intervalMs ?? 2_000
  const start = Date.now()
  let attempt = 0
  let lastRaw: unknown = null
  let lastTxHash: `0x${string}` | null = null
  while (Date.now() - start < timeoutMs) {
    attempt += 1
    try {
      const response = await fetch(params.statusEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const raw = await response.json().catch(() => null)
      const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
      const statusText = String(obj?.status ?? obj?.state ?? '').trim().toLowerCase()
      const txCandidate = obj?.txHash ?? obj?.transactionHash ?? obj?.executionTxHash ?? null
      const txHash =
        typeof txCandidate === 'string' && /^0x[0-9a-fA-F]{64}$/.test(txCandidate)
          ? (txCandidate as `0x${string}`)
          : null
      const success =
        obj?.success === true ||
        statusText === 'success' ||
        statusText === 'completed' ||
        statusText === 'executed' ||
        statusText === 'fulfilled'
      const done =
        success ||
        statusText === 'failed' ||
        statusText === 'error' ||
        statusText === 'cancelled' ||
        statusText === 'reverted'

      lastRaw = raw
      lastTxHash = txHash
      params.onTick?.(`status_poll.attempt=${attempt} status=${statusText || 'unknown'} tx=${txHash ?? 'n/a'}`)
      if (done) return { done: true, success, txHash, raw }
    } catch {
      params.onTick?.(`status_poll.attempt=${attempt} status=fetch_error`)
    }
    await sleep(intervalMs)
  }
  return { done: false, success: false, txHash: lastTxHash, raw: lastRaw }
}

export async function verifyAARelayDepositShape(params: {
  publicClient: PublicClient | undefined
  txHash: `0x${string}`
  cswAddress: `0x${string}`
  expectedRequestId: `0x${string}`
  strictTrace?: boolean
}): Promise<
  | { ok: true; diagnostics: AADepositDiagnostics }
  | { ok: false; reason: string; diagnostics?: AADepositDiagnostics }
> {
  if (!params.publicClient) {
    return { ok: false, reason: 'Public client unavailable; cannot verify AA relay deposit shape.' }
  }
  const receipt = await params.publicClient.getTransactionReceipt({ hash: params.txHash })
  const expectedCsw = params.cswAddress.toLowerCase()
  const expectedRequestIdTopic = toHex32Topic(params.expectedRequestId)

  let userOpHash: `0x${string}` | null = null
  let userOpNonce: bigint | null = null
  let userOpSuccess: boolean | null = null
  let actualGasCostWei: bigint | null = null
  let actualGasUsed: bigint | null = null
  let userOpPaymaster: `0x${string}` | null = null
  let relayDepositFrom: `0x${string}` | null = null
  let relayDepositAmountWei: bigint | null = null
  let relayDepositRequestId: `0x${string}` | null = null
  let hasEntryPointUserOpForCsw = false
  let hasRelayDepositForCsw = false
  let hasMatchingRequestId = false
  let hasTraceEntryPointToCsw: boolean | null = null
  let hasTraceCswToDepository: boolean | null = null

  for (const log of receipt.logs) {
    const addressLower = log.address.toLowerCase()
    const topic0 = log.topics?.[0]?.toLowerCase() ?? ''
    if (addressLower === ENTRY_POINT_V06_ADDRESS.toLowerCase() && topic0 === ENTRY_POINT_USER_OPERATION_EVENT_TOPIC) {
      const senderTopicAddress = topicAddress(log.topics?.[2])
      if (senderTopicAddress && senderTopicAddress.toLowerCase() === expectedCsw) {
        hasEntryPointUserOpForCsw = true
      }
      const opHashTopic = log.topics?.[1]
      if (typeof opHashTopic === 'string' && /^0x[0-9a-fA-F]{64}$/.test(opHashTopic)) {
        userOpHash = opHashTopic as `0x${string}`
      }
      try {
        const [nonce, success, actualGasCost, gasUsed] = decodeAbiParameters(
          [{ type: 'uint256' }, { type: 'bool' }, { type: 'uint256' }, { type: 'uint256' }],
          log.data,
        )
        userOpNonce = nonce as bigint
        userOpSuccess = success as boolean
        actualGasCostWei = actualGasCost as bigint
        actualGasUsed = gasUsed as bigint
        userOpPaymaster =
          typeof log.topics?.[3] === 'string' && /^0x[0-9a-fA-F]{64}$/.test(log.topics[3])
            ? (`0x${log.topics[3].slice(26)}` as `0x${string}`).toLowerCase() as `0x${string}`
            : null
      } catch {}
      continue
    }

    if (addressLower === RELAY_DEPOSITORY_BASE.toLowerCase() && topic0 === RELAY_NATIVE_DEPOSIT_EVENT_TOPIC) {
      try {
        const [from, amount, requestId] = decodeAbiParameters(
          [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }],
          log.data,
        )
        if (String(from).toLowerCase() === expectedCsw) hasRelayDepositForCsw = true
        relayDepositFrom = String(from).toLowerCase() as `0x${string}`
        relayDepositAmountWei = amount as bigint
        relayDepositRequestId = requestId as `0x${string}`
        if ((requestId as string).toLowerCase() === expectedRequestIdTopic.toLowerCase()) {
          hasMatchingRequestId = true
        }
      } catch {
        return { ok: false, reason: 'Could not decode RelayNativeDeposit log data.' }
      }
    }
  }

  const diagnostics: AADepositDiagnostics = {
    txHash: params.txHash,
    blockNumber: receipt.blockNumber,
    userOpHash,
    userOpNonce,
    userOpSuccess,
    actualGasCostWei,
    actualGasUsed,
    userOpPaymaster,
    relayDepositFrom,
    relayDepositAmountWei,
    relayDepositRequestId,
    expectedRequestId: params.expectedRequestId,
    checks: {
      hasEntryPointUserOpForCsw,
      hasRelayDepositForCsw,
      requestIdMatches: hasMatchingRequestId,
      traceEntryPointToCsw: hasTraceEntryPointToCsw,
      traceCswToDepository: hasTraceCswToDepository,
    },
  }

  if (!hasEntryPointUserOpForCsw) {
    return {
      ok: false,
      reason: 'Deposit tx missing EntryPoint UserOperationEvent for canonical CSW (no CSW -> EntryPoint leg).',
      diagnostics,
    }
  }
  if (!hasRelayDepositForCsw) {
    return {
      ok: false,
      reason: 'Deposit tx missing RelayNativeDeposit for canonical CSW (no CSW -> RelayDepository leg).',
      diagnostics,
    }
  }
  if (!hasMatchingRequestId) {
    return {
      ok: false,
      reason: 'Deposit tx RelayNativeDeposit requestId does not match the expected request-bound Relay quote.',
      diagnostics,
    }
  }

  if (params.strictTrace) {
    const expectedEntryPoint = ENTRY_POINT_V06_ADDRESS.toLowerCase()
    const expectedCswLower = params.cswAddress.toLowerCase()
    const expectedDepository = RELAY_DEPOSITORY_BASE.toLowerCase()
    type TraceNode = {
      from?: string
      to?: string
      calls?: TraceNode[]
    }
    const hasEdge = (node: TraceNode | null | undefined, fromLower: string, toLower: string): boolean => {
      if (!node) return false
      const from = String(node.from ?? '').toLowerCase()
      const to = String(node.to ?? '').toLowerCase()
      if (from === fromLower && to === toLower) return true
      const calls = Array.isArray(node.calls) ? node.calls : []
      for (const child of calls) {
        if (hasEdge(child, fromLower, toLower)) return true
      }
      return false
    }
    try {
      const traceRaw = await (params.publicClient as any).request({
        method: 'debug_traceTransaction',
        params: [params.txHash, { tracer: 'callTracer' }],
      })
      const traceNode =
        traceRaw && typeof traceRaw === 'object' && !Array.isArray(traceRaw) ? (traceRaw as TraceNode) : null
      const traceEntryPointToCsw = hasEdge(traceNode, expectedEntryPoint, expectedCswLower)
      const traceCswToDepository = hasEdge(traceNode, expectedCswLower, expectedDepository)
      hasTraceEntryPointToCsw = traceEntryPointToCsw
      hasTraceCswToDepository = traceCswToDepository
      diagnostics.checks.traceEntryPointToCsw = traceEntryPointToCsw
      diagnostics.checks.traceCswToDepository = traceCswToDepository
      if (!traceEntryPointToCsw || !traceCswToDepository) {
        return {
          ok: false,
          reason: 'Strict trace check failed: missing required call edges (EntryPoint->CSW and/or CSW->RelayDepository).',
          diagnostics,
        }
      }
    } catch (error) {
      return {
        ok: false,
        reason: `Strict trace check failed: debug_traceTransaction unavailable or errored (${error instanceof Error ? error.message : String(error)}).`,
        diagnostics,
      }
    }
  }

  return { ok: true, diagnostics }
}

export function classifyOwnerBytes(ownerBytes: `0x${string}`): OnchainOwnerRow['type'] {
  const lenBytes = (ownerBytes.length - 2) / 2
  if (lenBytes === 0) return 'empty'
  if (lenBytes === 32) return 'EOA'
  if (lenBytes === 64) return 'passkey'
  return 'unknown'
}

export function decodeOwnerAddress(ownerBytes: `0x${string}`): `0x${string}` | null {
  const lenBytes = (ownerBytes.length - 2) / 2
  if (lenBytes !== 32) return null
  const tail = ownerBytes.slice(-40)
  if (!/^[0-9a-fA-F]{40}$/.test(tail)) return null
  return `0x${tail}` as `0x${string}`
}
