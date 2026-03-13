type EthereumProviderCollisionState = {
  hasMultipleInjectedProviders: boolean
  lockedEthereumProviderGlobal: boolean
  shouldDisableInjectedConnector: boolean
}

export function detectEthereumProviderCollision(): EthereumProviderCollisionState {
  if (typeof window === 'undefined') {
    return {
      hasMultipleInjectedProviders: false,
      lockedEthereumProviderGlobal: false,
      shouldDisableInjectedConnector: false,
    }
  }

  const providerList = Array.isArray((window as any)?.ethereum?.providers)
    ? ((window as any).ethereum.providers as unknown[])
    : []
  const hasMultipleInjectedProviders = providerList.length > 1

  const descriptor = Object.getOwnPropertyDescriptor(window, 'ethereum')
  const lockedEthereumProviderGlobal = Boolean(
    descriptor &&
      typeof descriptor.get === 'function' &&
      typeof descriptor.set !== 'function',
  )

  return {
    hasMultipleInjectedProviders,
    lockedEthereumProviderGlobal,
    shouldDisableInjectedConnector: hasMultipleInjectedProviders || lockedEthereumProviderGlobal,
  }
}
