import { useMemo, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Wallet } from 'lucide-react'

import { WalletProviderIcon } from '@/components/ui/WalletProviderIcon'
import { resolveLinkedExternalWalletProvider } from '@/features/waitlist/resolveLinkedExternalWalletProvider'
import { inferWalletProvider, walletProviderLabel } from '@/lib/wallet/providerIdentity'
import { useSafePrivy } from '@/lib/privy/safeHooks'
import { usePrivyWalletsFromContext } from '@/lib/privy/walletHooksContext'
import { cn } from '@/lib/shared/utils'

/**
 * One row in the "linked accounts" summary — a provider that has already
 * been connected. Kept intentionally minimal: icon, label, optional
 * subtitle, and the points it contributed.
 */
export type WaitlistLinkedAccountRow = {
  key: string
  icon: ReactNode
  label: string
  subtitle?: string | null
  monospaceLabel?: boolean
  points: number
  /** When present, renders a small "Edit" action that unlinks and re-opens the connect step. */
  onEdit?: () => void
  editBusy?: boolean
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

/** Human-readable subtitle for a linked wallet ("Rabby", "MetaMask", …). */
function useLinkedWalletProviderLabel(linkedAddress?: string | null): string {
  const privy = useSafePrivy()
  const wallets = usePrivyWalletsFromContext()
  return useMemo(() => {
    const identity = resolveLinkedExternalWalletProvider({ linkedAddress, wallets, privyUser: privy.user })
    return walletProviderLabel(inferWalletProvider({ provider: identity.provider, connectorId: identity.connectorId }))
  }, [linkedAddress, privy.user, wallets])
}

/** Builds the full linked-wallet row (icon, label, provider subtitle) for a connected external EOA. */
export function useWaitlistLinkedWalletRow(linkedAddress: string | null, points: number): WaitlistLinkedAccountRow {
  const providerLabel = useLinkedWalletProviderLabel(linkedAddress)
  return {
    key: 'wallet',
    icon: <LinkedWalletIcon linkedAddress={linkedAddress} />,
    label: linkedAddress ? shortAddress(linkedAddress) : 'Wallet',
    subtitle: providerLabel,
    monospaceLabel: true,
    points,
  }
}

function LinkedAccountRow({
  icon,
  label,
  subtitle,
  monospaceLabel,
  points,
  onEdit,
  editBusy,
}: Omit<WaitlistLinkedAccountRow, 'key'>) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span
          className={cn(
            'block truncate text-[13px] font-semibold text-zinc-100',
            monospaceLabel && 'font-mono',
          )}
        >
          {label}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          {subtitle ? <span className="truncate">{subtitle}</span> : null}
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              disabled={editBusy}
              className="shrink-0 text-zinc-600 underline-offset-2 transition hover:text-zinc-300 hover:underline disabled:opacity-50"
            >
              {editBusy ? 'Removing…' : 'Edit'}
            </button>
          ) : null}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/[0.12] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-emerald-300">
        <Check className="size-3" aria-hidden="true" />+{points}
      </span>
    </div>
  )
}

/**
 * Unified "already connected" summary — replaces the previous per-provider
 * inline rows so linked identities read as one cohesive, minimal list
 * instead of three visually inconsistent items. Intentionally borderless so
 * it reads as part of the page rather than a nested card.
 */
export function WaitlistLinkedAccountsCard({ rows }: { rows: WaitlistLinkedAccountRow[] }) {
  const reduceMotion = useReducedMotion()
  if (rows.length === 0) return null
  return (
    <motion.div layout="position" className="mt-6 flex flex-col gap-1">
      <AnimatePresence initial={false}>
        {rows.map((row) => (
          <motion.div
            key={row.key}
            layout
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <LinkedAccountRow
              icon={row.icon}
              label={row.label}
              subtitle={row.subtitle}
              monospaceLabel={row.monospaceLabel}
              points={row.points}
              onEdit={row.onEdit}
              editBusy={row.editBusy}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}
