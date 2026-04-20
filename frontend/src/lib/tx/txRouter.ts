import { encodeFunctionData } from 'viem'

import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { recordUserOpTelemetry } from '@/lib/aa/coinbaseErc4337Telemetry'
import { appendBuilderSuffixToHex } from '@/lib/base/baseBuilderCodes'
import type { TransactionRequest } from '@/lib/uniswap/tradingApi'
import type { AccountCapabilities, SignerType } from '@/wallet/accountContext'
import {
  isAllowedCanonicalSigner,
  isTargetCanonicalCsw,
  resolvePolicyCanonicalAddress,
  shouldApplyCanonicalEnforcement,
} from '@/wallet/canonicalWalletPolicy'

const COINBASE_SMART_WALLET_EXECUTE_BATCH_ABI = [
  {
    type: 'function',
    name: 'executeBatch',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
] as const

export type TxSendMode = 'sendCalls' | 'canonical4337' | 'canonicalDirect' | 'eoaDirect'
export type TxMethod =
  | 'wallet_sendCalls'
  | 'eth_sendUserOperation'
  | 'walletClient.sendTransaction'
  | 'eth_sendTransaction'

export type TxRouterContext = {
  chainId: number
  executionMode: 'canonical' | 'eoa'
  walletClient: unknown
  publicClient: unknown
  canonicalAddress: `0x${string}` | null
  signerAddress: `0x${string}` | null
  executionAddress: `0x${string}` | null
  signerType?: SignerType
  connectorId?: string | null
  connectorName?: string | null
  capabilities?: AccountCapabilities | null
  debug?: (event: TxRouterDebugEvent) => void
}

export type TxRoutingDecision = {
  mode: TxSendMode
  fallbackMode: TxSendMode
  smartWalletDetected: boolean
  supportsSendCallsHint: boolean
  reason: string
}

export type TxRouterDebugEvent = {
  event: 'route_selected' | 'send_attempt' | 'send_success' | 'send_error' | 'send_fallback'
  mode: TxSendMode
  fallbackMode?: TxSendMode
  method?: TxMethod
  chainId: number
  sender: string | null
  callTargets: string[]
  reason?: string
  connectorId?: string | null
  connectorName?: string | null
  smartWalletDetected?: boolean
  supportsSendCallsHint?: boolean
  txHash?: string | null
  callsId?: string | null
  error?: string
}

export type TxRouterSendResult = {
  mode: TxSendMode
  method: TxMethod
  sender: `0x${string}` | null
  transactionHash: string | null
  callsId: string | null
  txHashes: string[]
}

type RoutedCall = {
  to: `0x${string}`
  data: `0x${string}`
  value: bigint
  tx: TransactionRequest
}

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.floor(value))
  if (typeof value === 'string' && value.trim()) return BigInt(value)
  return 0n
}

function asOptionalBigInt(value: unknown): bigint | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string' && !value.trim()) return undefined
  return asBigInt(value)
}

function toHex(value: bigint): `0x${string}` {
  return `0x${value.toString(16)}` as `0x${string}`
}

function toChainHex(chainId: number): `0x${string}` {
  return `0x${Math.floor(chainId).toString(16)}` as `0x${string}`
}

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value)
}

function collectErrorCodesAndMessages(error: unknown): { codes: Array<string | number>; messages: string[] } {
  const codes: Array<string | number> = []
  const messages: string[] = []
  const queue: unknown[] = [error]
  const visited = new Set<object>()

  while (queue.length) {
    const current = queue.shift()
    if (current === null || current === undefined) continue
    if (typeof current === 'string') {
      messages.push(current)
      continue
    }
    if (typeof current === 'number') {
      codes.push(current)
      continue
    }
    if (typeof current === 'object') {
      if (visited.has(current)) continue
      visited.add(current)

      if (current instanceof Error) {
        messages.push(current.message)
      }
      const record = current as Record<string, unknown>
      for (const key of ['code', 'status', 'statusCode', 'errorCode']) {
        const value = record[key]
        if (typeof value === 'number' || typeof value === 'string') codes.push(value)
      }
      for (const key of ['message', 'shortMessage', 'details', 'reason', 'errorMessage']) {
        const value = record[key]
        if (typeof value === 'string' && value.trim()) messages.push(value)
      }
      for (const key of ['cause', 'error', 'data']) {
        if (record[key] !== undefined) queue.push(record[key])
      }
      continue
    }
  }

  return { codes, messages }
}

