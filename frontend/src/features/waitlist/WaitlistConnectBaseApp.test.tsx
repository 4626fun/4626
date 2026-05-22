// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { WaitlistConnectBaseApp } from './WaitlistConnectBaseApp'

const PARENT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SUB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const EMBED = '0xcccccccccccccccccccccccccccccccccccccccc'

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

vi.mock('@/lib/privy/client', () => ({
  usePrivyClientStatus: () => 'ready',
}))

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

vi.mock('./SubAccountOwnerInstallPanel', () => ({
  SubAccountOwnerInstallPanel: () => null,
}))

const registerMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/wallet/subAccountBaseAppRegister', () => ({
  registerBaseAppSubAccountLink: (...args: unknown[]) => registerMock(...args),
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
    provider: { request: vi.fn() },
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
    registerMock.mockReset()
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

  it('single-step flow: connect wallet, provision, finalize signer, owner install, then register', async () => {
    mockProvision(true)
    registerMock.mockResolvedValueOnce({ ok: true, message: '' })

    const onComplete = vi.fn()
    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={onComplete} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })

    expect(hookState.connectWallet).toHaveBeenCalled()
    await waitFor(() =>
      expect(hookState.finalize).toHaveBeenCalledWith({
        parentAddress: PARENT,
        subAccountAddress: SUB,
      }),
    )
    await waitFor(() =>
      expect(hookState.confirmOwner).toHaveBeenCalledWith({
        parentAddress: PARENT,
        subAccountAddress: SUB,
        provider: expect.objectContaining({ request: expect.any(Function) }),
      }),
    )
    await waitFor(() => expect(registerMock).toHaveBeenCalled())
    await waitFor(
      () =>
        expect(onComplete).toHaveBeenCalledWith({
          parentAddress: PARENT,
          subAccountAddress: SUB,
        }),
      { timeout: 3000 },
    )
  })

  it('completes when optional owner install fails after signer link succeeds', async () => {
    mockProvision(true)
    hookState.confirmOwner.mockResolvedValueOnce(null)
    registerMock.mockResolvedValueOnce({ ok: true, message: '' })

    const onComplete = vi.fn()
    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={onComplete} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })

    await waitFor(() => expect(hookState.finalize).toHaveBeenCalled())
    await waitFor(() => expect(registerMock).toHaveBeenCalled())
    await waitFor(
      () =>
        expect(onComplete).toHaveBeenCalledWith({
          parentAddress: PARENT,
          subAccountAddress: SUB,
        }),
      { timeout: 3000 },
    )
    expect(screen.queryByTestId('waitlist-connect-base-app-error')).toBeNull()
  })

  it('surfaces user-rejection copy when provisioning fails', async () => {
    hookState.provision.mockResolvedValueOnce(null)
    hookState.getLastSetupError.mockReturnValue(new Error('User rejected the request'))

    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })
    await waitFor(() => expect(screen.getByTestId('waitlist-connect-base-app-error')).toBeTruthy())
    expect(screen.getByText(/you declined the base app request/i)).toBeTruthy()
  })

  it('generic server error allows retry', async () => {
    mockProvision(false)
    registerMock.mockResolvedValueOnce({ ok: false, message: 'unexpected_error', errorCode: 'unexpected_error' })

    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })
    await waitFor(() => expect(screen.queryByTestId('waitlist-connect-base-app-error')).toBeTruthy())
    expect(screen.getByText(/could not save your base app link/i)).toBeTruthy()

    mockProvision(false)
    registerMock.mockResolvedValueOnce({ ok: true, message: '' })
    await act(async () => {
      fireEvent.click(screen.getByTestId('retry-base-app-button'))
    })
    await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(2))
  })
})
