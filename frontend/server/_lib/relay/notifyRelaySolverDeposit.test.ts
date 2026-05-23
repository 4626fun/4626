import { afterEach, describe, expect, it, vi } from 'vitest'

import { notifyRelaySolverDeposit } from './notifyRelaySolverDeposit.js'

describe('notifyRelaySolverDeposit', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.RELAY_API_KEY
  })

  it('posts transactions/index and transactions/single for same-chain deposits', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/transactions/index') || url.endsWith('/transactions/single')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)
    process.env.RELAY_API_KEY = 'test-relay-key'

    const result = await notifyRelaySolverDeposit({
      chainId: 8453,
      depositTxHash: '0x' + '11'.repeat(32),
      requestId: '0x' + '22'.repeat(32),
      userCall: {
        to: '0x4cd00e387622c35bddb9b4c962c136462338bc31',
        data: '0x49290c1c' + '00'.repeat(32),
        value: '0x10',
      },
      referrer: '4626-add-owner',
    })

    expect(result.indexed).toBe(true)
    expect(result.sameChainSingle).toBe(true)
    expect(result.warnings).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const indexCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/transactions/index'))
    expect(indexCall).toBeTruthy()
    const indexInit = indexCall![1] as RequestInit
    expect(indexInit.headers).toMatchObject({
      'x-api-key': 'test-relay-key',
      'relay-sdk-version': '5.2.7',
    })
    expect(JSON.parse(String(indexInit.body))).toEqual({
      txHash: '0x' + '11'.repeat(32),
      chainId: '8453',
      referrer: '4626-add-owner',
    })

    const singleCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/transactions/single'))
    expect(singleCall).toBeTruthy()
    const singleBody = JSON.parse(String((singleCall![1] as RequestInit).body))
    expect(singleBody.requestId).toBe('0x' + '22'.repeat(32))
    expect(singleBody.chainId).toBe('8453')
    const txPayload = JSON.parse(singleBody.tx)
    expect(txPayload.txHash).toBe('0x' + '11'.repeat(32))
    expect(txPayload.value).toBe('16')
  })

  it('returns warnings but does not throw when upstream notify fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'bad request' }), { status: 400 })),
    )

    const result = await notifyRelaySolverDeposit({
      chainId: 8453,
      depositTxHash: '0x' + 'aa'.repeat(32),
      requestId: '0x' + 'bb'.repeat(32),
      userCall: {
        to: '0x4cd00e387622c35bddb9b4c962c136462338bc31',
        data: '0x49290c1c' + '00'.repeat(32),
        value: '1000',
      },
    })

    expect(result.indexed).toBe(false)
    expect(result.sameChainSingle).toBe(false)
    expect(result.warnings.length).toBe(2)
  })
})
