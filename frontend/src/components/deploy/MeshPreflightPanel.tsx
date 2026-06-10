import type { ReactNode } from 'react'

/**
 * Phase 2b "OVault mesh preflight + peer wiring" panel, nested under
 * Phase 2 with a distinct (sky) treatment. Content is composed by the
 * caller; this owns the framing, heading, and disabled state.
 */
export function MeshPreflightPanel({
  enabled,
  statusBadge,
  children,
}: {
  enabled: boolean
  /** Right-aligned status element for the 2b stage. */
  statusBadge?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-sky-400/15 bg-sky-500/[0.04] p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0">
          <div className="text-xs font-medium text-sky-200/90">Phase 2b · OVault mesh preflight + peer wiring</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
            Solana Share Mesh lane wiring belongs to Phase 2b, not the Phase 3 strategy set.
          </div>
        </div>
        {statusBadge}
      </div>
      {enabled ? (
        children
      ) : (
        <div className="rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2 text-[10px] text-zinc-600">
          OVault mesh lane is disabled for this deployment profile.
        </div>
      )}
    </div>
  )
}
