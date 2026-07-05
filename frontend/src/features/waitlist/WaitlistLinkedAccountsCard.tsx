import { useMemo, type ReactNode } from 'react'
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

function LinkedAccountRow({ icon, label, subtitle, monospaceLabel, points }: Omit<WaitlistLinkedAccountRow, 'key'>) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/[0.08]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span
          className={cn(
            'block truncate text-[13px] font-semibold text-zinc-100',
            monospaceLabel && 'font-mono',
          )}
        >
          {label}
        </span>
        {subtitle ? <span className="block truncate text-[11px] text-zinc-500">{subtitle}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/[0.12] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-emerald-300">
        <Check className="size-3" aria-hidden="true" />+{points}
      </span>
    </div>
  )
}

/**
 * Unified "already connected" summary — replaces the previous per-provider
 * inline rows so linked identities read as one cohesive, minimal card
 * instead of three visually inconsistent list items.
 */
export function WaitlistLinkedAccountsCard({ rows }: { rows: WaitlistLinkedAccountRow[] }) {
  if (rows.length === 0) return null
  return (
    <div className="mt-6 divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
      {rows.map((row) => (
        <LinkedAccountRow
          key={row.key}
          icon={row.icon}
          label={row.label}
          subtitle={row.subtitle}
          monospaceLabel={row.monospaceLabel}
          points={row.points}
        />
      ))}
    </div>
  )
}
