import { apiFetch } from '@/lib/api/apiBase'
import { toHex, type Address, type Hex } from 'viem'

const DEFAULT_SHARE_OFT_VANITY_MAX_TRIES = 1_000_000

export type FetchServerShareOftVanitySaltParams = {
  create2Deployer: Address
  initCode: Hex
  startAt: bigint
  suffix: string
  maxAttempts?: number
}

export async function fetchServerShareOftVanitySalt(
  params: FetchServerShareOftVanitySaltParams,
): Promise<Hex | null> {
  const res = await apiFetch('/api/deploy/vanity/share-oft-salt', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      create2Deployer: params.create2Deployer,
      initCode: params.initCode,
      startAt: toHex(params.startAt, { size: 32 }),
      suffix: params.suffix,
      maxAttempts: params.maxAttempts ?? DEFAULT_SHARE_OFT_VANITY_MAX_TRIES,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Share OFT vanity search failed (${res.status})`)
  }
  const json = (await res.json()) as {
    success?: boolean
    data?: { salt?: string | null }
    error?: string
  }
  if (!json.success) {
    throw new Error(json.error || 'Share OFT vanity search failed')
  }
  const salt = json.data?.salt
  return typeof salt === 'string' && salt.startsWith('0x') ? (salt as Hex) : null
}