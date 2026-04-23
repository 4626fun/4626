/**
 * Architecture B Phase 2 — Enrollment card.
 *
 * Visible when the user is signed in, has a canonical CSW, and is
 * not yet provisioned for bot-initiated transfers (status `not_delegated`
 * or `revoked`).
 *
 * Dismissible with a local flag — not persisted to the backend, so
 * the card reappears on the next session. This intentionally does not
 * block other account-setup steps.
 *
 * Copy is plain, no hype, no exclamation points.
 */

import { useEffect, useRef, useState } from 'react'
import { toast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { LoadingInline } from '@/components/ui/LoadingState'

import {
  useArchBDelegation,
  archBCapsMatchExpected,
  ARCH_B_EXPECTED_CAPS,
  type ArchBDelegationStatus,
} from './useArchBDelegation'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatWei(weiStr: string | null | undefined): string {
  if (!weiStr) return '—'
  try {
    const wei = BigInt(weiStr)
    // Convert to ETH with 4 decimal places
    const eth = Number(wei) / 1e18
    return `${eth.toFixed(4)} ETH`
  } catch {
    return weiStr
  }
}

// ── Subcomponent: error state ──────────────────────────────────────────────────

function ErrorRow({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      <span className="flex-1">{message}</span>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

type ArchBEnrollmentCardProps = {
  /**
   * Whether the user has a canonical CSW. If false, the card is hidden
   * because delegation only makes sense once a smart wallet exists.
   */
  hasCanonicalCsw: boolean
}

export function ArchBEnrollmentCard({ hasCanonicalCsw }: ArchBEnrollmentCardProps) {
  const delegation = useArchBDelegation()
  const [dismissed, setDismissed] = useState(false)

  const prevStatusRef = useRef<ArchBDelegationStatus | null>(null)

  // Fire a success toast only when the user's enable() call completes.
  // The meaningful transition is `delegated` (enroll POST in flight) → `provisioned`.
  // We intentionally do NOT toast on `loading` → `provisioned` (initial fetch,
  // window-focus refetch, or post-disable refetch), which would re-fire the
  // toast on every page load for already-provisioned users.
  useEffect(() => {
    const prev = prevStatusRef.current
    const curr = delegation.status
    prevStatusRef.current = curr

    if (prev === 'delegated' && curr === 'provisioned') {
      toast.success('Enabled. /keepr send will route through your smart wallet. Revoke any time in Settings.')
    }
  }, [delegation.status])

  const { status, caps, error, enable, refresh } = delegation

  // Hidden when: no CSW, dismissed, or status is not an enrollment-prompt state
  const PROMPT_STATUSES: ArchBDelegationStatus[] = ['not_delegated', 'revoked']
  const isPromptState = PROMPT_STATUSES.includes(status)

  if (!hasCanonicalCsw) return null
  if (dismissed) return null
  if (status === 'unlinked') return null
  if (status === 'provisioned') return null
  // Only show the "Enabling delegation…" placeholder when the user is
  // actively progressing through the consent/enroll flow. The generic
  // `loading` status also covers initial-mount fetch and window-focus
  // refetch — in those cases nothing is actually being enabled, so we
  // hide the card to avoid a misleading flash on every page visit.
  if (status === 'delegating' || status === 'delegated') {
    // Show loading state while enable() is in-flight
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 space-y-2"
      >
        <div className="text-sm text-zinc-100 font-medium">Enable bot-initiated transfers</div>
        <LoadingInline intent="processing" size="sm" labelOverride="Enabling delegation…" />
      </div>
    )
  }
  if (status === 'loading') {
    // Initial fetch or refetch — render nothing to avoid mount flash. The
    // card will surface again if the resolved status is `not_delegated`
    // or `revoked`.
    return null
  }

  if (status === 'error' && !isPromptState) {
    return (
      <ErrorRow
        message={error?.message ?? 'An error occurred. Please try again.'}
        onRetry={() => {
          refresh()
        }}
      />
    )
  }

  if (status === 'error' && isPromptState) {
    // Shouldn't happen but guard for completeness
    return (
      <ErrorRow
        message={error?.message ?? 'An error occurred. Please try again.'}
        onRetry={refresh}
      />
    )
  }

  if (!isPromptState) return null

  // L-18: Spend caps must be shown prominently BEFORE consent. The
  // canonical expected caps come from ARCH_B_EXPECTED_CAPS (client-side
  // constant mirroring the on-chain policy). The backend-sourced `caps`
  // are only trusted for display when they match the expected values;
  // any mismatch surfaces a warning so a compromised API cannot present
  // artificially low numbers.
  const displayCaps = caps ?? ARCH_B_EXPECTED_CAPS
  const perTxDisplay = formatWei(displayCaps.perTxCapWei)
  const dailyDisplay = formatWei(displayCaps.dailyCapWei)
  const capsMismatch = caps !== null && !archBCapsMatchExpected(caps)
  const expectedPerTxDisplay = formatWei(ARCH_B_EXPECTED_CAPS.perTxCapWei)
  const expectedDailyDisplay = formatWei(ARCH_B_EXPECTED_CAPS.dailyCapWei)

  return (
    <section
      aria-label="Enable bot-initiated transfers"
      className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="text-sm font-medium text-zinc-100">Enable bot-initiated transfers</div>
          <p className="text-xs leading-relaxed text-zinc-400 max-w-prose">
            Grant this app permission to sign{' '}
            <code className="font-mono text-zinc-300">/keepr send</code> transactions from your
            smart wallet. Your wallet stays yours — you can revoke at any time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors text-sm leading-none"
        >
          ✕
        </button>
      </div>

      {/* L-18: Prominent pre-consent spend-cap panel. Always visible
          above the Enable button. */}
      <div
        data-testid="arch-b-caps-panel"
        className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 space-y-1.5"
      >
        <div className="text-[11px] uppercase tracking-wider text-zinc-500">
          Spend limits that will apply
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-200">
          <div>
            <span className="text-zinc-500">Per transfer: </span>
            <span className="font-mono">{perTxDisplay}</span>
          </div>
          <div>
            <span className="text-zinc-500">Per day: </span>
            <span className="font-mono">{dailyDisplay}</span>
          </div>
        </div>
      </div>

      {capsMismatch ? (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="arch-b-caps-mismatch"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
        >
          The displayed caps differ from the expected on-chain policy
          ({expectedPerTxDisplay} per transfer, {expectedDailyDisplay}{' '}
          per day). Do not enable until this is resolved — contact support
          if the mismatch persists.
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
        >
          {error.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => void enable()}
          disabled={capsMismatch}
        >
          Enable
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
        >
          Not now
        </Button>
      </div>
    </section>
  )
}
