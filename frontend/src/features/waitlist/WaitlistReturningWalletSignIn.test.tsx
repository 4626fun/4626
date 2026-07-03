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

  it('shows loading state and disables the button while busy', () => {
    const onSignIn = vi.fn()
    const onCancel = vi.fn()
    render(<WaitlistReturningWalletSignIn busy onSignIn={onSignIn} onCancel={onCancel} />)

    const button = screen.getByRole('button', { name: /Connecting wallet/i })
    expect(button).toHaveProperty('disabled', true)

    fireEvent.click(button)
    expect(onSignIn).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Cancel wallet sign-in/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
