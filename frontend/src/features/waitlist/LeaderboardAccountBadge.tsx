import { WalletProviderIcon } from '@/components/ui/WalletProviderIcon'
import { cn } from '@/lib/shared/utils'

import {
  leaderboardAccountKindLabel,
  resolveLeaderboardAccountKind,
  resolveLeaderboardWalletProvider,
  type LeaderboardAccountKind,
} from './leaderboardAccountKind'

const ZORA_LOGO_URL = '/brands/zora-token.svg'
const BASE_APP_LOGO_URL = '/base/base-square-blue.svg'
const COINBASE_WALLET_LOGO_URL =
  'https://gist.githubusercontent.com/taycaldwell/2291907115c0bb5589bc346661435007/raw/cbw.svg'

type LeaderboardAccountBadgeProps = {
  showZoraBadge?: boolean
  showBaseAppBadge?: boolean
  cswAddress?: string | null
  walletProvider?: string | null
  size?: number
  className?: string
}

function BrandIcon({
  src,
  label,
  size,
  className,
}: {
  src: string
  label: string
  size: number
  className?: string
}) {
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      title={label}
      aria-label={label}
      className={cn('shrink-0 object-contain', className)}
      style={{ width: size, height: size }}
    />
  )
}

function AccountKindGlyph({
  kind,
  walletProvider,
  size,
}: {
  kind: LeaderboardAccountKind
  walletProvider: ReturnType<typeof resolveLeaderboardWalletProvider>
  size: number
}) {
  const label = leaderboardAccountKindLabel(kind, walletProvider)

  if (kind === 'zora') {
    return <BrandIcon src={ZORA_LOGO_URL} label={label} size={size} />
  }
  if (kind === 'base_app') {
    return <BrandIcon src={BASE_APP_LOGO_URL} label={label} size={size} />
  }
  if (kind === 'coinbase_csw') {
    return <BrandIcon src={COINBASE_WALLET_LOGO_URL} label={label} size={size} />
  }
  if (kind === 'eoa') {
    return (
      <WalletProviderIcon
        provider={walletProvider}
        walletType="external_eoa"
        size={size}
        className="rounded-sm"
      />
    )
  }

  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] font-semibold text-zinc-400"
      style={{ width: size, height: size }}
    >
      ?
    </span>
  )
}

export function LeaderboardAccountBadge({
  showZoraBadge = false,
  showBaseAppBadge = false,
  cswAddress = null,
  walletProvider = null,
  size = 14,
  className,
}: LeaderboardAccountBadgeProps) {
  const kind = resolveLeaderboardAccountKind({
    showZoraBadge,
    showBaseAppBadge,
    cswAddress,
    walletProvider,
  })
  const resolvedProvider = resolveLeaderboardWalletProvider(walletProvider)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-vault-bg ring-1 ring-white/15',
        className,
      )}
      style={{ width: size + 4, height: size + 4 }}
    >
      <AccountKindGlyph kind={kind} walletProvider={resolvedProvider} size={size} />
    </span>
  )
}
