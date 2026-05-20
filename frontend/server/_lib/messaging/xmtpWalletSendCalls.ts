import { toHex } from 'viem'

import type { XmtpWalletSendCallsPayload } from '../../../src/lib/xmtp/xmtpInteractive.js'
import { validateSwapTransactionPayload } from '../../uniswap/swapPayloadValidation.js'

const BASE_MAINNET_CHAIN_ID = 8453

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readSwapTransaction(payload: unknown): Record<string, unknown> | null {
  if (!isObject(payload)) return null
  const swap = payload.swap
  if (isObject(swap)) return swap
  const data = payload.data
  if (isObject(data) && isObject(data.swap)) return data.swap as Record<string, unknown>
  if (isObject(data) && isObject(data.data) && isObject((data.data as Record<string, unknown>).swap)) {
    return (data.data as Record<string, unknown>).swap as Record<string, unknown>
  }
  return null
}

export function buildWalletSendCallsFromSwapTransaction(params: {
  from: string
  chainId?: number
  swap: Record<string, unknown>
  description?: string
}): XmtpWalletSendCallsPayload | null {
  const envelope = { swap: params.swap }
  const validationError = validateSwapTransactionPayload(envelope)
  if (validationError) return null

  const to = String(params.swap.to ?? '').trim()
  const data = String(params.swap.data ?? '').trim()
  const valueRaw = params.swap.value
  const value =
    valueRaw == null || valueRaw === ''
      ? '0x0'
      : typeof valueRaw === 'number'
        ? toHex(valueRaw)
        : String(valueRaw)

  const gasRaw = params.swap.gasLimit ?? params.swap.gas
  const gas =
    gasRaw == null || gasRaw === ''
      ? undefined
      : typeof gasRaw === 'number'
        ? toHex(gasRaw)
        : String(gasRaw)

  return {
    version: '1.0',
    chainId: toHex(params.chainId ?? BASE_MAINNET_CHAIN_ID),
    from: params.from.toLowerCase(),
    calls: [
      {
        to: to.toLowerCase(),
        value,
        data,
        gas,
        metadata: {
          description: params.description ?? 'Confirm this swap in Base App.',
          transactionType: 'swap',
        },
      },
    ],
  }
}

export function extractWalletSendCallsFromUniswapActionReply(params: {
  actionReply: string
  fallbackFrom: string | null
}): XmtpWalletSendCallsPayload | null {
  const trimmed = String(params.actionReply ?? '').trim()
  if (!trimmed.startsWith('{')) return null

  let parsed: { skill?: string; data?: unknown }
  try {
    parsed = JSON.parse(trimmed) as { skill?: string; data?: unknown }
  } catch {
    return null
  }

  const skill = String(parsed.skill ?? '').trim()
  if (skill !== 'uniswap_build_swap' && skill !== 'uniswap_batch_swap_5792') {
    return null
  }

  const swap = readSwapTransaction(parsed.data)
  if (!swap) return null

  const from =
    typeof swap.from === 'string' && /^0x[a-fA-F0-9]{40}$/.test(swap.from)
      ? swap.from
      : params.fallbackFrom
  if (!from) return null

  const chainId =
    swap.chainId != null && Number.isFinite(Number(swap.chainId))
      ? Number(swap.chainId)
      : BASE_MAINNET_CHAIN_ID

  return buildWalletSendCallsFromSwapTransaction({
    from,
    chainId,
    swap,
    description: 'Review and confirm this Uniswap swap in Base App.',
  })
}