function isSendCallsUnsupportedError(error: unknown): boolean {
  const { codes, messages } = collectErrorCodesAndMessages(error)
  const normalizedCodes = codes.map((value) => String(value).trim().toLowerCase())
  const numericCodes = normalizedCodes
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))

  if (numericCodes.includes(-32601) || numericCodes.includes(4200)) return true
  if (normalizedCodes.some((value) => value.includes('method_not_found'))) return true
  if (normalizedCodes.some((value) => value.includes('unsupported_method'))) return true

  const normalizedMessage = messages.join(' ').toLowerCase()
  return (
    normalizedMessage.includes('wallet_sendcalls') ||
    normalizedMessage.includes('wallet sendcalls') ||
    normalizedMessage.includes('method not found') ||
    normalizedMessage.includes('unsupported method') ||
    normalizedMessage.includes('method is not supported') ||
    normalizedMessage.includes('requested method is not supported') ||
    normalizedMessage.includes('unsupported or unrecognized eip-1193 api method') ||
    normalizedMessage.includes('missing or invalid. request()') ||
    normalizedMessage.includes('eip-5792') ||
    normalizedMessage.includes('sendcalls')
  )
}

function normalizeConnectorId(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function normalizeConnectorName(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function normalizeTx(tx: TransactionRequest): RoutedCall {
  if (!tx.to || !tx.data) throw new Error('Invalid transaction payload')
  return {
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value: asBigInt(tx.value),
    tx,
  }
}

export function normalizeCanonicalSendError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const details =
    typeof (error as any)?.details === 'string'
      ? String((error as any).details)
      : typeof (error as any)?.cause?.details === 'string'
        ? String((error as any).cause.details)
        : ''
  const diagnostic = [message, details].filter((part) => typeof part === 'string' && part.trim().length > 0).join(' | ')
  const lower = diagnostic.toLowerCase()

  if (lower.includes('missing 4626 session token')) {
    return new Error('Missing 4626 session token for paymaster request.')
  }

  if (lower.includes('request denied') || lower.includes('not authenticated')) {
    return new Error('Paymaster rejected the swap because your 4626 session is not authenticated.')
  }

  if (lower.includes('session principal does not own sender csw') || lower.includes('not_owner')) {
    return new Error('Session principal does not own sender CSW for canonical swap execution.')
  }

  if (lower.includes('not an onchain owner of the smart wallet')) {
    return new Error('Privy embedded wallet is not an owner on the canonical smart wallet.')
  }

  return error instanceof Error ? error : new Error(message || 'Canonical swap send failed.')
}

function isCanonicalSponsorshipLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const details =
    typeof (error as any)?.details === 'string'
      ? String((error as any).details)
      : typeof (error as any)?.cause?.details === 'string'
        ? String((error as any).cause.details)
        : ''
  const diagnostic = [message, details]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .join(' | ')
    .toLowerCase()

  return (
    diagnostic.includes('sponsorship limit exceeded') ||
    diagnostic.includes('request exceeds defined limit') ||
    diagnostic.includes('max sponsorship cost') ||
    diagnostic.includes('sponsorship cost per user op exceeded') ||
    diagnostic.includes('insufficient sponsorship funds')
  )
}

function toRoutedCalls(params: { swapTx: TransactionRequest; approvalTx?: TransactionRequest | null }): RoutedCall[] {
  const calls: RoutedCall[] = []
  if (params.approvalTx) calls.push(normalizeTx(params.approvalTx))
  calls.push(normalizeTx(params.swapTx))
  return calls
}

function callsIncludeNativeValue(calls: RoutedCall[]): boolean {
  return calls.some((call) => call.value > 0n)
}

