import { describe, expect, it } from 'vitest'

import { readBootstrapSwapPrefs } from './bootstrapSwapPrefs'

describe('readBootstrapSwapPrefs', () => {
  it('uses safe defaults when env is empty', () => {
    const prefs = readBootstrapSwapPrefs({})
    expect(prefs.provider).toBe('defillama')
    expect(prefs.allowFallback).toBe(true)
    expect(prefs.slippageBps).toBe(100)
  })

  it('parses explicit env values', () => {
    const prefs = readBootstrapSwapPrefs({
      VITE_DEPLOY_BOOTSTRAP_SWAP_PROVIDER: '0x',
      VITE_DEPLOY_BOOTSTRAP_SWAP_ALLOW_FALLBACK: 'false',
      VITE_DEPLOY_BOOTSTRAP_SWAP_SLIPPAGE_BPS: '75',
    })
    expect(prefs.provider).toBe('0x')
    expect(prefs.allowFallback).toBe(false)
    expect(prefs.slippageBps).toBe(75)
  })

  it('falls back when env values are invalid', () => {
    const prefs = readBootstrapSwapPrefs({
      VITE_DEPLOY_BOOTSTRAP_SWAP_PROVIDER: 'not-real',
      VITE_DEPLOY_BOOTSTRAP_SWAP_ALLOW_FALLBACK: 'maybe',
      VITE_DEPLOY_BOOTSTRAP_SWAP_SLIPPAGE_BPS: '500000',
    })
    expect(prefs.provider).toBe('defillama')
    expect(prefs.allowFallback).toBe(true)
    expect(prefs.slippageBps).toBe(100)
  })
})
