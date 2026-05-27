// @vitest-environment happy-dom
/**
 * Tests for ArchBRevokeControl component.
 *
 * Regression coverage for Codex PR #295 review:
 *   - P1: success toast only fires when disable() returns { ok: true }
 *   - P2: control stays rendered in 'error' status so the user retains a retry path
 *
 * Additional coverage:
 *   - hidden on non-eligible statuses
 *   - visible with "Enabled" badge on 'provisioned'
 *   - visible with "Revoke failed" badge + retry copy on 'error'
 *   - confirmation modal opens + cancel works
 *   - toast.error fires with the failure message
 *   - modal stays open on failed revoke so user can retry
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ArchBActionResult,
  ArchBDelegationStatus,
  UseArchBDelegationReturn,
} from './useArchBDelegation'
import { ArchBRevokeControl } from './ArchBRevokeControl'

// ── Mock toast ────────────────────────────────────────────────────────────────

const mockToastSuccess = vi.fn<(msg: string) => void>()
const mockToastError = vi.fn<(msg: string) => void>()

vi.mock('@/components/ui/Toast', () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
}))

// ── Mock UI primitives ────────────────────────────────────────────────────────

vi.mock('@/components/ui/Button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    loading,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    loading?: boolean
  }) => (
    <button type="button" onClick={onClick} disabled={disabled ?? loading}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({
    children,
    variant,
  }: {
    children: React.ReactNode
    variant?: string
  }) => <span data-badge-variant={variant}>{children}</span>,
}))

vi.mock('@/components/ui/Modal', () => ({
  Modal: ({
    open,
    children,
    title,
  }: {
    open: boolean
    children: React.ReactNode
    title: string
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}))

// ── Mock useArchBDelegation ───────────────────────────────────────────────────

const mockDisable = vi.fn<() => Promise<ArchBActionResult>>(async () => ({ ok: true }))
const mockEnable = vi.fn<() => Promise<ArchBActionResult>>(async () => ({ ok: true }))
const mockEnsureDelegation = vi.fn<() => Promise<ArchBActionResult>>(async () => ({ ok: true }))
const mockRefresh = vi.fn<() => void>()

const delegationState: UseArchBDelegationReturn = {
  status: 'provisioned',
  caps: null,
  error: null,
  enable: mockEnable,
  ensureDelegation: mockEnsureDelegation,
  disable: mockDisable,
  refresh: mockRefresh,
}

vi.mock('./useArchBDelegation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useArchBDelegation')>()
  return {
    ...actual,
    useArchBDelegation: () => delegationState,
  }
})

function setState(
  status: ArchBDelegationStatus,
  error: UseArchBDelegationReturn['error'] = null,
) {
  delegationState.status = status
  delegationState.error = error
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ArchBRevokeControl', () => {
  beforeEach(() => {
    setState('provisioned', null)
    mockDisable.mockReset()
    mockDisable.mockResolvedValue({ ok: true })
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
  })

  it('hides on non-eligible status (loading)', () => {
    setState('loading')
    const { container } = render(<ArchBRevokeControl />)
    expect(container.firstChild).toBeNull()
  })

  it('hides on unlinked status', () => {
    setState('unlinked')
    const { container } = render(<ArchBRevokeControl />)
    expect(container.firstChild).toBeNull()
  })

  it('hides on revoked status', () => {
    setState('revoked')
    const { container } = render(<ArchBRevokeControl />)
    expect(container.firstChild).toBeNull()
  })

  it('renders with Enabled badge on provisioned status', () => {
    setState('provisioned')
    render(<ArchBRevokeControl />)
    expect(screen.getByText('Enabled')).toBeTruthy()
    expect(screen.getByText('Revoke')).toBeTruthy()
  })

  // P2 regression: error state must keep control visible with retry affordance
  it('stays rendered on error status so user retains a retry path', () => {
    setState('error', { code: 'db_unavailable', message: 'DB down' })
    render(<ArchBRevokeControl />)
    expect(screen.getByText('Revoke failed')).toBeTruthy()
    expect(screen.getByText('Retry revoke')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('DB down')
  })

  it('opens confirmation modal when Revoke button is clicked', () => {
    setState('provisioned')
    render(<ArchBRevokeControl />)
    fireEvent.click(screen.getByText('Revoke'))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  // P1 regression: success toast must NOT fire if disable() reports failure
  it('does not fire success toast when disable() returns { ok: false }', async () => {
    setState('provisioned')
    mockDisable.mockResolvedValueOnce({
      ok: false,
      error: { code: 'db_unavailable', message: 'Backend unavailable' },
    })

    render(<ArchBRevokeControl />)
    fireEvent.click(screen.getByText('Revoke'))

    // Find the destructive button inside the modal (last button in footer)
    const modal = screen.getByRole('dialog')
    const modalButtons = Array.from(modal.querySelectorAll('button'))
    const confirmBtn = modalButtons[modalButtons.length - 1]!

    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    await waitFor(() => {
      expect(mockDisable).toHaveBeenCalled()
    })

    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith('Backend unavailable')
  })

  // P1 regression: modal stays open on failure so user can retry
  it('keeps the modal open when revoke fails', async () => {
    setState('provisioned')
    mockDisable.mockResolvedValueOnce({
      ok: false,
      error: { code: 'revoke_failed', message: 'Try again' },
    })

    render(<ArchBRevokeControl />)
    fireEvent.click(screen.getByText('Revoke'))

    const modalButtons = Array.from(
      screen.getByRole('dialog').querySelectorAll('button'),
    )
    const confirmBtn = modalButtons[modalButtons.length - 1]!

    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    await waitFor(() => expect(mockDisable).toHaveBeenCalled())

    // Modal still open (would be null if closed — see Modal mock)
    expect(screen.queryByRole('dialog')).not.toBeNull()
  })

  it('fires success toast and closes modal on ok: true', async () => {
    setState('provisioned')
    mockDisable.mockResolvedValueOnce({ ok: true })

    render(<ArchBRevokeControl />)
    fireEvent.click(screen.getByText('Revoke'))

    const modalButtons = Array.from(
      screen.getByRole('dialog').querySelectorAll('button'),
    )
    const confirmBtn = modalButtons[modalButtons.length - 1]!

    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('revoked'),
      )
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('cancel button closes the modal without calling disable', () => {
    setState('provisioned')
    render(<ArchBRevokeControl />)
    fireEvent.click(screen.getByText('Revoke'))

    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mockDisable).not.toHaveBeenCalled()
  })
})
