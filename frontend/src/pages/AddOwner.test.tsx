// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

let mockController: Record<string, unknown> = {}

vi.mock('@/features/accountSetup/useAccountSetupController', () => ({
  useAccountSetupController: () => mockController,
}))

vi.mock('@/components/seo/PageMeta', () => ({
  PageMeta: ({ title }: { title: string }) => <div data-testid="page-meta">{title}</div>,
}))

import { AddOwnerPage } from './AddOwner'

function renderPage() {
  render(
    <MemoryRouter>
      <AddOwnerPage />
    </MemoryRouter>,
  )
}

describe('AddOwnerPage', () => {
  it('prompts unauthenticated users to sign in', () => {
    mockController = {
      advancedBusy: false,
      canonicalCswAddress: null,
      cswOwnersState: { status: 'idle', owners: [], error: null },
      error: null,
      loading: false,
      notice: null,
      onEnable4626Signing: vi.fn(),
      onResetOwnerApproval: vi.fn(),
      privyAuthed: false,
      privyWallets: [],
      login: vi.fn(),
    }
    renderPage()
    expect(screen.getByText(/Sign in to install/i)).toBeTruthy()
  })

  it('shows the install button when authenticated and the privy EOA is not yet an owner', () => {
    mockController = {
      advancedBusy: false,
      canonicalCswAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
      cswOwnersState: {
        status: 'ready',
        owners: [
          {
            index: 0,
            isAddressOwner: false,
            ownerAddress: null,
          },
          {
            index: 1,
            isAddressOwner: true,
            ownerAddress: '0x5e1a0afa913ad95aa3762b18ea9add73d31313cf',
          },
        ],
        error: null,
      },
      error: null,
      loading: false,
      notice: null,
      onEnable4626Signing: vi.fn(),
      onResetOwnerApproval: vi.fn(),
      privyAuthed: true,
      privyWallets: [
        {
          address: '0x2f4ec723ff6add6ab81b7befbec04ce31151613f',
          walletClientType: 'privy',
        },
      ],
      login: vi.fn(),
    }
    renderPage()
    const button = screen.getByRole('button', { name: /Install signing key/i })
    expect(button).toBeTruthy()
    expect((button as HTMLButtonElement).disabled).toBe(false)
  })

  it('detects already-installed when privy wallet uses a non-standard embedded variant (e.g. privy-v2)', () => {
    mockController = {
      advancedBusy: false,
      canonicalCswAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
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
      error: null,
      loading: false,
      notice: null,
      onEnable4626Signing: vi.fn(),
      onResetOwnerApproval: vi.fn(),
      privyAuthed: true,
      privyWallets: [
        {
          address: '0x2f4ec723ff6add6ab81b7befbec04ce31151613f',
          walletClientType: 'privy-v2',
        },
      ],
      login: vi.fn(),
    }
    renderPage()
    expect(screen.getByText(/Signing key is already installed/i)).toBeTruthy()
    const button = screen.getByRole('button', { name: /Already installed/i })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables the install button when the privy EOA is already an owner', () => {
    mockController = {
      advancedBusy: false,
      canonicalCswAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
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
      error: null,
      loading: false,
      notice: null,
      onEnable4626Signing: vi.fn(),
      onResetOwnerApproval: vi.fn(),
      privyAuthed: true,
      privyWallets: [
        {
          address: '0x2f4ec723ff6add6ab81b7befbec04ce31151613f',
          walletClientType: 'privy',
        },
      ],
      login: vi.fn(),
    }
    renderPage()
    expect(screen.getByText(/Signing key is already installed/i)).toBeTruthy()
    const button = screen.getByRole('button', { name: /Already installed/i })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })
})
