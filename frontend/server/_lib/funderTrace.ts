/**
 * Etherscan v2 "Get Address Funded By" recursive tracer.
 *
 * Uses the multichain Etherscan v2 API to trace who originally funded a wallet,
 * recursively following the funder chain up to N hops.
 *
 * @see https://docs.etherscan.io/api-reference/endpoint/fundedby
 */

const ETHERSCAN_V2_BASE = 'https://api.etherscan.io/v2/api'

/** Delay between sequential hops to respect Etherscan free-tier rate limit (5 req/s). */
const HOP_DELAY_MS = 250

/** Hard ceiling on recursive hops to prevent runaway chains. */
const MAX_HOPS_CEILING = 5

export type FunderHop = {
  /** The address being traced at this hop. */
  address: string
  /** The address that funded it. */
  funderAddress: string
  /** Transaction hash of the funding tx. */
  funderTxHash: string
  /** Block number of the funding tx. */
  blockNumber: number
  /** Unix timestamp of the funding tx. */
  timestamp: number
  /** Chain ID where this funding occurred. */
  chainId: number
  /** Depth of this hop (1 = direct funder of the target). */
  hop: number
}

export type FunderTraceResult = {
  /** The original target address. */
  target: string
  /** Ordered chain of funders (hop 1 = direct funder, hop N = deepest ancestor). */
  chain: FunderHop[]
  /** Whether the trace completed all requested hops (false if a hop failed or had no funder). */
  complete: boolean
  /** Number of hops requested. */
  requestedHops: number
  /** If the trace stopped early, the reason. */
  stopReason?: 'no_funder' | 'api_error' | 'contract_address' | 'self_funded' | 'max_hops'
}

type EtherscanFundedByResponse = {
  status: string
  message: string
  result?: {
    blockNumber?: string
    timeStamp?: string
    from?: string
    hash?: string
  }
}

function getEtherscanApiKey(): string {
  return (process.env.ETHERSCAN_API_KEY ?? '').trim()
}

async function fetchFundedBy(
  address: string,
  chainId: number,
  apiKey: string,
): Promise<FunderHop | null> {
  const url = new URL(ETHERSCAN_V2_BASE)
  url.searchParams.set('chainid', String(chainId))
  url.searchParams.set('module', 'account')
  url.searchParams.set('action', 'fundedby')
  url.searchParams.set('address', address)
  url.searchParams.set('apikey', apiKey)

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 10_000)

  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal })
    if (!res.ok) return null

    const data = (await res.json()) as EtherscanFundedByResponse
    if (data.status !== '1' || !data.result?.from || !data.result?.hash) {
      return null
    }

    const funderAddress = data.result.from.toLowerCase()
    if (funderAddress === address.toLowerCase()) {
      // Self-funded (e.g. contract deployment) — stop tracing.
      return null
    }

    return {
      address: address.toLowerCase(),
      funderAddress,
      funderTxHash: data.result.hash,
      blockNumber: Number(data.result.blockNumber ?? 0),
      timestamp: Number(data.result.timeStamp ?? 0),
      chainId,
      hop: 0, // Will be set by the caller.
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Trace the funding chain for a wallet address.
 *
 * @param address - Target wallet address.
 * @param options.hops - Number of hops to trace (default 3, max 5).
 * @param options.chainId - Chain to trace on (default 8453 = Base).
 */
export async function traceFunders(
  address: string,
  options: { hops?: number; chainId?: number } = {},
): Promise<FunderTraceResult> {
  const hops = Math.min(Math.max(1, options.hops ?? 3), MAX_HOPS_CEILING)
  const chainId = options.chainId ?? 8453
  const apiKey = getEtherscanApiKey()

  if (!apiKey) {
    return {
      target: address.toLowerCase(),
      chain: [],
      complete: false,
      requestedHops: hops,
      stopReason: 'api_error',
    }
  }

  const chain: FunderHop[] = []
  let currentAddress = address.toLowerCase()
  let stopReason: FunderTraceResult['stopReason'] | undefined

  for (let hop = 1; hop <= hops; hop++) {
    if (hop > 1) {
      // Rate-limit delay between hops.
      await new Promise((r) => setTimeout(r, HOP_DELAY_MS))
    }

    const result = await fetchFundedBy(currentAddress, chainId, apiKey)

    if (!result) {
      stopReason = hop === 1 ? 'no_funder' : 'no_funder'
      break
    }

    result.hop = hop
    chain.push(result)
    currentAddress = result.funderAddress
  }

  return {
    target: address.toLowerCase(),
    chain,
    complete: !stopReason && chain.length === hops,
    requestedHops: hops,
    stopReason,
  }
}

/**
 * Trace funders across multiple chains and merge results.
 * Returns the longest chain found across all requested chains.
 */
export async function traceFundersMultiChain(
  address: string,
  options: { hops?: number; chainIds?: number[] } = {},
): Promise<FunderTraceResult & { chains: Record<number, FunderTraceResult> }> {
  const chainIds = options.chainIds ?? [8453, 1] // Base + Ethereum mainnet
  const hops = options.hops ?? 3

  const results = await Promise.all(
    chainIds.map((chainId) => traceFunders(address, { hops, chainId })),
  )

  const chains: Record<number, FunderTraceResult> = {}
  let best: FunderTraceResult = results[0]!

  for (let i = 0; i < results.length; i++) {
    const result = results[i]!
    chains[chainIds[i]!] = result
    if (result.chain.length > best.chain.length) {
      best = result
    }
  }

  return { ...best, chains }
}
