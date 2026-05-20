import type { Address } from 'viem'
import { isAddress } from 'viem'

import { JazziconAvatar } from '@/components/account/JazziconAvatar'
import { useBasenameForAddress } from '@/hooks/useBasenameForAddress'

type LeaderboardIdentityCellProps = {
  /** Server fallback label (short CSW, persona, or user#id). */
  display: string
  /** Full canonical Coinbase Smart Wallet when known. */
  cswAddress: string | null
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

  const primaryLabel = basename.displayName ?? display
  const showCswSubtitle = Boolean(basename.displayName && cswAddress && display !== primaryLabel)
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
    <div className="flex items-center gap-2 min-w-0">
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
      <div className="min-w-0">
        <div className="min-w-0 text-sm truncate">{labelNode}</div>
        {showCswSubtitle ? (
          <div className="mt-0.5 font-mono text-[11px] text-zinc-600 truncate" title={cswAddress ?? undefined}>
            {display}
          </div>
        ) : null}
      </div>
    </div>
  )
}