function resolveCanonicalIdentityAddress(context: TxRouterContext): `0x${string}` | null {
  return (
    resolvePolicyCanonicalAddress({
      canonicalAddress: context.canonicalAddress ?? context.executionAddress ?? null,
      signerAddress: context.signerAddress,
    }) ??
    context.canonicalAddress ??
    context.executionAddress ??
    null
  )
}

function assertCanonicalPolicyContext(context: TxRouterContext): void {
  const policyApplies = shouldApplyCanonicalEnforcement({
    canonicalAddress: context.canonicalAddress,
    executionAddress: context.executionAddress,
    signerAddress: context.signerAddress,
  })
  if (!policyApplies) return

  if (context.executionMode !== 'canonical') {
    throw new Error('Canonical CSW policy requires canonical execution mode')
  }

  const canonicalIdentity = resolveCanonicalIdentityAddress(context)
  if (!isTargetCanonicalCsw(canonicalIdentity)) {
    throw new Error('Canonical CSW policy requires the configured canonical smart wallet identity')
  }
  if (context.executionAddress && !isTargetCanonicalCsw(context.executionAddress)) {
    throw new Error('Canonical CSW policy blocked non-canonical execution address')
  }
  if (!isAllowedCanonicalSigner(context.signerAddress)) {
    throw new Error('Canonical CSW policy requires an allowed owner signer')
  }
  if (context.signerType === 'SMART_WALLET' && !isTargetCanonicalCsw(context.signerAddress)) {
    throw new Error('Canonical CSW policy blocks non-canonical smart-wallet signers')
  }
}

function inferSmartWalletDetection(context: TxRouterContext): boolean {
  if (context.signerType === 'SMART_WALLET') return true
  if (context.executionMode !== 'canonical') return false
  const caps = context.capabilities
  if (!caps) return false
  const atomicReady = caps.atomicStatus === 'supported' || caps.atomicStatus === 'ready'
  return caps.paymasterService || atomicReady
}

function supportsSendCallsHint(context: TxRouterContext): boolean {
  const request = (context.walletClient as any)?.request
  if (typeof request !== 'function') return false
  const caps = context.capabilities
  const atomicReady = caps?.atomicStatus === 'supported' || caps?.atomicStatus === 'ready'
  if (caps?.supports5792 || caps?.paymasterService || atomicReady) return true

  const connectorId = normalizeConnectorId(context.connectorId)
  const connectorName = normalizeConnectorName(context.connectorName)
  const coinbaseConnector = connectorId.includes('coinbase') || connectorName.includes('coinbase')
  if (coinbaseConnector && context.signerType === 'SMART_WALLET') return true
  return false
}

export function detectTxSendMode(context: TxRouterContext): TxRoutingDecision {
  assertCanonicalPolicyContext(context)
  const smartWalletDetected = inferSmartWalletDetection(context)
  const sendCallsHint = supportsSendCallsHint(context)
  const canonicalIdentity = resolveCanonicalIdentityAddress(context)
  const selectedSender = context.executionMode === 'canonical' ? canonicalIdentity : context.signerAddress

  if (context.executionMode === 'canonical' && sendCallsHint) {
    const decision: TxRoutingDecision = {
      mode: 'sendCalls',
      fallbackMode: smartWalletDetected ? 'canonicalDirect' : 'canonical4337',
      smartWalletDetected,
      supportsSendCallsHint: sendCallsHint,
      reason: 'canonical mode + wallet_sendCalls capability/connector hint',
    }
    context.debug?.({
      event: 'route_selected',
      mode: decision.mode,
      fallbackMode: decision.fallbackMode,
      chainId: context.chainId,
      sender: selectedSender,
      callTargets: [],
      reason: decision.reason,
      connectorId: context.connectorId ?? null,
      connectorName: context.connectorName ?? null,
      smartWalletDetected,
      supportsSendCallsHint: sendCallsHint,
    })
    return decision
  }

  if (context.executionMode === 'canonical') {
    const mode: TxSendMode =
      !smartWalletDetected && context.publicClient && context.canonicalAddress && context.signerAddress
        ? 'canonical4337'
        : 'canonicalDirect'
    const fallbackMode: TxSendMode = mode === 'canonical4337' ? 'canonicalDirect' : mode
    const decision: TxRoutingDecision = {
      mode,
      fallbackMode,
      smartWalletDetected,
      supportsSendCallsHint: sendCallsHint,
      reason: mode === 'canonical4337' ? 'canonical owner signer path' : 'canonical connector-native direct path',
    }
    context.debug?.({
      event: 'route_selected',
      mode: decision.mode,
      fallbackMode: decision.fallbackMode,
      chainId: context.chainId,
      sender: selectedSender,
      callTargets: [],
      reason: decision.reason,
      connectorId: context.connectorId ?? null,
      connectorName: context.connectorName ?? null,
      smartWalletDetected,
      supportsSendCallsHint: sendCallsHint,
    })
    return decision
  }

  const decision: TxRoutingDecision = {
    mode: 'eoaDirect',
    fallbackMode: 'eoaDirect',
    smartWalletDetected,
    supportsSendCallsHint: sendCallsHint,
    reason: 'eoa mode direct sendTransaction path',
  }
  context.debug?.({
    event: 'route_selected',
    mode: decision.mode,
    fallbackMode: decision.fallbackMode,
    chainId: context.chainId,
    sender: selectedSender,
    callTargets: [],
    reason: decision.reason,
    connectorId: context.connectorId ?? null,
    connectorName: context.connectorName ?? null,
    smartWalletDetected,
    supportsSendCallsHint: sendCallsHint,
  })
  return decision
}

