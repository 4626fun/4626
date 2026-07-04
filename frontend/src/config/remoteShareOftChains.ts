export const ROBINHOOD_REMOTE_SHARE_OFT = {
  chainId: 4663,
  eid: 30416,
  label: 'Remote ShareOFT beta',
  shortName: 'Robinhood',
  explorerUrl: 'https://robinhoodchain.blockscout.com',
  rpcEnvKey: 'ROBINHOOD_RPC_URL',
  defaultRpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
  lzEndpoint: '0x6F475642a6e85809B1c36Fa62763669b1b48DD5B' as const,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  capabilities: {
    bridgeShares: true,
    vaultDeposit: false,
    strategies: false,
  },
  settlementHub: 'Base',
  hubEid: 30184,
} as const

export type RemoteShareOftChainId = typeof ROBINHOOD_REMOTE_SHARE_OFT.chainId

export function getRemoteShareOftChain(chainId: number) {
  if (chainId === ROBINHOOD_REMOTE_SHARE_OFT.chainId) return ROBINHOOD_REMOTE_SHARE_OFT
  return null
}
