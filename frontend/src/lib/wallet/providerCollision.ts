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

function isLockedEthereumDescriptor(descriptor: PropertyDescriptor | null): boolean {
  if (!descriptor) return false
  if (typeof descriptor.get === 'function' && typeof descriptor.set !== 'function') return true
  if (Object.prototype.hasOwnProperty.call(descriptor, 'writable') && descriptor.writable === false) return true
  return false
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
  const lockedEthereumProviderGlobal = isLockedEthereumDescriptor(descriptor)

  return {
    hasMultipleInjectedProviders,
    lockedEthereumProviderGlobal,
    shouldDisableInjectedConnector: hasMultipleInjectedProviders || lockedEthereumProviderGlobal,
  }
}
