import { describe, expect, it } from 'vitest'

import { getApiHandler } from '../_handlers/_routes.js'

describe('v1 agent access route registration', () => {
  it('resolves primary /v1/agents endpoints', async () => {
    const routes = [
      'v1/agents/capabilities',
      'v1/agents/access-proof/request',
      'v1/agents/access-proof/verify',
      'v1/agents/xmtp/join',
      'v1/agents/telegram/join',
    ]

    for (const route of routes) {
      const handler = await getApiHandler(route)
      expect(typeof handler).toBe('function')
    }
  })

  it('does not resolve removed singular compatibility aliases', async () => {
    const routes = [
      'v1/agent/capabilities',
      'v1/agent/access-proof/request',
      'v1/agent/access-proof/verify',
      'v1/agent/xmtp/join',
      'v1/agent/telegram/join',
    ]

    for (const route of routes) {
      const handler = await getApiHandler(route)
      expect(handler).toBeNull()
    }
  })
})
