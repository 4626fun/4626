import { base } from 'viem/chains'

type Eip1193RequestArgs = { method: string; params?: unknown[] }
type Eip1193ProviderLike = { request?: (args: Eip1193RequestArgs) => Promise<unknown> } | null | undefined
type SwitchChainAsyncLike = ((params: any) => Promise<unknown>) | null | undefined

export const BASE_CHAIN_ID_HEX = `0x${base.id.toString(16)}`

function switchToBaseError(label: string): Error {
  return new Error(`Please switch ${label} to Base network to continue.`)
}

export async function ensureWagmiChainOnBase(params: {
  currentChainId: number | null | undefined
  switchChainAsync: SwitchChainAsyncLike
  label: string
}): Promise<void> {
  if (params.currentChainId === base.id) return
  if (typeof params.switchChainAsync !== 'function') {
    throw switchToBaseError(params.label)
  }
  try {
    await params.switchChainAsync({ chainId: base.id })
  } catch {
    throw switchToBaseError(params.label)
  }
}

export async function ensureProviderOnBase(params: {
  provider: Eip1193ProviderLike
  label: string
  allowSwitch?: boolean
}): Promise<void> {
  const provider = params.provider
  if (!provider?.request) return

  const current = await provider.request({ method: 'eth_chainId' }).catch(() => null)
  if (typeof current !== 'string' || current.toLowerCase() === BASE_CHAIN_ID_HEX) return

  if (params.allowSwitch === false) {
    throw switchToBaseError(params.label)
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    })
  } catch {
    throw switchToBaseError(params.label)
  }
}
