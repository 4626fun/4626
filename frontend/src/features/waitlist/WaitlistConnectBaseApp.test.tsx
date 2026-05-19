// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { WaitlistConnectBaseApp } from './WaitlistConnectBaseApp'

const PARENT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SUB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const EMBED = '0xcccccccccccccccccccccccccccccccccccccccc'
const PROVIDER = { request: vi.fn() }

const hookState = {
  provision: vi.fn(),
  confirmOwner: vi.fn(),
  finalize: vi.fn(),
  connectWallet: vi.fn(),
  getLastSetupError: vi.fn(),
  isSettingUp: false,
  lastStage: null as null | { stage: string; status: string; message?: string },
  embeddedAddress: EMBED as string,
}

vi.mock('@/hooks/useSubAccountSetup', () => ({
  useSubAccountSetup: () => ({
    provisionSubAccount: hookState.provision,
    confirmSubAccountEmbeddedOwner: hookState.confirmOwner,
    finalizeSubAccountSigner: hookState.finalize,
    connectBaseAccountWallet: hookState.connectWallet,
    getLastSetupError: hookState.getLastSetupError,
    setupSubAccount: vi.fn(),
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

function mockProvision(created = true) {
  hookState.provision.mockResolvedValueOnce({
    parentAddress: PARENT,
    subAccountAddress: SUB,
    created,
    provider: PROVIDER,
  })
}

describe('WaitlistConnectBaseApp', () => {
  beforeEach(() => {
    hookState.provision.mockReset()
    hookState.confirmOwner.mockReset()
    hookState.finalize.mockReset()
    hookState.connectWallet.mockReset()
    hookState.getLastSetupError.mockReset()
    hookState.isSettingUp = false
    hookState.lastStage = null
    hookState.embeddedAddress = EMBED
    fetchMock.mockReset()
    hookState.connectWallet.mockResolvedValue(true)
    hookState.getLastSetupError.mockReturnValue(null)
    hookState.confirmOwner.mockResolvedValue({ alreadyOwner: false, transactionHash: null })
    hookState.finalize.mockResolvedValue(true)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders idle copy with Connect and Skip controls', () => {
    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    expect(screen.getByTestId('connect-base-app-button')).toBeTruthy()
    expect(screen.getByTestId('skip-base-app-button')).toBeTruthy()
  })

  it('two-step flow: connect wallet, provision, enable signing, then register', async () => {
    mockProvision(true)
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
    expect(hookState.connectWallet).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByTestId('waitlist-connect-base-app-ready')).toBeTruthy())

    await act(async () => {
      fireEvent.click(screen.getByTestId('enable-signing-button'))
    })

    await waitFor(() => expect(hookState.confirmOwner).toHaveBeenCalledWith({
      parentAddress: PARENT,
      subAccountAddress: SUB,
      provider: PROVIDER,
    }))
    expect(hookState.finalize).toHaveBeenCalledWith({
      parentAddress: PARENT,
      subAccountAddress: SUB,
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(
      () =>
        expect(onComplete).toHaveBeenCalledWith({
          parentAddress: PARENT,
          subAccountAddress: SUB,
        }),
      { timeout: 3000 },
    )
  })

  it('surfaces user-rejection copy when enable signing fails', async () => {
    mockProvision(true)
    hookState.confirmOwner.mockResolvedValueOnce(null)
    hookState.getLastSetupError.mockReturnValue(new Error('User rejected the request'))

    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })
    await waitFor(() => expect(screen.getByTestId('enable-signing-button')).toBeTruthy())
    await act(async () => {
      fireEvent.click(screen.getByTestId('enable-signing-button'))
    })
    await waitFor(() => expect(screen.getByTestId('waitlist-connect-base-app-error')).toBeTruthy())
    expect(screen.getByText(/you declined the base app request/i)).toBeTruthy()
  })

  it('generic server error allows retry from sign step', async () => {
    mockProvision(false)
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { success: false, error: 'unexpected_error' }))

    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })
    await waitFor(() => expect(screen.getByTestId('enable-signing-button')).toBeTruthy())
    await act(async () => {
      fireEvent.click(screen.getByTestId('enable-signing-button'))
    })
    await waitFor(() => expect(screen.queryByTestId('waitlist-connect-base-app-error')).toBeTruthy())
    expect(screen.getByText(/could not save your base app link/i)).toBeTruthy()

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { success: true, data: { profileId: 'p1', parentAddress: PARENT, subAccountAddress: SUB } }),
    )
    await act(async () => {
      fireEvent.click(screen.getByTestId('retry-base-app-button'))
    })
    await waitFor(() => expect(screen.getByTestId('enable-signing-button')).toBeTruthy())
  })
})
