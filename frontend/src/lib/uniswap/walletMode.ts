export type WalletMode = 'canonical' | 'eoa'

const STORAGE_KEY = 'cv.swap.executionMode'

export type WalletModeContextInput = {
  canonicalAddress: `0x${string}` | null
  signerAddress: `0x${string}` | null
  canonicalReady: boolean
  eoaReady: boolean
  supports5792?: boolean
  supports7702?: boolean
}

export type WalletExecutionContext = {
  mode: WalletMode
  walletType: 'canonical' | 'eoa'
  address: `0x${string}` | null
  ready: boolean
  capabilities: {
    supports5792: boolean
    supports7702: boolean
  }
}

export function readPreferredWalletMode(): WalletMode {
  if (typeof window === 'undefined') return 'canonical'
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === 'eoa' ? 'eoa' : 'canonical'
  } catch {
    return 'canonical'
  }
}

export function writePreferredWalletMode(mode: WalletMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Ignore localStorage errors in private mode/webviews.
  }
}

export function isCSWAvailable(input: WalletModeContextInput): boolean {
  return Boolean(input.canonicalAddress && input.canonicalReady)
}

export function getDefaultWalletMode(input: {
  preferredMode?: WalletMode | null
  canonicalReady: boolean
  eoaReady: boolean
}): WalletMode {
  const preferred = input.preferredMode ?? 'canonical'
  if (preferred === 'canonical' && input.canonicalReady) return 'canonical'
  if (preferred === 'eoa' && input.eoaReady) return 'eoa'
  if (input.canonicalReady) return 'canonical'
  if (input.eoaReady) return 'eoa'
  return preferred
}

export function getExecutionContext(mode: WalletMode, input: WalletModeContextInput): WalletExecutionContext {
  const canonicalCapabilities = {
    supports5792: Boolean(input.supports5792),
    supports7702: Boolean(input.supports7702),
  }
  const eoaCapabilities = {
    supports5792: false,
    supports7702: false,
  }

  if (mode === 'canonical') {
    return {
      mode,
      walletType: 'canonical',
      address: input.canonicalAddress,
      ready: Boolean(input.canonicalAddress && input.canonicalReady),
      capabilities: canonicalCapabilities,
    }
  }

  return {
    mode,
    walletType: 'eoa',
    address: input.signerAddress,
    ready: Boolean(input.signerAddress && input.eoaReady),
    capabilities: eoaCapabilities,
  }
}

export function getActiveSignerOrProvider(
  mode: WalletMode,
  input: {
    walletClient: unknown
    publicClient: unknown
  },
): { walletClient: unknown; publicClient: unknown; walletType: WalletMode } {
  return {
    walletClient: input.walletClient,
    publicClient: input.publicClient,
    walletType: mode,
  }
}
