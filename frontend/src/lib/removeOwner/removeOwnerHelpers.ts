import { formatEther, type PublicClient } from 'viem'

import { apiFetch } from '@/lib/api/apiBase'
import type {
  OwnerMutationEip5792Call,
  OwnerMutationRelayDepositSimulation,
  OwnerMutationRelayFlow,
  OwnerMutationRelayQuoteDiagnostics,
} from '@/lib/relay/ownerMutationTypes'
import {
  CSW_OWNER_READ_ABI,
  RELAY_DEPOSITORY_BASE,
  RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR,
  RELAY_MULTICALL_SELECTOR,
} from '@/lib/wallet/cswOwnerAbi'

export { RELAY_DEPOSITORY_BASE } from '@/lib/wallet/cswOwnerAbi'
export { CSW_OWNER_ABI, CSW_OWNER_READ_ABI, RELAY_DEPOSITORY_ABI } from '@/lib/wallet/cswOwnerAbi'
export type { OwnerMutationEip5792Call, OwnerMutationRelayFlow } from '@/lib/relay/ownerMutationTypes'

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
  calls: OwnerMutationEip5792Call[]
  relay: OwnerMutationRelayFlow | null
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
    relayDepositSimulation: OwnerMutationRelayDepositSimulation | null
    relayQuoteDiagnostics: OwnerMutationRelayQuoteDiagnostics | null
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

/** Unique Relay ids to pass as optional hints on POST /transactions/index. */
export function resolveRelayIndexRequestIds(
  relay: Pick<OwnerMutationRelayFlow, 'orderId' | 'requestId'>,
): `0x${string}`[] {
  const ids: `0x${string}`[] = []
  const push = (value: `0x${string}` | null | undefined) => {
    if (!value) return
    const lower = value.toLowerCase()
    if (ids.some((existing) => existing.toLowerCase() === lower)) return
    ids.push(value)
  }
  push(relay.orderId ?? null)
  push(relay.requestId)
  return ids
}

/**
 * Primary status poll id — prefer on-chain `depositNative` order id when present.
 * Relay binds explicit-deposit Part 1 to protocol.v2.orderId; steps[].requestId
 * can differ and returns `unknown` when polled alone.
 */
export function resolveRelayStatusRequestId(
  relay: Pick<OwnerMutationRelayFlow, 'orderId' | 'requestId'>,
): `0x${string}` {
  return (relay.orderId ?? relay.requestId) as `0x${string}`
}

/** Secondary poll id when primary returns `unknown` and ids differ. */
export function resolveRelayStatusFallbackRequestId(
  relay: Pick<OwnerMutationRelayFlow, 'orderId' | 'requestId'>,
): `0x${string}` | null {
  if (!relay.orderId) return null
  if (relay.orderId.toLowerCase() === relay.requestId.toLowerCase()) return null
  return relay.requestId
}

export type ParsedRelayIntentStatus = {
  statusText: string
  success: boolean
  done: boolean
  txHash: `0x${string}` | null
}

export function parseRelayIntentStatus(raw: unknown): ParsedRelayIntentStatus {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  const statusText = String(obj?.status ?? obj?.state ?? '').trim().toLowerCase()
  const txCandidate = obj?.txHash ?? obj?.transactionHash ?? obj?.executionTxHash ?? null
  const txHash =
    typeof txCandidate === 'string' && /^0x[0-9a-fA-F]{64}$/.test(txCandidate)
      ? (txCandidate as `0x${string}`)
      : extractRelayExecutionTxHash(raw)
  const success =
    obj?.success === true ||
    statusText === 'success' ||
    statusText === 'completed' ||
    statusText === 'executed' ||
    statusText === 'fulfilled'
  const done =
    success ||
    statusText === 'failed' ||
    statusText === 'failure' ||
    statusText === 'error' ||
    statusText === 'cancelled' ||
    statusText === 'canceled' ||
    statusText === 'reverted' ||
    statusText === 'refund' ||
    statusText === 'unknown'
  return { statusText, success, done, txHash }
}

