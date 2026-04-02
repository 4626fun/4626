import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fetchZoraCoin,
  fetchZoraExplore,
  fetchZoraProfile,
  fetchZoraProfileCoins,
  getZoraClientTelemetrySnapshot,
  resetZoraClientDebugState,
} from './client'

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('zora client request dedupe', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetZoraClientDebugState()
    vi.unstubAllGlobals()
  })

  it('dedupes concurrent profile fetches for mixed-case address identifiers', async () => {
    const fetchMock = vi.fn(async () =>
      okJson({
        success: true,
        data: { handle: 'akita' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const upper = '0xAbCdEfabcdefABCDEFabcdefabcdefABCDEF1234'
    const lower = upper.toLowerCase()

    const [a, b] = await Promise.all([fetchZoraProfile(upper), fetchZoraProfile(lower)])

    expect(a).toEqual({ handle: 'akita' })
    expect(b).toEqual({ handle: 'akita' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const firstUrl = (fetchMock.mock.calls as unknown[][])[0]?.[0]
    expect(String(firstUrl ?? '')).toContain(encodeURIComponent(lower))
  })

  it('dedupes concurrent coin fetches for mixed-case addresses', async () => {
    const fetchMock = vi.fn(async () =>
      okJson({
        success: true,
        data: { address: '0xcoin' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const upper = '0xAbCdEfabcdefABCDEFabcdefabcdefABCDEF1234'
    const lower = upper.toLowerCase() as `0x${string}`

    const [a, b] = await Promise.all([fetchZoraCoin(upper as `0x${string}`), fetchZoraCoin(lower)])

    expect(a).toEqual({ address: '0xcoin' })
    expect(b).toEqual({ address: '0xcoin' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const firstUrl = (fetchMock.mock.calls as unknown[][])[0]?.[0]
    expect(String(firstUrl ?? '')).toContain(`address=${encodeURIComponent(lower)}`)
  })

  it('dedupes concurrent profile-coins fetches for same identifier params', async () => {
    const fetchMock = vi.fn(async () =>
      okJson({
        success: true,
        data: { profile: { handle: 'akita' } },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const identifier = '0xAbCdEfabcdefABCDEFabcdefabcdefABCDEF5555'
    const expectedIdentifier = identifier.toLowerCase()
    const params = { identifier, count: 12, after: 'cursor-1' }

    const [a, b] = await Promise.all([fetchZoraProfileCoins(params), fetchZoraProfileCoins(params)])

    expect(a).toEqual({ profile: { handle: 'akita' } })
    expect(b).toEqual({ profile: { handle: 'akita' } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const firstUrl = (fetchMock.mock.calls as unknown[][])[0]?.[0]
    const firstUrlText = String(firstUrl ?? '')
    expect(firstUrlText).toContain('/api/zora/profileCoins?')
    expect(firstUrlText).toContain(`identifier=${encodeURIComponent(expectedIdentifier)}`)
    expect(firstUrlText).toContain('count=12')
    expect(firstUrlText).toContain('after=cursor-1')
  })

  it('dedupes concurrent explore fetches for same list params', async () => {
    const fetchMock = vi.fn(async () =>
      okJson({
        success: true,
        data: { items: [{ id: 'coin-1' }] },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const params = { list: 'TOP_GAINERS' as const, count: 8, after: 'cursor-2' }

    const [a, b] = await Promise.all([fetchZoraExplore(params), fetchZoraExplore(params)])

    expect(a).toEqual({ items: [{ id: 'coin-1' }] })
    expect(b).toEqual({ items: [{ id: 'coin-1' }] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const firstUrl = (fetchMock.mock.calls as unknown[][])[0]?.[0]
    const firstUrlText = String(firstUrl ?? '')
    expect(firstUrlText).toContain('/api/zora/explore?')
    expect(firstUrlText).toContain('list=TOP_GAINERS')
    expect(firstUrlText).toContain('count=8')
    expect(firstUrlText).toContain('after=cursor-2')
  })

  it('tracks telemetry for upstream and cache hits', async () => {
    const fetchMock = vi.fn(async () =>
      okJson({
        success: true,
        data: { handle: 'akita' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const identifier = '0xAbCdEfabcdefABCDEFabcdefabcdefABCDEF9999'
    const first = await fetchZoraProfile(identifier)
    const second = await fetchZoraProfile(identifier)

    expect(first).toEqual({ handle: 'akita' })
    expect(second).toEqual({ handle: 'akita' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const snapshot = getZoraClientTelemetrySnapshot()
    expect(snapshot.profile.requests).toBe(2)
    expect(snapshot.profile.upstreamCalls).toBe(1)
    expect(snapshot.profile.cacheHits).toBe(1)
    expect(snapshot.profile.inFlightHits).toBe(0)
    expect(snapshot.profile.successes).toBe(1)
    expect(snapshot.profile.errors).toBe(0)
  })

  it('tracks telemetry for in-flight dedupe hits', async () => {
    const fetchMock = vi.fn(async () =>
      okJson({
        success: true,
        data: { handle: 'akita' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const identifier = '0xAbCdEfabcdefABCDEFabcdefabcdefABCDEF8888'
    const [a, b] = await Promise.all([fetchZoraProfile(identifier), fetchZoraProfile(identifier)])

    expect(a).toEqual({ handle: 'akita' })
    expect(b).toEqual({ handle: 'akita' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const snapshot = getZoraClientTelemetrySnapshot()
    expect(snapshot.profile.requests).toBe(2)
    expect(snapshot.profile.upstreamCalls).toBe(1)
    expect(snapshot.profile.inFlightHits).toBe(1)
    expect(snapshot.profile.cacheHits).toBe(0)
    expect(snapshot.profile.successes).toBe(1)
    expect(snapshot.profile.errors).toBe(0)
  })

  it('exposes and removes window debug handle based on telemetry flag', async () => {
    let telemetryEnabled = true
    const fakeWindow = {
      localStorage: {
        getItem: vi.fn((key: string) => (key === 'cv:debug:zora-client-telemetry' ? (telemetryEnabled ? 'true' : 'false') : null)),
      },
    }
    vi.stubGlobal('window', fakeWindow)

    const fetchMock = vi.fn(async () =>
      okJson({
        success: true,
        data: { handle: 'akita' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const firstIdentifier = '0xAbCdEfabcdefABCDEFabcdefabcdefABCDEF7777'
    await fetchZoraProfile(firstIdentifier)

    const firstHandle = (fakeWindow as { __cvZoraClientTelemetry?: unknown }).__cvZoraClientTelemetry
    expect(firstHandle).toBeDefined()

    telemetryEnabled = false
    const secondIdentifier = '0xAbCdEfabcdefABCDEFabcdefabcdefABCDEF6666'
    await fetchZoraProfile(secondIdentifier)

    const secondHandle = (fakeWindow as { __cvZoraClientTelemetry?: unknown }).__cvZoraClientTelemetry
    expect(secondHandle).toBeUndefined()
  })
})
