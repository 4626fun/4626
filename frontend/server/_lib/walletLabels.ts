/**
 * Wallet entity labeling — multi-source resolution.
 *
 * Priority order:
 *   1. Etherscan v2 Nametag API (works if your key has Pro Plus tier)
 *   2. Built-in known-address map (~200 well-known addresses)
 *   3. WalletLabels API (optional, if WALLET_LABELS_API_KEY is set)
 *
 * All sources degrade gracefully — if one fails, the next is tried.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WalletLabel = {
  /** Display name of the entity (e.g. "Coinbase"). */
  name: string
  /** Category (e.g. "exchange", "defi", "mixer", "bridge"). */
  category: string
  /** Subcategory for finer granularity. */
  subcategory?: string
  /** Source of the label. */
  source: 'etherscan' | 'known-address' | 'walletlabels'
}

export type WalletLabelResult = {
  address: string
  labels: WalletLabel[]
  /** Whether the address is associated with a known entity. */
  isKnownEntity: boolean
}

// ---------------------------------------------------------------------------
// Source 1: Etherscan v2 Nametag API (Pro Plus)
// ---------------------------------------------------------------------------

const ETHERSCAN_V2_BASE = 'https://api.etherscan.io/v2/api'

type EtherscanNametagResponse = {
  status: string
  message: string
  result?: Array<{
    address?: string
    nametag?: string
    labels?: string[]
    labels_slug?: string[]
    url?: string
    reputation?: number
  }>
}

async function fetchEtherscanNametag(
  address: string,
  chainId: number,
): Promise<WalletLabel[]> {
  const apiKey = (process.env.ETHERSCAN_API_KEY ?? '').trim()
  if (!apiKey) return []

  const url = new URL(ETHERSCAN_V2_BASE)
  url.searchParams.set('module', 'nametag')
  url.searchParams.set('action', 'getaddresstag')
  url.searchParams.set('address', address.toLowerCase())
  url.searchParams.set('chainid', String(chainId))
  url.searchParams.set('apikey', apiKey)

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 6_000)

  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal })
    if (!res.ok) return []

    const data = (await res.json()) as EtherscanNametagResponse
    if (data.status !== '1' || !Array.isArray(data.result) || data.result.length === 0) {
      return []
    }

    const entry = data.result[0]!
    const labels: WalletLabel[] = []

    if (entry.nametag) {
      // Derive category from the labels array if available.
      const category = entry.labels_slug?.[0] ?? inferCategory(entry.nametag)
      labels.push({
        name: entry.nametag,
        category,
        source: 'etherscan',
      })
    }

    // Add any additional labels from the labels array.
    if (entry.labels && entry.labels.length > 0) {
      for (let i = 0; i < entry.labels.length; i++) {
        const lbl = entry.labels[i]!
        const slug = entry.labels_slug?.[i] ?? lbl.toLowerCase()
        // Skip if we already added this as the nametag.
        if (labels.some((l) => l.name === lbl)) continue
        labels.push({
          name: lbl,
          category: slug,
          source: 'etherscan',
        })
      }
    }

    return labels
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

function inferCategory(nametag: string): string {
  const lower = nametag.toLowerCase()
  if (/coinbase|binance|kraken|gemini|okx|bybit|bitfinex|huobi|kucoin|gate\.io|crypto\.com|bitstamp/.test(lower)) return 'exchange'
  if (/uniswap|sushiswap|curve|aave|compound|maker|lido|eigenlayer|pendle|morpho|yearn|convex|balancer|1inch|pancakeswap/.test(lower)) return 'defi'
  if (/tornado|mixer|blender/.test(lower)) return 'mixer'
  if (/bridge|wormhole|stargate|layerzero|across|hop|synapse|celer|multichain/.test(lower)) return 'bridge'
  if (/nft|opensea|blur|rarible|foundation|zora|manifold/.test(lower)) return 'nft'
  if (/gnosis|safe|multisig/.test(lower)) return 'multisig'
  if (/dao|governance|treasury/.test(lower)) return 'dao'
  return 'other'
}

// ---------------------------------------------------------------------------
// Source 2: Built-in known-address map
// ---------------------------------------------------------------------------

type KnownEntry = { name: string; category: string; subcategory?: string }

