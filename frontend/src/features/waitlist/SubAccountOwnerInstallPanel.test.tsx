// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { getAddress } from 'viem'

import { SubAccountOwnerInstallPanel } from './SubAccountOwnerInstallPanel'
import {
  SUB_ACCOUNT_SIGNER_LINKED_ONCHAIN_OWNER_PENDING_MESSAGE,
  SUB_ACCOUNT_WRONG_BROWSER_MESSAGE,
} from './subAccountOwnerInstallMessages'

const PARENT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SUB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const EMBED = '0xcccccccccccccccccccccccccccccccccccccccc'

const fetchPreview = vi.fn()
const handleAdd = vi.fn()
const isBaseAppInAppContext = vi.fn()
const useAddOwnerFlowMock = vi.fn()

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

vi.mock('@/features/accountSetup/addOwner/useAddOwnerFlow', () => ({
  useAddOwnerFlow: (...args: unknown[]) => {
    useAddOwnerFlowMock(...args)
    return {
      preview: null,
      previewLoading: false,
      busy: false,
      pageError: null,
      pageNotice: null,
      txHash: null,
      eventLog: [],
      lastErrorDetail: null,
      isSelfAuthSession: true,
      fetchPreview,
      handleAdd,
    }
  },
}))

vi.mock('@/hooks/useSubAccountSetup', () => ({
  useSubAccountSetup: () => ({
    embeddedWallet: { address: EMBED },
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
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockReset()
    fetchPreview.mockReset()
    handleAdd.mockReset()
    useAddOwnerFlowMock.mockReset()
    handleAdd.mockResolvedValue(true)
  })

  it('wires parent-funded Relay add-owner for the sub-account CSW', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(false)

    renderPanel(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    await screen.findByText('Build Relay preview')

    expect(useAddOwnerFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalCswAddress: getAddress(PARENT),
        targetCswAddress: getAddress(SUB),
        relayFundingCswAddress: getAddress(PARENT),
        ownerSignerAddress: getAddress(PARENT),
      }),
    )
  })

  it('shows Relay build preview when embedded EOA is not yet owner', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(false)

    renderPanel(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    expect(await screen.findByText('Build Relay preview')).toBeTruthy()
  })

  it('builds Relay preview when the button is clicked', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(false)

    renderPanel(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    fireEvent.click(await screen.findByText('Build Relay preview'))

    await waitFor(() => {
      expect(fetchPreview).toHaveBeenCalled()
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
    expect(screen.queryByText('Build Relay preview')).toBeNull()
  })

  it('shows pending Base App setup when server link exists outside Base App without on-chain owner', async () => {
    mockExternalBrowserHost()
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(false)

    renderPanel(
      <SubAccountOwnerInstallPanel
        parentAddress={PARENT}
        subAccountAddress={SUB}
        embeddedEoaAddress={EMBED}
        linkRegistered
      />,
    )

    expect(await screen.findByTestId('sub-account-owner-install-pending')).toBeTruthy()
    expect(screen.getByText(SUB_ACCOUNT_SIGNER_LINKED_ONCHAIN_OWNER_PENDING_MESSAGE)).toBeTruthy()
    expect(screen.queryByText(/4626 signing is enabled/i)).toBeNull()
  })

  it('hides the relay panel when embedded EOA is already owner', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(true)

    renderPanel(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    expect(await screen.findByText(/4626 signing is enabled/i)).toBeTruthy()
    expect(screen.queryByText('Build Relay preview')).toBeNull()
  })

  it('keeps install actionable when owner read is unknown/null', async () => {
    vi.mocked(readEmbeddedOwnerOnSubAccount).mockResolvedValue(null)

    renderPanel(
      <SubAccountOwnerInstallPanel parentAddress={PARENT} subAccountAddress={SUB} embeddedEoaAddress={EMBED} />,
    )

    expect(await screen.findByText('Build Relay preview')).toBeTruthy()
    expect(screen.queryByText(/Could not verify signing status/i)).toBeNull()
  })
})
