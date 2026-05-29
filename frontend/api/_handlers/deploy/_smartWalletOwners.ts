import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  checkRateLimit,
  RATE_LIMITS,
  rateLimitKey,
  getClientIp,
} from '@4626/server-core'

const DEFAULT_BASE_RPCS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
]

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'nextOwnerIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

type RequestBody = {
  smartWallet?: string
}

type OwnerEntry = {
  index: number
  ownerBytes: `0x${string}`
  ownerAddress: `0x${string}` | null
  isAddressOwner: boolean
}

type ResponseData = {
  smartWallet: `0x${string}`
  ownerCount: number
  nextOwnerIndex: number | null
  owners: OwnerEntry[]
}

function getBaseRpcUrls(): string[] {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  if (!raw) return DEFAULT_BASE_RPCS
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  const urls = parts.length > 0 ? [...parts, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]
  return [...new Set(urls)]
}

function isAddressLike(v: unknown): v is `0x${string}` {
  return typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/i.test(v)
}

function ownerBytesToAddress(ownerBytes: string): `0x${string}` | null {
  const normalized = String(ownerBytes || '').toLowerCase()
  if (!/^0x[0-9a-f]{64}$/.test(normalized)) return null
  if (!normalized.startsWith('0x000000000000000000000000')) return null
  return (`0x${normalized.slice(26)}`) as `0x${string}`
}

function isZeroOwnerBytes(value: string): boolean {
  return /^0x0{64}$/i.test(String(value || '').trim())
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('smart-wallet-owners-read', getClientIp(req)),
    RATE_LIMITS.smartWalletOwnerRead,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many owner checks' } satisfies ApiEnvelope<never>)
  }

  const body = req.method === 'POST'
    ? ((await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as RequestBody | null)
    : null
  const querySmartWallet = typeof req.query?.smartWallet === 'string' ? req.query.smartWallet : ''
  const bodySmartWallet = typeof body?.smartWallet === 'string' ? body.smartWallet : ''
  const smartWallet = String(querySmartWallet || bodySmartWallet || '').trim()

  if (!isAddressLike(smartWallet)) {
    return res.status(400).json({ success: false, error: 'Invalid smartWallet address' } satisfies ApiEnvelope<never>)
  }

  const { createPublicClient, getAddress, http } = await import('viem')
  const { base } = await import('viem/chains')

  const rpcs = getBaseRpcUrls()
  let lastError: Error | null = null
  for (const rpc of rpcs) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(rpc, { timeout: 10_000 }),
      })

      const ownerCountRaw = (await client.readContract({
        address: smartWallet as `0x${string}`,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerCount',
      })) as bigint
      const ownerCount = Number(ownerCountRaw)

      let nextOwnerIndex: number | null = null
      try {
        const nextRaw = (await client.readContract({
          address: smartWallet as `0x${string}`,
          abi: COINBASE_SMART_WALLET_OWNERS_ABI,
          functionName: 'nextOwnerIndex',
        })) as bigint
        const nextParsed = Number(nextRaw)
        if (Number.isFinite(nextParsed) && nextParsed >= 0) nextOwnerIndex = nextParsed
      } catch {
        // ignore: not all CSW versions expose nextOwnerIndex
      }

      const upperBound = Math.min(
        256,
        Math.max(
          Number.isFinite(ownerCount) && ownerCount > 0 ? ownerCount : 0,
          Number.isFinite(nextOwnerIndex) && nextOwnerIndex !== null && nextOwnerIndex > 0 ? nextOwnerIndex : 0,
        ),
      )

      const owners: OwnerEntry[] = []
      for (let i = 0; i < upperBound; i++) {
        let ownerBytes: string
        try {
          ownerBytes = (await client.readContract({
            address: smartWallet as `0x${string}`,
            abi: COINBASE_SMART_WALLET_OWNERS_ABI,
            functionName: 'ownerAtIndex',
            args: [BigInt(i)],
          })) as string
        } catch {
          continue
        }

        if (!ownerBytes || ownerBytes === '0x' || isZeroOwnerBytes(ownerBytes)) continue
        const ownerAddress = ownerBytesToAddress(ownerBytes)
        owners.push({
          index: i,
          ownerBytes: ownerBytes as `0x${string}`,
          ownerAddress: ownerAddress ? (getAddress(ownerAddress) as `0x${string}`) : null,
          isAddressOwner: Boolean(ownerAddress),
        })
      }

      const data: ResponseData = {
        smartWallet: getAddress(smartWallet) as `0x${string}`,
        ownerCount: Number.isFinite(ownerCount) && ownerCount >= 0 ? ownerCount : owners.length,
        nextOwnerIndex,
        owners,
      }

      return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ResponseData>)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      continue
    }
  }

  return res.status(500).json({
    success: false,
    error: lastError?.message || 'Failed to read smart wallet owners',
  } satisfies ApiEnvelope<never>)
}
