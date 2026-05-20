// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { getAddress } from 'viem'

import { SubAccountOwnerInstallPanel } from './SubAccountOwnerInstallPanel'

const PARENT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SUB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const EMBED = '0xcccccccccccccccccccccccccccccccccccccccc'

const installOwnerOnly = vi.fn()

vi.mock('@/lib/flags/featureFlags', () => ({
  waitlistSubAccountFlowFlag: () => true,
}))

vi.mock('@/lib/wallet/subAccountOwnerInstall', () => ({
  readEmbeddedOwnerOnSubAccount: vi.fn(),
}))

vi.mock('@/hooks/useSubAccountSetup', () => ({
  useSubAccountSetup: () => ({
    installSubAccountOwnerOnly: installOwnerOnly,
    embeddedWallet: { address: EMBED },
    isSettingUp: false,
    getLastSetupError: () => null,
    lastStage: null,
  }),
}))

vi.mock('@/components/ui/PixelWaveLoader', () => ({
  PixelWaveLoader: () => <span data-testid="loader" />,
}))

import { readEmbeddedOwnerOnSubAccount } from '@/lib/wallet/subAccountOwnerInstall'

describe('SubAccountOwnerInstallPanel', () => {
  beforeEach(() => {
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
