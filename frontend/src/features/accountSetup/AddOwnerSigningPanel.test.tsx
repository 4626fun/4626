// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { AddOwnerSigningPanel } from '@/features/accountSetup/AddOwnerSigningPanel'

function buildController(overrides: Record<string, unknown> = {}) {
  return {
    advancedBusy: false,
    busyProvider: null,
    canonicalCswAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
    connectOwnerWallet: vi.fn(),
    connectedOnchainEoaOwner: null,
    connectedOwnerReady: false,
    connectedSignerLabel: 'No wallet connected',
    cswOwnersState: {
      status: 'ready',
      owners: [
        {
          index: 1,
          isAddressOwner: true,
          ownerAddress: '0x5e1a0afa913ad95aa3762b18ea9add73d31313cf',
        },
      ],
      error: null,
    },
    error: null,
    loadMe: vi.fn(),
    needsBaseAccountReconnect: false,
    onchainEoaOwnerCandidates: [],
    onEnable4626Signing: vi.fn(),
    onResetOwnerApproval: vi.fn(),
    ownerSignerAddress: null,
    privyWallets: [
      {
        address: '0x2f4ec723ff6add6ab81b7befbec04ce31151613f',
        walletClientType: 'privy',
      },
    ],
    requiresBaseAppForOwnerInstall: true,
    activeExternalOwnerWallet: null,
    ...overrides,
  }
}

vi.mock('wagmi', () => ({
  useWalletClient: () => ({ data: null }),
}))

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    getAccessToken: vi.fn().mockResolvedValue('test-token'),
  }),
}))

vi.mock('@/features/accountSetup/addOwner/useAddOwnerRelayFlow', () => ({
  useAddOwnerRelayFlow: () => ({
    preview: null,
    previewLoading: false,
    busy: false,
    error: null,
    notice: null,
    txHash: null,
    loadPreview: vi.fn(),
    executeRelayInstall: vi.fn(),
    relayReady: false,
  }),
}))

describe('AddOwnerSigningPanel', () => {
  it('renders connect-owner CTA in waitlist variant when no owner wallet is connected', () => {
    render(
      <MemoryRouter>
        <AddOwnerSigningPanel
          controller={
            buildController({
              requiresBaseAppForOwnerInstall: false,
              onchainEoaOwnerCandidates: [
                {
                  index: 1,
                  ownerAddress: '0x5e1a0afa913ad95aa3762b18ea9add73d31313cf',
                },
              ],
            }) as any
          }
          variant="waitlist"
        />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('add-owner-signing-primary').textContent).toContain('Connect CSW owner wallet')
  })

  it('steers passkey-only CSWs to Base App setup instead of connect-owner CTA', () => {
    render(
      <MemoryRouter>
        <AddOwnerSigningPanel
          controller={
            buildController({
              cswOwnersState: {
                status: 'ready',
                owners: [{ index: 0, isAddressOwner: false, ownerAddress: null }],
                error: null,
              },
              onchainEoaOwnerCandidates: [],
              requiresBaseAppForOwnerInstall: true,
            }) as any
          }
          variant="waitlist"
        />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('add-owner-signing-primary').textContent).toContain('Open Base App setup')
    expect(screen.getByText(/passkey-controlled/i)).toBeTruthy()
  })

  it('shows completion state when privy embedded EOA is already an owner', () => {
    render(
      <MemoryRouter>
        <AddOwnerSigningPanel
          controller={
            buildController({
              cswOwnersState: {
                status: 'ready',
                owners: [
                  {
                    index: 3,
                    isAddressOwner: true,
                    ownerAddress: '0x2f4ec723ff6add6ab81b7befbec04ce31151613f',
                  },
                ],
                error: null,
              },
            }) as any
          }
          variant="waitlist"
        />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('add-owner-signing-complete')).toBeTruthy()
  })
})
