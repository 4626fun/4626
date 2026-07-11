import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, Pencil, Wallet } from 'lucide-react'

import { WalletProviderIcon } from '@/components/ui/WalletProviderIcon'
import { resolveLinkedExternalWalletProvider } from '@/features/waitlist/resolveLinkedExternalWalletProvider'
import { inferWalletProvider, walletProviderLabel } from '@/lib/wallet/providerIdentity'
import { useSafePrivy } from '@/lib/privy/safeHooks'
import { usePrivyWalletsFromContext } from '@/lib/privy/walletHooksContext'
import { cn } from '@/lib/shared/utils'

/** How long the freshly-linked rows stay visible before auto-collapsing into the summary. */
const AUTO_COLLAPSE_DELAY_MS = 1_600
/** Shared per-row delay for the collapse sequence — a row's exit and its "+N" popup fire
 * together at `index * ROW_COLLAPSE_STAGGER_S`, so each line visibly leaves and lands in the
 * total one at a time (a domino effect) instead of all rows/popups drifting independently. */
const ROW_COLLAPSE_STAGGER_S = 0.26
const ROW_EXIT_DURATION_S = 0.4
const COUNT_UP_BASE_DURATION_S = 0.6
/** Timing for the "+N" score-popup that floats up over the total as each row collapses into it. */
const POPUP_DURATION_S = 1.1

/**
 * One row in the "linked accounts" summary — a provider that has already
 * been connected. Kept intentionally minimal: icon, one-line identity, an
 * edit action, and the points it contributed.
 */
export type WaitlistLinkedAccountRow = {
  key: string
  icon: ReactNode
  /** Single-line identity — handle, ENS/basename, or short address. */
  identity: string
  monospaceIdentity?: boolean
  points: number
  /** When present, renders a small edit action that unlinks and re-opens the connect step. */
  onEdit?: () => void
  editBusy?: boolean
  /** Shown inline under this row when its most recent edit/unlink attempt failed. */
  error?: string | null
}

