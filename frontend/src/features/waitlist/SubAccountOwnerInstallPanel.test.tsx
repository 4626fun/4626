// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { getAddress } from 'viem'

import { SubAccountOwnerInstallPanel } from './SubAccountOwnerInstallPanel'
import {
  SUB_ACCOUNT_BASE_APP_APPROVAL_FAILED_MESSAGE,
  SUB_ACCOUNT_SIGNER_LINKED_ONCHAIN_OWNER_OPTIONAL_MESSAGE,
  SUB_ACCOUNT_WRONG_BROWSER_MESSAGE,
} from './subAccountOwnerInstallMessages'

const PARENT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SUB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const EMBED = '0xcccccccccccccccccccccccccccccccccccccccc'

const installOwnerOnly = vi.fn()
const getLastSetupError = vi.fn<() => Error | null>(() => null)
const isBaseAppInAppContext = vi.fn()

vi.mock('@/lib/flags/featureFlags', () => ({
  waitlistSubAccountFlowFlag: () => true,
}))

vi.mock('@/lib/privy/client', () => ({
  usePrivyClientStatus: () => 'ready',
}))

vi.mock('@/lib/wallet/inAppBrowser', () => ({
  isBaseAppInAppContext: (...args: unknown[]) => isBaseAppInAppContext(...args),
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
  isBaseAppInAppContext.mockReturnValue(true)
}

function mockExternalBrowserHost() {
  isBaseAppInAppContext.mockReturnValue(false)
}

function renderPanel(ui: Parameters<typeof render>[0]) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('SubAccountOwnerInstallPanel', () => {
  beforeEach(() => {
    mockBaseAppHost()
    getLastSetupError.mockReturnValue(null)
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockReset()
    installOwnerOnly.mockReset()
    installOwnerOnly.mockResolvedValue({
      registered: true,
      alreadyOwner: false,
      transactionHash: null,
      onChainOwnerInstalled: true,
      onChainOwnerWarning: null,
    })
  })

  it('shows the owner-install button when embedded EOA is not yet owner', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(false)

    renderPanel(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    expect(await screen.findByTestId('sub-account-owner-install-button')).toBeTruthy()
  })

  it('runs owner install when the button is clicked', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(false)

    renderPanel(
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

    renderPanel(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    expect(await screen.findByText(SUB_ACCOUNT_WRONG_BROWSER_MESSAGE)).toBeTruthy()
    expect(screen.getByTestId('sub-account-copy-base-app-link-button')).toBeTruthy()
    expect(screen.getByText(/Desktop \/ MetaMask path/i)).toBeTruthy()
    expect(screen.queryByTestId('sub-account-owner-install-button')).toBeNull()
  })

  it('surfaces in-app approval failure copy and recovery steps inside Base App', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(false)
    installOwnerOnly.mockResolvedValue(null)
    getLastSetupError.mockReturnValue(
      new Error('requested method and/or account has not been authorized by the user'),
    )

    renderPanel(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    fireEvent.click(await screen.findByTestId('sub-account-owner-install-button'))

    await waitFor(() => {
      expect(screen.getByText(SUB_ACCOUNT_BASE_APP_APPROVAL_FAILED_MESSAGE)).toBeTruthy()
      expect(screen.getByTestId('sub-account-owner-install-recovery')).toBeTruthy()
      expect(screen.getByText(/Confirm Base App is on/i)).toBeTruthy()
    })
  })

  it('shows soft optional copy when register succeeds but optional addOwner fails', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(false)
    installOwnerOnly.mockResolvedValue({
      registered: true,
      alreadyOwner: false,
      transactionHash: null,
      onChainOwnerInstalled: false,
      onChainOwnerWarning: 'requested method and/or account has not been authorized by the user',
    })

    renderPanel(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    fireEvent.click(await screen.findByTestId('sub-account-owner-install-button'))

    await waitFor(() => {
      expect(screen.getByText(/4626 signing is enabled/i)).toBeTruthy()
      expect(screen.getByText(SUB_ACCOUNT_SIGNER_LINKED_ONCHAIN_OWNER_OPTIONAL_MESSAGE)).toBeTruthy()
    })
    expect(screen.queryByText(SUB_ACCOUNT_BASE_APP_APPROVAL_FAILED_MESSAGE)).toBeNull()
    expect(screen.queryByTestId('sub-account-owner-install-recovery')).toBeNull()
  })

  it('hides the button when embedded EOA is already owner', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(true)

    renderPanel(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    expect(await screen.findByText(/4626 signing is enabled/i)).toBeTruthy()
    expect(screen.queryByTestId('sub-account-owner-install-button')).toBeNull()
  })

  it('keeps install actionable when owner read is unknown/null', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(null)

    renderPanel(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    expect(await screen.findByTestId('sub-account-owner-install-button')).toBeTruthy()
    expect(screen.queryByText(/Could not verify signing status/i)).toBeNull()
  })
})