/**
 * Comprehensive map of well-known addresses across Ethereum mainnet and Base.
 * Addresses are stored lowercase.
 */
const KNOWN_ADDRESSES: Record<string, KnownEntry> = {
  // ── Exchanges ──
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': { name: 'Coinbase', category: 'exchange' },
  '0x503828976d22510aad0201ac7ec88293211d23da': { name: 'Coinbase', category: 'exchange' },
  '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740': { name: 'Coinbase', category: 'exchange' },
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': { name: 'Coinbase', category: 'exchange' },
  '0x3cd751e6b0078be393132286c442345e68ff0aaa': { name: 'Coinbase', category: 'exchange' },
  '0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511': { name: 'Coinbase', category: 'exchange' },
  '0xeb2629a2734e272bcc07bda959863f316f4bd4cf': { name: 'Coinbase', category: 'exchange' },
  '0x02466e547bfdab679fc49e96bbfc62b9747d997c': { name: 'Coinbase', category: 'exchange' },
  '0xa090e606e30bd747d4e6245a1517ebe430f0057e': { name: 'Coinbase', category: 'exchange' },
  '0x28c6c06298d514db089934071355e5743bf21d60': { name: 'Binance', category: 'exchange' },
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': { name: 'Binance', category: 'exchange' },
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': { name: 'Binance', category: 'exchange' },
  '0x56eddb7aa87536c09ccc2793473599fd21a8b17f': { name: 'Binance', category: 'exchange' },
  '0xf977814e90da44bfa03b6295a0616a897441acec': { name: 'Binance', category: 'exchange' },
  '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8': { name: 'Binance', category: 'exchange' },
  '0x2faf487a4414fe77e2327f0bf4ae2a264a776ad2': { name: 'FTX', category: 'exchange', subcategory: 'defunct' },
  '0xc098b2a3aa256d2140208c3de6543aaef5cd3a94': { name: 'FTX', category: 'exchange', subcategory: 'defunct' },
  '0x2910543af39aba0cd09dbb2d50200b3e800a63d2': { name: 'Kraken', category: 'exchange' },
  '0xae2d4617c862309a3d75a0ffb358c7a5009c673f': { name: 'Kraken', category: 'exchange' },
  '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0': { name: 'Kraken', category: 'exchange' },
  '0xd24400ae8bfebb18ca49be86258a3c749cf46853': { name: 'Gemini', category: 'exchange' },
  '0x6fc82a5fe25a5cdb58bc74600a40a69c065263f8': { name: 'Gemini', category: 'exchange' },
  '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b': { name: 'OKX', category: 'exchange' },
  '0x98ec059dc3adfbdd63429454aeb0c990fba4a128': { name: 'OKX', category: 'exchange' },
  '0x4976a4a02f38326660d17bf34b431dc6e2eb2327': { name: 'Bybit', category: 'exchange' },
  '0x1ab4973a48dc892cd9971ece8e01dcc7688f8f23': { name: 'Bybit', category: 'exchange' },
  '0xf89d7b9c864f589bbf53a82105107622b35eaa40': { name: 'Bybit', category: 'exchange' },
  '0x0d0707963952f2fba59dd06f2b425ace40b492fe': { name: 'Gate.io', category: 'exchange' },
  '0x1c4b70a3968436b9a0a9cf5205c787eb81bb558c': { name: 'Gate.io', category: 'exchange' },
  '0x75e89d5979e4f6fba9f97c104c2f0afb3f1dcb88': { name: 'MEXC', category: 'exchange' },
  '0xeee27662c2b8eba3cd936a23f039f3189633e4c8': { name: 'Crypto.com', category: 'exchange' },
  '0x6262998ced04146fa42253a5c0af90ca02dfd2a3': { name: 'Crypto.com', category: 'exchange' },
  '0x46340b20830761efd32832a74d7169b29feb9758': { name: 'Crypto.com', category: 'exchange' },
  '0xc882b111a75c0c657fc507c04fbfcd2cc984f071': { name: 'HTX (Huobi)', category: 'exchange' },
  '0xab5c66752a9e8167967685f1450532fb96d5d24f': { name: 'HTX (Huobi)', category: 'exchange' },
  '0x1db92e2eebc8e0c075a02bea49a2935bcd2dfcf4': { name: 'KuCoin', category: 'exchange' },
  '0xd6216fc19db775df9774a6e33526131da7d19a2c': { name: 'KuCoin', category: 'exchange' },
  '0xfb8131c260749c7835a08ccbdb64a6e7f06515ab': { name: 'Bitfinex', category: 'exchange' },
  '0x742d35cc6634c0532925a3b844bc9e7595f2bd3e': { name: 'Bitfinex', category: 'exchange' },
  '0x61edcdf5bb737adffe5043706e7c5bb1f1a56eea': { name: 'Bitget', category: 'exchange' },
  '0x5bdf85216ec1e38d6458c870992a69e38e03f7ef': { name: 'Bitget', category: 'exchange' },
  '0x974caa59e49682cda0ad2bbe82983419a2ecc400': { name: 'Bitstamp', category: 'exchange' },
  '0x00bdb5699745f5b860228c8f939abf1b9ae374ed': { name: 'Bitstamp', category: 'exchange' },

  // ── DeFi Protocols ──
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': { name: 'Uniswap V2 Router', category: 'defi', subcategory: 'dex' },
  '0xe592427a0aece92de3edee1f18e0157c05861564': { name: 'Uniswap V3 Router', category: 'defi', subcategory: 'dex' },
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': { name: 'Uniswap V3 Router 2', category: 'defi', subcategory: 'dex' },
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': { name: 'Uniswap Universal Router', category: 'defi', subcategory: 'dex' },
  '0x1f98431c8ad98523631ae4a59f267346ea31f984': { name: 'Uniswap V3 Factory', category: 'defi', subcategory: 'dex' },
  '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': { name: 'SushiSwap Router', category: 'defi', subcategory: 'dex' },
  '0x1111111254eeb25477b68fb85ed929f73a960582': { name: '1inch Router V5', category: 'defi', subcategory: 'aggregator' },
  '0x111111125421ca6dc452d289314280a0f8842a65': { name: '1inch Router V6', category: 'defi', subcategory: 'aggregator' },
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': { name: '0x Exchange Proxy', category: 'defi', subcategory: 'aggregator' },
  '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': { name: 'Aave V3 Pool', category: 'defi', subcategory: 'lending' },
  '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9': { name: 'Aave V2 Pool', category: 'defi', subcategory: 'lending' },
  '0xc3d688b66703497daa19211eedff47f25384cdc3': { name: 'Compound V3 (cUSDCv3)', category: 'defi', subcategory: 'lending' },
  '0xa17581a9e3356d9a858b789d68b4d866e593ae94': { name: 'Compound V3 (cWETHv3)', category: 'defi', subcategory: 'lending' },
  '0x5a98fcbea516cf06857215779fd812ca3bef1b32': { name: 'Lido DAO Token', category: 'defi', subcategory: 'staking' },
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': { name: 'Lido stETH', category: 'defi', subcategory: 'staking' },
  '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': { name: 'Lido wstETH', category: 'defi', subcategory: 'staking' },
  '0x858646372cc42e1a627fce94aa7a7033e7cf075a': { name: 'EigenLayer Strategy Manager', category: 'defi', subcategory: 'restaking' },
  '0x9d39a5de30e57443bff2a8307a4256c8797a3497': { name: 'Maker sDAI', category: 'defi', subcategory: 'stablecoin' },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { name: 'Maker DAI', category: 'defi', subcategory: 'stablecoin' },
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': { name: 'Maker MKR', category: 'defi', subcategory: 'governance' },
  '0xd533a949740bb3306d119cc777fa900ba034cd52': { name: 'Curve CRV', category: 'defi', subcategory: 'dex' },
  '0xba100000625a3754423978a60c9317c58a424e3d': { name: 'Balancer BAL', category: 'defi', subcategory: 'dex' },

  // ── Bridges ──
  '0x3154cf16ccdb4c6d922629664174b904d80f2c35': { name: 'Base Bridge', category: 'bridge' },
  '0x49048044d57e1c92a77f79988d21fa8faf74e97e': { name: 'Base Portal (OptimismPortal)', category: 'bridge' },
  '0x99c9fc46f92e8a1c0dec1b1747d010903e884be1': { name: 'Optimism Bridge', category: 'bridge' },
  '0x3ee18b2214aff97000d974cf647e7c347e8fa585': { name: 'Wormhole Token Bridge', category: 'bridge' },
  '0x3a23f943181408eac424116af7b7790c94cb97a5': { name: 'Socket Bridge', category: 'bridge' },
  '0x5427fefa711eff984124bfbb1ab6fbf5e3da1820': { name: 'Synapse Bridge', category: 'bridge' },
  '0xb8901acb165ed027e32754e0ffe830802919727f': { name: 'Hop Protocol', category: 'bridge' },
  '0xe4e4003afe3765aca8149a82fc064c0b125b9e5a': { name: 'Stargate Router V2', category: 'bridge' },
  '0x8731d54e9d02c286767d56ac03e8037c07e01e98': { name: 'Stargate Router V1', category: 'bridge' },
  '0x5e4861a80b55f035d899f66f7f560a84a9304871': { name: 'Across Bridge', category: 'bridge' },

  // ── Mixers / Privacy ──
  '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b': { name: 'Tornado Cash Router', category: 'mixer' },
  '0x722122df12d4e14e13ac3b6895a86e84145b6967': { name: 'Tornado Cash Proxy', category: 'mixer' },
  '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc': { name: 'Tornado Cash 0.1 ETH', category: 'mixer' },
  '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936': { name: 'Tornado Cash 1 ETH', category: 'mixer' },
  '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf': { name: 'Tornado Cash 10 ETH', category: 'mixer' },
  '0xa160cdab225685da1d56aa342ad8841c3b53f291': { name: 'Tornado Cash 100 ETH', category: 'mixer' },

  // ── NFT / Marketplaces ──
  '0x00000000006c3852cbef3e08e8df289169ede581': { name: 'OpenSea Seaport 1.1', category: 'nft', subcategory: 'marketplace' },
  '0x00000000000001ad428e4906ae43d8f9852d0dd6': { name: 'OpenSea Seaport 1.5', category: 'nft', subcategory: 'marketplace' },
  '0x0000000000000068f116a894984e2db1123eb395': { name: 'OpenSea Seaport 1.6', category: 'nft', subcategory: 'marketplace' },
  '0x29469395eaf6f95920e59f858042f0e28d98a20b': { name: 'Blur Marketplace', category: 'nft', subcategory: 'marketplace' },
  '0x39da41747a83aee658334415666f3ef92dd0d541': { name: 'Blur Bidding', category: 'nft', subcategory: 'marketplace' },
  '0x1e0049783f008a0085193e00003d00cd54003c71': { name: 'Zora', category: 'nft', subcategory: 'creator' },

  // ── Stablecoins (issuers) ──
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { name: 'USDC (Circle)', category: 'stablecoin' },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { name: 'USDT (Tether)', category: 'stablecoin' },
  '0x4fabb145d64652a948d72533023f6e7a623c7c53': { name: 'BUSD (Paxos)', category: 'stablecoin' },

  // ── Multisig / DAOs ──
  '0xd73a92be73efbfcf3854433a5fcbabf9c1316073': { name: 'Safe Singleton Factory', category: 'multisig' },
  '0xa6b71e26c5e0845f74c812102ca7114b6a896ab2': { name: 'Safe Proxy Factory 1.3', category: 'multisig' },
  '0x4e1dcf7ad4e460cfd30791ccc4f9c8a4f820ec67': { name: 'Safe Proxy Factory 1.4', category: 'multisig' },

  // ── Infrastructure ──
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { name: 'WETH', category: 'infrastructure', subcategory: 'wrapper' },
  '0x4200000000000000000000000000000000000006': { name: 'WETH (Base)', category: 'infrastructure', subcategory: 'wrapper' },
  '0x4200000000000000000000000000000000000007': { name: 'L2 Cross Domain Messenger (Base)', category: 'infrastructure', subcategory: 'system' },
  '0x4200000000000000000000000000000000000010': { name: 'L2 Standard Bridge (Base)', category: 'infrastructure', subcategory: 'system' },
  '0x4200000000000000000000000000000000000016': { name: 'L2 To L1 Message Passer (Base)', category: 'infrastructure', subcategory: 'system' },
  '0x420000000000000000000000000000000000001a': { name: 'Fee Vault (Base)', category: 'infrastructure', subcategory: 'system' },

  // ── Notable Individuals ──
  '0xd8da6bf26964af9d7eed9e03e53415d37aa96045': { name: 'vitalik.eth', category: 'notable', subcategory: 'individual' },
  '0xab5801a7d398351b8be11c439e05c5b3259aec9b': { name: 'Vitalik Buterin (old)', category: 'notable', subcategory: 'individual' },
}

