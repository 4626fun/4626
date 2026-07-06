import type { Address, PublicClient } from 'viem'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

declare const process: { env: Record<string, string | undefined> }

export function getBasePublicClient(): PublicClient {
  const rpcUrl = (process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').split(',')[0].trim()
  return createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 10_000 }) }) as unknown as PublicClient
}

export function hasContractBytecode(bytecode: `0x${string}` | null | undefined): boolean {
  return typeof bytecode === 'string' && bytecode.trim() !== '' && bytecode !== '0x'
}

export async function isContractAddressByBytecode(args: {
  publicClient: PublicClient
  address: Address
}): Promise<boolean> {
  const bytecode = await args.publicClient.getBytecode({ address: args.address })
  return hasContractBytecode(bytecode)
}
