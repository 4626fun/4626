import { describe, expect, it } from 'vitest'

import { classifyManualChunk } from './viteManualChunks'

describe('classifyManualChunk', () => {
  it('keeps Vite preload helpers out of feature chunks', () => {
    expect(classifyManualChunk('\u0000vite/preload-helper.js')).toBe('vendor')
  })

  it('keeps Privy and wallet-core packages in the same chunk', () => {
    expect(classifyManualChunk('/repo/node_modules/@privy-io/react-auth/dist/index.mjs')).toBe('wallet-auth')
    expect(classifyManualChunk('/repo/node_modules/wagmi/dist/index.js')).toBe('wallet-auth')
    expect(classifyManualChunk('/repo/node_modules/viem/index.js')).toBe('wallet-auth')
    expect(classifyManualChunk('/repo/node_modules/@coinbase/wallet-sdk/dist/index.js')).toBe('wallet-auth')
  })

  it('keeps AA helper packages with the wallet/auth runtime', () => {
    expect(classifyManualChunk('/repo/node_modules/viem/account-abstraction/index.js')).toBe('wallet-auth')
    expect(classifyManualChunk('/repo/node_modules/permissionless/index.js')).toBe('wallet-auth')
    expect(classifyManualChunk('/repo/node_modules/ox/erc8021/index.js')).toBe('wallet-auth')
  })

  it('still classifies the other vendor families consistently', () => {
    expect(classifyManualChunk('/repo/node_modules/react/index.js')).toBe('vendor')
    expect(classifyManualChunk('/repo/node_modules/@tanstack/react-query/build/modern/index.js')).toBe('vendor')
    expect(classifyManualChunk('/repo/node_modules/@tanstack/query-core/build/modern/index.js')).toBe('vendor')
    expect(classifyManualChunk('/repo/node_modules/recharts/index.js')).toBe('charts')
    expect(classifyManualChunk('/repo/node_modules/framer-motion/dist/index.js')).toBe('ui-vendor')
    expect(classifyManualChunk('/repo/node_modules/@safe-global/api-kit/dist/index.js')).toBe('safe')
    expect(classifyManualChunk('/repo/node_modules/@zoralabs/coins-sdk/dist/index.js')).toBe('zora-sdk')
    expect(classifyManualChunk('/repo/node_modules/@lens-protocol/client/dist/index.js')).toBe('lens')
    expect(classifyManualChunk('/repo/node_modules/@xmtp/browser-sdk/dist/index.js')).toBe('xmtp')
  })

  it('does not force app code into a manual chunk', () => {
    expect(classifyManualChunk('/repo/src/pages/Home.tsx')).toBeUndefined()
  })
})