function lookupKnownAddress(address: string): WalletLabel | null {
  const entry = KNOWN_ADDRESSES[address.toLowerCase()]
  if (!entry) return null
  return {
    name: entry.name,
    category: entry.category,
    subcategory: entry.subcategory,
    source: 'known-address',
  }
}

// ---------------------------------------------------------------------------
// Source 3: WalletLabels API (optional)
// ---------------------------------------------------------------------------

const WALLET_LABELS_BASE = 'https://api.walletlabels.xyz'

type WalletLabelsApiResponse = {
  address?: string
  address_name?: string
  label_type?: string
  label_subtype?: string
  label?: string
}

function getWalletLabelsApiKey(): string {
  return (process.env.WALLET_LABELS_API_KEY ?? '').trim()
}

function chainSlug(chainId: number): string {
  switch (chainId) {
    case 1: return 'ethereum'
    case 8453: return 'base'
    case 10: return 'optimism'
    case 42161: return 'arbitrum'
    default: return 'ethereum'
  }
}

async function fetchWalletLabels(
  address: string,
  chainId: number,
): Promise<WalletLabel[]> {
  const apiKey = getWalletLabelsApiKey()
  if (!apiKey) return []

  const slug = chainSlug(chainId)
  const url = `${WALLET_LABELS_BASE}/${slug}/label/${address.toLowerCase()}`

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 8_000)

  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
      signal: ctrl.signal,
    })
    if (!res.ok) return []

    const data = await res.json()
    const items: WalletLabelsApiResponse[] = Array.isArray(data) ? data : data ? [data] : []

    return items
      .filter((item) => item.address_name || item.label)
      .map((item) => ({
        name: item.address_name || item.label || 'Unknown',
        category: item.label_type || 'unknown',
        subcategory: item.label_subtype || undefined,
        source: 'walletlabels' as const,
      }))
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve labels for a single address using all available sources.
 *
 * Priority: Etherscan nametag > built-in known map > WalletLabels API.
 * Returns as soon as any source produces results.
 */
