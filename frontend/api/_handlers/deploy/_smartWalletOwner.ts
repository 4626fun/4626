import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  checkDurableRateLimit,
  RATE_LIMITS,
  rateLimitKey,
  getClientIp,
} from '@4626/server-core'
import {
  resolveServerBaseRpcUrls,
  summarizeRpcFailure,
} from '../../../server/_lib/onchain/baseRpcUrl.js'

const COINBASE_SMART_WALLET_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'nextOwnerIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

type RequestBody = {
  smartWallet?: string
  ownerAddress?: string
}

type ResponseData = {
  smartWallet: string
  ownerAddress: string
  isOwner: boolean
}

function isAddressLike(v: unknown): v is `0x${string}` {
  return typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/i.test(v)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('smart-wallet-owner-read', getClientIp(req)),
    RATE_LIMITS.smartWalletOwnerRead,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many owner checks' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as RequestBody | null
  const smartWallet = typeof body?.smartWallet === 'string' ? body.smartWallet.trim() : ''
  const ownerAddress = typeof body?.ownerAddress === 'string' ? body.ownerAddress.trim() : ''

  if (!isAddressLike(smartWallet)) {
    return res.status(400).json({ success: false, error: 'Invalid smartWallet address' } satisfies ApiEnvelope<never>)
  }
  if (!isAddressLike(ownerAddress)) {
    return res.status(400).json({ success: false, error: 'Invalid ownerAddress' } satisfies ApiEnvelope<never>)
  }

  const rpcs = resolveServerBaseRpcUrls()
  const { createPublicClient, encodeAbiParameters, http } = await import('viem')
  const { base } = await import('viem/chains')

  let lastError: Error | null = null
  for (const rpc of rpcs) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(rpc, { timeout: 10_000 }),
      })

      let isOwner = false
      try {
        isOwner = Boolean(
          await client.readContract({
            address: smartWallet as `0x${string}`,
            abi: COINBASE_SMART_WALLET_ABI,
            functionName: 'isOwnerAddress',
            args: [ownerAddress as `0x${string}`],
          }),
        )
      } catch {
        const countRaw = (await client.readContract({
          address: smartWallet as `0x${string}`,
          abi: COINBASE_SMART_WALLET_ABI,
          functionName: 'ownerCount',
        })) as bigint
        const count = Number(countRaw)
        let upperBound = Number.isFinite(count) ? count : 0
        try {
          const nextRaw = (await client.readContract({
            address: smartWallet as `0x${string}`,
            abi: COINBASE_SMART_WALLET_ABI,
            functionName: 'nextOwnerIndex',
          })) as bigint
          const next = Number(nextRaw)
          if (Number.isFinite(next) && next > 0) upperBound = next
        } catch {
          // ignore; fallback to ownerCount
        }
        const maxScan = Math.min(upperBound, 128)
        const expected = String(encodeAbiParameters([{ type: 'address' }], [ownerAddress as `0x${string}`])).toLowerCase()
        for (let i = 0; i < maxScan; i++) {
          let ownerBytes: string
          try {
            ownerBytes = (await client.readContract({
              address: smartWallet as `0x${string}`,
              abi: COINBASE_SMART_WALLET_ABI,
              functionName: 'ownerAtIndex',
              args: [BigInt(i)],
            })) as string
          } catch {
            continue
          }
          if (String(ownerBytes).toLowerCase() === expected) {
            isOwner = true
            break
          }
        }
      }

      const data: ResponseData = { smartWallet, ownerAddress, isOwner }
      return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ResponseData>)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // Try next RPC
      continue
    }
  }

  if (lastError) {
    console.error('[smartWalletOwner] All RPC attempts failed:', summarizeRpcFailure(lastError))
  }
  return res.status(503).json({
    success: false,
    error: 'Failed to check ownership (Base RPC unavailable)',
  } satisfies ApiEnvelope<never>)
}
