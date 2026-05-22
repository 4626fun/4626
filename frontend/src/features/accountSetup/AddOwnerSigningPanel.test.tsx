// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { AddOwnerSigningPanel } from '@/features/accountSetup/AddOwnerSigningPanel'

const mockFetchPreview = vi.fn()
const mockHandleAdd = vi.fn()

vi.mock('@/features/accountSetup/addOwner/useAddOwnerFlow', () => ({
  useAddOwnerFlow: () => ({
    preview: null,
    previewLoading: false,
    busy: false,
    pageError: null,
    pageNotice: null,
    txHash: null,
    eventLog: [],
    lastErrorDetail: null,
    isSelfAuthSession: true,
    fetchPreview: mockFetchPreview,
    handleAdd: mockHandleAdd,
  }),
}))

function buildController(overrides: Record<string, unknown> = {}) {
  return {
    activeExternalOwnerWallet: null,
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
    loadMe: vi.fn(),
    needsBaseAccountReconnect: false,
    onchainEoaOwnerCandidates: [],
    ownerSignerAddress: null,
    privyWallets: [
      {
        address: '0x2f4ec723ff6add6ab81b7befbec04ce31151613f',
        walletClientType: 'privy',
      },
    ],
    refreshCswOwners: vi.fn(),
    requiresBaseAppForOwnerInstall: true,
    ...overrides,
  }
}

describe('AddOwnerSigningPanel', () => {
  it('renders connect-owner CTA when no owner wallet is connected', () => {
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
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /Connect CSW owner wallet/i })).toBeTruthy()
    expect(screen.getByText(/Owner install runs on/i)).toBeTruthy()
  })

  it('steers passkey-only CSWs to Base App setup when not in self-auth', () => {
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
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/passkey-controlled/i)).toBeTruthy()
    expect(screen.getByText(/Base App setup/i)).toBeTruthy()
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
        />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('add-owner-signing-complete')).toBeTruthy()
  })

  it('links to /add-owner when a valid signer session is connected', () => {
    render(
      <MemoryRouter>
        <AddOwnerSigningPanel
          controller={
            buildController({
              ownerSignerAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
              requiresBaseAppForOwnerInstall: false,
              connectedSignerLabel: '0x4beab…704ef',
            }) as any
          }
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /Continue on \/add-owner/i }).getAttribute('href')).toBe('/add-owner')
  })

  it('renders inline Relay step 1 when inlineRelay is enabled and self-auth is ready', () => {
    render(
      <MemoryRouter>
        <AddOwnerSigningPanel
          inlineRelay
          controller={
            buildController({
              ownerSignerAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
              requiresBaseAppForOwnerInstall: true,
              connectedSignerLabel: '0x4beab…704ef',
            }) as any
          }
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Step 1 of 2/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Build Relay preview/i })).toBeTruthy()
    expect(screen.queryByText(/passkey-controlled/i)).toBeNull()
  })
})
