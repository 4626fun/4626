import type { WalletClient } from 'viem'
import { probeWalletCapabilities } from '@/wallet/accountContext/getCapabilities'

export type UniswapWalletCapabilities = {
  supports5792: boolean
  supports7702: boolean
}

export async function detectUniswapWalletCapabilities(walletClient: WalletClient | undefined): Promise<UniswapWalletCapabilities> {
  const caps = await probeWalletCapabilities({
    walletClient,
    chainIdHex: null,
  })
  const supports5792 = caps.supports5792
  const supports7702 = false

  return { supports5792, supports7702 }
}
