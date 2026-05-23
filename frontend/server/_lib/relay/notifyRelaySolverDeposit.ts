import { logger } from '../../../packages/server-core/src/index.js'

const RELAY_API_BASE = 'https://api.relay.link'
const RELAY_SDK_VERSION = '5.2.7'
const DEFAULT_REFERRER = '4626-owner-mutation'
const BASE_MAINNET_CHAIN_ID = 8453

export type RelayDepositUserCall = {
  to: `0x${string}`
  data: `0x${string}`
  value: string
}

export type NotifyRelaySolverDepositParams = {
  chainId: number
  depositTxHash: `0x${string}`
  requestId: `0x${string}`
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
 * Mirrors relay-kit `executeSteps` post-deposit solver wakeups:
 * - POST /transactions/index — index the Part 1 deposit tx hash
 * - POST /transactions/single — same-chain notify with request-bound calldata + tx hash
 *
 * Non-fatal by design: deposit indexing may already be in flight from on-chain watchers.
 */
export async function notifyRelaySolverDeposit(
  params: NotifyRelaySolverDepositParams,
): Promise<NotifyRelaySolverDepositResult> {
  const chainId = params.chainId
  const referrer = (params.referrer ?? DEFAULT_REFERRER).trim() || DEFAULT_REFERRER
  const warnings: string[] = []

  const indexResult = await postRelayUpstream({
    path: '/transactions/index',
    body: {
      txHash: params.depositTxHash,
      chainId: String(chainId),
      referrer,
    },
  })
  if (!indexResult.ok) {
    warnings.push(
      `transactions/index failed (${indexResult.status || 'network'}): ${indexResult.message}`,
    )
    logger.warn('[relay/notifyRelaySolverDeposit] transactions/index failed', {
      status: indexResult.status,
      message: indexResult.message,
      depositTxHash: params.depositTxHash,
      requestId: params.requestId,
    })
  }

  let sameChainSingle = false
  if (params.userCall && chainId === BASE_MAINNET_CHAIN_ID) {
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
        requestId: params.requestId,
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
        requestId: params.requestId,
      })
    }
  }

  return {
    indexed: indexResult.ok,
    sameChainSingle,
    warnings,
  }
}
