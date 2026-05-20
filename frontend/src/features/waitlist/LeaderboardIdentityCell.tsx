import type { Address } from 'viem'
import { isAddress } from 'viem'

import { JazziconAvatar } from '@/components/account/JazziconAvatar'
import { useBasenameForAddress } from '@/hooks/useBasenameForAddress'

const COINBASE_WALLET_LOGO_URL =
  'https://gist.githubusercontent.com/taycaldwell/2291907115c0bb5589bc346661435007/raw/cbw.svg'
const ZORA_LOGO_URL = '/brands/zora-token.svg'
const BASE_APP_LOGO_URL = '/base/base-square-blue.svg'

type LeaderboardIdentityCellProps = {
  display: string
  cswAddress: string | null
  labelHint?: string | null
  avatarUrl?: string | null
  showZoraBadge?: boolean
  showBaseAppBadge?: boolean
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

function WalletBadge({
  src,
  title,
}: {
  src: string
  title: string
}) {
  return (
    <img
      src={src}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      title={title}
      className="h-4 w-4 shrink-0 object-contain opacity-90"
    />
  )
}

function LeaderboardAvatar({
  address,
  imageUrl,
}: {
  address: Address
  imageUrl: string | null | undefined
}) {
  const size = 26
  if (imageUrl) {
    return (
      <span className="relative shrink-0" style={{ width: size, height: size }}>
        <JazziconAvatar address={address} size={size} className="rounded-full opacity-35" />
        <img
          src={imageUrl}
          alt=""
          width={size}
          height={size}
          className="absolute inset-0 h-[26px] w-[26px] rounded-full object-cover"
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
}: LeaderboardIdentityCellProps) {
  const csw = cswAddress && isAddress(cswAddress) ? (cswAddress as Address) : null
  const basename = useBasenameForAddress(csw)

  const cswShortLabel = csw ? formatShortAddress(csw) : null
  const primaryLabel =
    basename.displayName ?? labelHint ?? cswShortLabel ?? (csw ? null : display)
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

  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      {csw ? <LeaderboardAvatar address={csw} imageUrl={resolvedAvatar} /> : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {showZoraBadge ? <WalletBadge src={ZORA_LOGO_URL} title="Zora Coinbase Smart Wallet" /> : null}
          {showBaseAppBadge ? <WalletBadge src={BASE_APP_LOGO_URL} title="Base App" /> : null}
          <div className="min-w-0 text-[13px] sm:text-sm truncate">{labelNode}</div>
          {cswAddress ? <WalletBadge src={COINBASE_WALLET_LOGO_URL} title="Coinbase Smart Wallet" /> : null}
        </div>
        {showCswSubtitle ? (
          <div className="mt-0.5 font-mono text-[10px] sm:text-[11px] text-zinc-500 truncate" title={cswAddress ?? undefined}>
            {cswShortLabel}
          </div>
        ) : null}
      </div>
    </div>
  )
}
