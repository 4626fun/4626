// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

let mockController: Record<string, unknown> = {}

vi.mock('wagmi', () => ({
  useWalletClient: () => ({ data: null }),
  usePublicClient: () => undefined,
}))

vi.mock('@/features/accountSetup/useAccountSetupController', () => ({
  useAccountSetupController: () => mockController,
}))

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
    isSelfAuthSession: false,
    signingReady: true,
    signingBlockedReason: null,
    fetchPreview: vi.fn(),
    handleAdd: vi.fn(),
  }),
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
      canonicalCswAddress: null,
      loading: false,
      privyAuthed: false,
      login: vi.fn(),
      loadMe: vi.fn(),
      ownerSignerAddress: null,
      activeExternalOwnerWallet: null,
      privyWallets: [],
      connectOwnerWallet: vi.fn(),
    }
    renderPage()
    expect(screen.getByText(/Sign in to install/i)).toBeTruthy()
  })

  it('shows Relay action panel when authenticated with a canonical CSW', () => {
    mockController = {
      canonicalCswAddress: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
      loading: false,
      privyAuthed: true,
      login: vi.fn(),
      loadMe: vi.fn(),
      ownerSignerAddress: '0x5e1a0afa913ad95aa3762b18ea9add73d31313cf',
      activeExternalOwnerWallet: null,
      privyWallets: [
        {
          address: '0x2f4ec723ff6add6ab81b7befbec04ce31151613f',
          walletClientType: 'privy',
        },
      ],
      connectOwnerWallet: vi.fn(),
    }
    renderPage()
    expect(screen.getByText(/Step 1 of 2/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Build Relay preview/i })).toBeTruthy()
  })

  it('prompts to link CSW when authenticated but no canonical wallet', () => {
    mockController = {
      canonicalCswAddress: null,
      loading: false,
      privyAuthed: true,
      login: vi.fn(),
      loadMe: vi.fn(),
      ownerSignerAddress: null,
      activeExternalOwnerWallet: null,
      privyWallets: [],
      connectOwnerWallet: vi.fn(),
    }
    renderPage()
    expect(screen.getByText(/No canonical Coinbase Smart Wallet is linked yet/i)).toBeTruthy()
  })
})
