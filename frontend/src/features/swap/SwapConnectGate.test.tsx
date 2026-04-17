// @vitest-environment happy-dom

// The production SwapConnectGate component still lives under
// src/components/swap/ — only the test file has moved to respect the
// features-first test-placement policy.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// The shared Button wraps `@coinbase/cds-web/buttons`, whose ESM entry pulls
// in modules that do not resolve under Vitest's happy-dom runner. The gate is
// agnostic to the underlying button implementation, so a minimal mock keeps
// this test focused on gate behavior and isolated from CDS packaging.
vi.mock('@/components/ui/Button', () => ({
  Button: ({
    children,
    loading,
    disabled,
    onClick,
    ...rest
  }: {
    children?: React.ReactNode
    loading?: boolean
    disabled?: boolean
    onClick?: () => void
  } & Record<string, unknown>) => (
    <button type="button" disabled={disabled || loading} onClick={onClick} data-testid="gate-cta" {...rest}>
      {children}
    </button>
  ),
}))

import { deriveSwapConnectGate } from '@/lib/swap/connectGate'

import { SwapConnectGate } from '@/components/swap/SwapConnectGate'

describe('SwapConnectGate', () => {
  it('renders a spinner (no CTA) in the hydrating state', () => {
    const gate = deriveSwapConnectGate({
      sessionHydrated: false,
      hasSession: false,
      executionAddress: null,
    })

    render(<SwapConnectGate gate={gate} busy={false} onPrimaryAction={() => {}} />)

    expect(screen.getByText('Restoring your 4626 session')).toBeTruthy()
    expect(screen.getByRole('status', { name: /restoring session/i })).toBeTruthy()
    expect(screen.queryByTestId('gate-cta')).toBeNull()
  })

  it('shows the signed-out CTA and fires onPrimaryAction when clicked', () => {
    const gate = deriveSwapConnectGate({
      sessionHydrated: true,
      hasSession: false,
      executionAddress: null,
    })
    const onPrimaryAction = vi.fn()

    render(<SwapConnectGate gate={gate} busy={false} onPrimaryAction={onPrimaryAction} />)

    const button = screen.getByTestId('gate-cta')
    expect(button.textContent).toContain('Sign in to 4626')
    fireEvent.click(button)

    expect(onPrimaryAction).toHaveBeenCalledTimes(1)
  })

  it('renders the wallet-required CTA copy and the passed error message', () => {
    const gate = deriveSwapConnectGate({
      sessionHydrated: true,
      hasSession: true,
      executionAddress: null,
    })

    render(
      <SwapConnectGate
        gate={gate}
        busy={false}
        errorMessage="Connect wallet first, then sign in."
        onPrimaryAction={() => {}}
      />,
    )

    expect(screen.getByRole('heading', { name: /connect a wallet to swap/i })).toBeTruthy()
    expect(screen.getByTestId('gate-cta').textContent).toContain('Connect wallet')
    expect(screen.getByRole('alert').textContent).toContain('Connect wallet first, then sign in.')
  })

  it('exposes the gate state as a data attribute for test/debug hooks', () => {
    const gate = deriveSwapConnectGate({
      sessionHydrated: true,
      hasSession: true,
      executionAddress: null,
      authBusy: true,
    })

    const { container } = render(
      <SwapConnectGate gate={gate} busy onPrimaryAction={() => {}} />,
    )

    const root = container.querySelector('[data-swap-gate]')
    expect(root?.getAttribute('data-swap-gate')).toBe('signing-in')
    expect(screen.getByRole('status', { name: /signing in/i })).toBeTruthy()
    expect(screen.queryByTestId('gate-cta')).toBeNull()
  })
})
