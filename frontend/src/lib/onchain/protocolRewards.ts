import { Address, createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { parseApiEnvelope, resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { getBrowserBaseReadRpcUrl, buildSameOriginRpcProxyTransport } from '@/lib/base/baseReadRpcPolicy'

const PROTOCOL_REWARDS_ADDRESS = `0x${'7777777F279eba3d3Ad8F4E708545291A6fDBA8B'}` as Address

const BASE_RPC_RAW =
  (import.meta.env.VITE_BASE_READ_RPC_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_BASE_RPC as string | undefined)?.trim() ||
  ''

const IS_BROWSER = typeof window !== 'undefined'

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
  // Browser reads should stay on explicitly browser-safe RPCs or use our proxy.
  if (IS_BROWSER) return getBrowserBaseReadRpcUrl(BASE_RPC_RAW)
  if (BASE_RPC_RAW) return BASE_RPC_RAW
  return 'https://base-mainnet.public.blastapi.io'
}

function getBasePublicClient() {
  const rpcUrl = getBaseRpcUrl()
  const transport = rpcUrl.startsWith('/api/rpc')
    ? buildSameOriginRpcProxyTransport(rpcUrl)
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

  // Small list in practice (unique CreatorCoin payoutRecipient addresses), so a simple loop is fine.
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

export async function fetchProtocolRewardsBalancesFromApi(accounts: Address[]): Promise<Record<string, bigint>> {
  const qs = new URLSearchParams({
    recipients: accounts.join(','),
  })

  const res = await fetch(`/api/onchain/protocolRewardsClaimable?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    const body = await parseApiEnvelope<unknown>(res)
    const msg = resolveApiErrorMessage(body, `HTTP ${res.status}`)
    const err: any = new Error(msg)
    err.status = res.status
    throw err
  }

  const body = await parseApiEnvelope<{
    claimableByRecipient: Record<string, string>
  }>(res)

  if (!body?.success) throw new Error(resolveApiErrorMessage(body, 'Failed to fetch claimable rewards'))

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
    const body = await parseApiEnvelope<unknown>(res)
    const msg = resolveApiErrorMessage(body, `HTTP ${res.status}`)
    const err: any = new Error(msg)
    err.status = res.status
    throw err
  }

  const body = await parseApiEnvelope<{
    withdrawnByRecipient: Record<string, string>
  }>(res)

  if (!body?.success) throw new Error(resolveApiErrorMessage(body, 'Failed to fetch withdrawn rewards'))
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


