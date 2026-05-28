import { describe, expect, it } from 'vitest'
import { resolveExecutionRoute } from '../executionRoute'

describe('base mcp execution route', () => {
  it('resolves canonical route when ready', () => {
    const result = resolveExecutionRoute({
      requestedMode: 'canonical',
      canonicalReady: true,
      canonicalSender: '0x1111111111111111111111111111111111111111',
      eoaReady: false,
    })

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.executionMode).toBe('canonical')
    }
  })

  it('blocks eoa when not ready', () => {
    const result = resolveExecutionRoute({
      requestedMode: 'eoa',
      canonicalReady: true,
      canonicalSender: '0x1111111111111111111111111111111111111111',
      eoaReady: false,
      eoaSender: null,
    })

    expect(result).toEqual({
      status: 'blocked',
      reasonCode: 'not_execution_ready',
      message: 'EOA execution lane is not ready for this account.',
    })
  })
})