export function normalizeRelayStatusEndpoint(rawEndpoint: string | null, requestId: `0x${string}`): string {
  const fallback = buildRelayStatusEndpointFromRequestId(requestId)
  const trimmed = typeof rawEndpoint === 'string' ? rawEndpoint.trim() : ''
  if (!trimmed) return fallback
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/')) return `https://api.relay.link${trimmed}`
  return fallback
}

export function validatePreviewRelayUserCallIsNativeDepository(
  preview: { relay?: OwnerMutationRelayFlow | null } | null,
  options?: { depositoryOnly?: boolean },
): string | null {
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
  const selector = userCall.data.slice(0, 10).toLowerCase()
  const target = userCall.to.toLowerCase()
  const isRouterMulticall = selector === RELAY_MULTICALL_SELECTOR
  const isDepositoryNativeDeposit =
    selector === RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR &&
    target === RELAY_DEPOSITORY_BASE.toLowerCase()
  if (options?.depositoryOnly) {
    if (!isDepositoryNativeDeposit) {
      return `CSW self-auth Part 1 must be native ETH Depository.depositNative (${RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR}); Relay router/USDC paths are not allowed`
    }
    return null
  }
  if (!isRouterMulticall && !isDepositoryNativeDeposit) {
    return `relay user call must be RelayRouter multicall (${RELAY_MULTICALL_SELECTOR}) or RelayDepository.depositNative (${RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR})`
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
  /** When true (e.g. on-chain owner already installed), stop polling early as success. */
  shouldShortCircuitSuccess?: () => Promise<boolean>
}): Promise<RelayStatusCheckResult> {
  const timeoutMs = params.timeoutMs ?? 90_000
  const intervalMs = params.intervalMs ?? 2_000
  const start = Date.now()
  let attempt = 0
  let lastRaw: unknown = null
  let lastTxHash: `0x${string}` | null = null
  while (Date.now() - start < timeoutMs) {
    attempt += 1
    if (params.shouldShortCircuitSuccess) {
      try {
        if (await params.shouldShortCircuitSuccess()) {
          params.onTick?.(`status_poll.attempt=${attempt} short_circuit=on_chain_verified`)
          return { done: true, success: true, txHash: lastTxHash, raw: lastRaw }
        }
      } catch {
        /* keep polling */
      }
    }
    try {
      const response = await fetch(params.statusEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const raw = await response.json().catch(() => null)
      const parsed = parseRelayIntentStatus(raw)
      lastRaw = raw
      lastTxHash = parsed.txHash ?? lastTxHash
      params.onTick?.(
        `status_poll.attempt=${attempt} status=${parsed.statusText || 'unknown'} tx=${lastTxHash ?? 'n/a'}`,
      )
      if (parsed.done) {
        return { done: true, success: parsed.success, txHash: lastTxHash, raw }
      }
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

function asEvmTxHash(value: unknown): `0x${string}` | null {
  if (typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)) {
    return value as `0x${string}`
  }
  return null
}

export function extractRelayExecutionTxHash(raw: unknown): `0x${string}` | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  const outTxHashes = Array.isArray(obj.outTxHashes) ? obj.outTxHashes : []
  for (const tx of outTxHashes) {
    const hash = asEvmTxHash(tx)
    if (hash) return hash
  }

  const txHashes = Array.isArray(obj.txHashes) ? obj.txHashes : []
  for (const tx of txHashes) {
    const hash =
      typeof tx === 'string'
        ? asEvmTxHash(tx)
        : tx && typeof tx === 'object'
          ? asEvmTxHash((tx as Record<string, unknown>).txHash)
          : null
    if (hash) return hash
  }

  const inTxHashes = Array.isArray(obj.inTxHashes) ? obj.inTxHashes : []
  for (const tx of inTxHashes) {
    const hash = asEvmTxHash(tx)
    if (hash) return hash
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

export async function fetchRemoveOwnerPreview(params: {
  cswAddress: string
  connectedAddress: string
  ownerIndex: number
}): Promise<RemoveOwnerPreview> {
  const res = await apiFetch('/api/onboarding/preview-remove-owner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cswAddress: params.cswAddress,
      connectedAddress: params.connectedAddress,
      ownerIndex: params.ownerIndex,
    }),
  })
  const json = (await res.json().catch(() => null)) as {
    success?: boolean
    error?: string
    data?: RemoveOwnerPreview
  } | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error ?? `preview-remove-owner failed (${res.status})`)
  }
  return json.data
}

