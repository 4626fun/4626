import { formatEther, type PublicClient } from 'viem'

import {
  CSW_OWNER_READ_ABI,
  RELAY_DEPOSITORY_BASE,
} from '@/lib/wallet/cswOwnerAbi'

export { RELAY_DEPOSITORY_BASE } from '@/lib/wallet/cswOwnerAbi'
export { CSW_OWNER_ABI, CSW_OWNER_READ_ABI, RELAY_DEPOSITORY_ABI } from '@/lib/wallet/cswOwnerAbi'

/** One EIP-5792 call. Shape matches what the backend preview returns. */
export type Eip5792Call = {
  to: `0x${string}`
  data: `0x${string}`
  value: `0x${string}`
}

/** Relay-orchestrated submission metadata for remove-owner. */
export type PreviewRelayFlow = {
  requestId: `0x${string}`
  orderId: `0x${string}` | null
  paymentDetails: {
    chainId: number | null
    depository: `0x${string}`
    currency: `0x${string}`
    amount: string
  } | null
  userCall: Eip5792Call
  userCallSource: 'quote_tx' | 'built_from_payment_details'
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

export type RemoveOwnerPreview = {
  /** Raw mutation calldata used for Relay quote reconstruction and on-chain checks. */
  txRequest: {
    chainId: 8453
    to: `0x${string}`
    data: `0x${string}`
    value: '0x0'
  }
  /** EIP-5792 calls from preview; Relay path submits the deposit userCall. */
  calls: Eip5792Call[]
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
    relayQuoteDiagnostics: {
      requestId: `0x${string}` | null
      orderId: `0x${string}` | null
      paymentDetails: {
        chainId: number | null
        depository: `0x${string}` | null
        currency: `0x${string}` | null
        amount: string | null
      } | null
      userTransaction: {
        to: `0x${string}`
        value: string
        chainId: number
        dataSelector: string | null
      } | null
      feeUsd: string | null
      rawSnippet: string | null
    } | null
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

const OWNER_SLOT_SCAN_HARD_CEILING = 256

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
  return null
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

export async function loadLiveCswDiagnostics(params: {
  publicClient: PublicClient
  cswAddress: `0x${string}`
}): Promise<LiveDiagnostics> {
  const { publicClient, cswAddress } = params
  try {
    const [ownerCountRaw, nextOwnerIndexRaw, cswBalance, depositoryBalance] = await Promise.all([
      publicClient.readContract({
        address: cswAddress,
        abi: CSW_OWNER_READ_ABI,
        functionName: 'ownerCount',
      }),
      publicClient.readContract({
        address: cswAddress,
        abi: CSW_OWNER_READ_ABI,
        functionName: 'nextOwnerIndex',
      }),
      publicClient.getBalance({ address: cswAddress }),
      publicClient.getBalance({ address: RELAY_DEPOSITORY_BASE }),
    ])
    const nextOwnerIndex = Number(nextOwnerIndexRaw)
    const rawScanLimit = Math.max(nextOwnerIndex, Number(ownerCountRaw))
    const scanLimit = Math.min(rawScanLimit, OWNER_SLOT_SCAN_HARD_CEILING)
    const slotResults = await Promise.allSettled(
      Array.from({ length: scanLimit }, (_, idx) =>
        publicClient.readContract({
          address: cswAddress,
          abi: CSW_OWNER_READ_ABI,
          functionName: 'ownerAtIndex',
          args: [BigInt(idx)],
        }),
      ),
    )
    const owners: OnchainOwnerRow[] = slotResults.map((result, idx) => {
      if (result.status === 'rejected') {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason ?? 'read failed')
        return {
          index: idx,
          ownerBytes: '0x',
          ownerAddress: null,
          type: 'unreadable',
          readError: message,
        }
      }
      const ownerBytes = result.value as `0x${string}`
      return {
        index: idx,
        ownerBytes,
        ownerAddress: decodeOwnerAddress(ownerBytes),
        type: classifyOwnerBytes(ownerBytes),
        readError: null,
      }
    })
    return {
      status: 'ready',
      ownerCount: Number(ownerCountRaw),
      nextOwnerIndex,
      owners,
      cswEthBalance: cswBalance,
      relayDepositoryEthBalance: depositoryBalance,
      error: null,
    }
  } catch (err: unknown) {
    return {
      ...INITIAL_DIAGNOSTICS,
      status: 'error',
      error: err instanceof Error ? err.message : 'Failed to load on-chain diagnostics.',
    }
  }
}

export function toRelayAmountDecimal(value: string | null | undefined): string | null {
  if (!value) return null
  if (/^[1-9][0-9]*$/.test(value)) return value
  if (/^0x[0-9a-fA-F]+$/.test(value)) {
    const wei = BigInt(value)
    return wei > 0n ? wei.toString(10) : null
  }
  return null
}

export function extractRelayExecutionTxHash(raw: unknown): `0x${string}` | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const txHashes = Array.isArray(obj.txHashes) ? obj.txHashes : []
  for (const tx of txHashes) {
    if (!tx || typeof tx !== 'object') continue
    const txHash = (tx as Record<string, unknown>).txHash
    if (typeof txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return txHash as `0x${string}`
    }
  }
  const steps = Array.isArray(obj.steps) ? obj.steps : []
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue
    const items = Array.isArray((step as Record<string, unknown>).items)
      ? ((step as Record<string, unknown>).items as unknown[])
      : []
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      const itemObj = item as Record<string, unknown>
      const receipt = itemObj.receipt
      if (receipt && typeof receipt === 'object') {
        const txHash = (receipt as Record<string, unknown>).transactionHash
        if (typeof txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(txHash)) {
          return txHash as `0x${string}`
        }
      }
      const itemTxHashes = Array.isArray(itemObj.txHashes) ? (itemObj.txHashes as unknown[]) : []
      for (const tx of itemTxHashes) {
        if (!tx || typeof tx !== 'object') continue
        const txHash = (tx as Record<string, unknown>).txHash
        if (typeof txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(txHash)) {
          return txHash as `0x${string}`
        }
      }
    }
  }
  return null
}

