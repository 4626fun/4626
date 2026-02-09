import type { Address, Chain, PublicClient, Transport } from 'viem'
import { getAddress, isAddress, parseAbiItem } from 'viem'

import { CONTRACTS } from '@/config/contracts'

const addrHex = (hexWithout0x: string) => `0x${hexWithout0x}` as Address
const ZERO_ADDRESS = addrHex('0000000000000000000000000000000000000000')

const CREATOR_REGISTRY_RESOLVE_ABI = [
  { type: 'function', name: 'vaultToToken', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'wrapperToToken', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'shareOFTToToken', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'oracleToToken', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'gaugeControllerToToken', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'canonicalWalletToToken', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'getTokenForRemoteOFT', stateMutability: 'view', inputs: [{ name: '_remoteOFT', type: 'address' }], outputs: [{ type: 'address' }] },
] as const

const CREATOR_REGISTRY_COIN_ABI = [
  {
    type: 'function',
    name: 'getCreatorCoin',
    stateMutability: 'view',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [
      {
        name: 'info',
        type: 'tuple',
        components: [
          { name: 'token', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'vault', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'gaugeController', type: 'address' },
          { name: 'creator', type: 'address' },
          { name: 'canonicalWallet', type: 'address' },
          { name: 'pool', type: 'address' },
          { name: 'poolFee', type: 'uint24' },
          { name: 'primaryChainId', type: 'uint16' },
          { name: 'isActive', type: 'bool' },
          { name: 'registeredAt', type: 'uint256' },
        ],
      },
    ],
  },
] as const

const ERC20_METADATA_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const

