import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleOptions, setCors } from '../../../server/auth/_shared.js'

declare const process: { env: Record<string, string | undefined> }

type CheckStatus = 'pass' | 'fail' | 'warn' | 'info'

type Check = {
  id: string
  label: string
  status: CheckStatus
  details?: string
  href?: string
}

type CheckSection = {
  id: string
  title: string
  description?: string
  checks: Check[]
}

function setCache(res: VercelResponse, seconds: number = 60) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

function getReadRpcUrl(): string {
  const read = process.env.BASE_READ_RPC_URL
  if (read && read.length > 0) return read

  const rpc = process.env.BASE_RPC_URL
  if (rpc && rpc.length > 0) return rpc

  return 'https://mainnet.base.org'
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getStringQuery(req: VercelRequest, key: string): string | null {
  const val = req.query?.[key]
  if (typeof val === 'string' && val.trim().length > 0) return val.trim()
  return null
}

function basescanAddressHref(addr: string) {
  return `https://basescan.org/address/${addr}`
}

function errorToMessage(e: unknown): string {
  return String((e as any)?.shortMessage || (e as any)?.message || e || 'Unknown error')
}

function isRateLimitError(message: string): boolean {
  return /429|rate limit|too many requests/i.test(message)
}

async function safeMulticall(client: any, contracts: any[]) {
  return await client.multicall({ contracts, allowFailure: true })
}

function pickResult<T>(r: any): T | null {
  return r?.status === 'success' ? (r.result as T) : null
}

const OWNABLE_VIEW_ABI = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const VAULT_VIEW_ABI = [
  { type: 'function', name: 'CREATOR_COIN', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'gaugeController', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'whitelist', stateMutability: 'view', inputs: [{ name: '_account', type: 'address' }], outputs: [{ type: 'bool' }] },
  {
    type: 'function',
    name: 'getStrategies',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'strategies', type: 'address[]' },
      { name: 'weights', type: 'uint256[]' },
      { name: 'assets', type: 'uint256[]' },
    ],
  },
] as const

