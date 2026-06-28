import { useState } from 'react'
import type { Address } from 'viem'
import { isAddress } from 'viem'

import { JazziconAvatar } from '@/components/account/JazziconAvatar'
import { useChatIdentity } from '@/components/chat/useChatIdentity'

import { LeaderboardAccountBadge } from './LeaderboardAccountBadge'
import { resolveLeaderboardAccountKind } from './leaderboardAccountKind'

type LeaderboardIdentityCellProps = {
  display: string
  cswAddress: string | null
  /** External (user-controlled) EOA, used only when there is no canonical CSW. Never the Privy embedded EOA. */
  eoaAddress?: string | null
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

function lc(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function basescanUrl(address: string): string {
  return `https://basescan.org/address/${address}`
}

/**
 * Avatar for a leaderboard row. When a real profile image (Zora/basename) is
 * available it is shown on its own — the deterministic Jazzicon is only used as
 * a fallback when there is no image or the image fails to load.
 */
function LeaderboardAvatar({
  address,
  imageUrl,
  size = 26,
}: {
  address: Address
  imageUrl: string | null | undefined
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(imageUrl) && !failed

  return (
    <span
      className="relative shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={imageUrl as string}
          alt=""
          width={size}
          height={size}
          className="block size-full rounded-full object-cover"
          style={{ width: size, height: size }}
          onError={() => setFailed(true)}
        />
      ) : (
        <JazziconAvatar address={address} size={size} className="rounded-full" />
      )}
    </span>
  )
}

/**
 * Public waitlist leaderboard identity. Resolution order:
 * Zora handle → basename → ENS → short canonical CSW → short external EOA →
 * anonymous member label. Resolves from the canonical CSW when present,
 * otherwise the user's external EOA. Never surfaces Privy embedded EOAs.
 */
export function LeaderboardIdentityCell({
  display,
  cswAddress,
  eoaAddress = null,
  labelHint = null,
  avatarUrl = null,
  showZoraBadge = false,
  showBaseAppBadge = false,
  walletProvider = null,
  layout = 'inline',
}: LeaderboardIdentityCellProps) {
  const csw = cswAddress && isAddress(cswAddress) ? (cswAddress as Address) : null
  const eoa = !csw && eoaAddress && isAddress(eoaAddress) ? (eoaAddress as Address) : null
  // The public address we resolve identity from and link to: canonical CSW
  // first, otherwise the user's external EOA. Never the embedded EOA.
  const resolveAddress = csw ?? eoa
  const identity = useChatIdentity(resolveAddress, {
    fallbackName: display,
    fallbackAvatar: avatarUrl,
  })

  const addrShortLabel = resolveAddress ? formatShortAddress(resolveAddress) : null
  const zoraHandle = labelHint && showZoraBadge ? `@${labelHint.replace(/^@/, '')}` : null
  const zoraProfileName = identity.source === 'zora' ? identity.displayName : null
  const basenameOrEns = identity.source !== 'address' ? identity.displayName : null
  const baseName = basenameOrEns?.toLowerCase().endsWith('.base.eth') ? basenameOrEns : null
  const ensName =
    basenameOrEns && !baseName && basenameOrEns.toLowerCase().endsWith('.eth') ? basenameOrEns : null
  const primaryLabel =
    zoraHandle ?? zoraProfileName ?? baseName ?? ensName ?? addrShortLabel ?? (resolveAddress ? null : display)
  const resolvedLabel = primaryLabel ?? addrShortLabel ?? display
  const secondaryIdentityLabel =
    zoraHandle && (baseName ?? ensName)
      ? (baseName ?? ensName)
      : identity.secondary && addrShortLabel && lc(identity.secondary) !== lc(addrShortLabel)
        ? addrShortLabel
        : null
  const title = resolveAddress ?? resolvedLabel
  const resolvedAvatar = identity.avatar ?? avatarUrl ?? null
  const monospaceLabel = isHexLabel(resolvedLabel)
  const labelTextClass = monospaceLabel ? 'font-mono' : 'font-medium'

  const labelNode = resolveAddress ? (
    <a
      href={basescanUrl(resolveAddress)}
      target="_blank"
      rel="noopener noreferrer"
      className={`truncate ${labelTextClass} text-zinc-100 hover:text-brand-300 transition-colors`}
      title={resolveAddress}
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
        {resolveAddress ? (
          <LeaderboardAvatar address={resolveAddress} imageUrl={resolvedAvatar} size={avatarSize} />
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
        {secondaryIdentityLabel ? (
          <div
            className={
              stacked
                ? `mt-1 ${secondaryIdentityLabel.startsWith('0x') ? 'font-mono' : 'font-medium'} text-[10px] text-zinc-400 truncate max-w-full`
                : `mt-0.5 ${secondaryIdentityLabel.startsWith('0x') ? 'font-mono' : 'font-medium'} text-[10px] sm:text-[11px] text-zinc-400 truncate`
            }
            title={resolveAddress ?? undefined}
          >
            {secondaryIdentityLabel}
          </div>
        ) : null}
      </div>
    </div>
  )
}
