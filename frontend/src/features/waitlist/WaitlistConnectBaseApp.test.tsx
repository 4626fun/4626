// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { WaitlistConnectBaseApp } from './WaitlistConnectBaseApp'

const PARENT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SUB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const EMBED = '0xcccccccccccccccccccccccccccccccccccccccc'

const hookState = {
  setup: vi.fn(),
  isSettingUp: false,
  lastStage: null as
    | null
    | { stage: 'check_existing' | 'create_sub_account' | 'configure_signer' | 'done'; status: string },
  embeddedAddress: EMBED as string,
}

vi.mock('@/hooks/useSubAccountSetup', () => ({
  useSubAccountSetup: () => ({
    setupSubAccount: hookState.setup,
    isSettingUp: hookState.isSettingUp,
    lastStage: hookState.lastStage,
    embeddedWallet: hookState.embeddedAddress ? { address: hookState.embeddedAddress } : null,
    subAccountAddress: null,
    parentAddress: null,
    error: null,
    created: false,
    canSetup: true,
    baseAccountWallet: null,
  }),
}))

vi.mock('@/components/ui/PixelWaveLoader', () => ({
  PixelWaveLoader: () => <span data-testid="pixel-loader" />,
}))

const fetchMock = vi.fn()
vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: (...args: unknown[]) => fetchMock(...args),
}))

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