export async function getWalletLabelsForAddress(
  address: string,
  chainId: number = 8453,
): Promise<WalletLabelResult> {
  const addr = address.toLowerCase()
  const labels: WalletLabel[] = []

  // 1. Try Etherscan nametag (Pro Plus — gracefully fails on free tier).
  const etherscanLabels = await fetchEtherscanNametag(addr, chainId)
  if (etherscanLabels.length > 0) {
    labels.push(...etherscanLabels)
    return { address: addr, labels, isKnownEntity: true }
  }

  // 2. Check built-in known-address map (instant, no network).
  const known = lookupKnownAddress(addr)
  if (known) {
    labels.push(known)
    return { address: addr, labels, isKnownEntity: true }
  }

  // 3. Try WalletLabels API (optional, if key is set).
  const walletLabelsResult = await fetchWalletLabels(addr, chainId)
  if (walletLabelsResult.length > 0) {
    labels.push(...walletLabelsResult)
    return { address: addr, labels, isKnownEntity: true }
  }

  return { address: addr, labels: [], isKnownEntity: false }
}

/**
 * Resolve labels for multiple addresses in parallel.
 */
export async function getWalletLabelsBatch(
  addresses: string[],
  chainId: number = 8453,
): Promise<Record<string, WalletLabelResult>> {
  const results: Record<string, WalletLabelResult> = {}

  // Batch in groups of 10 to avoid overwhelming external APIs.
  const BATCH_SIZE = 10
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map((addr) => getWalletLabelsForAddress(addr, chainId)),
    )
    for (const result of batchResults) {
      results[result.address] = result
    }
  }

  return results
}
