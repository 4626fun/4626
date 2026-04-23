import { createProlinkUrl, encodeProlink } from '@base-org/account/prolink'
import { getAddress } from 'viem'

const BASE_MAINNET_CHAIN_ID_HEX = '0x2105' as const
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
  to: AddressLike
  data: HexLike
  value?: HexLike
  atomicRequired?: boolean
}): Promise<string> {
  const payload = await encodeProlink({
    method: 'wallet_sendCalls',
    params: [
      {
        version: '1.0',
        chainId: BASE_MAINNET_CHAIN_ID_HEX,
        atomicRequired: input.atomicRequired ?? true,
        calls: [
          {
            to: getAddress(String(input.to).trim()) as `0x${string}`,
            value: normalizeHex(input.value ?? '0x0', 'value'),
            data: normalizeHex(input.data, 'call data'),
          },
        ],
      },
    ],
  })
  const normalized = String(payload ?? '').trim()
  if (!normalized) throw new Error('Failed to encode prolink payload')
  return normalized
}

export function buildBaseAppProlinkUrl(payload: string, baseUrl = DEFAULT_BASE_APP_PROLINK_URL): string {
  return createProlinkUrl(payload, baseUrl)
}