const TOKEN_HINT_ABI = [
  { type: 'function', name: 'asset', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'creatorToken', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'baseToken', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const CREATOR_VAULT_PHASE1_DEPLOYED_EVENT = parseAbiItem(
  'event Phase1Deployed(address indexed creatorToken, address indexed owner, address oftBootstrapRegistry, address vault, address wrapper, address shareOFT)',
)

const CREATOR_VAULT_PHASE2_DEPLOYED_AND_LAUNCHED_EVENT = parseAbiItem(
  'event Phase2DeployedAndLaunched(address indexed creatorToken, address indexed owner, address gaugeController, address ccaStrategy, address oracle, address auction)',
)

const CREATOR_VAULT_PHASE2_CORE_DEPLOYED_EVENT = parseAbiItem(
  'event Phase2CoreDeployed(address indexed creatorToken, address indexed owner, address gaugeController, address ccaStrategy, address oracle)',
)

const CREATOR_FACTORY_VIEW_ABI = [
  {
    type: 'function',
    name: 'deployments',
    stateMutability: 'view',
    inputs: [{ name: '_creatorCoin', type: 'address' }],
    outputs: [
      { name: 'creatorCoin', type: 'address' },
      { name: 'vault', type: 'address' },
      { name: 'wrapper', type: 'address' },
      { name: 'shareOFT', type: 'address' },
      { name: 'gaugeController', type: 'address' },
      { name: 'ccaStrategy', type: 'address' },
      { name: 'oracle', type: 'address' },
      { name: 'creator', type: 'address' },
      { name: 'deployedAt', type: 'uint256' },
      { name: 'exists', type: 'bool' },
    ],
  },
] as const

export type CreatorCoinInfo = {
  token: Address
  name: string
  symbol: string
  vault: Address | null
  shareOFT: Address | null
  wrapper: Address | null
  oracle: Address | null
  gaugeController: Address | null
  creator: Address | null
  isActive: boolean
  registeredAt: bigint | null
}

export type CreatorVaultResolved = {
  token: Address
  info: CreatorCoinInfo
  ccaStrategy: Address | null
}

function asAddress(value: unknown): Address | null {
  if (!isAddress(value as any)) return null
  const checksummed = getAddress(value as Address)
  if (checksummed === ZERO_ADDRESS) return null
  return checksummed
}

function eqAddress(a: Address | null | undefined, b: Address | null | undefined): boolean {
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}

export async function resolveCreatorTokenFromAnyAddress<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(
  publicClient: PublicClient<TTransport, TChain>,
  addr: Address,
): Promise<Address | null> {
  const registry = CONTRACTS.registry as Address

  const results = await publicClient.multicall({
    contracts: [
      { address: registry, abi: CREATOR_REGISTRY_RESOLVE_ABI, functionName: 'vaultToToken', args: [addr] },
      { address: registry, abi: CREATOR_REGISTRY_RESOLVE_ABI, functionName: 'wrapperToToken', args: [addr] },
      { address: registry, abi: CREATOR_REGISTRY_RESOLVE_ABI, functionName: 'shareOFTToToken', args: [addr] },
      { address: registry, abi: CREATOR_REGISTRY_RESOLVE_ABI, functionName: 'oracleToToken', args: [addr] },
      { address: registry, abi: CREATOR_REGISTRY_RESOLVE_ABI, functionName: 'gaugeControllerToToken', args: [addr] },
      { address: registry, abi: CREATOR_REGISTRY_RESOLVE_ABI, functionName: 'canonicalWalletToToken', args: [addr] },
      { address: registry, abi: CREATOR_REGISTRY_RESOLVE_ABI, functionName: 'getTokenForRemoteOFT', args: [addr] },
    ],
    allowFailure: true,
  })

  for (const res of results) {
    if (res?.status !== 'success') continue
    const token = asAddress(res.result)
    if (token) return token
  }

  return null
}

export async function fetchCreatorCoinInfo<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(publicClient: PublicClient<TTransport, TChain>, token: Address): Promise<CreatorCoinInfo | null> {
  const registry = CONTRACTS.registry as Address
  let infoRaw: unknown = null
  try {
    infoRaw = await publicClient.readContract({
      address: registry,
      abi: CREATOR_REGISTRY_COIN_ABI,
      functionName: 'getCreatorCoin',
      args: [token],
    })
  } catch {
    return null
  }

  const info = infoRaw as any
  const tokenFromRegistry = asAddress(info?.token)
  if (!eqAddress(tokenFromRegistry, token)) return null
  const out: CreatorCoinInfo = {
    token,
    name: typeof info?.name === 'string' ? info.name : '',
    symbol: typeof info?.symbol === 'string' ? info.symbol : '',
    vault: asAddress(info?.vault),
    shareOFT: asAddress(info?.shareOFT),
    wrapper: asAddress(info?.wrapper),
    oracle: asAddress(info?.oracle),
    gaugeController: asAddress(info?.gaugeController),
    creator: asAddress(info?.creator),
    isActive: Boolean(info?.isActive),
    registeredAt: typeof info?.registeredAt === 'bigint' ? (info.registeredAt as bigint) : null,
  }

  return out
}

export async function fetchCcaStrategyForToken<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(publicClient: PublicClient<TTransport, TChain>, token: Address): Promise<Address | null> {
  const factory = CONTRACTS.factory as Address
  const deploymentRaw = await publicClient.readContract({
    address: factory,
    abi: CREATOR_FACTORY_VIEW_ABI,
    functionName: 'deployments',
    args: [token],
  })
  const deployment = deploymentRaw as any
  if (!deployment || deployment?.exists === false) return null
  return asAddress(deployment?.ccaStrategy)
}

async function readTokenMetadataForFallback<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(
  publicClient: PublicClient<TTransport, TChain>,
  token: Address,
): Promise<{ name: string; symbol: string }> {
  const results = await publicClient.multicall({
    contracts: [
      { address: token, abi: ERC20_METADATA_ABI, functionName: 'name' },
      { address: token, abi: ERC20_METADATA_ABI, functionName: 'symbol' },
    ],
    allowFailure: true,
  })
  const name = results[0]?.status === 'success' && typeof results[0].result === 'string' ? results[0].result : ''
  const symbol = results[1]?.status === 'success' && typeof results[1].result === 'string' ? results[1].result : ''
  return { name, symbol }
}

async function readTokenHintsFromAddress<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(
  publicClient: PublicClient<TTransport, TChain>,
  addr: Address,
): Promise<Address[]> {
  const hints = new Set<string>([addr.toLowerCase()])
  const results = await publicClient.multicall({
    contracts: [
      { address: addr, abi: TOKEN_HINT_ABI, functionName: 'asset' },
      { address: addr, abi: TOKEN_HINT_ABI, functionName: 'creatorToken' },
      { address: addr, abi: TOKEN_HINT_ABI, functionName: 'token' },
      { address: addr, abi: TOKEN_HINT_ABI, functionName: 'baseToken' },
    ],
    allowFailure: true,
  })

  for (const result of results) {
    if (result?.status !== 'success') continue
    const tokenHint = asAddress(result.result)
    if (tokenHint) hints.add(tokenHint.toLowerCase())
  }

  return Array.from(hints).map((x) => getAddress(x as Address))
}

async function resolveCreatorVaultFromBatcherEvents<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(
  publicClient: PublicClient<TTransport, TChain>,
  addr: Address,
): Promise<CreatorVaultResolved | null> {
  const batcher = asAddress(CONTRACTS.creatorVaultBatcher)
  if (!batcher) return null

  const tokenHints = await readTokenHintsFromAddress(publicClient, addr)
  for (const token of tokenHints) {
    let phase1Logs: any[] = []
    try {
      phase1Logs = await publicClient.getLogs({
        address: batcher,
        event: CREATOR_VAULT_PHASE1_DEPLOYED_EVENT,
        args: { creatorToken: token },
        fromBlock: 0n,
        toBlock: 'latest',
      })
    } catch {
      phase1Logs = []
    }
    if (phase1Logs.length === 0) continue

    const matchingPhase1Logs = phase1Logs.filter((log) => {
      const vault = asAddress(log?.args?.vault)
      const wrapper = asAddress(log?.args?.wrapper)
      const shareOFT = asAddress(log?.args?.shareOFT)
      return eqAddress(vault, addr) || eqAddress(wrapper, addr) || eqAddress(shareOFT, addr) || eqAddress(token, addr)
    })

    const selectedPhase1Logs = matchingPhase1Logs.length > 0 ? matchingPhase1Logs : phase1Logs
    const phase1 = selectedPhase1Logs[selectedPhase1Logs.length - 1]
    const owner = asAddress(phase1?.args?.owner)
    const vault = asAddress(phase1?.args?.vault)
    const wrapper = asAddress(phase1?.args?.wrapper)
    const shareOFT = asAddress(phase1?.args?.shareOFT)

    const phaseArgs = owner ? ({ creatorToken: token, owner } as const) : ({ creatorToken: token } as const)
    const [phase2CoreLogs, phase2LaunchLogs] = await Promise.all([
      publicClient
        .getLogs({
          address: batcher,
          event: CREATOR_VAULT_PHASE2_CORE_DEPLOYED_EVENT,
          args: phaseArgs as any,
          fromBlock: 0n,
          toBlock: 'latest',
        })
        .catch(() => [] as any[]),
      publicClient
        .getLogs({
          address: batcher,
          event: CREATOR_VAULT_PHASE2_DEPLOYED_AND_LAUNCHED_EVENT,
          args: phaseArgs as any,
          fromBlock: 0n,
          toBlock: 'latest',
        })
        .catch(() => [] as any[]),
    ])

    const phase2Core = phase2CoreLogs[phase2CoreLogs.length - 1]
    const phase2Launch = phase2LaunchLogs[phase2LaunchLogs.length - 1]
    const gaugeController = asAddress(phase2Launch?.args?.gaugeController ?? phase2Core?.args?.gaugeController)
    const oracle = asAddress(phase2Launch?.args?.oracle ?? phase2Core?.args?.oracle)
    const ccaStrategy = asAddress(phase2Launch?.args?.ccaStrategy ?? phase2Core?.args?.ccaStrategy)
    const metadata = await readTokenMetadataForFallback(publicClient, token)

    return {
      token,
      info: {
        token,
        name: metadata.name,
        symbol: metadata.symbol,
        vault,
        shareOFT,
        wrapper,
        oracle,
        gaugeController,
        creator: owner,
        isActive: true,
        registeredAt: null,
      },
      ccaStrategy,
    }
  }

  return null
}

export async function resolveCreatorVaultByAnyAddress<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(
  publicClient: PublicClient<TTransport, TChain>,
  addressLike: string,
): Promise<CreatorVaultResolved | null> {
  if (!isAddress(addressLike)) return null
  const addr = getAddress(addressLike as Address)

  const token = await resolveCreatorTokenFromAnyAddress(publicClient, addr)
  if (token) {
    const [info, ccaStrategy] = await Promise.all([fetchCreatorCoinInfo(publicClient, token), fetchCcaStrategyForToken(publicClient, token)])
    if (info) return { token, info, ccaStrategy }

    const batcherResolved = await resolveCreatorVaultFromBatcherEvents(publicClient, addr)
    if (batcherResolved) {
      return {
        ...batcherResolved,
        ccaStrategy: batcherResolved.ccaStrategy ?? ccaStrategy,
      }
    }
  }

  const directTokenInfo = await fetchCreatorCoinInfo(publicClient, addr).catch(() => null)
  if (directTokenInfo) {
    const ccaStrategy = await fetchCcaStrategyForToken(publicClient, addr).catch(() => null)
    return { token: addr, info: directTokenInfo, ccaStrategy }
  }

  return await resolveCreatorVaultFromBatcherEvents(publicClient, addr)
}
