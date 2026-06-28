import { createPublicClient, getAddress, http, isAddress, type Address, type PublicClient } from 'viem'
import { base } from 'viem/chains'

import { AKITA_DEFAULTS } from '../../../src/config/contracts.defaults.js'
import { getApiContracts } from './contracts.js'

const DEFAULT_BASE_RPC_URL = 'https://mainnet.base.org'

const CREATOR_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'getTokenForVault',
    stateMutability: 'view',
    inputs: [{ name: 'vault', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'getVaultForToken',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'getShareOFTForToken',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
] as const

const CREATOR_OVAULT_VIEW_ABI = [
  {
    type: 'function',
    name: 'asset',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const CREATOR_OVAULT_STRATEGY_VIEW_ABI = [
  {
    type: 'function',
    name: 'strategyList',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'strategyWeights',
    stateMutability: 'view',
    inputs: [{ name: 'strategy', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const CREATOR_CHARM_STRATEGY_VIEW_ABI = [
  {
    type: 'function',
    name: 'charmVault',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const ERC4626_STRATEGY_ADAPTER_VIEW_ABI = [
  {
    type: 'function',
    name: 'ERC4626_VAULT',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const AJNA_INNER_VAULT_VIEW_ABI = [
  {
    type: 'function',
    name: 'AJNA_POOL',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'AUTH',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const AJNA_AUTH_VIEW_ABI = [
  {
    type: 'function',
    name: 'bufferRatio',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'minBucketIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

const AJNA_POOL_VIEW_ABI = [
  {
    type: 'function',
    name: 'ajnaPool',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const SOLANA_STRATEGY_VIEW_ABI = [
  {
    type: 'function',
    name: 'bridgeAddress',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

export type VaultStrategyScan = {
  strategy: Address
  weight: bigint
  charmVault: Address | null
  ajna: {
    ajnaPool: Address | null
    innerVault: Address | null
    auth: Address | null
    bufferRatioBps: number | null
    minBucketIndex: number | null
  }
  bridgeAddress: Address | null
}

export type VaultOnChainArtifacts = Record<string, unknown>

function normalizeAddress(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!isAddress(raw)) return null
  return getAddress(raw)
}

function isZeroAddress(value: Address | null): boolean {
  return !value || value.toLowerCase() === '0x0000000000000000000000000000000000000000'
}

function getBaseRpcUrls(): string[] {
  const urls = new Set<string>()
  for (const envKey of ['BASE_RPC_URL', 'VITE_BASE_RPC_URL']) {
    const raw = String(process.env[envKey] ?? '').trim()
    if (!raw) continue
    for (const part of raw.split(/[,\s]+/)) {
      const candidate = part.trim()
      if (candidate) urls.add(candidate)
    }
  }
  urls.add(DEFAULT_BASE_RPC_URL)
  return [...urls]
}

export function createVaultStrategyPublicClient(rpcUrl?: string): PublicClient {
  const url = rpcUrl?.trim() || getBaseRpcUrls()[0]
  return createPublicClient({
    chain: base,
    transport: http(url, { timeout: 20_000 }),
  }) as unknown as PublicClient
}

async function readContractSafe<T>(params: {
  client: PublicClient
  address: Address
  abi: readonly unknown[]
  functionName: string
  args?: readonly unknown[]
}): Promise<T | null> {
  try {
    return (await params.client.readContract({
      address: params.address,
      abi: params.abi as never,
      functionName: params.functionName as never,
      ...(params.args ? { args: params.args as never } : null),
    })) as T
  } catch {
    return null
  }
}

export async function readCreatorTokenForVault(params: {
  client: PublicClient
  vault: Address
}): Promise<Address | null> {
  const registry = normalizeAddress(getApiContracts().registry)
  if (registry) {
    const fromRegistry = normalizeAddress(
      await readContractSafe<Address>({
        client: params.client,
        address: registry,
        abi: CREATOR_REGISTRY_ABI,
        functionName: 'getTokenForVault',
        args: [params.vault],
      }),
    )
    if (!isZeroAddress(fromRegistry)) return fromRegistry
  }

  const asset = normalizeAddress(
    await readContractSafe<Address>({
      client: params.client,
      address: params.vault,
      abi: CREATOR_OVAULT_VIEW_ABI,
      functionName: 'asset',
    }),
  )
  return isZeroAddress(asset) ? null : asset
}

export async function readShareOftForCreatorToken(params: {
  client: PublicClient
  creatorToken: Address
}): Promise<Address | null> {
  const registry = normalizeAddress(getApiContracts().registry)
  if (!registry) return null
  const share = normalizeAddress(
    await readContractSafe<Address>({
      client: params.client,
      address: registry,
      abi: CREATOR_REGISTRY_ABI,
      functionName: 'getShareOFTForToken',
      args: [params.creatorToken],
    }),
  )
  return isZeroAddress(share) ? null : share
}

export async function readVaultOwner(params: {
  client: PublicClient
  vault: Address
}): Promise<Address | null> {
  const owner = normalizeAddress(
    await readContractSafe<Address>({
      client: params.client,
      address: params.vault,
      abi: CREATOR_OVAULT_VIEW_ABI,
      functionName: 'owner',
    }),
  )
  return isZeroAddress(owner) ? null : owner
}

export async function readVaultActiveStrategies(params: {
  client: PublicClient
  vault: Address
  maxScan?: number
}): Promise<Array<{ strategy: Address; weight: bigint }>> {
  const out: Array<{ strategy: Address; weight: bigint }> = []
  const seen = new Set<string>()
  const maxScan = Number.isFinite(params.maxScan) ? Math.max(1, Number(params.maxScan)) : 8

  for (let i = 0; i < maxScan; i++) {
    const strategy = normalizeAddress(
      await readContractSafe<Address>({
        client: params.client,
        address: params.vault,
        abi: CREATOR_OVAULT_STRATEGY_VIEW_ABI,
        functionName: 'strategyList',
        args: [BigInt(i)],
      }),
    )
    if (!strategy) break
    const key = strategy.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const weightRaw = await readContractSafe<bigint>({
      client: params.client,
      address: params.vault,
      abi: CREATOR_OVAULT_STRATEGY_VIEW_ABI,
      functionName: 'strategyWeights',
      args: [strategy],
    })
    const weight = typeof weightRaw === 'bigint' ? weightRaw : 0n
    if (weight > 0n) out.push({ strategy, weight })
  }

  return out
}

async function readCharmVaultAddress(params: {
  client: PublicClient
  strategy: Address
}): Promise<Address | null> {
  const charmVault = normalizeAddress(
    await readContractSafe<Address>({
      client: params.client,
      address: params.strategy,
      abi: CREATOR_CHARM_STRATEGY_VIEW_ABI,
      functionName: 'charmVault',
    }),
  )
  return isZeroAddress(charmVault) ? null : charmVault
}

async function readDirectAjnaPool(params: {
  client: PublicClient
  strategy: Address
}): Promise<Address | null> {
  const ajnaPool = normalizeAddress(
    await readContractSafe<Address>({
      client: params.client,
      address: params.strategy,
      abi: AJNA_POOL_VIEW_ABI,
      functionName: 'ajnaPool',
    }),
  )
  return isZeroAddress(ajnaPool) ? null : ajnaPool
}

async function readNestedAjnaDetails(params: {
  client: PublicClient
  strategy: Address
}): Promise<VaultStrategyScan['ajna']> {
  const directAjnaPool = await readDirectAjnaPool(params)
  if (directAjnaPool) {
    return {
      ajnaPool: directAjnaPool,
      innerVault: params.strategy,
      auth: null,
      bufferRatioBps: null,
      minBucketIndex: null,
    }
  }

  const innerVault = normalizeAddress(
    await readContractSafe<Address>({
      client: params.client,
      address: params.strategy,
      abi: ERC4626_STRATEGY_ADAPTER_VIEW_ABI,
      functionName: 'ERC4626_VAULT',
    }),
  )
  if (!innerVault) {
    return { ajnaPool: null, innerVault: null, auth: null, bufferRatioBps: null, minBucketIndex: null }
  }

  const [ajnaPool, auth] = await Promise.all([
    readContractSafe<Address>({
      client: params.client,
      address: innerVault,
      abi: AJNA_INNER_VAULT_VIEW_ABI,
      functionName: 'AJNA_POOL',
    }),
    readContractSafe<Address>({
      client: params.client,
      address: innerVault,
      abi: AJNA_INNER_VAULT_VIEW_ABI,
      functionName: 'AUTH',
    }),
  ])

  const ajnaAuth = normalizeAddress(auth)
  let bufferRatioBps: number | null = null
  let minBucketIndex: number | null = null
  if (ajnaAuth) {
    const [bufferRatioRaw, minBucketRaw] = await Promise.all([
      readContractSafe<bigint>({
        client: params.client,
        address: ajnaAuth,
        abi: AJNA_AUTH_VIEW_ABI,
        functionName: 'bufferRatio',
      }),
      readContractSafe<bigint>({
        client: params.client,
        address: ajnaAuth,
        abi: AJNA_AUTH_VIEW_ABI,
        functionName: 'minBucketIndex',
      }),
    ])
    if (typeof bufferRatioRaw === 'bigint') bufferRatioBps = Number(bufferRatioRaw)
    if (typeof minBucketRaw === 'bigint') minBucketIndex = Number(minBucketRaw)
  }

  return {
    ajnaPool: normalizeAddress(ajnaPool),
    innerVault,
    auth: ajnaAuth,
    bufferRatioBps,
    minBucketIndex,
  }
}

async function readSolanaBridgeAddress(params: {
  client: PublicClient
  strategy: Address
}): Promise<Address | null> {
  const bridgeAddress = normalizeAddress(
    await readContractSafe<Address>({
      client: params.client,
      address: params.strategy,
      abi: SOLANA_STRATEGY_VIEW_ABI,
      functionName: 'bridgeAddress',
    }),
  )
  return isZeroAddress(bridgeAddress) ? null : bridgeAddress
}

export async function scanVaultStrategyDetails(params: {
  client: PublicClient
  vault: Address
  maxScan?: number
}): Promise<VaultStrategyScan[]> {
  const strategies = await readVaultActiveStrategies(params)
  return Promise.all(
    strategies.map(async (entry) => ({
      ...entry,
      charmVault: await readCharmVaultAddress({ client: params.client, strategy: entry.strategy }),
      ajna: await readNestedAjnaDetails({ client: params.client, strategy: entry.strategy }),
      bridgeAddress: await readSolanaBridgeAddress({ client: params.client, strategy: entry.strategy }),
    })),
  )
}

export function applyKnownVaultDefaults(vault: Address, artifacts: VaultOnChainArtifacts): VaultOnChainArtifacts {
  if (vault.toLowerCase() !== AKITA_DEFAULTS.vault.toLowerCase()) return artifacts
  const next = { ...artifacts }
  if (!next.creatorToken && !next.creatorCoin && !next.creatorCoinAddress) {
    next.creatorToken = AKITA_DEFAULTS.token
  }
  if (!next.shareOFT && !next.shareToken) {
    next.shareOFT = AKITA_DEFAULTS.shareOFT
  }
  if (!next.oracle) {
    next.oracle = AKITA_DEFAULTS.oracle
  }
  if (!next.ccaStrategy) {
    next.ccaStrategy = AKITA_DEFAULTS.ccaStrategy
  }
  return next
}

function assignIfMissing(target: VaultOnChainArtifacts, key: string, value: unknown): void {
  if (value == null) return
  const existing = target[key]
  if (typeof existing === 'string' && existing.trim()) return
  target[key] = value
}

export async function enrichVaultArtifactsFromOnChain(params: {
  vaultAddress: `0x${string}`
  chainId?: number
  artifacts?: VaultOnChainArtifacts
  client?: PublicClient
}): Promise<{ artifacts: VaultOnChainArtifacts; warnings: string[] }> {
  const warnings: string[] = []
  const vault = getAddress(params.vaultAddress)
  let artifacts: VaultOnChainArtifacts = { ...(params.artifacts ?? {}) }

  if (Number(params.chainId ?? 8453) !== 8453) {
    warnings.push('onchain_enrichment_skipped_non_base_chain')
    return { artifacts: applyKnownVaultDefaults(vault, artifacts), warnings }
  }

  const client = params.client ?? createVaultStrategyPublicClient()
  try {
    const [creatorToken, owner, strategyDetails] = await Promise.all([
      readCreatorTokenForVault({ client, vault }),
      readVaultOwner({ client, vault }),
      scanVaultStrategyDetails({ client, vault }),
    ])

    if (creatorToken) {
      assignIfMissing(artifacts, 'creatorToken', creatorToken)
      assignIfMissing(artifacts, 'creatorCoin', creatorToken)
      assignIfMissing(artifacts, 'creatorCoinAddress', creatorToken)

      const shareOft = await readShareOftForCreatorToken({ client, creatorToken })
      if (shareOft) {
        assignIfMissing(artifacts, 'shareOFT', shareOft)
        assignIfMissing(artifacts, 'shareToken', shareOft)
      }
    } else {
      warnings.push('creator_token_unresolved_onchain')
    }

    if (owner) {
      assignIfMissing(artifacts, 'owner', owner)
      assignIfMissing(artifacts, 'creatorAddress', owner)
    }

    const charm = strategyDetails.find((entry: VaultStrategyScan) => Boolean(entry.charmVault))
    const ajna = pickAjnaRegistryCandidate(strategyDetails)
    const solana = strategyDetails.find((entry: VaultStrategyScan) => Boolean(entry.bridgeAddress))

    if (charm?.charmVault) {
      assignIfMissing(artifacts, 'charmVault', charm.charmVault)
      assignIfMissing(artifacts, 'charmStrategy', charm.strategy)
    }
    if (ajna) {
      assignIfMissing(artifacts, 'strategyAdapter', ajna.strategy)
      assignIfMissing(artifacts, 'ajnaAdapter', ajna.strategy)
      if (ajna.ajna.innerVault) assignIfMissing(artifacts, 'ajnaInnerVault', ajna.ajna.innerVault)
      if (ajna.ajna.auth) assignIfMissing(artifacts, 'ajnaAuth', ajna.ajna.auth)
      if (ajna.ajna.ajnaPool) assignIfMissing(artifacts, 'ajnaPool', ajna.ajna.ajnaPool)
    } else {
      const directAjna = strategyDetails.find((entry: VaultStrategyScan) => Boolean(entry.ajna.ajnaPool))
      if (directAjna?.ajna.ajnaPool) {
        assignIfMissing(artifacts, 'strategyAdapter', directAjna.strategy)
        assignIfMissing(artifacts, 'ajnaAdapter', directAjna.strategy)
        assignIfMissing(artifacts, 'ajnaInnerVault', directAjna.strategy)
        assignIfMissing(artifacts, 'ajnaPool', directAjna.ajna.ajnaPool)
      }
    }
    if (solana?.bridgeAddress) {
      assignIfMissing(artifacts, 'solanaBridgeAdapter', solana.bridgeAddress)
      assignIfMissing(artifacts, 'solanaStrategy', solana.strategy)
    }
  } catch (error) {
    warnings.push(`onchain_enrichment_failed:${error instanceof Error ? error.message : String(error)}`)
  }

  artifacts = applyKnownVaultDefaults(vault, artifacts)
  return { artifacts, warnings }
}

export function pickAjnaRegistryCandidate(strategyDetails: VaultStrategyScan[]): VaultStrategyScan | null {
  return (
    strategyDetails.find((entry) => entry.ajna.innerVault && entry.ajna.auth && entry.ajna.ajnaPool) ??
    strategyDetails.find((entry) => entry.ajna.innerVault && entry.ajna.auth && !entry.bridgeAddress) ??
    strategyDetails.find((entry) => Boolean(entry.ajna.ajnaPool)) ??
    null
  )
}
