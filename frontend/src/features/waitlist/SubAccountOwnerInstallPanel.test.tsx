// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { getAddress } from 'viem'

import { SubAccountOwnerInstallPanel } from './SubAccountOwnerInstallPanel'
import {
  SUB_ACCOUNT_BASE_APP_APPROVAL_FAILED_MESSAGE,
  SUB_ACCOUNT_WRONG_BROWSER_MESSAGE,
} from './subAccountOwnerInstallMessages'

const PARENT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SUB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const EMBED = '0xcccccccccccccccccccccccccccccccccccccccc'

const installOwnerOnly = vi.fn()
const getLastSetupError = vi.fn<() => Error | null>(() => null)
const detectInAppEnvironment = vi.fn()

vi.mock('@/lib/flags/featureFlags', () => ({
  waitlistSubAccountFlowFlag: () => true,
}))

vi.mock('@/lib/privy/client', () => ({
  usePrivyClientStatus: () => 'ready',
}))

vi.mock('@/lib/wallet/inAppBrowser', () => ({
  detectInAppEnvironment: (...args: unknown[]) => detectInAppEnvironment(...args),
}))

vi.mock('@/lib/wallet/subAccountOwnerInstall', () => ({
  readEmbeddedOwnerOnSubAccount: vi.fn(),
}))

vi.mock('@/hooks/useSubAccountSetup', () => ({
  useSubAccountSetup: () => ({
    installSubAccountOwnerOnly: installOwnerOnly,
    embeddedWallet: { address: EMBED },
    isSettingUp: false,
    getLastSetupError,
    lastStage: null,
  }),
}))

vi.mock('@/components/ui/PixelWaveLoader', () => ({
  PixelWaveLoader: () => <span data-testid="loader" />,
}))

import { readEmbeddedOwnerOnSubAccount } from '@/lib/wallet/subAccountOwnerInstall'

function mockBaseAppHost() {
  detectInAppEnvironment.mockReturnValue({
    hasInjectedEthereum: true,
    isCoinbaseInApp: false,
    isBaseAppInApp: true,
    isAnyWalletInApp: true,
    userAgent: 'baseapp-test',
  })
}

function mockExternalBrowserHost() {
  detectInAppEnvironment.mockReturnValue({
    hasInjectedEthereum: true,
    isCoinbaseInApp: false,
    isBaseAppInApp: false,
    isAnyWalletInApp: false,
    userAgent: 'chrome-test',
  })
}

describe('SubAccountOwnerInstallPanel', () => {
  beforeEach(() => {
    mockBaseAppHost()
    getLastSetupError.mockReturnValue(null)
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockReset()
    installOwnerOnly.mockReset()
    installOwnerOnly.mockResolvedValue({ alreadyOwner: false, transactionHash: null })
  })

  it('shows the owner-install button when embedded EOA is not yet owner', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(false)

    render(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    expect(await screen.findByTestId('sub-account-owner-install-button')).toBeTruthy()
  })

  it('runs owner install when the button is clicked', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(false)

    render(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    const button = await screen.findByTestId('sub-account-owner-install-button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(installOwnerOnly).toHaveBeenCalledWith({
        parentAddress: getAddress(PARENT),
        subAccountAddress: getAddress(SUB),
      })
    })
  })

  it('shows Base App open CTA and desktop recovery outside Base App', async () => {
    mockExternalBrowserHost()
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(false)

    render(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    expect(await screen.findByText(SUB_ACCOUNT_WRONG_BROWSER_MESSAGE)).toBeTruthy()
    expect(screen.getByTestId('sub-account-open-base-app-button')).toBeTruthy()
    expect(screen.getByText(/Desktop \/ MetaMask path/i)).toBeTruthy()
    expect(screen.queryByTestId('sub-account-owner-install-button')).toBeNull()
  })

  it('surfaces in-app approval failure copy and recovery steps inside Base App', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(false)
    installOwnerOnly.mockResolvedValue(null)
    getLastSetupError.mockReturnValue(
      new Error('requested method and/or account has not been authorized by the user'),
    )

    render(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    fireEvent.click(await screen.findByTestId('sub-account-owner-install-button'))

    await waitFor(() => {
      expect(screen.getByText(SUB_ACCOUNT_BASE_APP_APPROVAL_FAILED_MESSAGE)).toBeTruthy()
      expect(screen.getByTestId('sub-account-owner-install-recovery')).toBeTruthy()
      expect(screen.getByText(/Confirm Base App is on/i)).toBeTruthy()
    })
  })

  it('hides the button when embedded EOA is already owner', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(true)

    render(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    expect(await screen.findByText(/4626 signing is enabled/i)).toBeTruthy()
    expect(screen.queryByTestId('sub-account-owner-install-button')).toBeNull()
  })

  it('keeps install actionable when owner read is unknown/null', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(null)

    render(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    expect(await screen.findByTestId('sub-account-owner-install-button')).toBeTruthy()
    expect(screen.queryByText(/Could not verify signing status/i)).toBeNull()
  })
})
