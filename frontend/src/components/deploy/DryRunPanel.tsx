import type { ReactNode } from 'react'

import { Loader2 } from 'lucide-react'

import { StatusBadge } from './ui/StatusBadge'
import { AdvancedDetails } from './ui/AdvancedDetails'

/**
 * Dry-run status surface: calm success line, warnings, and failure detail
 * behind a disclosure. Action buttons live in the DeployActionBar; this
 * panel only reports state.
 */
export function DryRunPanel({
  busy,
  ok,
  forkMode,
  errorText,
  errorAction,
  failureDetail,
  children,
}: {
  busy: boolean
  /** null = no dry-run result yet. */
  ok: boolean | null
  forkMode: string | null
  errorText?: string | null
  /** Optional action rendered under the error text (e.g. vanity activation link). */
  errorAction?: ReactNode
  /** Failure detail content, rendered behind a disclosure. */
  failureDetail?: ReactNode
  /** Context rows (ERC-4337 sender, smart wallet balance). */
  children?: ReactNode
}) {
  const hasStatus = busy || ok !== null || Boolean(errorText)
  return (
    <div className="space-y-2 rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Dry run</div>
        {busy ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-blue-300/90" role="status">
            <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />
            Running on local fork…
          </span>
        ) : ok !== null ? (
          <StatusBadge
            status={ok ? 'success' : 'warning'}
            label={ok ? `Dry run passed on ${forkMode ?? 'local'} fork` : `Dry run failed on ${forkMode ?? 'local'} fork`}
          />
        ) : (
          <span className="text-[11px] text-zinc-600">Not run yet</span>
        )}
      </div>
      {errorText ? (
        <div className="space-y-1.5">
          <div className="text-[11px] leading-relaxed text-amber-300/80">{errorText}</div>
          {errorAction}
        </div>
      ) : null}
      {children}
      {failureDetail ? (
        <AdvancedDetails summary="Failure detail">
          {failureDetail}
        </AdvancedDetails>
      ) : null}
      {!hasStatus ? (
        <div className="text-[11px] leading-relaxed text-zinc-600">
          Optional: rehearse all phases on a local Anvil fork before deploying. Nothing is sent on-chain.
        </div>
      ) : null}
    </div>
  )
}
