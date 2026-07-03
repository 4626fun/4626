// @vitest-environment happy-dom

import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

let mockPrivyClientStatus: 'disabled' | 'loading' | 'ready' = 'disabled'
let capturedPrivyProps: { mode?: string; showWalletLoginFirst?: boolean } = {}

vi.mock('@/lib/privy/client', () => ({
  PrivyClientProvider: ({
    children,
    mode,
    showWalletLoginFirst,
  }: {
    children: ReactNode
    mode?: string
    showWalletLoginFirst?: boolean
  }) => {
    capturedPrivyProps = { mode, showWalletLoginFirst }
    return <>{children}</>
  },
  usePrivyClientStatus: () => mockPrivyClientStatus,
}))

vi.mock('@/features/waitlist/WaitlistReturningWalletSignInRunner', () => ({
  WaitlistReturningWalletSignInRunner: () => <div data-testid="wallet-signin-runner" />,
}))

vi.mock('@/components/layout/AppLoadingOverlay', () => ({
  AppLoadingRegistrar: () => null,
}))

vi.mock('@/components/seo/PageMeta', () => ({
  PageMeta: () => null,
  META: { waitlist: { title: 'Waitlist', description: 'Join' } },
}))

vi.mock('@/features/waitlist/WaitlistFlow', () => ({
  WaitlistFlow: (props: {
    onRequestWalletSignIn?: () => void
    walletSignInPending?: boolean
  }) => (
    <div data-testid="waitlist-flow-mock">
      waitlist flow mounted
      {props.walletSignInPending ? <span data-testid="wallet-signin-pending">pending</span> : null}
      <button type="button" onClick={() => props.onRequestWalletSignIn?.()}>
        trigger wallet sign-in
      </button>
    </div>
  ),
}))

import { Waitlist } from './Waitlist'

describe('Waitlist', () => {
  beforeEach(() => {
    mockPrivyClientStatus = 'disabled'
    capturedPrivyProps = {}
  })

  it('still mounts the waitlist flow when Privy client is disabled', async () => {
    render(<Waitlist />)

    expect(await screen.findByTestId('waitlist-flow-mock')).toBeTruthy()
    expect(capturedPrivyProps.mode).toBe('waitlist-email-only')
    expect(capturedPrivyProps.showWalletLoginFirst).toBe(false)
  })

  it('switches the shared Privy provider into wallet mode when returning wallet sign-in is requested', async () => {
    render(<Waitlist />)

    fireEvent.click(screen.getByRole('button', { name: 'trigger wallet sign-in' }))

    expect(await screen.findByTestId('wallet-signin-pending')).toBeTruthy()
    expect(await screen.findByTestId('wallet-signin-runner')).toBeTruthy()
    expect(capturedPrivyProps.mode).toBe('waitlist-returning-wallet')
    expect(capturedPrivyProps.showWalletLoginFirst).toBe(true)
  })
})