async function waitForCallsStatus(params: {
  wallet: any
  id: string
  timeoutMs?: number
  pollMs?: number
}): Promise<{ txHash: string | null }> {
  const timeoutMs = params.timeoutMs ?? 90_000
  const pollMs = params.pollMs ?? 1_000
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    let result: any = null
    try {
      result = await params.wallet.request({
        method: 'wallet_getCallsStatus',
        params: [params.id],
      })
    } catch {
      return { txHash: null }
    }
    const statusCode = Number(result?.status)
    const receipts = Array.isArray(result?.receipts) ? result.receipts : []
    const receiptHash =
      receipts
        .map((receipt: Record<string, unknown>) => String(receipt?.transactionHash ?? ''))
        .find((value: string) => isTxHash(value)) ?? null
    if (Number.isFinite(statusCode)) {
      if (statusCode >= 200 && statusCode < 300) return { txHash: receiptHash }
      if (statusCode >= 300) {
        throw new Error(`wallet_sendCalls failed with status ${statusCode}`)
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  return { txHash: null }
}

function classifySendCallsErrorCode(error: unknown): string | null {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const lower = raw.toLowerCase()
  if (!lower) return null
  if (lower.includes('user rejected') || lower.includes('user denied')) return 'user_rejected'
  if (lower.includes('unsupported') && lower.includes('wallet_sendcalls')) return 'wallet_sendcalls_unsupported'
  if (lower.includes('timeout') || lower.includes('timed out')) return 'timeout'
  if (lower.includes('insufficient funds')) return 'insufficient_funds'
  if (lower.includes('no call bundle id')) return 'no_callsid'
  return 'wallet_sendcalls_error'
}

async function sendViaSendCalls(params: {
  context: TxRouterContext
  decision: TxRoutingDecision
  calls: RoutedCall[]
}): Promise<TxRouterSendResult> {
  const { context, decision, calls } = params
  assertCanonicalPolicyContext(context)
  const wallet = context.walletClient as any
  if (typeof wallet?.request !== 'function') {
    throw new Error('Connected wallet does not support provider request() for wallet_sendCalls')
  }
  const sender =
    context.executionMode === 'canonical'
      ? resolveCanonicalIdentityAddress(context)
      : context.signerAddress ?? context.executionAddress ?? null
  context.debug?.({
    event: 'send_attempt',
    mode: decision.mode,
    fallbackMode: decision.fallbackMode,
    method: 'wallet_sendCalls',
    chainId: context.chainId,
    sender,
    callTargets: calls.map((call) => call.to),
  })
  const startedAt = Date.now()
  let telemetryStatus: 'success' | 'error' | 'timeout' = 'error'
  let telemetryErrorCode: string | null = null
  let fellBackToAnotherMode = false
  try {
    const response = await wallet.request({
      method: 'wallet_sendCalls',
      params: [
        {
          chainId: toChainHex(context.chainId),
          from: sender ?? undefined,
          calls: calls.map((call) => ({
            to: call.to,
            data: call.data,
            value: toHex(call.value),
          })),
          atomicRequired: calls.length > 1,
          version: '2.0.0',
        },
      ],
    })
    const callsId =
      typeof response === 'string'
        ? response
        : response && typeof response === 'object' && typeof (response as any).id === 'string'
          ? String((response as any).id)
          : ''
    if (!callsId) throw new Error('wallet_sendCalls returned no call bundle id')
    const status = await waitForCallsStatus({ wallet, id: callsId })
    // Count the sample as a timeout (not success) when the bundle never
    // resolved to a tx hash within the polling window. Otherwise unresolved
    // calls skew success-rate metrics upward.
    if (status.txHash) {
      telemetryStatus = 'success'
    } else {
      telemetryStatus = 'timeout'
      telemetryErrorCode = 'timeout'
    }
    context.debug?.({
      event: 'send_success',
      mode: decision.mode,
      fallbackMode: decision.fallbackMode,
      method: 'wallet_sendCalls',
      chainId: context.chainId,
      sender,
      callTargets: calls.map((call) => call.to),
      txHash: status.txHash,
      callsId,
    })
    return {
      mode: decision.mode,
      method: 'wallet_sendCalls',
      sender,
      transactionHash: status.txHash,
      callsId,
      txHashes: status.txHash ? [status.txHash] : [],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '')
    telemetryErrorCode = classifySendCallsErrorCode(error)
    telemetryStatus = telemetryErrorCode === 'timeout' ? 'timeout' : 'error'
    context.debug?.({
      event: 'send_error',
      mode: decision.mode,
      fallbackMode: decision.fallbackMode,
      method: 'wallet_sendCalls',
      chainId: context.chainId,
      sender,
      callTargets: calls.map((call) => call.to),
      error: message,
    })
    if (isSendCallsUnsupportedError(error) && decision.fallbackMode !== 'sendCalls') {
      context.debug?.({
        event: 'send_fallback',
        mode: decision.mode,
        fallbackMode: decision.fallbackMode,
        method: 'wallet_sendCalls',
        chainId: context.chainId,
        sender,
        callTargets: calls.map((call) => call.to),
        error: message,
      })
      fellBackToAnotherMode = true
      return sendViaMode({ context, decision: { ...decision, mode: decision.fallbackMode }, calls })
    }
    throw error
  } finally {
    // Don't double-count a sample when we bounced to a sibling path — that
    // path records its own telemetry.
    if (!fellBackToAnotherMode) {
      recordUserOpTelemetry({
        status: telemetryStatus,
        durationMs: Math.max(0, Date.now() - startedAt),
        verificationGasLimit: null,
        // The wallet decides sponsorship on its side; from 4626's perspective
        // we're not the sponsor, so track this as self_funded.
        paymasterMode: 'self_funded',
        signatureMode: 'auto',
        ownerIsContract: false,
        errorCode: telemetryErrorCode,
        submissionPath: 'wallet_sendCalls',
      })
    }
  }
}

async function sendViaCanonical4337(params: {
  context: TxRouterContext
  decision: TxRoutingDecision
  calls: RoutedCall[]
}): Promise<TxRouterSendResult> {
  const { context, decision, calls } = params
  assertCanonicalPolicyContext(context)
  const canonicalIdentity = resolveCanonicalIdentityAddress(context)
  if (!canonicalIdentity || !context.signerAddress || !context.publicClient || !context.walletClient) {
    throw new Error('Canonical smart wallet or owner signer is not ready for ERC-4337 execution')
  }
  const sender = canonicalIdentity
  context.debug?.({
    event: 'send_attempt',
    mode: decision.mode,
    fallbackMode: decision.fallbackMode,
    method: 'eth_sendUserOperation',
    chainId: context.chainId,
    sender,
    callTargets: calls.map((call) => call.to),
  })
  const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
  const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
  let result: Awaited<ReturnType<typeof sendCoinbaseSmartWalletUserOperation>>
  try {
    result = await sendCoinbaseSmartWalletUserOperation({
      publicClient: context.publicClient as any,
      walletClient: context.walletClient as any,
      bundlerUrl,
      smartWallet: canonicalIdentity,
      ownerAddress: context.signerAddress,
      // Let the ERC-4337 helper handle attribution so it can preserve canonical
      // calldata for strict paymaster policies (e.g. Universal Router execute).
      calls: calls.map((call) => ({
        to: call.to,
        data: call.data,
        value: call.value,
      })),
      version: '1',
    })
  } catch (error) {
    const normalized = normalizeCanonicalSendError(error)
    const shouldFallbackToCanonicalDirect =
      params.decision.fallbackMode === 'canonicalDirect' && isCanonicalSponsorshipLimitError(error)
    if (shouldFallbackToCanonicalDirect) {
      context.debug?.({
        event: 'send_fallback',
        mode: decision.mode,
        fallbackMode: 'canonicalDirect',
        method: 'eth_sendUserOperation',
        chainId: context.chainId,
        sender,
        callTargets: calls.map((call) => call.to),
        error: normalized.message,
      })
      return sendViaMode({
        context,
        decision: { ...decision, mode: 'canonicalDirect', fallbackMode: 'canonicalDirect' },
        calls,
      })
    }
    throw normalized
  }
  context.debug?.({
    event: 'send_success',
    mode: decision.mode,
    fallbackMode: decision.fallbackMode,
    method: 'eth_sendUserOperation',
    chainId: context.chainId,
    sender,
    callTargets: calls.map((call) => call.to),
    txHash: result.transactionHash,
  })
  return {
    mode: decision.mode,
    method: 'eth_sendUserOperation',
    sender,
    transactionHash: result.transactionHash,
    callsId: null,
    txHashes: [result.transactionHash],
  }
}

async function sendViaCanonicalDirect(params: {
  context: TxRouterContext
  decision: TxRoutingDecision
  calls: RoutedCall[]
}): Promise<TxRouterSendResult> {
  const { context, decision, calls } = params
  assertCanonicalPolicyContext(context)
  const canonicalIdentity = resolveCanonicalIdentityAddress(context)
  if (!canonicalIdentity || !context.signerAddress || !context.walletClient) {
    throw new Error('Canonical direct send is not ready')
  }
  const wallet = context.walletClient as any
  const executeBatchData = encodeFunctionData({
    abi: COINBASE_SMART_WALLET_EXECUTE_BATCH_ABI,
    functionName: 'executeBatch',
    args: [
      calls.map((call) => ({
        target: call.to,
        value: call.value,
        data: call.data,
      })),
    ],
  })
  const sender = canonicalIdentity
  if (typeof wallet?.sendTransaction === 'function') {
    context.debug?.({
      event: 'send_attempt',
      mode: decision.mode,
      fallbackMode: decision.fallbackMode,
      method: 'walletClient.sendTransaction',
      chainId: context.chainId,
      sender,
      callTargets: calls.map((call) => call.to),
    })
    const txHash = await wallet.sendTransaction({
      account: context.signerAddress,
      to: canonicalIdentity,
      value: 0n,
      data: executeBatchData,
    })
    if (!isTxHash(txHash)) throw new Error('Canonical direct send did not return a valid transaction hash')
    context.debug?.({
      event: 'send_success',
      mode: decision.mode,
      fallbackMode: decision.fallbackMode,
      method: 'walletClient.sendTransaction',
      chainId: context.chainId,
      sender,
      callTargets: calls.map((call) => call.to),
      txHash,
    })
    return {
      mode: decision.mode,
      method: 'walletClient.sendTransaction',
      sender,
      transactionHash: txHash,
      callsId: null,
      txHashes: [txHash],
    }
  }
  if (typeof wallet?.request !== 'function') {
    throw new Error('Connected wallet does not support direct canonical transaction sends')
  }
  context.debug?.({
    event: 'send_attempt',
    mode: decision.mode,
    fallbackMode: decision.fallbackMode,
    method: 'eth_sendTransaction',
    chainId: context.chainId,
    sender,
    callTargets: calls.map((call) => call.to),
  })
  const txHashRaw = await wallet.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: context.signerAddress,
        to: canonicalIdentity,
        value: '0x0',
        data:
          appendBuilderSuffixToHex(executeBatchData, {
            chainId: context.chainId,
          }) ?? executeBatchData,
      },
    ],
  })
  const txHash = String(txHashRaw ?? '').trim()
  if (!isTxHash(txHash)) throw new Error('Canonical direct send did not return a valid transaction hash')
  context.debug?.({
    event: 'send_success',
    mode: decision.mode,
    fallbackMode: decision.fallbackMode,
    method: 'eth_sendTransaction',
    chainId: context.chainId,
    sender,
    callTargets: calls.map((call) => call.to),
    txHash,
  })
  return {
    mode: decision.mode,
    method: 'eth_sendTransaction',
    sender,
    transactionHash: txHash,
    callsId: null,
    txHashes: [txHash],
  }
}

