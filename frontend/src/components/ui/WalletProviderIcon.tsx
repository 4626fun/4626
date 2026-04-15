import { Wallet as WalletGlyph } from 'lucide-react'
import {
  WalletCoinbase,
  WalletMetamask,
  WalletRabby,
  WalletWalletConnect,
} from '@web3icons/react'

import { cn } from '@/lib/shared/utils'
import { inferWalletProvider, walletProviderLabel } from '@/lib/wallet/providerIdentity'

interface WalletProviderIconProps {
  provider?: string | null
  walletType?: string | null
  connectorId?: string | null
  isCanonicalSmartWallet?: boolean
  size?: number
  className?: string
}

export function WalletProviderIcon({
  provider,
  walletType,
  connectorId,
  isCanonicalSmartWallet,
  size = 14,
  className,
}: WalletProviderIconProps) {
  const providerId = inferWalletProvider({
    provider,
    walletType,
    connectorId,
    isCanonicalSmartWallet,
  })
  const label = walletProviderLabel(providerId)
  const shared = {
    size,
    className: cn('shrink-0', className),
    title: label,
    'aria-label': label,
  } as const

  if (providerId === 'coinbase') {
    return <WalletCoinbase {...shared} variant="branded" />
  }
  if (providerId === 'metamask') {
    return <WalletMetamask {...shared} variant="branded" />
  }
  if (providerId === 'rabby') {
    return <WalletRabby {...shared} variant="branded" />
  }
  if (providerId === 'walletconnect') {
    return <WalletWalletConnect {...shared} variant="branded" />
  }
  if (providerId === 'privy') {
    return (
      <span
        title={label}
        aria-label={label}
        className={cn('inline-flex shrink-0 items-center justify-center', className)}
        style={{ width: size, height: size }}
      >
        <img
          src="/brands/privy-symbol-white.svg"
          alt=""
          aria-hidden="true"
          className="h-[88%] w-auto object-contain"
        />
      </span>
    )
  }

  return (
    <span title={label} aria-label={label} className={cn('inline-flex shrink-0', className)}>
      <WalletGlyph size={size} className="text-zinc-500" />
    </span>
  )
}