describe('WaitlistConnectBaseApp', () => {
  beforeEach(() => {
    hookState.setup.mockReset()
    hookState.isSettingUp = false
    hookState.lastStage = null
    hookState.embeddedAddress = EMBED
    fetchMock.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders idle copy with Connect and Skip controls', () => {
    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    expect(screen.getByTestId('connect-base-app-button')).toBeTruthy()
    expect(screen.getByTestId('skip-base-app-button')).toBeTruthy()
  })

  it('Skip invokes onSkip immediately', () => {
    const onSkip = vi.fn()
    render(<WaitlistConnectBaseApp onSkip={onSkip} onComplete={() => {}} />)
    fireEvent.click(screen.getByTestId('skip-base-app-button'))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('Connect runs setupSubAccount + POSTs to /api/arch-b/sub-account/baseapp/register and lands in complete', async () => {
    hookState.setup.mockResolvedValueOnce({
      parentAddress: PARENT,
      subAccountAddress: SUB,
      created: true,
    })
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: { profileId: 'p1', parentAddress: PARENT, subAccountAddress: SUB },
      }),
    )

    const onComplete = vi.fn()
    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={onComplete} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const firstCall = fetchMock.mock.calls[0] ?? []
    const path = firstCall[0]
    const init = (firstCall[1] ?? {}) as RequestInit
    expect(path).toBe('/api/arch-b/sub-account/baseapp/register')
    expect(init.method).toBe('POST')
    const body = JSON.parse((init.body as string) || '{}')
    expect(body).toEqual({ parentAddress: PARENT, subAccountAddress: SUB, embeddedEoaAddress: EMBED })

    await waitFor(() => expect(screen.queryByTestId('waitlist-connect-base-app-complete')).toBeTruthy())
    expect(screen.getByTestId('basescan-link').getAttribute('href')).toContain(SUB)
  })

  it('orchestrator rejection surfaces error with retry control', async () => {
    hookState.setup.mockRejectedValueOnce(new Error('passkey cancelled'))
    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })
    await waitFor(() => expect(screen.queryByTestId('waitlist-connect-base-app-error')).toBeTruthy())
    expect(screen.getByTestId('retry-base-app-button')).toBeTruthy()
    expect(screen.getByText(/passkey cancelled/i)).toBeTruthy()
  })

  it('orchestrator returning null surfaces a generic retryable error', async () => {
    hookState.setup.mockResolvedValueOnce(null)
    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })
    await waitFor(() => expect(screen.queryByTestId('waitlist-connect-base-app-error')).toBeTruthy())
    expect(screen.getByTestId('retry-base-app-button')).toBeTruthy()
  })

  it('embedded_eoa_mismatch shows non-retryable friendly message', async () => {
    hookState.setup.mockResolvedValueOnce({
      parentAddress: PARENT,
      subAccountAddress: SUB,
      created: false,
    })
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { success: false, error: 'embedded_eoa_mismatch' }))

    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })
    await waitFor(() => expect(screen.queryByTestId('waitlist-connect-base-app-error')).toBeTruthy())
    expect(screen.getByText(/different 4626 account/i)).toBeTruthy()
    expect(screen.queryByTestId('retry-base-app-button')).toBeNull()
  })

  it('parent_csw_conflict shows non-retryable contact-support copy', async () => {
    hookState.setup.mockResolvedValueOnce({
      parentAddress: PARENT,
      subAccountAddress: SUB,
      created: false,
    })
    fetchMock.mockResolvedValueOnce(jsonResponse(409, { success: false, error: 'parent_csw_conflict' }))

    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })
    await waitFor(() => expect(screen.queryByTestId('waitlist-connect-base-app-error')).toBeTruthy())
    expect(screen.getByText(/already linked to a different Base App wallet/i)).toBeTruthy()
    expect(screen.queryByTestId('retry-base-app-button')).toBeNull()
  })

  it('feature_disabled auto-skips after a brief notice', async () => {
    hookState.setup.mockResolvedValueOnce({
      parentAddress: PARENT,
      subAccountAddress: SUB,
      created: false,
    })
    fetchMock.mockResolvedValueOnce(jsonResponse(503, { success: false, error: 'feature_disabled' }))

    const onSkip = vi.fn()
    render(<WaitlistConnectBaseApp onSkip={onSkip} onComplete={() => {}} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })
    await waitFor(() => expect(screen.queryByTestId('waitlist-connect-base-app-error')).toBeTruthy())
    expect(screen.getByText(/feature is not yet enabled/i)).toBeTruthy()
    await waitFor(() => expect(onSkip).toHaveBeenCalled(), { timeout: 2_000 })
  })

  it('generic server error allows retry', async () => {
    hookState.setup.mockResolvedValue({
      parentAddress: PARENT,
      subAccountAddress: SUB,
      created: false,
    })
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { success: false, error: 'unexpected_error' }))

    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })
    await waitFor(() => expect(screen.queryByTestId('waitlist-connect-base-app-error')).toBeTruthy())
    expect(screen.getByTestId('retry-base-app-button')).toBeTruthy()

    // Retry path: a second call should re-invoke setupSubAccount + fetch.
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { success: true, data: { profileId: 'p1', parentAddress: PARENT, subAccountAddress: SUB } }),
    )
    await act(async () => {
      fireEvent.click(screen.getByTestId('retry-base-app-button'))
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('success path eventually invokes onComplete with the (parent, sub-account) pair', async () => {
    hookState.setup.mockResolvedValueOnce({
      parentAddress: PARENT,
      subAccountAddress: SUB,
      created: true,
    })
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: { profileId: 'p1', parentAddress: PARENT, subAccountAddress: SUB },
      }),
    )

    const onComplete = vi.fn()
    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={onComplete} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })
    await waitFor(() => expect(screen.queryByTestId('waitlist-connect-base-app-complete')).toBeTruthy())
    await waitFor(
      () => expect(onComplete).toHaveBeenCalledWith({ parentAddress: PARENT, subAccountAddress: SUB }),
      { timeout: 3_000 },
    )
  })

  it('missing embedded EOA surfaces a retryable error and does not POST', async () => {
    hookState.embeddedAddress = ''
    hookState.setup.mockResolvedValueOnce({
      parentAddress: PARENT,
      subAccountAddress: SUB,
      created: false,
    })
    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })
    await waitFor(() => expect(screen.queryByTestId('waitlist-connect-base-app-error')).toBeTruthy())
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
