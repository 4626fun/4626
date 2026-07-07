type ProviderRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>

export type PrivyEmbeddedEoaProvider = {
  request: ProviderRequest
}

export async function resolvePrivyEmbeddedEoaProvider(
  wallet: unknown,
): Promise<PrivyEmbeddedEoaProvider | null> {
  const walletAny = wallet && typeof wallet === 'object' ? (wallet as Record<string, unknown>) : null
  if (!walletAny) return null

  const directProvider = walletAny.provider
  if (
    directProvider &&
    typeof directProvider === 'object' &&
    typeof (directProvider as { request?: unknown }).request === 'function'
  ) {
    const request = (directProvider as { request: ProviderRequest }).request.bind(directProvider)
    return { request }
  }

  const getEthereumProvider = walletAny.getEthereumProvider
  if (typeof getEthereumProvider === 'function') {
    const provider = await getEthereumProvider.call(walletAny).catch(() => null)
    if (provider && typeof (provider as { request?: unknown }).request === 'function') {
      const request = (provider as { request: ProviderRequest }).request.bind(provider)
      return { request }
    }
  }

  if (typeof walletAny.request === 'function') {
    return { request: walletAny.request.bind(walletAny) as ProviderRequest }
  }

  return null
}
