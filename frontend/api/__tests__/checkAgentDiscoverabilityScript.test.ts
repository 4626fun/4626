import { describe, expect, it } from 'vitest'

// @ts-expect-error NodeNext/Bundler typing for local .mjs helper is not resolved in this test project.
import { validateDiscoverabilityPayload } from '../../scripts/check-agent-discoverability.mjs'

const readyPayload = {
  chainId: 8453,
  registryAddress: '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
  agentId: 2205,
  canonicalCsw: '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5',
  ownerAddress: '0x742d35cc6634c0532925a3b844bc9e7595f2bd18',
  agentWallet: '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5',
  tokenUri: 'data:application/json;base64,abc',
  agentRegistered: true,
  walletBoundToCanonical: true,
  discoverabilityReady: true,
  tokenUriIsStrictImmutable: true,
  tokenUriMatchesCanonical: true,
  endpoint: {
    url: 'https://4626.fun/api/v1/spec.json',
    ok: true,
    status: 200,
  },
  mirrors: {
    registration: {
      url: 'https://4626.fun/.well-known/agent-registration.json',
      matchesCanonical: true,
    },
    domainVerification: {
      url: 'https://4626.fun/.well-known/erc8004.json',
      matchesCanonical: true,
    },
  },
  checks: [
    { id: 'onchain-registration', passed: true, detail: 'ok' },
    { id: 'service-availability', passed: true, detail: 'ok' },
  ],
}

describe('check-agent-discoverability script', () => {
  it('accepts a scanner-ready verification snapshot and returns a concise summary', () => {
    const summary = validateDiscoverabilityPayload(readyPayload, {
      expectedAgentId: 2205,
      expectedAgentRegistry: 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
      expectReady: true,
    })

    expect(summary.agentId).toBe(2205)
    expect(summary.discoverabilityReady).toBe(true)
    expect(summary.registrationMirrorUrl).toBe('https://4626.fun/.well-known/agent-registration.json')
    expect(summary.domainVerificationUrl).toBe('https://4626.fun/.well-known/erc8004.json')
  })

  it('fails with actionable failing-check details when discoverability is not ready', () => {
    expect(() =>
      validateDiscoverabilityPayload(
        {
          ...readyPayload,
          discoverabilityReady: false,
          endpoint: {
            ...readyPayload.endpoint,
            ok: false,
            status: 503,
          },
          checks: [
            { id: 'service-availability', passed: false, detail: 'Primary public endpoint responded with 503.' },
          ],
        },
        {
          expectedAgentId: 2205,
          expectedAgentRegistry: 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
          expectReady: true,
        },
      ),
    ).toThrowError(/service-availability: Primary public endpoint responded with 503\./)
  })

  it('fails with a precise error when the expected agent id does not match', () => {
    expect(() =>
      validateDiscoverabilityPayload(readyPayload, {
        expectedAgentId: 9999,
        expectedAgentRegistry: 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
        expectReady: true,
      }),
    ).toThrowError('Expected agentId 9999, received 2205.')
  })

  it('fails with a precise error when the expected registry ref does not match', () => {
    expect(() =>
      validateDiscoverabilityPayload(readyPayload, {
        expectedAgentId: 2205,
        expectedAgentRegistry: 'eip155:8453:0x1111111111111111111111111111111111111111',
        expectReady: true,
      }),
    ).toThrowError(
      'Expected agentRegistry eip155:8453:0x1111111111111111111111111111111111111111, received eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432.',
    )
  })
})
