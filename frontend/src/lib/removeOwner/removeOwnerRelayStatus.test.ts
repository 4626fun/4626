import { describe, expect, it, vi } from 'vitest'

import {
  parseRelayIntentStatus,
  pollRelayStatusEndpoint,
  resolveRelayIndexRequestIds,
  resolveRelayStatusEndpoints,
  resolveRelayStatusFallbackRequestId,
  resolveRelayStatusFetchUrl,
  resolveRelayStatusRequestId,
  mapRemoveOwnerSubmissionError,
} from '@/lib/removeOwner/removeOwnerHelpers'
import type { OwnerMutationRelayFlow } from '@/lib/relay/ownerMutationTypes'

vi.mock('@/lib/wallet/inAppBrowser', () => ({
  isBaseAppInAppContext: vi.fn(() => false),
}))

import { isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'

const mockedIsBaseAppInAppContext = vi.mocked(isBaseAppInAppContext)

describe('removeOwner relay status helpers', () => {
  it('builds status endpoints with requestId first when ids match', () => {
    const relay = {
      requestId: '0x1111111111111111111111111111111111111111111111111111111111111111',
      orderId: '0x1111111111111111111111111111111111111111111111111111111111111111',
    } as Pick<OwnerMutationRelayFlow, 'orderId' | 'requestId'>

    expect(resolveRelayStatusEndpoints(relay)).toEqual([
      'https://api.relay.link/intents/status/v3?requestId=0x1111111111111111111111111111111111111111111111111111111111111111',
      'https://api.relay.link/intents/status/v3?orderId=0x1111111111111111111111111111111111111111111111111111111111111111',
    ])
  })

  it('indexes both ids when they differ and polls requestId first', () => {
    const relay = {
      requestId: '0x1111111111111111111111111111111111111111111111111111111111111111',
      orderId: '0x2222222222222222222222222222222222222222222222222222222222222222',
    } as Pick<OwnerMutationRelayFlow, 'orderId' | 'requestId'>

    expect(resolveRelayIndexRequestIds(relay)).toEqual([relay.orderId, relay.requestId])
    expect(resolveRelayStatusRequestId(relay)).toBe(relay.requestId)
    expect(resolveRelayStatusFallbackRequestId(relay)).toBe(relay.requestId)
    expect(resolveRelayStatusEndpoints(relay)).toEqual([
      'https://api.relay.link/intents/status/v3?requestId=0x1111111111111111111111111111111111111111111111111111111111111111',
      'https://api.relay.link/intents/status/v3?orderId=0x2222222222222222222222222222222222222222222222222222222222222222',
    ])
  })

  it('falls back to requestId when orderId is missing', () => {
    const relay = {
      requestId: '0x1111111111111111111111111111111111111111111111111111111111111111',
      orderId: null,
    } as Pick<OwnerMutationRelayFlow, 'orderId' | 'requestId'>

    expect(resolveRelayStatusRequestId(relay)).toBe(relay.requestId)
  })

  it('treats Relay unknown status as terminal failure', () => {
    const parsed = parseRelayIntentStatus({ status: 'unknown' })
    expect(parsed.done).toBe(true)
    expect(parsed.success).toBe(false)
    expect(parsed.statusText).toBe('unknown')
  })

  it('parses success with fill tx from txHashes', () => {
    const fillTx = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const parsed = parseRelayIntentStatus({
      status: 'success',
      txHashes: [fillTx],
      inTxHashes: ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
    })
    expect(parsed.success).toBe(true)
    expect(parsed.done).toBe(true)
    expect(parsed.txHash).toBe(fillTx)
  })

  it('marks failure and refund as terminal without success', () => {
    expect(parseRelayIntentStatus({ status: 'failure' }).done).toBe(true)
    expect(parseRelayIntentStatus({ status: 'failure' }).success).toBe(false)
    expect(parseRelayIntentStatus({ status: 'refund' }).done).toBe(true)
    expect(parseRelayIntentStatus({ status: 'refund' }).success).toBe(false)
  })

  it('maps stale Relay unknown status to rebuild guidance', () => {
    const mapped = mapRemoveOwnerSubmissionError({
      error: new Error(
        'Relay does not recognize this quote requestId. Rebuild the preview and submit again without waiting.',
      ),
      requiredDepositWei: null,
      latestCswBalanceWei: null,
    })
    expect(mapped).toMatch(/rebuild preview/i)
  })

  it('maps Base App signing endpoint failures without Chrome escape guidance', () => {
    mockedIsBaseAppInAppContext.mockReturnValueOnce(true)
    const mapped = mapRemoveOwnerSubmissionError({
      error: new Error('An internal error was received. Details: Failed to fetch RPC request'),
      requiredDepositWei: null,
      latestCswBalanceWei: null,
      isSelfAuthSession: true,
    })
    expect(mapped).toMatch(/base app could not reach coinbase/i)
    expect(mapped).not.toMatch(/open the same link in chrome/i)
    expect(mapped).toMatch(/stay inside base app/i)
  })

  it('maps Coinbase Wallet in-app self-auth signing failures to external browser guidance', () => {
    mockedIsBaseAppInAppContext.mockReturnValueOnce(false)
    const mapped = mapRemoveOwnerSubmissionError({
      error: new Error('Failed to fetch RPC request'),
      requiredDepositWei: null,
      latestCswBalanceWei: null,
      isSelfAuthSession: true,
    })
    expect(mapped).toMatch(/chrome or safari/i)
  })

  it('rewrites Relay status URLs to the same-origin proxy in browser contexts', () => {
    vi.stubGlobal('window', { location: { origin: 'https://app.4626.fun' } })
    const endpoint =
      'https://api.relay.link/intents/status/v3?requestId=0x1111111111111111111111111111111111111111111111111111111111111111'
    expect(resolveRelayStatusFetchUrl(endpoint)).toBe(
      '/api/relay/intent-status?requestId=0x1111111111111111111111111111111111111111111111111111111111111111',
    )
    vi.unstubAllGlobals()
  })

  it('fail-fast polls when Relay returns unknown', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ status: 'unknown' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await pollRelayStatusEndpoint({
      statusEndpoint: 'https://api.relay.link/intents/status/v3?requestId=0x1',
      timeoutMs: 5_000,
      intervalMs: 10,
    })

    expect(result.done).toBe(true)
    expect(result.success).toBe(false)
    expect(fetchMock.mock.calls.length).toBe(1)
    const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? '')
    expect(calledUrl.startsWith('/api/relay/intent-status') || calledUrl.includes('api.relay.link')).toBe(
      true,
    )
    vi.unstubAllGlobals()
  })

  it('short-circuits polling when on-chain verify passes', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await pollRelayStatusEndpoint({
      statusEndpoint: 'https://api.relay.link/intents/status/v3?requestId=0x1',
      timeoutMs: 5_000,
      intervalMs: 10,
      shouldShortCircuitSuccess: async () => true,
    })

    expect(result.done).toBe(true)
    expect(result.success).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
