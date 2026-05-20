import type { Address } from 'viem'
import { isAddress } from 'viem'

import { JazziconAvatar } from '@/components/account/JazziconAvatar'
import { useBasenameForAddress } from '@/hooks/useBasenameForAddress'

/** Same mark as account chrome — Coinbase Wallet / Smart Wallet. */
const COINBASE_WALLET_LOGO_URL =
  'https://gist.githubusercontent.com/taycaldwell/2291907115c0bb5589bc346661435007/raw/cbw.svg'

type LeaderboardIdentityCellProps = {
  /** Server fallback when no CSW is on file (`user#id`). */
  display: string
  /** Full canonical Coinbase Smart Wallet when known. */
  cswAddress: string | null
}

function formatShortAddress(address: string): string {
  if (!address.startsWith('0x') || address.length < 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function basescanUrl(address: string): string {
  return `https://basescan.org/address/${address}`
}

/**
 * Public waitlist leaderboard identity — basename on the canonical CSW when
 * available, otherwise shortened CSW. Never surfaces Privy embedded EOAs.
 */
export function LeaderboardIdentityCell({ display, cswAddress }: LeaderboardIdentityCellProps) {
  const csw = cswAddress && isAddress(cswAddress) ? (cswAddress as Address) : null
  const basename = useBasenameForAddress(csw)

  const cswShortLabel = csw ? formatShortAddress(csw) : null
  const primaryLabel = basename.displayName ?? cswShortLabel ?? display
  const showCswSubtitle = Boolean(basename.displayName && cswShortLabel && cswShortLabel !== primaryLabel)
  const title = cswAddress ?? primaryLabel
  const avatarAddress = csw ?? undefined

  const labelNode = cswAddress ? (
    <a
      href={basescanUrl(cswAddress)}
      target="_blank"
      rel="noopener noreferrer"
      className="truncate text-zinc-200 hover:text-brand-300 transition-colors"
      title={title}
    >
      {primaryLabel}
    </a>
  ) : (
    <span className="truncate text-zinc-200" title={title}>
      {primaryLabel}
    </span>
  )

  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      {avatarAddress ? (
        basename.avatar ? (
          <img
            src={basename.avatar}
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 shrink-0 rounded-full object-cover"
          />
        ) : (
          <JazziconAvatar address={avatarAddress} size={24} className="shrink-0" />
        )
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="min-w-0 text-sm truncate">{labelNode}</div>
          {cswAddress ? (
            <img
              src={COINBASE_WALLET_LOGO_URL}
              alt=""
              width={16}
              height={16}
              loading="lazy"
              title="Coinbase Smart Wallet"
              className="h-4 w-4 shrink-0 object-contain opacity-90"
            />
          ) : null}
        </div>
        {showCswSubtitle ? (
          <div className="mt-0.5 font-mono text-[11px] text-zinc-600 truncate" title={cswAddress ?? undefined}>
            {cswShortLabel}
          </div>
        ) : null}
      </div>
    </div>
  )
}
