// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Capture mocked hook state that tests can mutate between renders
type SiweMock = {
  authAddress: string | null
  sessionHydrated: boolean
  busy: boolean
}
let siweMock: SiweMock = { authAddress: null, sessionHydrated: false, busy: false }
let accountMock = { address: null as string | null, isConnected: false }
let apiFetchMock = vi.fn()

vi.mock('wagmi', () => ({
  useAccount: () => accountMock,
}))

vi.mock('@/hooks/useSiweAuth', () => ({
  useSiweAuth: () => siweMock,
}))

vi.mock('@/hooks/useAdminStatus', () => ({
  useAdminStatusFromSession: () => ({ isAdmin: false, isLoading: false }),
}))

vi.mock('@/hooks/useTelegramMiniAppEntryStatus', () => ({
  useTelegramMiniAppEntryStatus: () => 'blocked' as const,
}))

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

vi.mock('@/lib/env/host', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env/host')>('@/lib/env/host')
  return {
    ...actual,
    APP_ORIGIN: 'https://app.4626.fun',
    MARKETING_ORIGIN: 'https://4626.fun',
    getHostMode: () => 'app' as const,
    getMarketingBaseUrl: () => 'https://4626.fun',
  }
})

vi.mock('@/components/layout/AppLoadingState', () => ({
  AppLoadingState: () => <div data-testid="loading-state">loading</div>,
}))

import { AccessStateProvider, RequireAccepted } from './accessRuntime'
import { useAccessContext } from './accessShared'

function AccessProbe() {
  const s = useAccessContext()
  return <div data-testid="probe" data-loading={String(s.loading)} data-accepted={String(s.accepted)} data-session={String(s.sessionValid)} />
}

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
    },
  })
}

function ProtectedChild() {
  return <div data-testid="protected-swap">swap</div>
}

describe('useResolvedAccessState — waitlist → swap bounce race', () => {
  beforeEach(() => {
    siweMock = { authAddress: null, sessionHydrated: false, busy: false }
    accountMock = { address: null, isConnected: false }
    apiFetchMock = vi.fn()
    window.history.replaceState({}, '', 'http://localhost:3000/swap')
  })

  it('does not redirect to the marketing waitlist between session hydration and the first waitlist/me result', async () => {
    // Arrange: waitlist/me has not yet resolved
    let resolveFetch: (value: unknown) => void = () => {}
    const pending = new Promise<unknown>((r) => (resolveFetch = r))
    apiFetchMock.mockImplementation(() => pending)

    const replaceSpy = vi.spyOn(window.location, 'replace').mockImplementation(() => {})

    // Start with a hydrated session whose acceptance status is unknown
    siweMock = {
      authAddress: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      sessionHydrated: true,
      busy: false,
    }

    const client = createClient()
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/swap']}>
          <AccessStateProvider>
            <RequireAccepted>
              <ProtectedChild />
            </RequireAccepted>
          </AccessStateProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // While the query is in-flight, the guard must show loading — NOT redirect.
    // Regression: previously the first render after `hasSession` flipped could
    // produce `acceptedStateQuery.isLoading === false` while `data === undefined`,
    // so the guard declared `loading=false`, `accepted=false`, and redirected to
    // the marketing waitlist before the query had a chance to fetch.
    await waitFor(() => expect(screen.getByTestId('loading-state')).toBeTruthy())
    expect(replaceSpy).not.toHaveBeenCalled()
    expect(screen.queryByTestId('protected-swap')).toBeNull()

    // Resolve the query with "approved"
    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({ success: true, data: { appAccessStatus: 'approved' } }),
      })
      await pending
    })

    await waitFor(() => expect(screen.getByTestId('protected-swap')).toBeTruthy())
    expect(replaceSpy).not.toHaveBeenCalled()
    replaceSpy.mockRestore()
  })

  it('keeps loading=true while waitlist/me data is undefined even if react-query reports isLoading=false', async () => {
    // This directly exercises the post-fix invariant: access state MUST stay
    // loading whenever hasSession && data === undefined, regardless of the
    // transient value of react-query's isLoading flag.
    let resolveFetch: (value: unknown) => void = () => {}
    const pending = new Promise<unknown>((r) => (resolveFetch = r))
    apiFetchMock.mockImplementation(() => pending)

    siweMock = {
      authAddress: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      sessionHydrated: true,
      busy: false,
    }

    const client = createClient()
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/swap']}>
          <AccessStateProvider>
            <AccessProbe />
          </AccessStateProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const probe = await screen.findByTestId('probe')
    expect(probe.getAttribute('data-session')).toBe('true')
    expect(probe.getAttribute('data-loading')).toBe('true')
    expect(probe.getAttribute('data-accepted')).toBe('false')

    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ success: true, data: { appAccessStatus: 'approved' } }) })
      await pending
    })

    await waitFor(() => expect(probe.getAttribute('data-accepted')).toBe('true'))
    expect(probe.getAttribute('data-loading')).toBe('false')
  })

  it('redirects to the marketing waitlist when the query resolves as not-approved', async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { appAccessStatus: 'pending' } }),
    })

    const replaceSpy = vi.spyOn(window.location, 'replace').mockImplementation(() => {})

    siweMock = {
      authAddress: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      sessionHydrated: true,
      busy: false,
    }

    const client = createClient()
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/swap']}>
          <AccessStateProvider>
            <RequireAccepted>
              <ProtectedChild />
            </RequireAccepted>
          </AccessStateProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(replaceSpy).toHaveBeenCalled())
    expect(replaceSpy.mock.calls[0]?.[0]).toMatch(/^https:\/\/4626\.fun\/waitlist/)
    replaceSpy.mockRestore()
  })

  it('shows loading (not bounce) while the session hydrates', async () => {
    // During the initial handoff redeem, sessionHydrated briefly flips between
    // false → true. While it is false the guard must show loading, not redirect.
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { appAccessStatus: 'approved' } }),
    })

    const replaceSpy = vi.spyOn(window.location, 'replace').mockImplementation(() => {})

    siweMock = { authAddress: null, sessionHydrated: false, busy: false }

    const client = createClient()
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/swap']}>
          <AccessStateProvider>
            <AccessProbe />
            <RequireAccepted>
              <ProtectedChild />
            </RequireAccepted>
          </AccessStateProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const probe = await screen.findByTestId('probe')
    expect(probe.getAttribute('data-loading')).toBe('true')
    expect(replaceSpy).not.toHaveBeenCalled()
    expect(screen.queryByTestId('protected-swap')).toBeNull()
    replaceSpy.mockRestore()
  })
})