async function sendEoaTransaction(params: {
  context: TxRouterContext
  decision: TxRoutingDecision
  call: RoutedCall
}): Promise<{ method: TxMethod; txHash: string }> {
  const { context, decision, call } = params
  if (!context.signerAddress || !context.walletClient) {
    throw new Error('Connected EOA signer is not ready')
  }
  const wallet = context.walletClient as any
  const sender = context.signerAddress

  if (typeof wallet?.sendTransaction === 'function') {
    context.debug?.({
      event: 'send_attempt',
      mode: decision.mode,
      fallbackMode: decision.fallbackMode,
      method: 'walletClient.sendTransaction',
      chainId: context.chainId,
      sender,
      callTargets: [call.to],
    })
    const hash = await wallet.sendTransaction({
      account: context.signerAddress,
      to: call.to,
      data: call.data,
      value: call.value,
      gas: asOptionalBigInt(call.tx.gasLimit),
      gasPrice: asOptionalBigInt(call.tx.gasPrice),
      maxFeePerGas: asOptionalBigInt(call.tx.maxFeePerGas),
      maxPriorityFeePerGas: asOptionalBigInt(call.tx.maxPriorityFeePerGas),
    })
    if (!isTxHash(hash)) throw new Error('EOA direct send did not return a valid transaction hash')
    context.debug?.({
      event: 'send_success',
      mode: decision.mode,
      fallbackMode: decision.fallbackMode,
      method: 'walletClient.sendTransaction',
      chainId: context.chainId,
      sender,
      callTargets: [call.to],
      txHash: hash,
    })
    return { method: 'walletClient.sendTransaction', txHash: hash }
  }

  if (typeof wallet?.request !== 'function') {
    throw new Error('Connected wallet does not support direct transaction sends')
  }
  context.debug?.({
    event: 'send_attempt',
    mode: decision.mode,
    fallbackMode: decision.fallbackMode,
    method: 'eth_sendTransaction',
    chainId: context.chainId,
    sender,
    callTargets: [call.to],
  })
  const txHashRaw = await wallet.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: context.signerAddress,
        to: call.to,
        value: toHex(call.value),
        data:
          appendBuilderSuffixToHex(call.data, {
            chainId: context.chainId,
          }) ?? call.data,
      },
    ],
  })
  const txHash = String(txHashRaw ?? '').trim()
  if (!isTxHash(txHash)) throw new Error('EOA direct send did not return a valid transaction hash')
  context.debug?.({
    event: 'send_success',
    mode: decision.mode,
    fallbackMode: decision.fallbackMode,
    method: 'eth_sendTransaction',
    chainId: context.chainId,
    sender,
    callTargets: [call.to],
    txHash,
  })
  return { method: 'eth_sendTransaction', txHash }
}