// Some older vault versions used different getter names (or no public getter at all).
const VAULT_WHITELIST_COMPAT_ABI = [
  { type: 'function', name: 'whitelist', stateMutability: 'view', inputs: [{ name: '_account', type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'whitelisted', stateMutability: 'view', inputs: [{ name: '_account', type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'isWhitelisted', stateMutability: 'view', inputs: [{ name: '_account', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const

const GAUGE_VIEW_ABI = [
  { type: 'function', name: 'shareOFT', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'wrapper', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'vault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'creatorCoin', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'oracle', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'creatorTreasury', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'protocolTreasury', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const WRAPPER_VIEW_ABI = [
  { type: 'function', name: 'creatorCoin', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'vault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'shareOFT', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const SHAREOFT_VIEW_ABI = [
  { type: 'function', name: 'vault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'gaugeController', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'isMinter', stateMutability: 'view', inputs: [{ name: 'minter', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const

const CREATOR_CHARM_STRATEGY_VIEW_ABI = [
  { type: 'function', name: 'charmVault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const ERC4626_STRATEGY_ADAPTER_VIEW_ABI = [
  { type: 'function', name: 'ERC4626_VAULT', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const AJNA_INNER_VAULT_VIEW_ABI = [
  { type: 'function', name: 'AJNA_POOL', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'AUTH', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const AJNA_AUTH_VIEW_ABI = [
  { type: 'function', name: 'admin', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'bufferRatio', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'minBucketIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
] as const

const SOLANA_BRIDGE_STRATEGY_VIEW_ABI = [
  { type: 'function', name: 'bridgeAdapter', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'solanaDestination', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
] as const

const STRATEGY_VIEW_ABI = [
  { type: 'function', name: 'isActive', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'asset', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const AJNA_POOL_VIEW_ABI = [
  { type: 'function', name: 'collateralAddress', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const ORACLE_V3_VIEW_ABI = [
  { type: 'function', name: 'v3PoolConfigured', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'v3Pool', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'v3CreatorToken', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'v3UsdToken', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const UNISWAP_V3_FACTORY_ABI = [
  {
    type: 'function',
    name: 'getPool',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ type: 'address' }],
  },
] as const

const UNISWAP_V3_POOL_ABI = [
  { type: 'function', name: 'token0', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token1', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function',
    name: 'slot0',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'observe',
    stateMutability: 'view',
    inputs: [{ name: 'secondsAgos', type: 'uint32[]' }],
    outputs: [
      { name: 'tickCumulatives', type: 'int56[]' },
      { name: 'secondsPerLiquidityCumulativeX128s', type: 'uint160[]' },
    ],
  },
] as const

// Base mainnet constants (avoid path aliases in serverless handlers used by Vite config bundling)
const BASE_USDC = `0x${'833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'}`
const BASE_UNISWAP_V3_FACTORY = `0x${'33128a8fC17869897dcE68Ed026d694621f6FDfD'}`
const AJNA_BUCKET_TARGET_LTV_BPS = (() => {
  const raw = Number(process.env.AJNA_BUCKET_TARGET_LTV_BPS ?? '7000')
  if (!Number.isFinite(raw) || raw <= 0 || raw > 10_000) return 7_000
  return Math.floor(raw)
})()
const LOG_1_0001 = Math.log(1.0001)
const LOG_10_BASE_1_0001 = Math.log(10) / LOG_1_0001

function floorDiv(a: number, b: number): number {
  const q = Math.trunc(a / b)
  const r = a % b
  if (a < 0 && r !== 0) return q - 1
  return q
}

function tickToAjnaBucket(tick: number): number {
  const q = floorDiv(tick, 50)
  let idx = 4156 - q
  if (idx < 1) idx = 1
  if (idx > 7388) idx = 7388
  return idx
}

function compareAddressNumeric(a: `0x${string}`, b: `0x${string}`): number {
  const av = BigInt(a)
  const bv = BigInt(b)
  if (av === bv) return 0
  return av > bv ? 1 : -1
}

function deriveAjnaBucketFromV3Tick(params: {
  twapTick: number
  creatorToken: `0x${string}`
  usdToken: `0x${string}`
  creatorDecimals: number
  usdDecimals: number
  targetLtvBps: number
}): { bucket: number; adjustedTick: number } | null {
  if (!Number.isFinite(params.twapTick)) return null
  if (params.targetLtvBps <= 0 || params.targetLtvBps > 10_000) return null

  const creatorIsToken1 = compareAddressNumeric(params.creatorToken, params.usdToken) > 0
  const orientedTick = creatorIsToken1 ? params.twapTick : -params.twapTick
  const decimalsTickOffset = (params.usdDecimals - params.creatorDecimals) * LOG_10_BASE_1_0001
  const ltvTickOffset = Math.log(params.targetLtvBps / 10_000) / LOG_1_0001
  const adjustedTick = Math.floor(orientedTick + decimalsTickOffset + ltvTickOffset)
  if (!Number.isFinite(adjustedTick)) return null
  return { bucket: tickToAjnaBucket(adjustedTick), adjustedTick }
}

function approxToken1PerToken0(tick: number, decimals0: number, decimals1: number): number {
  const priceRaw = Math.pow(1.0001, tick)
  const decAdj = Math.pow(10, decimals0 - decimals1)
  return priceRaw * decAdj
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const vault = getStringQuery(req, 'vault')
  if (!vault) return res.status(400).json({ success: false, error: 'vault is required' })
  if (!isAddressLike(vault)) return res.status(400).json({ success: false, error: 'Invalid vault address' })
  const cacheBust = getStringQuery(req, 't')

  const rpcUrl = getReadRpcUrl()

  try {
    const { createPublicClient, http, erc20Abi, isAddress } = await import('viem')
    const { base } = await import('viem/chains')

    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl, { timeout: 20_000 }),
    })

    const ZERO = `0x${'0'.repeat(40)}`
    const ZERO_BYTES32 = `0x${'0'.repeat(64)}`
    const addrOk = (a: any): a is `0x${string}` => typeof a === 'string' && isAddress(a) && a !== ZERO
    const any429 = (results: any[]) =>
      results.some((r) => r?.status === 'failure' && isRateLimitError(errorToMessage((r as any)?.error)))

    const vaultAddress = vault as `0x${string}`

    const vaultBasics = await safeMulticall(client, [
      { address: vaultAddress, abi: OWNABLE_VIEW_ABI, functionName: 'owner' },
      { address: vaultAddress, abi: VAULT_VIEW_ABI, functionName: 'CREATOR_COIN' },
      { address: vaultAddress, abi: VAULT_VIEW_ABI, functionName: 'gaugeController' },
      { address: vaultAddress, abi: erc20Abi, functionName: 'name' },
      { address: vaultAddress, abi: erc20Abi, functionName: 'symbol' },
    ])
    if (any429(vaultBasics)) {
      return res.status(429).json({ success: false, error: 'Rate limited by RPC' })
    }

    const owner = pickResult<`0x${string}`>(vaultBasics[0])
    const creatorToken = pickResult<`0x${string}`>(vaultBasics[1])
    const gaugeAddress = pickResult<`0x${string}`>(vaultBasics[2])
    const vaultName = pickResult<string>(vaultBasics[3]) ?? 'Vault'
    const vaultSymbol = pickResult<string>(vaultBasics[4]) ?? '—'

    if (!addrOk(owner) || !addrOk(creatorToken)) {
      return res.status(400).json({ success: false, error: 'Vault is not readable (or not a CreatorOVault)' })
    }

    let creatorSymbol = '—'
    try {
      creatorSymbol = (await client.readContract({
        address: creatorToken,
        abi: erc20Abi as any,
        functionName: 'symbol',
      })) as string
    } catch {
      // ignore
    }

    // Gauge derived addresses
    let shareOFTAddress: `0x${string}` | null = null
    let wrapperAddress: `0x${string}` | null = null
    let oracleAddress: `0x${string}` | null = null
    let gaugeVault: `0x${string}` | null = null
    let gaugeCreatorCoin: `0x${string}` | null = null
    let creatorTreasury: `0x${string}` | null = null
    let protocolTreasury: `0x${string}` | null = null

    if (addrOk(gaugeAddress)) {
      const gaugeRes = await safeMulticall(client, [
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'shareOFT' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'wrapper' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'oracle' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'vault' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'creatorCoin' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'creatorTreasury' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'protocolTreasury' },
      ])
      if (any429(gaugeRes)) {
        return res.status(429).json({ success: false, error: 'Rate limited by RPC' })
      }
      shareOFTAddress = pickResult<`0x${string}`>(gaugeRes[0])
      wrapperAddress = pickResult<`0x${string}`>(gaugeRes[1])
      oracleAddress = pickResult<`0x${string}`>(gaugeRes[2])
      gaugeVault = pickResult<`0x${string}`>(gaugeRes[3])
      gaugeCreatorCoin = pickResult<`0x${string}`>(gaugeRes[4])
      creatorTreasury = pickResult<`0x${string}`>(gaugeRes[5])
      protocolTreasury = pickResult<`0x${string}`>(gaugeRes[6])
    }

    // Share token wiring
    let shareName: string | null = null
    let shareSymbol: string | null = null
    let shareOwner: `0x${string}` | null = null
    let shareVault: `0x${string}` | null = null
    let shareGauge: `0x${string}` | null = null
    let shareMinterOk: boolean | null = null
    if (addrOk(shareOFTAddress)) {
      const shareCalls: any[] = [
        { address: shareOFTAddress, abi: OWNABLE_VIEW_ABI, functionName: 'owner' },
        { address: shareOFTAddress, abi: erc20Abi, functionName: 'name' },
        { address: shareOFTAddress, abi: erc20Abi, functionName: 'symbol' },
        { address: shareOFTAddress, abi: SHAREOFT_VIEW_ABI, functionName: 'vault' },
        { address: shareOFTAddress, abi: SHAREOFT_VIEW_ABI, functionName: 'gaugeController' },
      ]
      if (addrOk(wrapperAddress)) {
        shareCalls.push({
          address: shareOFTAddress,
          abi: SHAREOFT_VIEW_ABI,
          functionName: 'isMinter',
          args: [wrapperAddress],
        })
      }
      const shareRes = await safeMulticall(client, shareCalls)
      if (any429(shareRes)) {
        return res.status(429).json({ success: false, error: 'Rate limited by RPC' })
      }
      shareOwner = pickResult<`0x${string}`>(shareRes[0])
      shareName = pickResult<string>(shareRes[1])
      shareSymbol = pickResult<string>(shareRes[2])
      shareVault = pickResult<`0x${string}`>(shareRes[3])
      shareGauge = pickResult<`0x${string}`>(shareRes[4])
      if (shareRes.length >= 6) shareMinterOk = pickResult<boolean>(shareRes[5])
    }

    // Wrapper wiring
    let wrapperVault: `0x${string}` | null = null
    let wrapperCoin: `0x${string}` | null = null
    let wrapperShare: `0x${string}` | null = null
    let wrapperOwner: `0x${string}` | null = null
    if (addrOk(wrapperAddress)) {
      const wrapRes = await safeMulticall(client, [
        { address: wrapperAddress, abi: OWNABLE_VIEW_ABI, functionName: 'owner' },
        { address: wrapperAddress, abi: WRAPPER_VIEW_ABI, functionName: 'vault' },
        { address: wrapperAddress, abi: WRAPPER_VIEW_ABI, functionName: 'creatorCoin' },
        { address: wrapperAddress, abi: WRAPPER_VIEW_ABI, functionName: 'shareOFT' },
      ])
      if (any429(wrapRes)) {
        return res.status(429).json({ success: false, error: 'Rate limited by RPC' })
      }
      wrapperOwner = pickResult<`0x${string}`>(wrapRes[0])
      wrapperVault = pickResult<`0x${string}`>(wrapRes[1])
      wrapperCoin = pickResult<`0x${string}`>(wrapRes[2])
      wrapperShare = pickResult<`0x${string}`>(wrapRes[3])
    }

    // Vault whitelist + strategies
    let wrapperWhitelisted: boolean | null = null
    let strategies: readonly `0x${string}`[] = []
    let weights: readonly bigint[] = []
    const extraCalls: any[] = []
    if (addrOk(wrapperAddress)) {
      extraCalls.push({ address: vaultAddress, abi: VAULT_WHITELIST_COMPAT_ABI, functionName: 'whitelist', args: [wrapperAddress] })
      extraCalls.push({ address: vaultAddress, abi: VAULT_WHITELIST_COMPAT_ABI, functionName: 'whitelisted', args: [wrapperAddress] })
      extraCalls.push({ address: vaultAddress, abi: VAULT_WHITELIST_COMPAT_ABI, functionName: 'isWhitelisted', args: [wrapperAddress] })
    }
    extraCalls.push({ address: vaultAddress, abi: VAULT_VIEW_ABI, functionName: 'getStrategies' })
    const extraRes = await safeMulticall(client, extraCalls)
    if (any429(extraRes)) {
      return res.status(429).json({ success: false, error: 'Rate limited by RPC' })
    }
    if (addrOk(wrapperAddress)) {
      wrapperWhitelisted =
        pickResult<boolean>(extraRes[0]) ??
        pickResult<boolean>(extraRes[1]) ??
        pickResult<boolean>(extraRes[2]) ??
        null
    }
    const tuple = pickResult<any>(extraRes[addrOk(wrapperAddress) ? 3 : 0])
    if (tuple) {
      strategies = (tuple[0] ?? []) as readonly `0x${string}`[]
      weights = (tuple[1] ?? []) as readonly bigint[]
    }

    // Strategy details (best-effort)
    const strategyChecks: Check[] = []
    if (!strategies.length) {
      strategyChecks.push({
        id: 'no-strategies',
        label: 'Yield strategies configured',
        status: 'warn',
        details: 'No strategies are configured yet. This is optional.',
      })
    } else {
      strategyChecks.push({
        id: 'strategy-count',
        label: 'Yield strategies configured',
        status: 'pass',
        details: `${strategies.length} strategies`,
      })
    }

    let ajnaAdapterAddress: `0x${string}` | null = null
    let ajnaAdapterOwner: `0x${string}` | null = null
    let ajnaInnerVaultAddress: `0x${string}` | null = null
    let ajnaAuthAddress: `0x${string}` | null = null
    let ajnaAuthAdmin: `0x${string}` | null = null
    let ajnaBufferRatioBps: bigint | null = null
    let ajnaMinBucketIndex: bigint | null = null
    let ajnaPaused: boolean | null = null
    let ajnaCollateralToken: `0x${string}` | null = null
    let solanaStrategyAddress: `0x${string}` | null = null
    let solanaStrategyOwner: `0x${string}` | null = null
    let solanaBridgeAdapterAddress: `0x${string}` | null = null
    let solanaBridgeDestination: `0x${string}` | null = null

    const stratCalls: any[] = []
    for (const s of strategies) {
      stratCalls.push({ address: s, abi: STRATEGY_VIEW_ABI, functionName: 'isActive' })
      stratCalls.push({ address: s, abi: STRATEGY_VIEW_ABI, functionName: 'asset' })
      stratCalls.push({ address: s, abi: CREATOR_CHARM_STRATEGY_VIEW_ABI, functionName: 'charmVault' })
      stratCalls.push({ address: s, abi: SOLANA_BRIDGE_STRATEGY_VIEW_ABI, functionName: 'bridgeAdapter' })
      stratCalls.push({ address: s, abi: SOLANA_BRIDGE_STRATEGY_VIEW_ABI, functionName: 'solanaDestination' })
      stratCalls.push({ address: s, abi: OWNABLE_VIEW_ABI, functionName: 'owner' })
    }

    const stratRes = stratCalls.length ? await safeMulticall(client, stratCalls) : []
    if (any429(stratRes)) {
      strategyChecks.push({
        id: 'strategies-rate',
        label: 'Strategy checks',
        status: 'warn',
        details: 'Rate limited while reading strategy details. Try again.',
      })
    } else {
      const stride = 6
      for (let i = 0; i < strategies.length; i++) {
        const s = strategies[i]
        const w = weights[i] ?? 0n
        const base = i * stride

        const isActive = pickResult<boolean>(stratRes[base + 0])
        const asset = pickResult<`0x${string}`>(stratRes[base + 1])
        const charmVault = pickResult<`0x${string}`>(stratRes[base + 2])
        const bridgeAdapter = pickResult<`0x${string}`>(stratRes[base + 3])
        const solanaDestination = pickResult<`0x${string}`>(stratRes[base + 4])
        const stratOwner = pickResult<`0x${string}`>(stratRes[base + 5])
        let nestedAjnaInnerVault: `0x${string}` | null = null
        let nestedAjnaAuth: `0x${string}` | null = null
        let nestedAjnaAdmin: `0x${string}` | null = null
        let nestedAjnaBufferRatio: bigint | null = null
        let nestedAjnaMinBucket: bigint | null = null
        let nestedAjnaPaused: boolean | null = null
        let nestedAjnaCollateral: `0x${string}` | null = null
        let effectiveAjnaPool: `0x${string}` | null = null

        const adapterRes = await safeMulticall(client, [
          { address: s, abi: ERC4626_STRATEGY_ADAPTER_VIEW_ABI, functionName: 'ERC4626_VAULT' },
        ])
        const adapterVault = pickResult<`0x${string}`>(adapterRes[0])

        if (addrOk(adapterVault)) {
          nestedAjnaInnerVault = adapterVault ?? null

          const innerRes = await safeMulticall(client, [
            { address: adapterVault as `0x${string}`, abi: AJNA_INNER_VAULT_VIEW_ABI, functionName: 'AJNA_POOL' },
            { address: adapterVault as `0x${string}`, abi: AJNA_INNER_VAULT_VIEW_ABI, functionName: 'AUTH' },
          ])
          effectiveAjnaPool = pickResult<`0x${string}`>(innerRes[0])
          nestedAjnaAuth = pickResult<`0x${string}`>(innerRes[1])

          if (addrOk(effectiveAjnaPool)) {
            const poolRes = await safeMulticall(client, [
              { address: effectiveAjnaPool as `0x${string}`, abi: AJNA_POOL_VIEW_ABI, functionName: 'collateralAddress' },
            ])
            nestedAjnaCollateral = pickResult<`0x${string}`>(poolRes[0])
          }

          if (addrOk(nestedAjnaAuth)) {
            const authRes = await safeMulticall(client, [
              { address: nestedAjnaAuth as `0x${string}`, abi: AJNA_AUTH_VIEW_ABI, functionName: 'admin' },
              { address: nestedAjnaAuth as `0x${string}`, abi: AJNA_AUTH_VIEW_ABI, functionName: 'bufferRatio' },
              { address: nestedAjnaAuth as `0x${string}`, abi: AJNA_AUTH_VIEW_ABI, functionName: 'minBucketIndex' },
              { address: nestedAjnaAuth as `0x${string}`, abi: AJNA_AUTH_VIEW_ABI, functionName: 'paused' },
            ])
            nestedAjnaAdmin = pickResult<`0x${string}`>(authRes[0])
            nestedAjnaBufferRatio = pickResult<bigint>(authRes[1])
            nestedAjnaMinBucket = pickResult<bigint>(authRes[2])
            nestedAjnaPaused = pickResult<boolean>(authRes[3])
          }
        }
        const hasSolanaRoute =
          addrOk(bridgeAdapter) || (typeof solanaDestination === 'string' && solanaDestination.toLowerCase() !== ZERO_BYTES32)
        const isNestedAjna = Boolean(nestedAjnaInnerVault && addrOk(effectiveAjnaPool))

        const flavor = addrOk(charmVault)
          ? 'Charm LP (CreatorCharmStrategy)'
          : isNestedAjna
            ? 'Ajna lending (adapter-backed inner vault)'
            : hasSolanaRoute
              ? 'Solana bridge (SolanaBridgeStrategy)'
            : `Strategy #${i + 1}`

        const assetOk = asset && isAddress(asset) ? asset.toLowerCase() === creatorToken.toLowerCase() : null
        const status: CheckStatus =
          assetOk === false
            ? 'fail'
            : isActive === false || nestedAjnaPaused === true
              ? 'warn'
              : typeof isActive !== 'boolean' || assetOk === null
                ? 'warn'
                : 'pass'

        const extras: string[] = [`${s} · weight ${w.toString()}`]
        if (asset) extras.push(`asset=${asset}`)
        if (charmVault) extras.push(`charmVault=${charmVault}`)
        if (isNestedAjna) {
          if (effectiveAjnaPool) extras.push(`ajnaPool=${effectiveAjnaPool}`)
          if (nestedAjnaCollateral) extras.push(`collateral=${nestedAjnaCollateral}`)
          if (nestedAjnaInnerVault) extras.push(`innerVault=${nestedAjnaInnerVault}`)
          if (nestedAjnaAuth) extras.push(`auth=${nestedAjnaAuth}`)
          if (nestedAjnaAdmin) extras.push(`authAdmin=${nestedAjnaAdmin}`)
          if (nestedAjnaBufferRatio !== null && nestedAjnaBufferRatio !== undefined) extras.push(`bufferRatio=${nestedAjnaBufferRatio.toString()}`)
          if (nestedAjnaMinBucket !== null && nestedAjnaMinBucket !== undefined) extras.push(`minBucket=${nestedAjnaMinBucket.toString()}`)
          if (typeof nestedAjnaPaused === 'boolean') extras.push(`paused=${String(nestedAjnaPaused)}`)
        }
        if (bridgeAdapter) extras.push(`bridgeAdapter=${bridgeAdapter}`)
        if (solanaDestination) extras.push(`solanaDestination=${solanaDestination}`)
        if (stratOwner) extras.push(`owner=${stratOwner}`)

        strategyChecks.push({
          id: `strategy-${i}`,
          label: flavor,
          status,
          details: extras.join(' · '),
          href: basescanAddressHref(s),
        })

        // Capture nested Ajna adapter context for pricing + fix actions.
        if (!ajnaAdapterAddress && isNestedAjna) {
          ajnaAdapterAddress = s
          ajnaAdapterOwner = stratOwner
          ajnaInnerVaultAddress = nestedAjnaInnerVault
          ajnaAuthAddress = nestedAjnaAuth
          ajnaAuthAdmin = nestedAjnaAdmin
          ajnaBufferRatioBps = nestedAjnaBufferRatio
          ajnaMinBucketIndex = nestedAjnaMinBucket
          ajnaPaused = nestedAjnaPaused
          ajnaCollateralToken = nestedAjnaCollateral ?? null
        }
        if (!solanaStrategyAddress && hasSolanaRoute) {
          solanaStrategyAddress = s
          solanaStrategyOwner = stratOwner
          solanaBridgeAdapterAddress = bridgeAdapter ?? null
          solanaBridgeDestination = solanaDestination ?? null
        }
      }
    }

    // Pricing checks (Uniswap V3 CREATOR/USDC) + Ajna bucket suggestion
    const pricingChecks: Check[] = []
    const usdc = BASE_USDC as `0x${string}`
    const v3Factory = BASE_UNISWAP_V3_FACTORY as `0x${string}`
    const v3FeeTier = 3000

    let v3PoolAddress: `0x${string}` | null = null
    let v3SpotTick: number | null = null
    let v3TwapTick: number | null = null
    let v3ObservationCardinality: number | null = null
    let v3ObservationCardinalityNext: number | null = null
    let v3SpotUsdPerCreator: number | null = null
    let v3TwapUsdPerCreator: number | null = null
    let suggestedAjnaBucket: number | null = null
    let oracleOwner: `0x${string}` | null = null
    let oracleV3PoolConfigured: boolean | null = null
    let oracleV3Pool: `0x${string}` | null = null

    try {
      const poolRes = await safeMulticall(client, [
        { address: v3Factory, abi: UNISWAP_V3_FACTORY_ABI, functionName: 'getPool', args: [creatorToken, usdc, v3FeeTier] },
      ])
      if (any429(poolRes)) {
        pricingChecks.push({ id: 'v3-rate', label: 'Uniswap V3 pricing', status: 'warn', details: 'Rate limited while reading V3 pool. Try again.' })
      } else {
        v3PoolAddress = pickResult<`0x${string}`>(poolRes[0])
      }
    } catch {
      // ignore
    }

    if (!addrOk(v3PoolAddress)) {
      pricingChecks.push({
        id: 'v3-pool',
        label: 'Uniswap V3 CREATOR/USDC pool (0.3%)',
        status: 'warn',
        details: 'No pool found yet. It may not have been created, or it’s using a different fee tier.',
      })
    } else {
      pricingChecks.push({
        id: 'v3-pool',
        label: 'Uniswap V3 CREATOR/USDC pool (0.3%)',
        status: 'pass',
        details: v3PoolAddress,
        href: basescanAddressHref(v3PoolAddress),
      })

      const poolMeta = await safeMulticall(client, [
        { address: v3PoolAddress, abi: UNISWAP_V3_POOL_ABI, functionName: 'token0' },
        { address: v3PoolAddress, abi: UNISWAP_V3_POOL_ABI, functionName: 'token1' },
        { address: v3PoolAddress, abi: UNISWAP_V3_POOL_ABI, functionName: 'slot0' },
        { address: creatorToken, abi: erc20Abi, functionName: 'decimals' },
        { address: usdc, abi: erc20Abi, functionName: 'decimals' },
        { address: v3PoolAddress, abi: UNISWAP_V3_POOL_ABI, functionName: 'observe', args: [[1800, 0]] },
        { address: v3PoolAddress, abi: UNISWAP_V3_POOL_ABI, functionName: 'observe', args: [[300, 0]] },
      ])
      if (any429(poolMeta)) {
        pricingChecks.push({ id: 'v3-meta-rate', label: 'Uniswap V3 price tick', status: 'warn', details: 'Rate limited while reading V3 price. Try again.' })
      } else {
        const token0 = pickResult<`0x${string}`>(poolMeta[0])
        const token1 = pickResult<`0x${string}`>(poolMeta[1])
        const slot0 = pickResult<any>(poolMeta[2])
        const creatorDec = pickResult<number>(poolMeta[3]) ?? 18
        const usdcDec = pickResult<number>(poolMeta[4]) ?? 6

        if (slot0 && typeof slot0[1] === 'number') v3SpotTick = slot0[1]
        if (slot0 && typeof slot0[1] === 'bigint') v3SpotTick = Number(slot0[1])
        if (slot0 && typeof slot0[3] === 'number') v3ObservationCardinality = slot0[3]
        if (slot0 && typeof slot0[3] === 'bigint') v3ObservationCardinality = Number(slot0[3])
        if (slot0 && typeof slot0[4] === 'number') v3ObservationCardinalityNext = slot0[4]
        if (slot0 && typeof slot0[4] === 'bigint') v3ObservationCardinalityNext = Number(slot0[4])

        const calcMeanTick = (tickCumulatives: readonly (bigint | number)[], duration: number): number | null => {
          if (!Array.isArray(tickCumulatives) || tickCumulatives.length < 2) return null
          const a0 = tickCumulatives[0]
          const a1 = tickCumulatives[1]
          const t0 = typeof a0 === 'bigint' ? a0 : BigInt(a0)
          const t1 = typeof a1 === 'bigint' ? a1 : BigInt(a1)
          const delta = t1 - t0
          const dur = BigInt(duration)
          if (dur <= 0n) return null
          let mean = delta / dur
          if (delta < 0n && delta % dur !== 0n) mean -= 1n
          return Number(mean)
        }

        const tryObserve = (res: any, duration: number): number | null => {
          const obs = pickResult<any>(res)
          const ticks = obs?.[0] as readonly (bigint | number)[] | undefined
          return ticks ? calcMeanTick(ticks, duration) : null
        }

        // Prefer a 30m TWAP; fall back to 5m if the pool is too new.
        v3TwapTick = tryObserve(poolMeta[5], 1800) ?? tryObserve(poolMeta[6], 300)

        const isCreatorToken0 = token0?.toLowerCase?.() === creatorToken.toLowerCase()
        const isCreatorToken1 = token1?.toLowerCase?.() === creatorToken.toLowerCase()
        const tickForPrice = v3TwapTick ?? v3SpotTick

        if (typeof tickForPrice === 'number' && (isCreatorToken0 || isCreatorToken1)) {
          // priceToken1PerToken0Human depends on decimals order; use creator/usdc decimals.
          const priceToken1PerToken0Human = approxToken1PerToken0(tickForPrice, isCreatorToken0 ? creatorDec : usdcDec, isCreatorToken0 ? usdcDec : creatorDec)
          const usdPerCreator = isCreatorToken0 ? priceToken1PerToken0Human : priceToken1PerToken0Human > 0 ? 1 / priceToken1PerToken0Human : 0
          const usdSpot = typeof v3SpotTick === 'number'
            ? (() => {
                const p = approxToken1PerToken0(v3SpotTick, isCreatorToken0 ? creatorDec : usdcDec, isCreatorToken0 ? usdcDec : creatorDec)
                return isCreatorToken0 ? p : p > 0 ? 1 / p : 0
              })()
            : null
          const usdTwap = typeof v3TwapTick === 'number'
            ? (() => {
                const p = approxToken1PerToken0(v3TwapTick, isCreatorToken0 ? creatorDec : usdcDec, isCreatorToken0 ? usdcDec : creatorDec)
                return isCreatorToken0 ? p : p > 0 ? 1 / p : 0
              })()
            : null

          v3SpotUsdPerCreator = usdSpot
          v3TwapUsdPerCreator = usdTwap

          const fmt = (n: number) =>
            n <= 0 ? '—' : n >= 1 ? `$${n.toFixed(4)}` : `$${n.toPrecision(3)}`

          pricingChecks.push({
            id: 'v3-price',
            label: 'CREATOR price (Uniswap V3)',
            status: 'info',
            details: `spot≈${usdSpot !== null && usdSpot !== undefined ? fmt(usdSpot) : '—'} · twap≈${
              usdTwap !== null && usdTwap !== undefined ? fmt(usdTwap) : '—'
            }`,
          })

          if (v3ObservationCardinalityNext !== null && v3ObservationCardinalityNext !== undefined) {
            const ok = v3ObservationCardinalityNext >= 16
            pricingChecks.push({
              id: 'v3-oracle-capacity',
              label: 'Uniswap V3 oracle capacity',
              status: ok ? 'pass' : 'warn',
              details: `observations=${String(v3ObservationCardinality ?? '—')} · next=${String(v3ObservationCardinalityNext)}`,
            })
            if (!ok) {
              pricingChecks.push({
                id: 'v3-oracle-tip',
                label: 'TWAP readiness',
                status: 'warn',
                details: 'This pool may not be able to serve reliable TWAP yet. Recommended: increase observation cardinality (e.g. to 64).',
              })
            }
          }

          const bucketFromTick = deriveAjnaBucketFromV3Tick({
            twapTick: tickForPrice,
            creatorToken,
            usdToken: usdc,
            creatorDecimals: creatorDec,
            usdDecimals: usdcDec,
            targetLtvBps: AJNA_BUCKET_TARGET_LTV_BPS,
          })
          suggestedAjnaBucket = bucketFromTick?.bucket ?? null
          pricingChecks.push({
            id: 'ajna-bucket-suggested',
            label: 'Suggested Ajna bucket (from V3 tick)',
            status: suggestedAjnaBucket == null ? 'warn' : 'info',
            details:
              suggestedAjnaBucket == null
                ? 'Could not derive bucket (check token ordering/decimals).'
                : `bucket=${suggestedAjnaBucket} (tick=${bucketFromTick?.adjustedTick}) · quote=CREATOR · collateral=USDC · ltv=${(AJNA_BUCKET_TARGET_LTV_BPS / 100).toFixed(2)}%`,
          })
        } else {
          pricingChecks.push({
            id: 'v3-price',
            label: 'CREATOR price (Uniswap V3)',
            status: 'warn',
            details: 'Could not derive price tick (pool may be too new or unreadable).',
          })
        }
      }
    }

    // Oracle V3 configuration (optional, but needed for onchain TWAP helpers)
    if (addrOk(oracleAddress)) {
      const oracleRes = await safeMulticall(client, [
        { address: oracleAddress, abi: OWNABLE_VIEW_ABI, functionName: 'owner' },
        { address: oracleAddress, abi: ORACLE_V3_VIEW_ABI, functionName: 'v3PoolConfigured' },
        { address: oracleAddress, abi: ORACLE_V3_VIEW_ABI, functionName: 'v3Pool' },
        { address: oracleAddress, abi: ORACLE_V3_VIEW_ABI, functionName: 'v3CreatorToken' },
        { address: oracleAddress, abi: ORACLE_V3_VIEW_ABI, functionName: 'v3UsdToken' },
      ])
      if (!any429(oracleRes)) {
        oracleOwner = pickResult<`0x${string}`>(oracleRes[0])
        oracleV3PoolConfigured = pickResult<boolean>(oracleRes[1])
        oracleV3Pool = pickResult<`0x${string}`>(oracleRes[2])
        const oracleCreator = pickResult<`0x${string}`>(oracleRes[3])
        const oracleUsd = pickResult<`0x${string}`>(oracleRes[4])

        const ok =
          oracleV3PoolConfigured === true &&
          addrOk(v3PoolAddress) &&
          typeof oracleV3Pool === 'string' &&
          oracleV3Pool.toLowerCase() === v3PoolAddress.toLowerCase() &&
          typeof oracleCreator === 'string' &&
          oracleCreator.toLowerCase() === creatorToken.toLowerCase() &&
          typeof oracleUsd === 'string' &&
          oracleUsd.toLowerCase() === usdc.toLowerCase()

        pricingChecks.push({
          id: 'oracle-v3',
          label: 'Oracle configured for V3 CREATOR/USDC TWAP',
          status: ok ? 'pass' : oracleV3PoolConfigured === false ? 'warn' : ok === false ? 'warn' : 'info',
          details: ok
            ? 'oracle.v3PoolConfigured=true'
            : oracleV3PoolConfigured === false
              ? 'Not configured yet. Recommended: set oracle.setV3Pool(pool, creator, usdc, 1800).'
              : `oracle.v3Pool=${String(oracleV3Pool ?? '—')}`,
        })
      }
    }

    const ajnaConfiguredBucket = ajnaMinBucketIndex

    // Compare Ajna bucket/min-bucket to suggested (best-effort)
    const ajnaHrefTarget = ajnaAuthAddress ?? ajnaAdapterAddress
    if (suggestedAjnaBucket !== null && suggestedAjnaBucket !== undefined && addrOk(ajnaHrefTarget)) {
      if (ajnaConfiguredBucket === null || ajnaConfiguredBucket === undefined) {
        pricingChecks.push({
          id: 'ajna-bucket-match',
          label: 'Ajna min bucket configured',
          status: 'warn',
          details: `No min bucket configured yet · suggested=${suggestedAjnaBucket}`,
          href: basescanAddressHref(ajnaHrefTarget),
        })
      } else {
        const ok = ajnaConfiguredBucket === BigInt(suggestedAjnaBucket)
        pricingChecks.push({
          id: 'ajna-bucket-match',
          label: 'Ajna min bucket matches suggestion',
          status: ok ? 'pass' : 'warn',
          details: `current=${ajnaConfiguredBucket.toString()} · suggested=${suggestedAjnaBucket} · ltv=${(AJNA_BUCKET_TARGET_LTV_BPS / 100).toFixed(2)}%${ajnaCollateralToken ? ` · collateral=${ajnaCollateralToken}` : ''}`,
          href: basescanAddressHref(ajnaHrefTarget),
        })
      }
    }

    // Core and wiring sections
    const coreChecks: Check[] = [
      { id: 'vault', label: 'Vault', status: 'pass', details: `${vaultName} (${vaultSymbol})`, href: basescanAddressHref(vaultAddress) },
      { id: 'owner', label: 'Vault owner', status: 'info', details: owner, href: basescanAddressHref(owner) },
      { id: 'creatorToken', label: 'Creator coin', status: 'info', details: `${creatorSymbol} · ${creatorToken}`, href: basescanAddressHref(creatorToken) },
      { id: 'gauge', label: 'Gauge controller', status: addrOk(gaugeAddress) ? 'pass' : 'fail', details: String(gaugeAddress ?? '—'), href: addrOk(gaugeAddress) ? basescanAddressHref(gaugeAddress) : undefined },
      { id: 'shareOFT', label: 'Share token (ShareOFT)', status: addrOk(shareOFTAddress) ? 'pass' : 'fail', details: String(shareOFTAddress ?? '—'), href: addrOk(shareOFTAddress) ? basescanAddressHref(shareOFTAddress) : undefined },
      { id: 'wrapper', label: 'Wrapper', status: addrOk(wrapperAddress) ? 'pass' : 'fail', details: String(wrapperAddress ?? '—'), href: addrOk(wrapperAddress) ? basescanAddressHref(wrapperAddress) : undefined },
      { id: 'oracle', label: 'Oracle', status: addrOk(oracleAddress) ? 'pass' : 'warn', details: String(oracleAddress ?? '—'), href: addrOk(oracleAddress) ? basescanAddressHref(oracleAddress) : undefined },
    ]

    const wiringChecks: Check[] = []
    const same = (a?: string | null, b?: string | null) => (a && b ? a.toLowerCase() === b.toLowerCase() : null)
    const pushBool = (id: string, label: string, ok: boolean | null, details: string) => {
      wiringChecks.push({ id, label, status: ok === null ? 'warn' : ok ? 'pass' : 'fail', details })
    }
    pushBool('gauge-vault', 'Gauge points to vault', same(gaugeVault, vaultAddress), `gauge.vault = ${String(gaugeVault ?? '—')}`)
    pushBool('gauge-coin', 'Gauge points to creator coin', same(gaugeCreatorCoin, creatorToken), `gauge.creatorCoin = ${String(gaugeCreatorCoin ?? '—')}`)
    // Share token wiring is important for fee routing + accurate conversions, but not required for basic deposit/withdraw.
    // For compatibility deployments, these values may be unset; treat as warnings with recommended action instead of hard failures.
    const isZero = (a?: string | null) => !!a && a.toLowerCase() === ZERO
    const shareVaultOk = same(shareVault, vaultAddress)
    if (shareVault == null) {
      wiringChecks.push({
        id: 'share-vault',
        label: 'Share token wired to vault',
        status: 'warn',
        details: 'Could not read shareOFT.vault (may be a compatibility token version).',
      })
    } else if (isZero(shareVault)) {
      wiringChecks.push({
        id: 'share-vault',
        label: 'Share token wired to vault',
        status: 'warn',
        details: 'shareOFT.vault is unset. Recommended: set it to the vault address to enable accurate conversions.',
      })
    } else {
      wiringChecks.push({
        id: 'share-vault',
        label: 'Share token wired to vault',
        status: shareVaultOk ? 'pass' : 'fail',
        details: `shareOFT.vault = ${String(shareVault)}`,
      })
    }

    const shareGaugeOk = same(shareGauge, gaugeAddress)
    if (shareGauge == null) {
      wiringChecks.push({
        id: 'share-gauge',
        label: 'Share token wired to gauge',
        status: 'warn',
        details: 'Could not read shareOFT.gaugeController (may be a compatibility token version).',
      })
    } else if (isZero(shareGauge)) {
      wiringChecks.push({
        id: 'share-gauge',
        label: 'Share token wired to gauge',
        status: 'warn',
        details: 'shareOFT.gaugeController is unset. Recommended: set it to enable fee routing to the gauge.',
      })
    } else {
      wiringChecks.push({
        id: 'share-gauge',
        label: 'Share token wired to gauge',
        status: shareGaugeOk ? 'pass' : 'fail',
        details: `shareOFT.gaugeController = ${String(shareGauge)}`,
      })
    }
    pushBool('wrapper-vault', 'Wrapper points to vault', same(wrapperVault, vaultAddress), `wrapper.vault = ${String(wrapperVault ?? '—')}`)
    pushBool('wrapper-coin', 'Wrapper points to creator coin', same(wrapperCoin, creatorToken), `wrapper.creatorCoin = ${String(wrapperCoin ?? '—')}`)
    pushBool('wrapper-share', 'Wrapper points to share token', same(wrapperShare, shareOFTAddress), `wrapper.shareOFT = ${String(wrapperShare ?? '—')}`)
    wiringChecks.push({
      id: 'share-minter',
      label: 'Wrapper is approved minter on share token',
      status: shareMinterOk == null ? 'warn' : shareMinterOk ? 'pass' : 'fail',
      details: shareMinterOk == null ? 'Could not read isMinter(wrapper)' : shareMinterOk ? 'isMinter(wrapper)=true' : 'isMinter(wrapper)=false',
    })
    wiringChecks.push({
      id: 'vault-whitelist',
      label: 'Wrapper is whitelisted on vault',
      status: !addrOk(wrapperAddress) ? 'info' : wrapperWhitelisted == null ? 'info' : wrapperWhitelisted ? 'pass' : 'fail',
      details:
        !addrOk(wrapperAddress)
          ? 'No wrapper detected; whitelist check not applicable.'
          : wrapperWhitelisted == null
            ? 'Whitelist status is not readable for this vault version. If deposits fail, whitelist the wrapper as the vault owner.'
          : wrapperWhitelisted
            ? 'whitelist=true'
            : 'whitelist=false',
    })

    const sections: CheckSection[] = [
      { id: 'core', title: 'Vault overview', description: 'Identity + core contract addresses.', checks: coreChecks },
      { id: 'wiring', title: 'Wiring checks', description: 'Read-only checks to confirm contracts are connected correctly.', checks: wiringChecks },
      { id: 'pricing', title: 'Market pricing (V3) + Ajna bucket', description: 'Reads the CREATOR/USDC Uniswap V3 pool and suggests an Ajna bucket.', checks: pricingChecks },
      { id: 'strategies', title: 'Yield strategy checks', description: 'Verifies the vault’s configured strategies and basic health signals.', checks: strategyChecks },
    ]

    if (cacheBust) {
      // Manual runs should be "fresh" and not stored at the edge under a unique key.
      res.setHeader('Cache-Control', 'no-store')
    } else {
      setCache(res, 120)
    }
    return res.status(200).json({
      success: true,
      data: {
        chainId: base.id,
        generatedAt: new Date().toISOString(),
        sections,
        context: {
          vault: vaultAddress,
          owner,
          vaultOwner: owner,
          creatorToken,
          vaultName,
          vaultSymbol,
          creatorSymbol,
          gaugeAddress,
          shareOFTAddress,
          shareOftOwner: shareOwner,
          shareVault,
          shareGaugeController: shareGauge,
          shareMinterOk,
          wrapperAddress,
          wrapperOwner,
          wrapperWhitelisted,
          oracleAddress,
          oracleOwner,
          oracleV3PoolConfigured,
          oracleV3Pool,
          v3PoolAddress,
          v3SpotTick: v3SpotTick == null ? null : String(v3SpotTick),
          v3TwapTick: v3TwapTick == null ? null : String(v3TwapTick),
          v3ObservationCardinality: v3ObservationCardinality == null ? null : String(v3ObservationCardinality),
          v3ObservationCardinalityNext: v3ObservationCardinalityNext == null ? null : String(v3ObservationCardinalityNext),
          v3SpotUsdPerCreator: v3SpotUsdPerCreator == null ? null : String(v3SpotUsdPerCreator),
          v3TwapUsdPerCreator: v3TwapUsdPerCreator == null ? null : String(v3TwapUsdPerCreator),
          ajnaAdapterAddress,
          ajnaAdapterOwner,
          ajnaInnerVaultAddress,
          ajnaAuthAddress,
          ajnaAuthAdmin,
          ajnaBufferRatioBps: ajnaBufferRatioBps == null ? null : ajnaBufferRatioBps.toString(),
          ajnaMinBucketIndex: ajnaMinBucketIndex == null ? null : ajnaMinBucketIndex.toString(),
          ajnaPaused,
          ajnaSuggestedBucketIndex: suggestedAjnaBucket == null ? null : String(suggestedAjnaBucket),
          solanaStrategyAddress,
          solanaStrategyOwner,
          solanaBridgeAdapterAddress,
          solanaBridgeDestination,
          creatorTreasury,
          protocolTreasury,
          shareName,
          shareSymbol,
        },
      },
    })
  } catch (e: any) {
    const msg = errorToMessage(e)
    const status = isRateLimitError(msg) ? 429 : 500
    return res.status(status).json({ success: false, error: msg || 'Failed to build vault report' })
  }
}
