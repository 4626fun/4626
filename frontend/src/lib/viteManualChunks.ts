const MANUAL_CHUNK_RULES: ReadonlyArray<{
  chunk: string
  patterns: ReadonlyArray<string>
}> = [
  {
    chunk: 'wallet-auth',
    patterns: [
      '/@privy-io/react-auth/',
      '/@coinbase/wallet-sdk/',
      '/wagmi/',
      '/viem/',
      '/permissionless/',
      '/ox/',
    ],
  },
  {
    chunk: 'charts',
    patterns: ['/recharts/'],
  },
  {
    chunk: 'ui-vendor',
    patterns: ['/framer-motion/'],
  },
  {
    chunk: 'safe',
    patterns: ['/@safe-global/'],
  },
  {
    chunk: 'zora-sdk',
    patterns: ['/@zoralabs/'],
  },
  {
    chunk: 'lens',
    patterns: ['/@lens-protocol/'],
  },
  {
    chunk: 'xmtp',
    patterns: ['/@xmtp/'],
  },
  {
    chunk: 'vendor',
    patterns: ['/react/', '/react-dom/', '/@tanstack/react-query/', '/@tanstack/query-core/'],
  },
]

export function classifyManualChunk(id: string): string | undefined {
  const normalizedId = id.replaceAll('\\', '/').toLowerCase()

  // Keep Vite preload helpers in the baseline vendor chunk.
  if (normalizedId.includes('vite/preload-helper')) {
    return 'vendor'
  }

  if (!normalizedId.includes('/node_modules/')) {
    return undefined
  }

  for (const rule of MANUAL_CHUNK_RULES) {
    if (rule.patterns.some((pattern) => normalizedId.includes(pattern))) {
      return rule.chunk
    }
  }

  return undefined
}
