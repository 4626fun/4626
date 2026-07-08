// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { WaitlistReturningWalletSignIn } from './WaitlistReturningWalletSignIn'

describe('WaitlistReturningWalletSignIn', () => {
  it('renders returning-user copy and triggers sign-in on click', () => {
    const onSignIn = vi.fn()
    render(<WaitlistReturningWalletSignIn busy={false} onSignIn={onSignIn} />)

    expect(screen.getByText('Already joined?')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sign in with linked wallet/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Sign in with linked wallet/i }))
    expect(onSignIn).toHaveBeenCalledTimes(1)
  })

  it('shows loading state and triggers cancel while busy', () => {
    const onSignIn = vi.fn()
    const onCancel = vi.fn()
    render(<WaitlistReturningWalletSignIn busy onSignIn={onSignIn} onCancel={onCancel} />)

    expect(screen.getByText(/Connecting wallet/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Sign in with linked wallet/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onSignIn).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
