import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
}))

import { AgentVerificationCard } from './AgentVerificationCard'

const baseVerificationData = {
  chainId: 8453,
  registryAddress: '0x1111111111111111111111111111111111111111',
  agentId: 2205,
  canonicalCsw: '0x2222222222222222222222222222222222222222',
  ownerAddress: '0x3333333333333333333333333333333333333333',
  agentWallet: '0x2222222222222222222222222222222222222222',
  tokenUri: 'data:application/json;base64,eyJ0eXBlIjoiZXJjODAwNCJ9',
  agentRegistered: true,
  walletBoundToCanonical: true,
  discoverabilityReady: true,
  tokenUriIsStrictImmutable: true,
  tokenUriMatchesCanonical: true,
  endpoint: {
    url: 'https://4626.fun/api/v1/spec.json',
    ok: true,
    status: 200,
    error: null,
  },
  mirrors: {
    registration: {
      url: 'https://4626.fun/.well-known/agent-registration.json',
      reachable: true,
      finalUrl: 'https://4626.fun/.well-known/agent-registration.json',
      matchesCanonical: true,
      agentIdMatches: true,
      error: null,
    },
    domainVerification: {
      url: 'https://4626.fun/.well-known/erc8004.json',
      reachable: true,
      finalUrl: 'https://4626.fun/.well-known/erc8004.json',
      matchesCanonical: true,
      error: null,
    },
  },
  checks: [],
  links: {
    registry: 'https://basescan.org/address/0x1111111111111111111111111111111111111111',
    token: 'https://basescan.org/token/0x1111111111111111111111111111111111111111?a=2205',
    canonicalCsw: 'https://basescan.org/address/0x2222222222222222222222222222222222222222',
    ownerAddress: 'https://basescan.org/address/0x3333333333333333333333333333333333333333',
    agentWallet: 'https://basescan.org/address/0x2222222222222222222222222222222222222222',
  },
} as const

function renderCard(data: Partial<typeof baseVerificationData> = {}) {
  useQueryMock.mockReturnValue({
    data: {
      ...baseVerificationData,
      ...data,
      endpoint: {
        ...baseVerificationData.endpoint,
        ...(data.endpoint ?? {}),
      },
      mirrors: {
        registration: {
          ...baseVerificationData.mirrors.registration,
          ...(data.mirrors?.registration ?? {}),
        },
        domainVerification: {
          ...baseVerificationData.mirrors.domainVerification,
          ...(data.mirrors?.domainVerification ?? {}),
        },
      },
    },
    isLoading: false,
    isError: false,
    error: null,
  })

  return renderToStaticMarkup(React.createElement(AgentVerificationCard))
}

describe('AgentVerificationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows unreachable mirror messaging when the registration mirror cannot be fetched', () => {
    const html = renderCard({
      mirrors: {
        registration: {
          reachable: false,
          matchesCanonical: false,
          error: 'Registration URL returned 503',
        },
      },
    })

    expect(html).toContain('Unreachable')
    expect(html).not.toContain('Mismatch detected')
  })

  it('shows invalid payload messaging when the domain proof payload is inconsistent', () => {
    const html = renderCard({
      mirrors: {
        domainVerification: {
          reachable: false,
          matchesCanonical: false,
          error: 'Domain proof verifiedEndpoints do not match the canonical public endpoints.',
        },
      },
    })

    expect(html).toContain('Invalid payload')
    expect(html).not.toContain('Mismatch detected')
  })

  it('keeps mismatch messaging for reachable mirrors that simply drift from the canonical payload', () => {
    const html = renderCard({
      mirrors: {
        registration: {
          reachable: true,
          matchesCanonical: false,
          error: null,
        },
      },
    })

    expect(html).toContain('Mismatch detected')
  })
})
