import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ENV_KEYS = [
  'VIRTUALS_ACP_ENABLED',
  'VIRTUALS_ACP_WALLET_ADDRESS',
  'VIRTUALS_ACP_WALLET_ID',
  'VIRTUALS_ACP_SIGNER_PRIVATE_KEY',
  'VIRTUALS_ACP_AUTO_LLM',
  'VIRTUALS_API_KEY',
  'GROQ_API_KEY',
  'ELIZA_LLM_VIRTUALS_ACP_PROVIDER_PRIORITY',
]

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key]
}

describe('virtuals acp readiness', () => {
  beforeEach(() => {
    vi.resetModules()
    clearEnv()
  })

  afterEach(() => {
    clearEnv()
    vi.unstubAllGlobals()
  })

  it('fails when auto LLM is enabled but no providers are configured', async () => {
    process.env.VIRTUALS_ACP_ENABLED = '1'
    process.env.VIRTUALS_ACP_WALLET_ADDRESS = '0x00000000000000000000000000000000000000aa'
    process.env.VIRTUALS_ACP_WALLET_ID = 'wallet-id'
    process.env.VIRTUALS_ACP_SIGNER_PRIVATE_KEY = '0x' + '11'.repeat(32)

    const { checkVirtualsAcpRuntimeReadiness } = await import('./readiness.ts')
    const result = await checkVirtualsAcpRuntimeReadiness({ pingCompute: false })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('no LLM providers configured')
    }
  })

  it('requires VIRTUALS_API_KEY when VirtualsCompute is first in ACP priority', async () => {
    process.env.VIRTUALS_ACP_ENABLED = '1'
    process.env.VIRTUALS_ACP_WALLET_ADDRESS = '0x00000000000000000000000000000000000000aa'
    process.env.VIRTUALS_ACP_WALLET_ID = 'wallet-id'
    process.env.VIRTUALS_ACP_SIGNER_PRIVATE_KEY = '0x' + '11'.repeat(32)
    process.env.GROQ_API_KEY = 'groq-key'
    process.env.ELIZA_LLM_VIRTUALS_ACP_PROVIDER_PRIORITY = 'VirtualsCompute,Groq'

    const { checkVirtualsAcpRuntimeReadiness } = await import('./readiness.ts')
    const result = await checkVirtualsAcpRuntimeReadiness({ pingCompute: false })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('VIRTUALS_API_KEY is missing')
    }
  })

  it('passes when observe-only mode has no LLM providers', async () => {
    process.env.VIRTUALS_ACP_ENABLED = '1'
    process.env.VIRTUALS_ACP_WALLET_ADDRESS = '0x00000000000000000000000000000000000000aa'
    process.env.VIRTUALS_ACP_WALLET_ID = 'wallet-id'
    process.env.VIRTUALS_ACP_SIGNER_PRIVATE_KEY = '0x' + '11'.repeat(32)
    process.env.VIRTUALS_ACP_AUTO_LLM = '0'

    const { checkVirtualsAcpRuntimeReadiness } = await import('./readiness.ts')
    const result = await checkVirtualsAcpRuntimeReadiness({ pingCompute: false })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.llmProviders).toEqual([])
      expect(result.config.autoLlmEnabled).toBe(false)
    }
  })
})
