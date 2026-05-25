import { afterEach, describe, expect, it, vi } from 'vitest'

import { notifyRelaySolverDeposit } from './notifyRelaySolverDeposit.js'

describe('notifyRelaySolverDeposit', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.RELAY_API_KEY
  })

  it('indexes depository depositNative without transactions/single', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/transactions/index')) {
        return new Response(JSON.stringify({ message: 'Success' }), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)
    process.env.RELAY_API_KEY = 'test-relay-key'

    const orderId = '0x' + '22'.repeat(32)
    const requestId = '0x' + '11'.repeat(32)
    const result = await notifyRelaySolverDeposit({
      chainId: 8453,
      depositTxHash: '0x' + 'aa'.repeat(32),
      indexRequestIds: [orderId, requestId],
      userCall: {
        to: '0x4cd00e387622c35bddb9b4c962c136462338bc31',
        data: '0x49290c1c' + '00'.repeat(32),
        value: '0x10',
      },
      referrer: '4626-add-owner',
    })

    expect(result.indexed).toBe(true)
    expect(result.sameChainSingle).toBe(false)
    expect(result.warnings).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const indexCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/transactions/index'))
    expect(indexCalls).toHaveLength(2)
    expect(JSON.parse(String((indexCalls[0][1] as RequestInit).body)).requestId).toBe(orderId)
    expect(JSON.parse(String((indexCalls[1][1] as RequestInit).body)).requestId).toBe(requestId)
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/transactions/single'))).toBe(false)
  })

  it('posts transactions/single for router multicall same-chain deposits', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/transactions/index') || url.endsWith('/transactions/single')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)
    process.env.RELAY_API_KEY = 'test-relay-key'

    const requestId = '0x' + '22'.repeat(32)
    const result = await notifyRelaySolverDeposit({
      chainId: 8453,
      depositTxHash: '0x' + '11'.repeat(32),
      indexRequestIds: [requestId],
      userCall: {
        to: '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f',
        data: '0xcd6e13f7' + '00'.repeat(32),
        value: '0x10',
      },
      referrer: '4626-add-owner',
    })

    expect(result.indexed).toBe(true)
    expect(result.sameChainSingle).toBe(true)
    expect(result.warnings).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns warnings but does not throw when upstream notify fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'bad request' }), { status: 400 })),
    )

    const result = await notifyRelaySolverDeposit({
      chainId: 8453,
      depositTxHash: '0x' + 'aa'.repeat(32),
      indexRequestIds: ['0x' + 'bb'.repeat(32)],
      userCall: {
        to: '0x4cd00e387622c35bddb9b4c962c136462338bc31',
        data: '0x49290c1c' + '00'.repeat(32),
        value: '1000',
      },
    })

    expect(result.indexed).toBe(false)
    expect(result.sameChainSingle).toBe(false)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})
