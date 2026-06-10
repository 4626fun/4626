import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'

import { cn } from '@/lib/shared/utils'
import { CopyButton } from './CopyButton'
import { deployStatusTextClasses, type DeployStatus } from './statusModel'

const ZERO_EVM_ADDRESS = '0x0000000000000000000000000000000000000000'

export type AddressRowTag = 'local fork' | 'pending' | 'live' | 'shared' | 'this deploy' | 'external'

export interface AddressRowProps {
  label: string
  /** Full underlying value (EVM address, bytes32, Solana base58, …). Never truncated in the data model. */
  value: string | null | undefined
  /**
   * On-chain liveness from the existing bytecode checks:
   * `true`/`undefined` = live, `false` = pending, `null` = checking.
   */
  deployed?: boolean | null
  /** Local fork rows are clearly labeled and never link to BaseScan. */
  forkOnly?: boolean
  /** Shared protocol infrastructure rows get a subtle distinct tint. */
  shared?: boolean
  /** When the dry run simulated this row's phase successfully, render a green check. */
  dryRunPassed?: boolean
  /** Extra descriptive tags rendered after the label. */
  tags?: AddressRowTag[]
  /**
   * Explorer link override (e.g. Solana explorer). When omitted, live EVM
   * addresses link to BaseScan. Pass `null` to suppress the link entirely.
   */
  explorerHref?: string | null
  /** Optional secondary raw value (e.g. bytes32 form of a Solana address). */
  rawValue?: string | null
  rawValueLabel?: string
  className?: string
}

function truncateValue(value: string): string {
  if (value.length <= 14) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function rowStatus(params: { ok: boolean; forkOnly?: boolean; deployed?: boolean | null }): DeployStatus {
  if (!params.ok) return 'disabled'
  if (params.forkOnly) return 'localFork'
  if (params.deployed === false) return 'pending'
  if (params.deployed === null) return 'checking'
  return 'live'
}

function statusHint(status: DeployStatus): string | null {
  switch (status) {
    case 'localFork':
      return 'local fork'
    case 'pending':
      return 'pending'
    case 'checking':
      return 'checking…'
    default:
      return null
  }
}

const TAG_CLASSES: Record<AddressRowTag, string> = {
  'local fork': 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  pending: 'border-white/10 bg-white/[0.04] text-zinc-400',
  live: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  shared: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  'this deploy': 'border-blue-500/25 bg-blue-500/10 text-blue-300',
  external: 'border-white/10 bg-white/[0.04] text-zinc-400',
}

/**
 * Polished address/value row: truncated mono display, copy of the full value,
 * explorer link only when the contract is live and not fork-only.
 */
export function AddressRow({
  label,
  value,
  deployed,
  forkOnly,
  shared,
  dryRunPassed,
  tags,
  explorerHref,
  rawValue,
  rawValueLabel,
  className,
}: AddressRowProps) {
  const [expanded, setExpanded] = useState(false)

  const fullValue = value ? String(value) : ''
  const ok = Boolean(fullValue) && fullValue !== ZERO_EVM_ADDRESS
  const status = rowStatus({ ok, forkOnly, deployed })
  const hint = statusHint(status)

  const href = useMemo(() => {
    if (!ok || status !== 'live') return null
    if (explorerHref !== undefined) return explorerHref
    if (!fullValue.startsWith('0x') || fullValue.length !== 42) return null
    return `https://basescan.org/address/${fullValue}`
  }, [ok, status, explorerHref, fullValue])

  const display = expanded ? fullValue : truncateValue(fullValue)

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg px-2.5 py-1.5 text-xs transition-colors',
        shared ? 'border border-sky-400/15 bg-sky-500/[0.06]' : 'hover:bg-white/[0.03]',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('truncate', shared ? 'text-sky-200/90' : 'text-zinc-500')}>{label}</span>
        {tags?.map((tag) => (
          <span
            key={tag}
            className={cn(
              'hidden shrink-0 rounded-full border px-1.5 py-px text-[9px] uppercase tracking-wide sm:inline-flex',
              TAG_CLASSES[tag],
            )}
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex min-w-0 items-center gap-1.5">
        {!ok ? (
          <span className="font-mono text-zinc-600">—</span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? `Collapse ${label} value` : `Expand ${label} value to full length`}
              aria-expanded={expanded}
              title={expanded ? 'Show truncated value' : fullValue}
              className={cn(
                'min-w-0 break-all text-right font-mono transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500/70',
                status === 'checking' && 'animate-pulse motion-reduce:animate-none',
                deployStatusTextClasses(status),
              )}
            >
              {display}
            </button>
            {hint ? (
              <span
                className={cn(
                  'shrink-0 text-[10px]',
                  status === 'localFork' ? 'text-amber-200/70' : 'text-zinc-600',
                )}
              >
                ({hint})
              </span>
            ) : null}
            {dryRunPassed ? (
              <span className="shrink-0 text-emerald-300" title="Dry run passed for this phase">
                ✓
              </span>
            ) : null}
            <CopyButton value={fullValue} label={`Copy ${label}`} />
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${label} in block explorer`}
                title="Open in block explorer"
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500/70"
              >
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </>
        )}
      </div>

      {rawValue && expanded ? (
        <div className="w-full basis-full pl-2 text-[10px] text-zinc-600">
          <span className="mr-1">{rawValueLabel ?? 'raw'}:</span>
          <span className="break-all font-mono">{rawValue}</span>
        </div>
      ) : null}
    </div>
  )
}
