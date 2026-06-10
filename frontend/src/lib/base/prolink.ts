import { createProlinkUrl, encodeProlink } from '@base-org/account/prolink'
import { getAddress } from 'viem'

import { buildWalletSendCallsPayload } from '@/lib/wallet/walletSendCallsPayload'

const BASE_MAINNET_CHAIN_ID = 8453
const DEFAULT_BASE_APP_PROLINK_URL = 'https://base.app/base-pay'

type AddressLike = `0x${string}` | string
type HexLike = `0x${string}` | string

function normalizeHex(value: HexLike, label: string): `0x${string}` {
  const raw = String(value ?? '').trim()
  if (!/^0x[0-9a-fA-F]+$/.test(raw)) {
    throw new Error(`Invalid ${label} hex payload`)
  }
  return raw as `0x${string}`
}

/**
 * Encode a single-call wallet_sendCalls prolink payload for Base mainnet.
 */
export async function encodeSingleCallSendCallsProlink(input: {
  from: AddressLike
  to: AddressLike
  data: HexLike
  value?: HexLike
  atomicRequired?: boolean
}): Promise<string> {
  const payload = buildWalletSendCallsPayload({
    from: getAddress(String(input.from).trim()) as `0x${string}`,
    chainId: BASE_MAINNET_CHAIN_ID,
    atomicRequired: input.atomicRequired ?? true,
    calls: [
      {
        to: getAddress(String(input.to).trim()) as `0x${string}`,
        value: normalizeHex(input.value ?? '0x0', 'value'),
        data: normalizeHex(input.data, 'call data'),
      },
    ],
  })

  const encoded = await encodeProlink({
    method: 'wallet_sendCalls',
    params: [payload],
  })
  const normalized = String(encoded ?? '').trim()
  if (!normalized) throw new Error('Failed to encode prolink payload')
  return normalized
}

export function buildBaseAppProlinkUrl(payload: string, baseUrl = DEFAULT_BASE_APP_PROLINK_URL): string {
  return createProlinkUrl(payload, baseUrl)
}
