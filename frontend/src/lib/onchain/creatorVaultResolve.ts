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

const CCA_STRATEGY_LINK_ABI = [
  { type: 'function', name: 'auctionToken', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'fundsRecipient', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
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

function sortLogsNewestFirst<T extends { blockNumber?: bigint; logIndex?: number }>(logs: T[]): T[] {
  return [...logs].sort((a, b) => {
    const blockA = typeof a.blockNumber === 'bigint' ? a.blockNumber : 0n
    const blockB = typeof b.blockNumber === 'bigint' ? b.blockNumber : 0n
    if (blockA !== blockB) return blockA > blockB ? -1 : 1
    const indexA = typeof a.logIndex === 'number' ? a.logIndex : 0
    const indexB = typeof b.logIndex === 'number' ? b.logIndex : 0
    return indexB - indexA
  })
}

async function selectMatchingPhase2Log<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(
  publicClient: PublicClient<TTransport, TChain>,
  logs: any[],
  expected: { shareOFT: Address | null; vault: Address | null },
): Promise<any | null> {
  const ordered = sortLogsNewestFirst(logs)
  if (ordered.length === 0) return null
  if (!expected.shareOFT && !expected.vault) return ordered[0] ?? null

  for (const log of ordered) {
    const ccaStrategy = asAddress(log?.args?.ccaStrategy)
    if (!ccaStrategy) continue
    let auctionToken: Address | null = null
    let fundsRecipient: Address | null = null
    try {
      const reads = await publicClient.multicall({
        contracts: [
          { address: ccaStrategy, abi: CCA_STRATEGY_LINK_ABI, functionName: 'auctionToken' },
          { address: ccaStrategy, abi: CCA_STRATEGY_LINK_ABI, functionName: 'fundsRecipient' },
        ],
        allowFailure: true,
      })
      auctionToken = reads[0]?.status === 'success' ? asAddress(reads[0].result) : null
      fundsRecipient = reads[1]?.status === 'success' ? asAddress(reads[1].result) : null
    } catch {
      continue
    }

    const shareMatches = expected.shareOFT ? eqAddress(auctionToken, expected.shareOFT) : true
    const vaultMatches = expected.vault ? eqAddress(fundsRecipient, expected.vault) : true
    if (shareMatches && vaultMatches) return log
  }

  return null
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

    const phase2Match = await selectMatchingPhase2Log(publicClient, [...phase2LaunchLogs, ...phase2CoreLogs], {
      shareOFT,
      vault,
    })
    const gaugeController = asAddress(phase2Match?.args?.gaugeController)
    const oracle = asAddress(phase2Match?.args?.oracle)
    const ccaStrategy = asAddress(phase2Match?.args?.ccaStrategy)
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
    const batcherResolved = await resolveCreatorVaultFromBatcherEvents(publicClient, addr)
    const info = await fetchCreatorCoinInfo(publicClient, token)
    if (info) return { token, info, ccaStrategy: batcherResolved?.ccaStrategy ?? null }

    if (batcherResolved) {
      return batcherResolved
    }
  }

  const directTokenInfo = await fetchCreatorCoinInfo(publicClient, addr).catch(() => null)
  if (directTokenInfo) {
    const batcherResolved = await resolveCreatorVaultFromBatcherEvents(publicClient, addr).catch(() => null)
    return { token: addr, info: directTokenInfo, ccaStrategy: batcherResolved?.ccaStrategy ?? null }
  }

  return await resolveCreatorVaultFromBatcherEvents(publicClient, addr)
}