async function sendViaEoaDirect(params: {
  context: TxRouterContext
  decision: TxRoutingDecision
  calls: RoutedCall[]
}): Promise<TxRouterSendResult> {
  assertCanonicalPolicyContext(params.context)
  const txHashes: string[] = []
  let method: TxMethod = 'walletClient.sendTransaction'
  for (const call of params.calls) {
    const sent = await sendEoaTransaction({
      context: params.context,
      decision: params.decision,
      call,
    })
    method = sent.method
    txHashes.push(sent.txHash)
  }
  return {
    mode: params.decision.mode,
    method,
    sender: params.context.signerAddress ?? null,
    transactionHash: txHashes[txHashes.length - 1] ?? null,
    callsId: null,
    txHashes,
  }
}

async function sendViaMode(params: {
  context: TxRouterContext
  decision: TxRoutingDecision
  calls: RoutedCall[]
}): Promise<TxRouterSendResult> {
  switch (params.decision.mode) {
    case 'sendCalls':
      return sendViaSendCalls(params)
    case 'canonical4337':
      return sendViaCanonical4337(params)
    case 'canonicalDirect':
      return sendViaCanonicalDirect(params)
    case 'eoaDirect':
      return sendViaEoaDirect(params)
    default:
      throw new Error('Unsupported transaction routing mode')
  }
}

