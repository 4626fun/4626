import { createPublicClient, decodeFunctionData, getAddress, http, isAddress, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

declare const process: { env: Record<string, string | undefined> }

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const DEFAULT_CHARM_FACTORY = '0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa'
const DEFAULT_CHARM_STITCHING_BASE_ENDPOINT = 'https://stitching-v2.herokuapp.com/8453'

const CHARM_FACTORY_VIEW_ABI = [
  {
    type: 'function',
    name: 'isVault',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const CHARM_FACTORY_WRITE_ABI = [
  {
    type: 'function',
    name: 'createVault',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'pool', type: 'address' },
          { name: 'manager', type: 'address' },
          { name: 'managerFee', type: 'uint24' },
          { name: 'rebalanceDelegate', type: 'address' },
          { name: 'maxTotalSupply', type: 'uint256' },
          { name: 'baseThreshold', type: 'int24' },
          { name: 'limitThreshold', type: 'int24' },
          { name: 'fullRangeWeight', type: 'uint24' },
          { name: 'period', type: 'uint32' },
          { name: 'minTickMove', type: 'int24' },
          { name: 'maxTwapDeviation', type: 'int24' },
          { name: 'twapDuration', type: 'uint32' },
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
        ],
      },
    ],
    outputs: [{ name: 'vault', type: 'address' }],
  },
] as const

export function getCharmFactoryAddress(): Address {
  const configured = (process.env.CHARM_FACTORY ?? '').trim()
  if (configured && isAddress(configured)) return getAddress(configured as Address)
  return getAddress(DEFAULT_CHARM_FACTORY as Address)
}

export function getCharmValidationRpcUrl(): string {
  const rpc = (process.env.BASE_RPC_URL ?? '').trim()
  return rpc || 'https://mainnet.base.org'
}

export function getCharmStitchingBaseEndpoint(): string {
  const configured = (process.env.CHARM_STITCHING_BASE_ENDPOINT ?? '').trim()
  return configured || DEFAULT_CHARM_STITCHING_BASE_ENDPOINT
}

export function createBasePublicClientForCharmValidation() {
  return createPublicClient({
    chain: base,
    transport: http(getCharmValidationRpcUrl(), { timeout: 20_000 }),
  })
}

export async function isOfficialCharmVault(params: {
  charmVaultAddress: Address
  publicClient?: { readContract: (request: Record<string, unknown>) => Promise<unknown> }
}): Promise<boolean> {
  const charmVaultAddress = getAddress(params.charmVaultAddress)
  if (charmVaultAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) return false

  const factory = getCharmFactoryAddress()
  const publicClient = params.publicClient ?? createBasePublicClientForCharmValidation()
  const isVault = await publicClient
    .readContract({
      address: factory,
      abi: CHARM_FACTORY_VIEW_ABI,
      functionName: 'isVault',
      args: [charmVaultAddress],
    })
    .catch(() => null)

  return isVault === true
}

export function extractCharmCreateVaultPool(call: { to?: string; data?: string }): Address | null {
  const toRaw = typeof call?.to === 'string' ? call.to : ''
  const dataRaw = typeof call?.data === 'string' ? call.data.trim() : ''
  if (!isAddress(toRaw) || !dataRaw.startsWith('0x')) return null
  const to = getAddress(toRaw as Address)
  if (to.toLowerCase() !== getCharmFactoryAddress().toLowerCase()) return null

  try {
    const decoded = decodeFunctionData({
      abi: CHARM_FACTORY_WRITE_ABI,
      data: dataRaw as Hex,
    })
    if (decoded.functionName !== 'createVault') return null
    const params = (decoded.args?.[0] ?? null) as { pool?: string } | null
    if (!params?.pool || !isAddress(params.pool)) return null
    return getAddress(params.pool as Address)
  } catch {
    return null
  }
}

export async function isCharmPoolIndexed(params: {
  poolAddress: Address
  endpoint?: string
  fetchImpl?: typeof fetch
}): Promise<boolean | null> {
  const poolAddress = getAddress(params.poolAddress)
  const endpoint = (params.endpoint ?? '').trim() || getCharmStitchingBaseEndpoint()
  const fetchImpl = params.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') return null

  const query = `
    query GetPool($id: ID!) {
      pool(id: $id) {
        id
      }
    }
  `

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { id: poolAddress.toLowerCase() },
      }),
    })
    if (!response.ok) return null
    const payload = (await response.json().catch(() => null)) as
      | { data?: { pool?: { id?: string | null } | null }; errors?: unknown[] }
      | null
    if (!payload || (Array.isArray(payload.errors) && payload.errors.length > 0)) return null
    const poolId = payload.data?.pool?.id
    if (typeof poolId !== 'string' || !poolId) return false
    return poolId.toLowerCase() === poolAddress.toLowerCase()
  } catch {
    return null
  }
}

export function officialCharmVaultError(charmVaultAddress: Address): string {
  return `Charm vault ${charmVaultAddress} is not recognized by official Charm factory ${getCharmFactoryAddress()}`
}

export function charmPoolNotIndexedError(poolAddress: Address): string {
  return (
    `Charm pool ${poolAddress} is not currently indexed by Charm's public vault data source. ` +
    'Deploying a vault against this pool can succeed on-chain but remain invisible on alpha.charm.fi.'
  )
}
