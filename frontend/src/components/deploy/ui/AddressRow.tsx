import { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'

import { cn } from '@/lib/shared/utils'
import { CopyButton } from './CopyButton'
import { deployStatusTextClasses, type DeployStatus } from './statusModel'

const ZERO_EVM_ADDRESS = '0x0000000000000000000000000000000000000000'

export type AddressRowTag = 'local fork' | 'pending' | 'live' | 'shared' | 'this deploy' | 'external'

export interface AddressRowProps {
  label: string
  /** Full underlying value (EVM address, bytes32, Solana base58, …). Always rendered in full. */
  value: string | null | undefined
  /**
   * On-chain liveness from the existing bytecode checks:
   * `true`/`undefined` = live, `false` = pending, `null` = checking.
   */
  deployed?: boolean | null
  /** Local fork rows are clearly labeled and never link to BaseScan. */
  forkOnly?: boolean
  /** Protocol shared infrastructure rows get a "protocol" tag and sky label. */
  shared?: boolean
  /** When the dry run simulated this row's phase successfully, render a green check. */
  dryRunPassed?: boolean
  /** Dry run currently in flight for this row's phase: brighten + pulse the value. */
  simulating?: boolean
  /** Stagger delay (ms) for the dry-run check pop-in so phases reveal in deploy order. */
  dryRunCheckDelayMs?: number
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
  /** Optional protocol logo rendered before the label (e.g. Uniswap, Ajna, Chainlink). */
  iconSrc?: string
  className?: string
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
  'local fork': 'bg-amber-500/10 text-amber-200',
  pending: 'bg-white/[0.05] text-zinc-400',
  live: 'bg-emerald-500/10 text-emerald-300',
  shared: 'bg-sky-500/10 text-sky-300',
  'this deploy': 'bg-blue-500/10 text-blue-300',
  external: 'bg-white/[0.05] text-zinc-400',
}

/**
 * Borderless address/value row: full untruncated mono value, copy of the
 * full value, explorer link only when the contract is live and not fork-only.
 * Protocol shared rows are tagged "protocol" so ownership is unambiguous.
 */
export function AddressRow({
  label,
  value,
  deployed,
  forkOnly,
  shared,
  dryRunPassed,
  simulating,
  dryRunCheckDelayMs,
  tags,
  explorerHref,
  rawValue,
  rawValueLabel,
  iconSrc,
  className,
}: AddressRowProps) {
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

  return (
    <div className={cn('min-w-0 py-1.5', className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        {iconSrc ? (
          <img src={iconSrc} alt="" aria-hidden="true" loading="lazy" className="size-3.5 shrink-0 opacity-90" />
        ) : null}
        <span className={cn('truncate', shared ? 'text-sky-200/80' : 'text-zinc-400')}>{label}</span>
        {shared ? (
          <span className="shrink-0 rounded-full bg-sky-500/10 px-1.5 py-px text-[9px] uppercase tracking-wide text-sky-300">
            protocol
          </span>
        ) : null}
        {tags?.map((tag) => (
          <span
            key={tag}
            className={cn('shrink-0 rounded-full px-1.5 py-px text-[9px] uppercase tracking-wide', TAG_CLASSES[tag])}
          >
            {tag}
          </span>
        ))}
        {hint ? (
          <span className={cn('shrink-0 text-[10px]', status === 'localFork' ? 'text-amber-200/70' : 'text-zinc-600')}>
            ({hint})
          </span>
        ) : null}
        {simulating && ok ? (
          <span className="shrink-0 text-[10px] text-zinc-300 animate-pulse motion-reduce:animate-none">
            simulating…
          </span>
        ) : dryRunPassed ? (
          <span
            className="deploy-dryrun-check shrink-0 text-emerald-300"
            style={dryRunCheckDelayMs ? { animationDelay: `${dryRunCheckDelayMs}ms` } : undefined}
            title="Dry run passed for this phase"
          >
            ✓
          </span>
        ) : null}
      </div>

      <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
        {!ok ? (
          <span className="font-mono text-xs text-zinc-600">—</span>
        ) : (
          <>
            <span
              className={cn(
                'min-w-0 break-all font-mono text-[11px] leading-relaxed',
                status === 'checking' && 'animate-pulse motion-reduce:animate-none',
                simulating
                  ? 'text-zinc-100 animate-pulse motion-reduce:animate-none'
                  : deployStatusTextClasses(status),
              )}
            >
              {fullValue}
            </span>
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

      {rawValue ? (
        <div className="text-[10px] text-zinc-600">
          <span className="mr-1">{rawValueLabel ?? 'raw'}:</span>
          <span className="break-all font-mono">{rawValue}</span>
        </div>
      ) : null}
    </div>
  )
}
