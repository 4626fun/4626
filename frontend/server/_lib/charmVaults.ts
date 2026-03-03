import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

declare const process: { env: Record<string, string | undefined> }

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const DEFAULT_CHARM_FACTORY = '0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa'

const CHARM_FACTORY_VIEW_ABI = [
  {
    type: 'function',
    name: 'isVault',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
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

export function officialCharmVaultError(charmVaultAddress: Address): string {
  return `Charm vault ${charmVaultAddress} is not recognized by official Charm factory ${getCharmFactoryAddress()}`
}