export function mapRemoveOwnerSubmissionError(params: {
  error: unknown
  requiredDepositWei: bigint | null
  latestCswBalanceWei: bigint | null
  isSelfAuthSession?: boolean
  fundingCswAddress?: string | null
}): string | null {
  const message =
    params.error instanceof Error
      ? params.error.message
      : typeof params.error === 'string'
        ? params.error
        : ''
  const normalized = message.toLowerCase()

  if (
    normalized.includes("must call 'eth_requestaccounts'") ||
    normalized.includes('must call "eth_requestaccounts"') ||
    normalized.includes('not been authorized by the user')
  ) {
    return (
      'Base App wallet session is not authorized for signing. Re-open https://4626.fun/waitlist?setup=base-app inside Base App, approve the wallet connection when prompted, then retry Submit Relay add.'
    )
  }

  const depositHint =
    params.requiredDepositWei && params.requiredDepositWei > 0n
      ? ` Required relay deposit: ${formatCompactEth(params.requiredDepositWei)} ETH.`
      : ''
  const balanceHint =
    params.latestCswBalanceWei !== null
      ? ` Smart wallet balance: ${formatCompactEth(params.latestCswBalanceWei)} ETH.`
      : ''

  if (
    normalized.includes('insufficient funds') ||
    normalized.includes('not enough funds') ||
    normalized.includes('error generating transaction')
  ) {
    const balanceCoversDeposit =
      params.latestCswBalanceWei !== null &&
      params.requiredDepositWei !== null &&
      params.requiredDepositWei > 0n &&
      params.latestCswBalanceWei >= params.requiredDepositWei

    if (params.isSelfAuthSession && balanceCoversDeposit) {
      return (
        'Base App reported insufficient funds, but your smart wallet balance covers the Relay deposit.' +
        depositHint +
        balanceHint +
        ' Re-open this page inside Base App, confirm Base Mainnet is selected, and retry. If it persists, rebuild the preview and submit again without switching to an embedded-signer connection.'
      )
    }

    if (params.isSelfAuthSession) {
      return (
        'Relay deposit must be paid from your Coinbase Smart Wallet inside Base App.' +
        depositHint +
        balanceHint +
        ' Fund the smart wallet on Base Mainnet, then rebuild the preview and retry.'
      )
    }

    return (
      'Relay deposit must be paid from the connected external owner wallet, not the smart wallet custody address.' +
      depositHint +
      ' Connect the owner wallet that holds ETH on Base, fund that wallet if needed, rebuild the preview, and retry.'
    )
  }

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
      'Coinbase Wallet could not simulate this owner-change UserOp. ' +
      'This usually means the Relay deposit would revert, the signer context is stale, or the funding wallet does not have enough ETH for the Relay deposit plus gas.' +
      depositHint +
      balanceHint +
      ' Rebuild preview, confirm Base Mainnet, fund the funding smart wallet if needed, then retry.'
    )
  }

  if (
    normalized.includes('does not recognize this quote requestid') ||
    normalized.includes('err_relay_status_incomplete:unknown')
  ) {
    return 'Relay lost track of this quote. Tap Rebuild preview, then submit again without waiting on a stale preview.'
  }

  if (normalized.includes('relay owner mutation did not complete')) {
    return 'Relay has not finished executing this owner change yet. Wait one minute, use Recheck, and only rebuild the preview if on-chain signing is still missing.'
  }

  return null
}
