type EthereumProviderCollisionState = {
  hasMultipleInjectedProviders: boolean
  lockedEthereumProviderGlobal: boolean
  persistedCollisionSignal: boolean
  shouldDisableInjectedConnector: boolean
}

const PERSISTED_WALLET_COLLISION_KEY = 'cv:wallet-provider-collision-at'
const PERSISTED_WALLET_COLLISION_WINDOW_MS = 24 * 60 * 60 * 1000

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

function hasRecentPersistedCollisionSignal(nowMs: number): boolean {
  if (typeof window === 'undefined') return false

  const storages: Storage[] = []
  try {
    if (window.localStorage) storages.push(window.localStorage)
  } catch {
    // ignore
  }
  try {
    if (window.sessionStorage) storages.push(window.sessionStorage)
  } catch {
    // ignore
  }

  for (const storage of storages) {
    try {
      const raw = storage.getItem(PERSISTED_WALLET_COLLISION_KEY)
      if (!raw) continue
      const timestampMs = Number(raw)
      if (!Number.isFinite(timestampMs) || timestampMs <= 0) continue
      if (nowMs - timestampMs <= PERSISTED_WALLET_COLLISION_WINDOW_MS) return true
    } catch {
      // ignore
    }
  }

  return false
}

export function detectEthereumProviderCollision(): EthereumProviderCollisionState {
  if (typeof window === 'undefined') {
    return {
      hasMultipleInjectedProviders: false,
      lockedEthereumProviderGlobal: false,
      persistedCollisionSignal: false,
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
  const persistedCollisionSignal = hasRecentPersistedCollisionSignal(Date.now())

  return {
    hasMultipleInjectedProviders,
    lockedEthereumProviderGlobal,
    persistedCollisionSignal,
    shouldDisableInjectedConnector:
      hasMultipleInjectedProviders || lockedEthereumProviderGlobal || persistedCollisionSignal,
  }
}
