// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { WaitlistConnectBaseApp } from './WaitlistConnectBaseApp'

const PARENT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SUB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const EMBED = '0xcccccccccccccccccccccccccccccccccccccccc'

const hookState = {
  provision: vi.fn(),
  installOwnerOnly: vi.fn(),
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
    installSubAccountOwnerOnly: hookState.installOwnerOnly,
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
  SubAccountOwnerInstallPanel: () => null,
}))

function mockProvision(created = true) {
  hookState.provision.mockResolvedValueOnce({
    parentAddress: PARENT,
    subAccountAddress: SUB,
    created,
    provider: { request: vi.fn() },
  })
}

function mockOwnerInstallSuccess() {
  hookState.installOwnerOnly.mockResolvedValueOnce({
    registered: true,
    alreadyOwner: false,
    onChainOwnerInstalled: true,
    onChainOwnerWarning: null,
    transactionHash: null,
  })
}

describe('WaitlistConnectBaseApp', () => {
  beforeEach(() => {
    hookState.provision.mockReset()
    hookState.installOwnerOnly.mockReset()
    hookState.connectWallet.mockReset()
    hookState.getLastSetupError.mockReset()
    hookState.isSettingUp = false
    hookState.lastStage = null
    hookState.embeddedAddress = EMBED
    hookState.connectWallet.mockResolvedValue(true)
    hookState.getLastSetupError.mockReturnValue(null)
    mockOwnerInstallSuccess()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders idle copy with Connect and Skip controls', () => {
    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    expect(screen.getByTestId('connect-base-app-button')).toBeTruthy()
    expect(screen.getByTestId('skip-base-app-button')).toBeTruthy()
  })

  it('connect flow provisions the app wallet then runs the shared owner-install lane', async () => {
    mockProvision(true)

    const onComplete = vi.fn()
    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={onComplete} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })

    expect(hookState.connectWallet).toHaveBeenCalled()
    await waitFor(() =>
      expect(hookState.installOwnerOnly).toHaveBeenCalledWith({
        parentAddress: PARENT,
        subAccountAddress: SUB,
      }),
    )
    await waitFor(
      () =>
        expect(onComplete).toHaveBeenCalledWith({
          parentAddress: PARENT,
          subAccountAddress: SUB,
        }),
      { timeout: 3000 },
    )
  })

  it('surfaces owner-install failure instead of completing when on-chain owner is missing', async () => {
    mockProvision(true)
    hookState.installOwnerOnly.mockReset()
    hookState.installOwnerOnly.mockResolvedValueOnce({
      registered: true,
      alreadyOwner: false,
      onChainOwnerInstalled: false,
      onChainOwnerWarning: 'Smart wallet signature validation failed during sponsorship (AA23).',
      transactionHash: null,
    })

    const onComplete = vi.fn()
    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={onComplete} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })

    await waitFor(() => expect(screen.getByTestId('waitlist-connect-base-app-error')).toBeTruthy())
    expect(onComplete).not.toHaveBeenCalled()
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

  it('allows retry after owner-install lane failure', async () => {
    mockProvision(true)
    hookState.installOwnerOnly.mockReset()
    hookState.installOwnerOnly
      .mockResolvedValueOnce({
        registered: true,
        alreadyOwner: false,
        onChainOwnerInstalled: false,
        onChainOwnerWarning: 'Could not save your Base App signing link.',
        transactionHash: null,
      })
      .mockResolvedValueOnce({
        registered: true,
        alreadyOwner: false,
        onChainOwnerInstalled: true,
        onChainOwnerWarning: null,
        transactionHash: null,
      })

    render(<WaitlistConnectBaseApp onSkip={() => {}} onComplete={() => {}} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('connect-base-app-button'))
    })
    await waitFor(() => expect(screen.getByTestId('waitlist-connect-base-app-error')).toBeTruthy())

    mockProvision(true)
    await act(async () => {
      fireEvent.click(screen.getByTestId('retry-base-app-button'))
    })
    await waitFor(() => expect(hookState.installOwnerOnly).toHaveBeenCalledTimes(2))
  })
})
