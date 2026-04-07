import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AgentOperatorStatus, getAgentOperatorSummaryView } from './AgentOperatorStatus'

const baseStatus = {
  registration: {
    name: '4626 Agent',
    registrations: [{ agentId: 2205, agentRegistry: 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432' }],
  },
  publish: {
    uriPolicy: {
      mode: 'strict-immutable',
      preferredOnchainUri: 'data:application/json;base64,abc',
      preferredOnchainUriKind: 'data:',
      mirrorUrl: 'https://4626.fun/.well-known/agent-registration.json',
      domainVerificationUrl: 'https://4626.fun/.well-known/erc8004.json',
      compatibilityFallbackUrl: 'https://api.grove.storage/registration-key',
      writeOnchainHint: 'Write the strict immutable URI onchain.',
    },
    groveStatus: 'stored' as const,
    grove: {
      lensUri: 'lens://registration-key',
      gatewayUrl: 'https://api.grove.storage/registration-key',
      storageKey: 'registration-key',
      statusUrl: null,
    },
  },
  discoverability: {
    agentId: 2205,
    discoverabilityReady: false,
    walletBoundToCanonical: false,
    tokenUriIsStrictImmutable: true,
    tokenUriMatchesCanonical: true,
  },
  nextActions: [
    {
      id: 'set_agent_wallet',
      label: 'Bind agentWallet to the canonical CSW',
      detail: 'Onchain agentWallet is missing or does not match the canonical CSW.',
    },
  ],
  checkedAt: '2026-04-07T00:00:00.000Z',
}

describe('AgentOperatorStatus', () => {
  it('summarizes follow-through needed when discoverability is not ready', () => {
    const view = getAgentOperatorSummaryView(baseStatus)

    expect(view.readinessBadge.label).toBe('Needs follow-through')
    expect(view.walletBadge.label).toBe('agentWallet not bound')
    expect(view.uriBadge.label).toBe('tokenURI canonical')
    expect(view.summaryMessage).toContain('Follow the items below')

    const html = renderToStaticMarkup(React.createElement(AgentOperatorStatus, { status: baseStatus }))
    expect(html).toContain('ERC-8004 operator status')
    expect(html).toContain('Needs follow-through')
    expect(html).toContain('Bind agentWallet to the canonical CSW')
    expect(html).toContain('Canonical immutable URI ready for onchain write.')
    expect(html).toContain('2026-04-07T00:00:00.000Z')
  })

  it('renders an all-clear summary when there are no remaining next actions', () => {
    const status = {
      ...baseStatus,
      discoverability: {
        ...baseStatus.discoverability,
        discoverabilityReady: true,
        walletBoundToCanonical: true,
      },
      nextActions: [],
    }

    const view = getAgentOperatorSummaryView(status)
    expect(view.readinessBadge.label).toBe('Scanner-ready')
    expect(view.walletBadge.label).toBe('agentWallet verified')
    expect(view.summaryMessage).toContain('aligned')

    const html = renderToStaticMarkup(React.createElement(AgentOperatorStatus, { status }))
    expect(html).toContain('Scanner-ready')
    expect(html).toContain('All scanner-facing publish and verification checks are aligned.')
    expect(html).not.toContain('Bind agentWallet to the canonical CSW')
  })
})
