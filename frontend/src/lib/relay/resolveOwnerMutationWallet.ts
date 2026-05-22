import { createWalletClient, custom, type Address } from 'viem'
import { base } from 'viem/chains'

export type OwnerMutationWalletLike = {
  account?: unknown
  sendTransaction?: (...args: any[]) => Promise<`0x${string}`>
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

async function getPrivyEthereumProvider(wallet: unknown): Promise<{ request: (args: unknown) => Promise<unknown> } | null> {
  if (!wallet || typeof wallet !== 'object') return null
  const record = wallet as Record<string, unknown>
  const provider = record.provider
  if (provider && typeof provider === 'object' && typeof (provider as { request?: unknown }).request === 'function') {
    return provider as { request: (args: unknown) => Promise<unknown> }
  }
  if (typeof record.getEthereumProvider === 'function') {
    const resolved = await (record.getEthereumProvider as () => Promise<unknown>)().catch(() => null)
    if (resolved && typeof resolved === 'object' && typeof (resolved as { request?: unknown }).request === 'function') {
      return resolved as { request: (args: unknown) => Promise<unknown> }
    }
  }
  if (typeof record.request === 'function') {
    return { request: (record.request as (args: unknown) => Promise<unknown>).bind(record) }
  }
  return null
}

function resolveWalletAccountAddress(walletClient: OwnerMutationWalletLike | null | undefined): Address | null {
  if (!walletClient?.account) return null
  if (typeof walletClient.account === 'string') return walletClient.account as Address
  if (
    typeof walletClient.account === 'object' &&
    walletClient.account !== null &&
    'address' in walletClient.account &&
    typeof (walletClient.account as { address?: unknown }).address === 'string'
  ) {
    return (walletClient.account as { address: string }).address as Address
  }
  return null
}

function walletMatchesSigner(
  walletClient: OwnerMutationWalletLike | null | undefined,
  ownerSignerAddress: string | null | undefined,
): boolean {
  if (!walletClient || !ownerSignerAddress) return false
  const account = resolveWalletAccountAddress(walletClient)
  return account?.toLowerCase() === ownerSignerAddress.toLowerCase()
}

export async function resolveOwnerMutationWallet(params: {
  wagmiWalletClient: OwnerMutationWalletLike | null | undefined
  ownerSignerAddress: string | null | undefined
  privyExternalOwnerWallet?: unknown
}): Promise<OwnerMutationWalletLike | null> {
  const { wagmiWalletClient, ownerSignerAddress, privyExternalOwnerWallet } = params
  if (!ownerSignerAddress) return null

  if (walletMatchesSigner(wagmiWalletClient, ownerSignerAddress) && wagmiWalletClient) {
    return wagmiWalletClient
  }

  if (privyExternalOwnerWallet) {
    const provider = await getPrivyEthereumProvider(privyExternalOwnerWallet)
    if (provider?.request) {
      return createWalletClient({
        account: ownerSignerAddress as Address,
        chain: base,
        transport: custom(provider as Parameters<typeof custom>[0]),
      }) as OwnerMutationWalletLike
    }
  }

  if (wagmiWalletClient?.sendTransaction || wagmiWalletClient?.request) {
    return wagmiWalletClient
  }

  return null
}

export function resolveOwnerMutationWalletRequest(
  walletClient: OwnerMutationWalletLike | null | undefined,
): ((args: { method: string; params?: unknown[] }) => Promise<unknown>) | undefined {
  if (!walletClient?.request) return undefined
  return async (args) => await walletClient.request!(args)
}
