import { afterEach, describe, expect, it, vi } from 'vitest'

import { isVanityWasmWorkerEnabled } from '@/lib/vanity/vanityWasmWorkerClient'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('vanityWasmWorkerClient', () => {
  it('is disabled when Worker is unavailable', () => {
    expect(isVanityWasmWorkerEnabled()).toBe(false)
  })

  it('is enabled by default when Worker exists', () => {
    vi.stubGlobal('Worker', class Worker {})
    expect(isVanityWasmWorkerEnabled()).toBe(true)
  })

  it('can be disabled via VITE_VANITY_WASM_WORKER=false', () => {
    vi.stubGlobal('Worker', class Worker {})
    vi.stubEnv('VITE_VANITY_WASM_WORKER', 'false')
    expect(isVanityWasmWorkerEnabled()).toBe(false)
  })
})