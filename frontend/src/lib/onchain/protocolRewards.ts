import { Address, createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const PROTOCOL_REWARDS_ADDRESS = `0x${'7777777F279eba3d3Ad8F4E708545291A6fDBA8B'}` as Address

const BASE_RPC_RAW =
  (import.meta.env.VITE_BASE_READ_RPC_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_BASE_RPC as string | undefined)?.trim() ||
  ''

const IS_BROWSER = typeof window !== 'undefined'

function isCorsRestrictedRpc(url: string): boolean {
  // Alchemy browser CORS is opt-in; avoid hard failures by default.
  return /(^|\/\/)base-mainnet\.g\.alchemy\.com/i.test(url) || /\.g\.alchemy\.com\//i.test(url)
}

const protocolRewardsAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

function getBaseRpcUrl(): string {
  // Avoid CORS-restricted RPCs in the browser. Prefer the same-origin proxy when needed.
  if (IS_BROWSER) {
    if (BASE_RPC_RAW && !isCorsRestrictedRpc(BASE_RPC_RAW)) return BASE_RPC_RAW
    return '/api/rpc?chain=base'
  }
  if (BASE_RPC_RAW) return BASE_RPC_RAW
  return 'https://base-mainnet.public.blastapi.io'
}

function getBasePublicClient() {
  const rpcUrl = getBaseRpcUrl()
  const transport = rpcUrl.startsWith('/api/rpc')
    ? http(rpcUrl, {
        retryCount: 0,
        retryDelay: 150,
      })
    : http(rpcUrl)
  return createPublicClient({
    chain: base,
    transport,
  })
}

export async function fetchProtocolRewardsBalance(account: Address): Promise<bigint> {
  const client = getBasePublicClient()
  return await client.readContract({
    address: PROTOCOL_REWARDS_ADDRESS,
    abi: protocolRewardsAbi,
    functionName: 'balanceOf',
    args: [account],
  })
}

export async function fetchProtocolRewardsBalances(accounts: Address[]): Promise<Record<string, bigint>> {
  const client = getBasePublicClient()
  const balances: Record<string, bigint> = {}

  // Small list in practice (unique payoutRecipients), so a simple loop is fine.
  for (const account of accounts) {
    balances[account] = await client.readContract({
      address: PROTOCOL_REWARDS_ADDRESS,
      abi: protocolRewardsAbi,
      functionName: 'balanceOf',
      args: [account],
    })
  }

  return balances
}

type ApiEnvelope<T> = {
  success: boolean
  data: T | null
  error?: string
}

export async function fetchProtocolRewardsBalancesFromApi(accounts: Address[]): Promise<Record<string, bigint>> {
  const qs = new URLSearchParams({
    recipients: accounts.join(','),
  })

  const res = await fetch(`/api/onchain/protocolRewardsClaimable?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiEnvelope<any> | null
    const msg = body?.error || `HTTP ${res.status}`
    const err: any = new Error(msg)
    err.status = res.status
    throw err
  }

  const body = (await res.json()) as ApiEnvelope<{
    claimableByRecipient: Record<string, string>
  }>

  if (!body.success) throw new Error(body.error || 'Failed to fetch claimable rewards')

  const map: Record<string, bigint> = {}
  const raw = body.data?.claimableByRecipient ?? {}
  for (const [k, v] of Object.entries(raw)) {
    try {
      map[k.toLowerCase()] = BigInt(v)
    } catch {
      map[k.toLowerCase()] = 0n
    }
  }
  return map
}

export async function fetchProtocolRewardsWithdrawnFromApi(accounts: Address[]): Promise<Record<string, bigint>> {
  const qs = new URLSearchParams({
    recipients: accounts.join(','),
  })

  const res = await fetch(`/api/onchain/protocolRewardsWithdrawn?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiEnvelope<any> | null
    const msg = body?.error || `HTTP ${res.status}`
    const err: any = new Error(msg)
    err.status = res.status
    throw err
  }

  const body = (await res.json()) as ApiEnvelope<{
    withdrawnByRecipient: Record<string, string>
  }>

  if (!body.success) throw new Error(body.error || 'Failed to fetch withdrawn rewards')
  const map: Record<string, bigint> = {}
  const raw = body.data?.withdrawnByRecipient ?? {}
  for (const [k, v] of Object.entries(raw)) {
    try {
      map[k.toLowerCase()] = BigInt(v)
    } catch {
      map[k.toLowerCase()] = 0n
    }
  }
  return map
}


