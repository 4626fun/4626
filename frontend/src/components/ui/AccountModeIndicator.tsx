import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { useAccount, usePublicClient } from 'wagmi'
import { useCanonicalWallet } from '@/hooks/useCanonicalWallet'
import {
  isCSWAvailable,
  readPreferredWalletMode,
} from '@/lib/uniswap/walletMode'
import { cn } from '@/lib/utils'

interface AccountModeIndicatorProps {
  compact?: boolean
  className?: string
}

export function AccountModeIndicator({ compact = false, className }: AccountModeIndicatorProps) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  const { canonicalAddress, canOperateCanonical } = useCanonicalWallet({
    address,
    publicClient,
    walletReady: isConnected,
  })

  const preferredMode = readPreferredWalletMode()

  const isSmartWalletAvailable = isCSWAvailable({
    canonicalAddress: canonicalAddress ?? null,
    signerAddress: (address as `0x${string}`) ?? null,
    canonicalReady: canOperateCanonical,
    eoaReady: isConnected,
  })

  const getActingMode = useCallback(() => {
    if (!isConnected) return null
    if (preferredMode === 'canonical' && isSmartWalletAvailable) return 'canonical'
    return 'eoa'
  }, [isConnected, preferredMode, isSmartWalletAvailable])

  const actingMode = getActingMode()

  if (!isConnected || !actingMode) return null

  const isCanonical = actingMode === 'canonical'

  // ── Compact pill ─────────────────────────────────────────────────────────
  if (compact) {
    return (
      <Link
        to="/account"
        title={isCanonical ? '1-click actions available — manage' : 'Using connected wallet — manage'}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-medium transition-all duration-150',
          'hover:bg-white/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary',
          isCanonical
            ? 'border-emerald-500/20 text-emerald-400/80 hover:border-emerald-500/30 hover:text-emerald-400'
            : 'border-white/8 text-zinc-500 hover:border-white/12 hover:text-zinc-400',
          className,
        )}
      >
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            isCanonical ? 'bg-emerald-400' : 'bg-zinc-600',
          )}
        />
        {isCanonical ? (
          <>
            Smart Wallet
            <Zap className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
          </>
        ) : (
          'EOA'
        )}
      </Link>
    )
  }

  // ── Full row ──────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs',
        isCanonical
          ? 'border-emerald-500/15 bg-emerald-400/[0.03] text-emerald-400/80'
          : 'border-white/6 bg-white/[0.02] text-zinc-400',
        className,
      )}
    >
      <span
        className={cn(
          'w-2 h-2 rounded-full shrink-0',
          isCanonical ? 'bg-emerald-400' : 'bg-zinc-600',
        )}
      />
      <span className="flex-1">
        {isCanonical ? (
          <>
            <span className="text-vault-subtext">Acting as </span>
            <span className="font-medium text-emerald-400">Smart Wallet</span>
          </>
        ) : (
          <>
            <span className="text-vault-subtext">Acting as </span>
            <span className="font-medium text-zinc-300">connected wallet</span>
          </>
        )}
      </span>
      {isCanonical ? (
        <span className="flex items-center gap-1 text-emerald-400/70">
          <Zap className="w-3 h-3" aria-hidden="true" />
          <span>1-click</span>
        </span>
      ) : (
        isSmartWalletAvailable && (
          <Link
            to="/account"
            className="text-brand-accent hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary rounded"
          >
            Switch →
          </Link>
        )
      )}
    </div>
  )
}
