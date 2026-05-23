import { logger } from '../../../packages/server-core/src/index.js'

const RELAY_API_BASE = 'https://api.relay.link'
const RELAY_SDK_VERSION = '5.2.7'
const DEFAULT_REFERRER = '4626-owner-mutation'
const BASE_MAINNET_CHAIN_ID = 8453
const RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR = '0x49290c1c'

export type RelayDepositUserCall = {
  to: `0x${string}`
  data: `0x${string}`
  value: string
}

export type NotifyRelaySolverDepositParams = {
  chainId: number
  depositTxHash: `0x${string}`
  /** Optional quote ids to associate while indexing (order id + step request id). */
  indexRequestIds?: `0x${string}`[]
  userCall?: RelayDepositUserCall | null
  referrer?: string
}

export type NotifyRelaySolverDepositResult = {
  indexed: boolean
  sameChainSingle: boolean
  warnings: string[]
}

function resolveRelayApiKey(): string | null {
  const candidates = ['RELAY_API_KEY', 'VITE_RELAY_API_KEY', 'RELAY_LINK_API_KEY']
  for (const key of candidates) {
    const raw = process.env[key]
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
  }
  return null
}

function relayUpstreamHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'relay-sdk-version': RELAY_SDK_VERSION,
  }
  const apiKey = resolveRelayApiKey()
  if (apiKey) headers['x-api-key'] = apiKey
  return headers
}

function isDepositoryDepositNativeUserCall(userCall: RelayDepositUserCall | null | undefined): boolean {
  if (!userCall) return false
  return userCall.data.slice(0, 10).toLowerCase() === RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR
}

async function postRelayUpstream(params: {
  path: '/transactions/index' | '/transactions/single'
  body: Record<string, unknown>
}): Promise<{ ok: boolean; status: number; message: string }> {
  let upstream: Response
  try {
    upstream = await fetch(`${RELAY_API_BASE}${params.path}`, {
      method: 'POST',
      headers: relayUpstreamHeaders(),
      body: JSON.stringify(params.body),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'fetch failed')
    return { ok: false, status: 0, message }
  }

  const text = await upstream.text().catch(() => '')
  if (upstream.ok) {
    return { ok: true, status: upstream.status, message: text.slice(0, 200) }
  }

  let message = text.slice(0, 400)
  if (text) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>
      message = String(parsed.message ?? parsed.error ?? message)
    } catch {
      /* keep raw snippet */
    }
  }
  return { ok: false, status: upstream.status, message: message || `HTTP ${upstream.status}` }
}

/**
 * Mirrors relay-kit `executeSteps` post-deposit solver wakeups for AA/proxy Part 1:
 * - POST /transactions/index immediately after broadcast (trace-detect internal deposits)
 *
 * CSW Depository `depositNative` lanes must NOT call `/transactions/single` — Relay rejects
 * call-execution deposits with "Same-chain request is not a send, wrap, or unwrap".
 */
export async function notifyRelaySolverDeposit(
  params: NotifyRelaySolverDepositParams,
): Promise<NotifyRelaySolverDepositResult> {
  const chainId = params.chainId
  const referrer = (params.referrer ?? DEFAULT_REFERRER).trim() || DEFAULT_REFERRER
  const warnings: string[] = []
  const depositoryLane = isDepositoryDepositNativeUserCall(params.userCall)

  const indexIds = params.indexRequestIds?.length
    ? params.indexRequestIds
    : ([] as `0x${string}`[])

  let indexed = false
  const indexAttempts: Array<{ requestId?: string; result: { ok: boolean; status: number; message: string } }> =
    []

  if (indexIds.length === 0) {
    const indexResult = await postRelayUpstream({
      path: '/transactions/index',
      body: {
        txHash: params.depositTxHash,
        chainId: String(chainId),
        referrer,
      },
    })
    indexAttempts.push({ result: indexResult })
    indexed = indexResult.ok
    if (!indexResult.ok) {
      warnings.push(
        `transactions/index failed (${indexResult.status || 'network'}): ${indexResult.message}`,
      )
    }
  } else {
    for (const requestId of indexIds) {
      const indexResult = await postRelayUpstream({
        path: '/transactions/index',
        body: {
          txHash: params.depositTxHash,
          chainId: String(chainId),
          requestId,
          referrer,
        },
      })
      indexAttempts.push({ requestId, result: indexResult })
      indexed = indexed || indexResult.ok
      if (!indexResult.ok) {
        warnings.push(
          `transactions/index(${requestId.slice(0, 10)}…) failed (${indexResult.status || 'network'}): ${indexResult.message}`,
        )
      }
    }
  }

  if (!indexed) {
    logger.warn('[relay/notifyRelaySolverDeposit] transactions/index failed', {
      depositTxHash: params.depositTxHash,
      indexRequestIds: indexIds,
      attempts: indexAttempts.map((attempt) => ({
        requestId: attempt.requestId,
        status: attempt.result.status,
        message: attempt.result.message,
      })),
    })
  }

  let sameChainSingle = false
  if (
    !depositoryLane &&
    params.userCall &&
    chainId === BASE_MAINNET_CHAIN_ID &&
    indexIds[0]
  ) {
    const value =
      typeof params.userCall.value === 'string' && params.userCall.value.startsWith('0x')
        ? BigInt(params.userCall.value).toString(10)
        : params.userCall.value

    const singleResult = await postRelayUpstream({
      path: '/transactions/single',
      body: {
        tx: JSON.stringify({
          to: params.userCall.to,
          data: params.userCall.data,
          value,
          chainId,
          txHash: params.depositTxHash,
        }),
        chainId: String(chainId),
        requestId: indexIds[0],
        referrer,
      },
    })
    sameChainSingle = singleResult.ok
    if (!singleResult.ok) {
      warnings.push(
        `transactions/single failed (${singleResult.status || 'network'}): ${singleResult.message}`,
      )
      logger.warn('[relay/notifyRelaySolverDeposit] transactions/single failed', {
        status: singleResult.status,
        message: singleResult.message,
        depositTxHash: params.depositTxHash,
        requestId: indexIds[0],
      })
    }
  }

  return {
    indexed,
    sameChainSingle,
    warnings,
  }
}
