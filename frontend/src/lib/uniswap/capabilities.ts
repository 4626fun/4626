import type { WalletClient } from 'viem'

export type UniswapWalletCapabilities = {
  supports5792: boolean
  supports7702: boolean
}

export async function detectUniswapWalletCapabilities(walletClient: WalletClient | undefined): Promise<UniswapWalletCapabilities> {
  if (!walletClient) return { supports5792: false, supports7702: false }

  const request = (walletClient as any)?.request as ((args: { method: string; params?: unknown[] }) => Promise<unknown>) | undefined
  if (!request) return { supports5792: false, supports7702: false }

  let supports5792 = false
  let supports7702 = false

  try {
    const caps = await request({ method: 'wallet_getCapabilities' }).catch(() => null)
    const text = JSON.stringify(caps ?? {}).toLowerCase()
    supports5792 = text.includes('wallet_sendcalls') || text.includes('5792')
    supports7702 = text.includes('7702')
  } catch {
    // no-op: fallback capabilities remain false
  }

  return { supports5792, supports7702 }
}