function ensureDirectEOASendForSwapWithApproval(decision: TxRoutingDecision, hasApproval: boolean): TxRoutingDecision {
  // EOA cannot atomically batch approval+swap in one tx. Keep the route fixed and
  // allow sequential sends via the same direct path.
  if (!hasApproval) return decision
  if (decision.mode !== 'eoaDirect') return decision
  return decision
}

function ensureCanonicalOneClickBatchRouting(
  context: TxRouterContext,
  decision: TxRoutingDecision,
  hasApproval: boolean,
  _hasNativeValue: boolean,
): TxRoutingDecision {
  void _hasNativeValue

  const canonical4337Ready = Boolean(context.publicClient && context.canonicalAddress && context.signerAddress)
  if (context.executionMode === 'canonical' && canonical4337Ready && decision.mode === 'sendCalls') {
    return {
      ...decision,
      fallbackMode: 'canonical4337',
      reason: `${decision.reason}; fallback locked to canonical4337 for canonical swap execution`,
    }
  }

  if (!hasApproval) return decision
  if (context.executionMode !== 'canonical') return decision

  if (!canonical4337Ready) return decision

  if (decision.mode === 'canonical4337') return decision

  if (decision.mode === 'sendCalls') {
    return {
      ...decision,
      fallbackMode: 'canonical4337',
      reason: `${decision.reason}; fallback locked to canonical4337 for approval+swap batching`,
    }
  }

  return {
    ...decision,
    mode: 'canonical4337',
    fallbackMode: 'canonical4337',
    reason: 'canonical approval+swap path enforces ERC-4337 batch execution',
  }
}

