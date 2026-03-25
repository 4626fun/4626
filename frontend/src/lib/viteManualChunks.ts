const CHART_PACKAGES = ['d3', 'recharts'] as const
const UI_VENDOR_PACKAGES = ['framer-motion', 'sonner'] as const
const WALLET_AUTH_PACKAGES = [
  '@privy-io/react-auth',
  '@privy-io/wagmi',
  '@coinbase/wallet-sdk',
  '@web3icons/react',
  'wagmi',
  '@wagmi/core',
  'viem',
  'permissionless',
  'ox',
] as const
const SAFE_PACKAGES = ['@safe-global/api-kit', '@safe-global/protocol-kit', '@safe-global/types-kit'] as const
const ZORA_PACKAGES = ['@zoralabs/coins-sdk', '@zoralabs/protocol-deployments'] as const
const LENS_PACKAGES = ['@lens-protocol/client', '@lens-chain/storage-client'] as const

function matchesPackage(id: string, pkgName: string): boolean {
  return id.includes(`/node_modules/${pkgName}/`)
}

function matchesAny(id: string, packageNames: readonly string[]): boolean {
  return packageNames.some((packageName) => matchesPackage(id, packageName))
}

export function classifyManualChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined

  if (matchesPackage(id, 'react') || matchesPackage(id, 'react-dom') || matchesPackage(id, 'react-router-dom')) {
    return 'vendor'
  }
  if (matchesAny(id, CHART_PACKAGES)) return 'charts'
  if (matchesAny(id, UI_VENDOR_PACKAGES)) return 'ui-vendor'

  // Keep Privy + wallet orchestration packages in one chunk. Splitting the
  // auth wrappers from the web3 core has produced circular initialization in
  // production bundles, which blanks the Mini App before React can render.
  if (matchesAny(id, WALLET_AUTH_PACKAGES)) return 'wallet-auth'

  if (matchesAny(id, SAFE_PACKAGES)) return 'safe'
  if (matchesAny(id, ZORA_PACKAGES)) return 'zora-sdk'
  if (matchesAny(id, LENS_PACKAGES)) return 'lens'
  if (matchesPackage(id, '@xmtp/browser-sdk') || matchesPackage(id, '@xmtp/content-type-primitives')) return 'xmtp'

  return undefined
}
