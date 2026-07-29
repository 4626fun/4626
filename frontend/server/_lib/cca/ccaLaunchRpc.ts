/**
 * Server-side RPC resolution for CCA launch chains (mirrors ccaLaunchChains.ts).
 * Kept in server/_lib so Vercel API handlers do not import frontend src/.
 */

export type CcaLaunchRpcChain = {
  chainId: number
  label: string
  rpcEnvKeys: readonly string[]
  defaultRpcUrls: readonly string[]
}

const CHAINS: readonly CcaLaunchRpcChain[] = [
  {
    chainId: 1,
    label: 'Ethereum',
    rpcEnvKeys: ['ETHEREUM_RPC_URL', 'ETH_RPC_URL'],
    defaultRpcUrls: ['https://ethereum-rpc.publicnode.com'],
  },
  {
    chainId: 8453,
    label: 'Base',
    rpcEnvKeys: ['BASE_READ_RPC_URL', 'BASE_RPC_URL', 'BASE_RPC_URL_FALLBACK'],
    defaultRpcUrls: ['https://mainnet.base.org'],
  },
  {
    chainId: 130,
    label: 'Unichain',
    rpcEnvKeys: ['UNICHAIN_RPC_URL'],
    defaultRpcUrls: ['https://mainnet.unichain.org'],
  },
  {
    chainId: 42_161,
    label: 'Arbitrum',
    rpcEnvKeys: ['ARBITRUM_RPC_URL'],
    defaultRpcUrls: ['https://arb1.arbitrum.io/rpc'],
  },
  {
    chainId: 4_663,
    label: 'Robinhood',
    rpcEnvKeys: ['ROBINHOOD_RPC_URL'],
    defaultRpcUrls: ['https://rpc.mainnet.chain.robinhood.com'],
  },
] as const

export function resolveCcaLaunchRpcChain(chainId: number): CcaLaunchRpcChain | undefined {
  return CHAINS.find((c) => c.chainId === chainId)
}

export function getCcaLaunchReadRpcUrls(
  chainId: number,
  env: Record<string, string | undefined> = process.env,
): string[] {
  const chain = resolveCcaLaunchRpcChain(chainId)
  if (!chain) return []
  const fromEnv = chain.rpcEnvKeys
    .map((key) => (env[key] ?? '').trim())
    .filter((url): url is string => Boolean(url))
  return Array.from(new Set([...fromEnv, ...chain.defaultRpcUrls]))
}
