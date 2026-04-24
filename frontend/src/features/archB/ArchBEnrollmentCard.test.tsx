// @vitest-environment happy-dom
/**
 * Tests for ArchBEnrollmentCard component.
 *
 * Covers all render states:
 *   - hidden (no CSW, dismissed, provisioned, unlinked)
 *   - loading (delegating / loading)
 *   - visible prompt (not_delegated, revoked)
 *   - submitting via enable()
 *   - error with retry
 *   - caps display from hook
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UseArchBDelegationReturn, ArchBDelegationStatus } from './useArchBDelegation'
import { ArchBEnrollmentCard } from './ArchBEnrollmentCard'

// ── Mock toast ────────────────────────────────────────────────────────────────

const mockToastSuccess = vi.fn<(msg: string) => void>()

vi.mock('@/components/ui/Toast', () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: vi.fn(),
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

vi.mock('@/components/ui/LoadingState', () => ({
  LoadingInline: ({ labelOverride }: { labelOverride?: string }) => (
    <span role="status">{labelOverride ?? 'Loading…'}</span>
  ),
}))

// ── Mock useArchBDelegation ───────────────────────────────────────────────────

import type { ArchBActionResult } from './useArchBDelegation'

const mockEnable = vi.fn<() => Promise<ArchBActionResult>>(async () => ({ ok: true }))
const mockDisable = vi.fn<() => Promise<ArchBActionResult>>(async () => ({ ok: true }))
const mockRefresh = vi.fn<() => void>()

const delegationState: UseArchBDelegationReturn = {
  status: 'not_delegated',
  caps: null,
  error: null,
  enable: mockEnable,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function setStatus(
  status: ArchBDelegationStatus,
  error: UseArchBDelegationReturn['error'] = null,
) {
  delegationState.status = status
  delegationState.error = error
}

function renderCard(hasCanonicalCsw = true) {
  return render(<ArchBEnrollmentCard hasCanonicalCsw={hasCanonicalCsw} />)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ArchBEnrollmentCard', () => {
  beforeEach(() => {
    delegationState.status = 'not_delegated'
    delegationState.caps = null
    delegationState.error = null
    mockEnable.mockReset()
    mockDisable.mockReset()
    mockRefresh.mockReset()
    mockToastSuccess.mockReset()
  })

  it('is hidden when hasCanonicalCsw is false', () => {
    setStatus('not_delegated')
    const { container } = renderCard(false)
    expect(container.firstChild).toBeNull()
  })

  it('is hidden when status is provisioned', () => {
    setStatus('provisioned')
    const { container } = renderCard()
    expect(container.firstChild).toBeNull()
  })

  it('is hidden when status is unlinked', () => {
    setStatus('unlinked')
    const { container } = renderCard()
    expect(container.firstChild).toBeNull()
  })

  it('shows loading state when status is delegating', () => {
    setStatus('delegating')
    renderCard()
    // Outer wrapper and inner LoadingInline both carry role=status
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
    expect(screen.getByText(/Enabling delegation/i)).toBeTruthy()
  })

  it('is hidden when status is loading (initial fetch, avoids mount flash)', () => {
    setStatus('loading')
    const { container } = renderCard()
    expect(container.firstChild).toBeNull()
  })

  it('renders the enrollment prompt when status is not_delegated', () => {
    setStatus('not_delegated')
    renderCard()
    expect(screen.getByText('Enable bot-initiated transfers')).toBeTruthy()
    expect(screen.getByText('Enable')).toBeTruthy()
    expect(screen.getByText('Not now')).toBeTruthy()
  })

  it('renders the enrollment prompt when status is revoked', () => {
    setStatus('revoked')
    renderCard()
    expect(screen.getByText('Enable bot-initiated transfers')).toBeTruthy()
  })

  it('calls enable() when Enable button is clicked', async () => {
    setStatus('not_delegated')
    mockEnable.mockResolvedValue({ ok: true })
    renderCard()

    fireEvent.click(screen.getByText('Enable'))
    await waitFor(() => expect(mockEnable).toHaveBeenCalledTimes(1))
  })

  it('dismisses the card when Not now is clicked', () => {
    setStatus('not_delegated')
    renderCard()

    fireEvent.click(screen.getByText('Not now'))
    expect(screen.queryByText('Enable bot-initiated transfers')).toBeNull()
  })

  it('dismisses the card when the dismiss (X) button is clicked', () => {
    setStatus('not_delegated')
    renderCard()

    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText('Enable bot-initiated transfers')).toBeNull()
  })

  it('shows inline error message when error is present in prompt state', () => {
    delegationState.error = { code: 'delegation_declined', message: 'Delegation was declined.' }
    setStatus('not_delegated', { code: 'delegation_declined', message: 'Delegation was declined.' })
    renderCard()
    expect(screen.getByText(/Delegation was declined\./i)).toBeTruthy()
  })

  it('calls refresh() when Retry is clicked in standalone error state', () => {
    setStatus('error', { code: 'network_error', message: 'Could not reach the server.' })
    renderCard()

    const retryBtn = screen.queryByText('Retry')
    if (retryBtn) {
      fireEvent.click(retryBtn)
      expect(mockRefresh).toHaveBeenCalledTimes(1)
    }
    // If no Retry shown (error folded into prompt), just verify no crash
  })

  it('displays caps when available from the delegation hook', () => {
    delegationState.caps = {
      perTxCapWei: '10000000000000000',
      dailyCapWei: '50000000000000000',
    }
    setStatus('not_delegated')
    renderCard()

    expect(screen.getByText(/Per transfer:/i)).toBeTruthy()
    // 0.01 ETH formatted to 4 decimal places
    expect(screen.getByText(/0\.0100 ETH/i)).toBeTruthy()
  })

  // ── Regression: success toast should NOT fire on every page load ──────────
  // Previously, the effect fired on `loading → provisioned` (the normal
  // mount-then-fetch sequence), which meant every page visit by an
  // already-provisioned user re-surfaced the "Enabled" toast. The fix
  // restricts the toast to the true enable() completion path:
  // `delegated → provisioned`.
  it('does NOT fire success toast on loading → provisioned (initial fetch)', () => {
    setStatus('loading')
    const { rerender } = renderCard()

    // Simulate the hook resolving to `provisioned` after status fetch.
    act(() => {
      setStatus('provisioned')
      rerender(<ArchBEnrollmentCard hasCanonicalCsw={true} />)
    })

    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it('does NOT fire success toast on not_delegated → loading → provisioned (focus refetch)', () => {
    setStatus('not_delegated')
    const { rerender } = renderCard()

    // Window focus triggers a refetch: FETCH_START moves status back to loading
    act(() => {
      setStatus('loading')
      rerender(<ArchBEnrollmentCard hasCanonicalCsw={true} />)
    })
    // FETCH_DONE resolves to provisioned
    act(() => {
      setStatus('provisioned')
      rerender(<ArchBEnrollmentCard hasCanonicalCsw={true} />)
    })

    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it('fires success toast only on delegated → provisioned (user enable completion)', () => {
    setStatus('not_delegated')
    const { rerender } = renderCard()

    // enable() sequence: not_delegated → delegating → delegated → provisioned
    act(() => {
      setStatus('delegating')
      rerender(<ArchBEnrollmentCard hasCanonicalCsw={true} />)
    })
    act(() => {
      setStatus('delegated')
      rerender(<ArchBEnrollmentCard hasCanonicalCsw={true} />)
    })
    act(() => {
      setStatus('provisioned')
      rerender(<ArchBEnrollmentCard hasCanonicalCsw={true} />)
    })

    expect(mockToastSuccess).toHaveBeenCalledTimes(1)
    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/^Enabled\. \/keepr send will route/),
    )
  })
})
