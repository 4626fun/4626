import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AgentPublishStatus, getAgentPublishStatusView } from './AgentPublishStatus'

const basePublish = {
  uriPolicy: {
    mode: 'strict-immutable',
    preferredOnchainUri: 'data:application/json;base64,abc',
    preferredOnchainUriKind: 'data:',
    mirrorUrl: 'https://4626.fun/.well-known/agent-registration.json',
    domainVerificationUrl: 'https://4626.fun/.well-known/erc8004.json',
    compatibilityFallbackUrl: null,
    writeOnchainHint: 'Write the strict immutable URI onchain.',
  },
  groveStatus: 'stored' as const,
  grove: {
    lensUri: 'lens://registration-key',
    gatewayUrl: 'https://api.grove.storage/registration-key',
    storageKey: 'registration-key',
    statusUrl: null,
  },
}

describe('AgentPublishStatus', () => {
  it('separates canonical URI readiness from Grove fallback storage success', () => {
    const view = getAgentPublishStatusView(basePublish)

    expect(view.canonicalUriReady).toBe(true)
    expect(view.groveStored).toBe(true)
    expect(view.groveUnavailable).toBe(false)
    expect(view.canonicalMessage).toContain('Canonical immutable URI ready')
    expect(view.groveMessage).toContain('stored successfully')

    const html = renderToStaticMarkup(React.createElement(AgentPublishStatus, { publish: basePublish }))
    expect(html).toContain('Canonical immutable URI ready')
    expect(html).toContain('Grove fallback stored successfully')
    expect(html).toContain('https://api.grove.storage/registration-key')
    expect(html).toContain('lens://registration-key')
  })

  it('shows Grove unavailable without claiming fallback storage succeeded', () => {
    const publish = {
      ...basePublish,
      groveStatus: 'unavailable' as const,
      grove: undefined,
      uriPolicy: {
        ...basePublish.uriPolicy,
        compatibilityFallbackUrl: null,
      },
    }

    const view = getAgentPublishStatusView(publish)

    expect(view.canonicalUriReady).toBe(true)
    expect(view.groveStored).toBe(false)
    expect(view.groveUnavailable).toBe(true)
    expect(view.groveMessage).toContain('unavailable right now')

    const html = renderToStaticMarkup(React.createElement(AgentPublishStatus, { publish }))
    expect(html).toContain('Canonical immutable URI ready')
    expect(html).toContain('Grove fallback is unavailable right now')
    expect(html).not.toContain('stored successfully')
  })

  it('shows canonical URI readiness when Grove storage was intentionally skipped', () => {
    const publish = {
      ...basePublish,
      groveStatus: 'skipped' as const,
      grove: undefined,
    }

    const view = getAgentPublishStatusView(publish)

    expect(view.canonicalUriReady).toBe(true)
    expect(view.groveStored).toBe(false)
    expect(view.groveUnavailable).toBe(false)
    expect(view.groveSkipped).toBe(true)
    expect(view.groveMessage).toContain('skipped for this request')

    const html = renderToStaticMarkup(React.createElement(AgentPublishStatus, { publish }))
    expect(html).toContain('Canonical immutable URI ready')
    expect(html).toContain('Grove fallback was skipped for this request')
    expect(html).not.toContain('stored successfully')
  })
})