function shortAddress(address: string): string {
  const trimmed = address.trim()
  if (trimmed.length < 10) return trimmed
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`
}

/** Resolves the branded wallet mark for a linked external EOA (Rabby, MetaMask, Coinbase, …). */
function LinkedWalletIcon({ linkedAddress }: { linkedAddress?: string | null }) {
  const privy = useSafePrivy()
  const wallets = usePrivyWalletsFromContext()
  const identity = useMemo(
    () => resolveLinkedExternalWalletProvider({ linkedAddress, wallets, privyUser: privy.user }),
    [linkedAddress, privy.user, wallets],
  )

  if (!identity.provider && !identity.connectorId) {
    return <Wallet className="size-[18px] shrink-0 text-zinc-300" aria-hidden="true" />
  }

  return (
    <WalletProviderIcon
      provider={identity.provider}
      connectorId={identity.connectorId}
      walletType="external_eoa"
      size={18}
      className="shrink-0"
    />
  )
}

/** Human-readable wallet provider name ("Rabby", "MetaMask", …) — used only as a tooltip now that the icon already brands the row. */
function useLinkedWalletProviderLabel(linkedAddress?: string | null): string {
  const privy = useSafePrivy()
  const wallets = usePrivyWalletsFromContext()
  return useMemo(() => {
    const identity = resolveLinkedExternalWalletProvider({ linkedAddress, wallets, privyUser: privy.user })
    return walletProviderLabel(inferWalletProvider({ provider: identity.provider, connectorId: identity.connectorId }))
  }, [linkedAddress, privy.user, wallets])
}

/** Builds the full linked-wallet row (icon + short address) for a connected external EOA. */
export function useWaitlistLinkedWalletRow(linkedAddress: string | null, points: number): WaitlistLinkedAccountRow {
  const providerLabel = useLinkedWalletProviderLabel(linkedAddress)
  return {
    key: 'wallet',
    icon: <LinkedWalletIcon linkedAddress={linkedAddress} />,
    identity: linkedAddress ? shortAddress(linkedAddress) : providerLabel || 'Wallet',
    monospaceIdentity: Boolean(linkedAddress),
    points,
  }
}

function LinkedAccountRow({
  icon,
  identity,
  monospaceIdentity,
  onEdit,
  editBusy,
  error,
}: Omit<WaitlistLinkedAccountRow, 'key' | 'points'>) {
  return (
    <div className="py-2">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center">{icon}</span>
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-200',
            monospaceIdentity && 'font-mono',
          )}
        >
          {identity}
        </span>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            disabled={editBusy}
            aria-label="Edit"
            className="shrink-0 rounded-full p-1.5 text-zinc-600 transition hover:bg-white/[0.06] hover:text-zinc-300 disabled:opacity-50"
          >
            {editBusy ? (
              <span className="block size-3.5 animate-spin rounded-full border-[1.5px] border-zinc-500 border-t-transparent" />
            ) : (
              <Pencil className="size-3.5" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="pl-11 pt-1 text-[11px] leading-relaxed text-rose-300/90">{error}</p>
      ) : null}
    </div>
  )
}

/**
 * "Your points" summary — header (label, running total) plus the linked
 * accounts list. The list starts expanded so newly-earned points are visible,
 * then auto-collapses once: each row animates up and fades into the header
 * while the total counts up to match, turning three rows into one clean
 * summary line. The header stays clickable afterward to re-expand and review
 * or edit any linked account.
 */
export function WaitlistLinkedAccountsCard({
  rows,
  totalPoints,
  showTotal,
  progress,
  density = 'page',
}: {
  rows: WaitlistLinkedAccountRow[]
  totalPoints: number
  showTotal: boolean
  /** Optional step-progress indicator, rendered between the header and the
   * row list. Lets the caller show "where you are" in a linking wizard
   * without this card needing to know anything about that wizard's steps. */
  progress?: ReactNode
  /** `tray` is flush with CanonicalIdentityDropdown sections (no nested card). */
  density?: 'page' | 'tray'
}) {
  const reduceMotion = useReducedMotion()
  const [expanded, setExpanded] = useState(true)
  const [displayTotal, setDisplayTotal] = useState(totalPoints)
  const [popups, setPopups] = useState<{ id: string; points: number }[]>([])
  const hasAutoCollapsedRef = useRef(false)
  const stopCountRef = useRef<{ stop: () => void } | null>(null)
  const popupClearTimerRef = useRef<number | null>(null)
  const autoCollapseTimerRef = useRef<number | null>(null)
  // Guards against the collapse animation (count-up + popups) playing twice —
  // e.g. the user manually collapses the header a moment before the delayed
  // auto-collapse timer below was going to fire anyway. Set synchronously
  // (not via effect) so it's correct even inside that same setTimeout tick.
  const isCollapsedRef = useRef(false)

  const rowsPoints = useMemo(() => rows.reduce((sum, row) => sum + row.points, 0), [rows])

  const clearPopupTimer = useCallback(() => {
    if (popupClearTimerRef.current != null) {
      window.clearTimeout(popupClearTimerRef.current)
      popupClearTimerRef.current = null
    }
  }, [])

  const clearAutoCollapseTimer = useCallback(() => {
    if (autoCollapseTimerRef.current != null) {
      window.clearTimeout(autoCollapseTimerRef.current)
      autoCollapseTimerRef.current = null
    }
  }, [])

  const collapse = useCallback(() => {
    if (isCollapsedRef.current) return
    isCollapsedRef.current = true
    clearAutoCollapseTimer()
    setExpanded(false)
    stopCountRef.current?.stop()
    clearPopupTimer()
    if (reduceMotion) {
      setDisplayTotal(totalPoints)
      setPopups([])
      return
    }
    const baseline = totalPoints - rowsPoints
    // The number keeps counting up until the last row's points have landed, so it
    // reads as one continuous total accruing in step with each line disappearing.
    const staggerSpan = Math.max(0, rows.length - 1) * ROW_COLLAPSE_STAGGER_S
    stopCountRef.current = animate(baseline, totalPoints, {
      duration: staggerSpan + COUNT_UP_BASE_DURATION_S,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (value) => setDisplayTotal(value),
    })
    // "+N" score popups float up over the total in the same one-by-one cadence as
    // the rows exiting below — each row leaves and its points land at the same
    // moment, like a game combo counter ticking off one line at a time.
    setPopups(rows.map((row) => ({ id: row.key, points: row.points })))
    const totalPopupMs = (staggerSpan + POPUP_DURATION_S) * 1_000
    popupClearTimerRef.current = window.setTimeout(() => setPopups([]), totalPopupMs)
  }, [clearAutoCollapseTimer, clearPopupTimer, reduceMotion, rows, rowsPoints, totalPoints])

  // Auto-collapse once, shortly after the linked rows first appear — long
  // enough to register what was just earned, short enough to feel snappy.
  useEffect(() => {
    if (hasAutoCollapsedRef.current) return
    if (rows.length === 0) return
    hasAutoCollapsedRef.current = true
    autoCollapseTimerRef.current = window.setTimeout(collapse, AUTO_COLLAPSE_DELAY_MS)
    return clearAutoCollapseTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when rows first appear, not on every rows/points change
  }, [rows.length > 0])

  useEffect(() => {
    if (!expanded) setDisplayTotal(totalPoints)
  }, [expanded, totalPoints])

  // A failed edit/unlink is only useful if the user can see which row it
  // belongs to — force back open if the summary already auto-collapsed
  // (or is mid-collapse) by the time the error arrives, so it's never
  // silently hidden behind the summary line.
  const hasRowError = rows.some((row) => Boolean(row.error))
  useEffect(() => {
    if (!hasRowError || expanded) return
    isCollapsedRef.current = false
    clearAutoCollapseTimer()
    stopCountRef.current?.stop()
    clearPopupTimer()
    setPopups([])
    setDisplayTotal(totalPoints)
    setExpanded(true)
  }, [hasRowError, expanded, clearAutoCollapseTimer, clearPopupTimer, totalPoints])

  useEffect(
    () => () => {
      stopCountRef.current?.stop()
      clearPopupTimer()
      clearAutoCollapseTimer()
    },
    [clearAutoCollapseTimer, clearPopupTimer],
  )

  const toggleExpanded = () => {
    if (expanded) {
      collapse()
    } else {
      isCollapsedRef.current = false
      clearAutoCollapseTimer()
      stopCountRef.current?.stop()
      clearPopupTimer()
      setPopups([])
      setDisplayTotal(totalPoints)
      setExpanded(true)
    }
  }

  const canToggle = rows.length > 0
  const isTray = density === 'tray'

  return (
    <div>
      <button
        type="button"
        onClick={canToggle ? toggleExpanded : undefined}
        disabled={!canToggle}
        aria-expanded={canToggle ? expanded : undefined}
        aria-controls="waitlist-earn-points-rows"
        className={cn(
          'flex w-full items-center gap-3 text-left',
          isTray ? 'py-1' : undefined,
          canToggle && 'cursor-pointer',
        )}
      >
        <span
          className={cn(
            'font-semibold uppercase text-zinc-500',
            isTray ? 'text-[10px] tracking-wider text-zinc-600' : 'text-[10px] tracking-[0.16em]',
          )}
        >
          {isTray ? 'Linked' : 'Your points'}
        </span>
        <span className="h-px flex-1 bg-white/[0.06]" aria-hidden="true" />
        {showTotal ? (
          <span
            className={cn(
              'relative shrink-0 font-semibold tabular-nums',
              isTray ? 'text-[12px] text-zinc-300' : 'text-[12px] text-zinc-300',
            )}
          >
            {Math.round(displayTotal).toLocaleString()}
            <AnimatePresence>
              {popups.map((popup, index) => (
                <motion.span
                  key={popup.id}
                  initial={{ opacity: 0, y: 0, scale: 0.85 }}
                  animate={{ opacity: [0, 0.85, 0.85, 0], y: [0, -14, -24, -34], scale: [0.85, 1.12, 1.02, 1.02] }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: POPUP_DURATION_S,
                    delay: index * ROW_COLLAPSE_STAGGER_S,
                    times: [0, 0.18, 0.5, 1],
                    ease: 'easeOut',
                  }}
                  className="pointer-events-none absolute -top-1 right-0 text-[15px] font-bold text-emerald-300"
                >
                  +{popup.points}
                </motion.span>
              ))}
            </AnimatePresence>
          </span>
        ) : null}
        {canToggle ? (
          <motion.span
            animate={{ rotate: expanded ? 0 : -90 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="shrink-0 text-zinc-500"
          >
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </motion.span>
        ) : null}
      </button>

      {progress}

      <div
        id="waitlist-earn-points-rows"
        className={cn('flex w-full flex-col', !isTray && 'mx-auto max-w-[240px]')}
      >
        <AnimatePresence initial={false}>
          {expanded
            ? rows.map((row, index) => (
                <motion.div
                  key={row.key}
                  layout
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: -28, scale: 0.85, filter: 'blur(2px)' }
                  }
                  transition={{
                    duration: ROW_EXIT_DURATION_S,
                    delay: index * ROW_COLLAPSE_STAGGER_S,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <LinkedAccountRow
                    icon={row.icon}
                    identity={row.identity}
                    monospaceIdentity={row.monospaceIdentity}
                    onEdit={row.onEdit}
                    editBusy={row.editBusy}
                    error={row.error}
                  />
                </motion.div>
              ))
            : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
