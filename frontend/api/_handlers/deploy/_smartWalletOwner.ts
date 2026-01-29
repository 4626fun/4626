import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
} from '../../../server/auth/_shared.js'

const DEFAULT_BASE_RPCS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
]

function getBaseRpcUrls(): string[] {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  if (!raw) return DEFAULT_BASE_RPCS
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  const urls = parts.length > 0 ? [...parts, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]
  return [...new Set(urls)]
}

const COINBASE_SMART_WALLET_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
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

  const body = await readJsonBody<RequestBody>(req)
  const smartWallet = typeof body?.smartWallet === 'string' ? body.smartWallet.trim() : ''
  const ownerAddress = typeof body?.ownerAddress === 'string' ? body.ownerAddress.trim() : ''

  if (!isAddressLike(smartWallet)) {
    return res.status(400).json({ success: false, error: 'Invalid smartWallet address' } satisfies ApiEnvelope<never>)
  }
  if (!isAddressLike(ownerAddress)) {
    return res.status(400).json({ success: false, error: 'Invalid ownerAddress' } satisfies ApiEnvelope<never>)
  }

  const rpcs = getBaseRpcUrls()
  const { createPublicClient, encodeAbiParameters, http } = await import('viem')
  const { base } = await import('viem/chains')

  let lastError: Error | null = null
  for (const rpc of rpcs) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(rpc, { timeout: 10_000 }),
      })

      // First try the standard method (fast path).
      try {
        const isOwner = await client.readContract({
          address: smartWallet as `0x${string}`,
          abi: COINBASE_SMART_WALLET_ABI,
          functionName: 'isOwnerAddress',
          args: [ownerAddress as `0x${string}`],
        })

        const data: ResponseData = {
          smartWallet,
          ownerAddress,
          isOwner: isOwner === true,
        }
        return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ResponseData>)
      } catch {
        // Fall back to iterating owners if isOwnerAddress is not available.
      }

      const countRaw = (await client.readContract({
        address: smartWallet as `0x${string}`,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerCount',
      })) as bigint
      const count = Number(countRaw)
      const maxScan = Math.min(Number.isFinite(count) ? count : 0, 64)
      const expected = String(encodeAbiParameters([{ type: 'address' }], [ownerAddress as `0x${string}`])).toLowerCase()
      let isOwner = false
      for (let i = 0; i < maxScan; i++) {
        const ownerBytes = (await client.readContract({
          address: smartWallet as `0x${string}`,
          abi: COINBASE_SMART_WALLET_OWNERS_ABI,
          functionName: 'ownerAtIndex',
          args: [BigInt(i)],
        })) as string
        if (String(ownerBytes).toLowerCase() === expected) {
          isOwner = true
          break
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

  return res.status(500).json({
    success: false,
    error: lastError?.message || 'Failed to check ownership',
  } satisfies ApiEnvelope<never>)
}
