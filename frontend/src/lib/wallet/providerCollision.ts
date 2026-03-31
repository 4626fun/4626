type EthereumProviderCollisionState = {
  hasMultipleInjectedProviders: boolean
  lockedEthereumProviderGlobal: boolean
  shouldDisableInjectedConnector: boolean
}

function findWindowEthereumDescriptor(target: Window): PropertyDescriptor | null {
  let cursor: object | null = target
  while (cursor) {
    const descriptor = Object.getOwnPropertyDescriptor(cursor, 'ethereum')
    if (descriptor) return descriptor
    cursor = Object.getPrototypeOf(cursor)
  }
  return null
}

export function detectEthereumProviderCollision(): EthereumProviderCollisionState {
  if (typeof window === 'undefined') {
    return {
      hasMultipleInjectedProviders: false,
      lockedEthereumProviderGlobal: false,
      shouldDisableInjectedConnector: false,
    }
  }

  let providerList: unknown[] = []
  try {
    const providers = (window as any)?.ethereum?.providers
    providerList = Array.isArray(providers) ? providers : []
  } catch {
    providerList = []
  }
  const hasMultipleInjectedProviders = providerList.length > 1

  const descriptor = findWindowEthereumDescriptor(window)
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
