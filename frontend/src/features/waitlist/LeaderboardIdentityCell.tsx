import type { Address } from 'viem'
import { isAddress } from 'viem'

import { JazziconAvatar } from '@/components/account/JazziconAvatar'
import { useBasenameForAddress } from '@/hooks/useBasenameForAddress'

import { LeaderboardAccountBadge } from './LeaderboardAccountBadge'
import { resolveLeaderboardAccountKind } from './leaderboardAccountKind'

type LeaderboardIdentityCellProps = {
  display: string
  cswAddress: string | null
  labelHint?: string | null
  avatarUrl?: string | null
  showZoraBadge?: boolean
  showBaseAppBadge?: boolean
  walletProvider?: string | null
  /** Centered column for podium cards. */
  layout?: 'inline' | 'stacked'
}

function formatShortAddress(address: string): string {
  if (!address.startsWith('0x') || address.length < 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function isHexLabel(label: string): boolean {
  return label.startsWith('0x')
}

function basescanUrl(address: string): string {
  return `https://basescan.org/address/${address}`
}

function LeaderboardAvatar({
  address,
  imageUrl,
  size = 26,
}: {
  address: Address
  imageUrl: string | null | undefined
  size?: number
}) {
  if (imageUrl) {
    return (
      <span className="relative shrink-0" style={{ width: size, height: size }}>
        <JazziconAvatar address={address} size={size} className="rounded-full opacity-35" />
        <img
          src={imageUrl}
          alt=""
          width={size}
          height={size}
          className="absolute inset-0 rounded-full object-cover"
          style={{ width: size, height: size }}
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      </span>
    )
  }
  return <JazziconAvatar address={address} size={size} className="shrink-0 rounded-full" />
}

/**
 * Public waitlist leaderboard identity — basename on CSW when available,
 * otherwise shortened CSW. Never surfaces Privy embedded EOAs or persona labels.
 */
export function LeaderboardIdentityCell({
  display,
  cswAddress,
  labelHint = null,
  avatarUrl = null,
  showZoraBadge = false,
  showBaseAppBadge = false,
  walletProvider = null,
  layout = 'inline',
}: LeaderboardIdentityCellProps) {
  const csw = cswAddress && isAddress(cswAddress) ? (cswAddress as Address) : null
  const basename = useBasenameForAddress(csw)

  const cswShortLabel = csw ? formatShortAddress(csw) : null
  const zoraHandle =
    labelHint && showZoraBadge ? `@${labelHint.replace(/^@/, '')}` : labelHint
  const primaryLabel =
    basename.displayName ?? zoraHandle ?? cswShortLabel ?? (csw ? null : display)
  const resolvedLabel = primaryLabel ?? cswShortLabel ?? display
  const showCswSubtitle = Boolean(
    basename.displayName && cswShortLabel && basename.displayName !== cswShortLabel,
  )
  const title = cswAddress ?? resolvedLabel
  const resolvedAvatar = basename.avatar ?? avatarUrl ?? null
  const monospaceLabel = isHexLabel(resolvedLabel)
  const labelTextClass = monospaceLabel ? 'font-mono' : 'font-medium'

  const labelNode = cswAddress ? (
    <a
      href={basescanUrl(cswAddress)}
      target="_blank"
      rel="noopener noreferrer"
      className={`truncate ${labelTextClass} text-zinc-100 hover:text-brand-300 transition-colors`}
      title={cswAddress}
    >
      {resolvedLabel}
    </a>
  ) : (
    <span className={`truncate ${labelTextClass} text-zinc-100`} title={title}>
      {resolvedLabel}
    </span>
  )

  const stacked = layout === 'stacked'
  const avatarSize = stacked ? 40 : 26
  const accountKind = resolveLeaderboardAccountKind({
    showZoraBadge,
    showBaseAppBadge,
    cswAddress,
    walletProvider,
  })
  const showAccountBadge = accountKind !== 'unknown'

  return (
    <div
      className={
        stacked
          ? 'flex flex-col items-center gap-2 min-w-0 w-full text-center'
          : 'flex items-center gap-2 min-w-0 flex-1'
      }
    >
      <div className="relative shrink-0">
        {csw ? (
          <LeaderboardAvatar address={csw} imageUrl={resolvedAvatar} size={avatarSize} />
        ) : (
          <span
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-zinc-400"
            style={{ width: avatarSize, height: avatarSize }}
            aria-hidden
          >
            {resolvedLabel.slice(0, 1).toUpperCase()}
          </span>
        )}
        {showAccountBadge ? (
          <span className="absolute -bottom-0.5 -right-0.5">
            <LeaderboardAccountBadge
              showZoraBadge={showZoraBadge}
              showBaseAppBadge={showBaseAppBadge}
              cswAddress={cswAddress}
              walletProvider={walletProvider}
              size={stacked ? 13 : 12}
            />
          </span>
        ) : null}
      </div>
      <div className={stacked ? 'min-w-0 w-full' : 'min-w-0 flex-1'}>
        <div className={stacked ? 'min-w-0 w-full text-sm truncate' : 'min-w-0 text-[13px] sm:text-sm truncate'}>
          {labelNode}
        </div>
        {showCswSubtitle ? (
          <div
            className={
              stacked
                ? 'mt-1 font-mono text-[10px] text-zinc-400 truncate max-w-full'
                : 'mt-0.5 font-mono text-[10px] sm:text-[11px] text-zinc-400 truncate'
            }
            title={cswAddress ?? undefined}
          >
            {cswShortLabel}
          </div>
        ) : null}
      </div>
    </div>
  )
}