export function getWalletErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) {
    return error.message
  }
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object') {
    const maybeMessage = (error as Record<string, unknown>).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage
    try {
      return JSON.stringify(error)
    } catch {}
  }
  return 'unknown error'
}

export function formatCompactEth(value: bigint): string {
  const raw = formatEther(value)
  const [whole = '0', fraction = ''] = raw.split('.')
  const trimmedFraction = fraction.replace(/0+$/, '').slice(0, 6)
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole
}

export function mapRemoveOwnerSubmissionError(params: {
  error: unknown
  requiredDepositWei: bigint | null
  latestCswBalanceWei: bigint | null
}): string | null {
  const message =
    params.error instanceof Error
      ? params.error.message
      : typeof params.error === 'string'
        ? params.error
        : ''
  const normalized = message.toLowerCase()

  if (normalized.includes('networkid must be provided and not empty')) {
    return (
      'Relay quote metadata is missing a network identifier. Refresh the preview, keep your wallet on Base, and retry. ' +
      'If this keeps happening, regenerate the preview from the owner list before submitting.'
    )
  }

  if (
    normalized.includes('failed to estimate gas for user operation') &&
    normalized.includes('useroperation reverted')
  ) {
    const depositHint =
      params.requiredDepositWei && params.requiredDepositWei > 0n
        ? ` Required relay deposit: ${formatCompactEth(params.requiredDepositWei)} ETH.`
        : ''
    const balanceHint =
      params.latestCswBalanceWei !== null
        ? ` Current CSW balance: ${formatCompactEth(params.latestCswBalanceWei)} ETH.`
        : ''
    return (
      'Coinbase Wallet could not simulate this remove-owner UserOp. ' +
      'This usually means the targeted owner slot changed, the signer context is stale, or the CSW does not have enough ETH for Relay deposit.' +
      depositHint +
      balanceHint +
      ' Re-open the owner list to rebuild preview state, confirm the same owner is still at that index, and fund the CSW if needed.'
    )
  }
  return null
}