export async function buildAndSendApproval(params: {
  context: TxRouterContext
  approvalTx: TransactionRequest
}): Promise<{ routing: TxRoutingDecision; send: TxRouterSendResult }> {
  const routing = detectTxSendMode(params.context)
  const calls = [normalizeTx(params.approvalTx)]
  const send = await sendViaMode({
    context: params.context,
    decision: routing,
    calls,
  })
  return { routing, send }
}

export async function buildAndSendSwap(params: {
  context: TxRouterContext
  swapTx: TransactionRequest
  approvalTx?: TransactionRequest | null
}): Promise<{ routing: TxRoutingDecision; send: TxRouterSendResult }> {
  const calls = toRoutedCalls({
    swapTx: params.swapTx,
    approvalTx: params.approvalTx,
  })
  const hasApproval = Boolean(params.approvalTx)
  const hasNativeValue = callsIncludeNativeValue(calls)
  const baseRouting = detectTxSendMode(params.context)
  const canonicalRouted = ensureCanonicalOneClickBatchRouting(params.context, baseRouting, hasApproval, hasNativeValue)
  const routing = ensureDirectEOASendForSwapWithApproval(canonicalRouted, hasApproval)
  const send = await sendViaMode({
    context: params.context,
    decision: routing,
    calls,
  })
  return { routing, send }
}
