// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { WaitlistConnectBaseApp } from './WaitlistConnectBaseApp'

const PARENT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SUB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const EMBED = '0xcccccccccccccccccccccccccccccccccccccccc'

const hookState = {
  provision: vi.fn(),
  linkSubAccount: vi.fn(),
  connectWallet: vi.fn(),
  getLastSetupError: vi.fn(),
  isSettingUp: false,
  lastStage: null as null | { stage: string; status: string; message?: string },
  embeddedAddress: EMBED as string,
  relayInstallSuccess: vi.fn(),
}

vi.mock('@/lib/privy/client', () => ({
  usePrivyClientStatus: () => 'ready',
}))

vi.mock('@/hooks/useSubAccountSetup', () => ({
  useSubAccountSetup: () => ({
    provisionSubAccount: hookState.provision,
    linkSubAccountWithoutOwnerInstall: hookState.linkSubAccount,
    connectBaseAccountWallet: hookState.connectWallet,
    getLastSetupError: hookState.getLastSetupError,
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
  SubAccountOwnerInstallPanel: (props: { onSuccess?: () => void }) => (
    <button type="button" data-testid="mock-relay-owner-install" onClick={() => props.onSuccess?.()}>
      Finish Relay signing
    </button>
  ),
}))

function mockProvision(created = true) {
  hookState.provision.mockResolvedValueOnce({
    parentAddress: PARENT,
    subAccountAddress: SUB,
    created,
    provider: { request: vi.fn() },
  })
}

function mockLinkSuccess() {
  hookState.linkSubAccount.mockResolvedValueOnce({ ok: true, message: null })
}

describe('WaitlistConnectBaseApp', () => {
  beforeEach(() => {
    hookState.provision.mockReset()
    hookState.linkSubAccount.mockReset()
    hookState.connectWallet.mockReset()
    hookState.getLastSetupError.mockReset()
    hookState.isSettingUp = false
    hookState.lastStage = null
    hookState.embeddedAddress = EMBED
    hookState.connectWallet.mockResolvedValue(true)
    hookState.getLastSetupError.mockReturnValue(null)
    mockLinkSuccess()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders idle copy with Connect and Skip controls', () => {
    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    expect(screen.getByTestId('connect-base-app-button')).toBeTruthy()
    expect(screen.getByTestId('skip-base-app-button')).toBeTruthy()
  })

  it('connect flow provisions the app wallet then opens Relay owner install', async () => {
    mockProvision(true)

    const onComplete = vi.fn()
    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={onComplete} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })

    expect(hookState.connectWallet).toHaveBeenCalled()
    await waitFor(() =>
      expect(hookState.linkSubAccount).toHaveBeenCalledWith({
        parentAddress: PARENT,
        subAccountAddress: SUB,
      }),
    )
    expect(await screen.findByTestId('waitlist-connect-base-app-relay-install')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-relay-owner-install'))
    })

    await waitFor(
      () =>
        expect(onComplete).toHaveBeenCalledWith({
          parentAddress: PARENT,
          subAccountAddress: SUB,
        }),
      { timeout: 3000 },
    )
  })

  it('surfaces link registration failure instead of opening Relay install', async () => {
    mockProvision(true)
    hookState.linkSubAccount.mockReset()
    hookState.linkSubAccount.mockResolvedValueOnce({
      ok: false,
      message: 'Could not save your Base App signing link.',
    })

    const onComplete = vi.fn()
    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={onComplete} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })

    await waitFor(() => expect(screen.getByTestId('waitlist-connect-base-app-error')).toBeTruthy())
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.queryByTestId('waitlist-connect-base-app-relay-install')).toBeNull()
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

  it('allows retry after link registration failure', async () => {
    mockProvision(true)
    hookState.linkSubAccount.mockReset()
    hookState.linkSubAccount
      .mockResolvedValueOnce({
        ok: false,
        message: 'Could not save your Base App signing link.',
      })
      .mockResolvedValueOnce({ ok: true, message: null })

    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })
    await waitFor(() => expect(screen.getByTestId('waitlist-connect-base-app-error')).toBeTruthy())

    mockProvision(true)
    await act(async () => {
      fireEvent.click(screen.getByTestId('retry-base-app-button'))
    })
    await waitFor(() => expect(hookState.linkSubAccount).toHaveBeenCalledTimes(2))
    expect(await screen.findByTestId('waitlist-connect-base-app-relay-install')).toBeTruthy()
  })
})
