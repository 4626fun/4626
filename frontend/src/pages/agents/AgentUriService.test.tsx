import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

describe('AgentUriService', () => {
  it('explains the canonical immutable URI and Grove fallback split', async () => {
    const { AgentUriService } = await import('./AgentUriService')

    const html = renderToStaticMarkup(React.createElement(AgentUriService))

    expect(html).toContain('canonical immutable')
    expect(html).toContain('compatibility fallback')
    expect(html).toContain('/.well-known/agent-registration.json')
    expect(html).toContain('/.well-known/erc8004.json')
    expect(html).toContain('preferredOnchainUri')
    expect(html).toContain('preferredOnchainUriKind')
  })
})
