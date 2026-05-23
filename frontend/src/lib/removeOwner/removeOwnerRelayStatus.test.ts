import { describe, expect, it, vi } from 'vitest'

import {
  parseRelayIntentStatus,
  pollRelayStatusEndpoint,
  resolveRelayStatusRequestId,
  mapRemoveOwnerSubmissionError,
} from '@/lib/removeOwner/removeOwnerHelpers'
import type { OwnerMutationRelayFlow } from '@/lib/relay/ownerMutationTypes'

describe('removeOwner relay status helpers', () => {
  it('prefers orderId for status polling when both ids are present', () => {
    const relay = {
      requestId: '0x1111111111111111111111111111111111111111111111111111111111111111',
      orderId: '0x2222222222222222222222222222222222222222222222222222222222222222',
    } as Pick<OwnerMutationRelayFlow, 'orderId' | 'requestId'>

    expect(resolveRelayStatusRequestId(relay)).toBe(relay.orderId)
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
