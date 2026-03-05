import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { useAccountContext } from '@/wallet/accountContext'
import { cn } from '@/lib/utils'

interface AccountModeIndicatorProps {
  compact?: boolean
  className?: string
}

export function AccountModeIndicator({ compact = false, className }: AccountModeIndicatorProps) {
  const account = useAccountContext()
  const isConnected = Boolean(account.signerAddress)
  const isSmartWalletMode = account.activeAccountType === 'SMART_WALLET'
  const canSwitchToSmartWallet =
    account.signerType === 'EOA' &&
    account.eoaIsOwnerOfCsw === true &&
    Boolean(account.cswAddress && account.signerAddress)

  if (!isConnected) return null

  // ── Compact pill ─────────────────────────────────────────────────────────
  const isConnectedAsAgent = account.signerType === 'SMART_WALLET'
  const activeIdentityHint =
    isSmartWalletMode && isConnectedAsAgent
      ? 'Connected with a Smart Wallet. Acting as Smart Wallet.'
      : isSmartWalletMode && account.signerType === 'EOA'
        ? 'Connected with a User Wallet, but acting as a linked Smart Wallet.'
        : isConnectedAsAgent && account.activeAccountType !== 'SMART_WALLET'
          ? 'Connected with Smart Wallet while acting as a User Wallet.'
          : 'Acting as your connected User Wallet.'

  if (compact) {
    return (
      <Link
        to="/accounts"
        title={
          isSmartWalletMode
            ? `Smart Wallet mode active — ${isConnectedAsAgent ? 'connected Smart Wallet' : 'linked Smart Wallet'}`
            : 'User Wallet mode active — manage'
        }
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-medium transition-all duration-150',
          'hover:bg-white/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary',
          isSmartWalletMode
            ? 'border-emerald-500/20 text-emerald-400/80 hover:border-emerald-500/30 hover:text-emerald-400'
            : 'border-white/8 text-zinc-500 hover:border-white/12 hover:text-zinc-400',
          className,
        )}
      >
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            isSmartWalletMode ? 'bg-emerald-400' : 'bg-zinc-600',
          )}
        />
        {isSmartWalletMode ? (
          <>
            Smart Wallet
            <Zap className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
          </>
        ) : (
          'User Wallet'
        )}
      </Link>
    )
  }

  // ── Full row ──────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs',
        isSmartWalletMode
          ? 'border-emerald-500/15 bg-emerald-400/[0.03] text-emerald-400/80'
          : 'border-white/6 bg-white/[0.02] text-zinc-400',
        className,
      )}
    >
      <span
        className={cn(
          'w-2 h-2 rounded-full shrink-0',
          isSmartWalletMode ? 'bg-emerald-400' : 'bg-zinc-600',
        )}
      />
      <span className="flex-1">
        {isSmartWalletMode ? (
          <>
            <span className="text-vault-subtext">Acting as </span>
            <span className="font-medium text-emerald-400">Smart Wallet</span>
          </>
        ) : (
          <>
            <span className="text-vault-subtext">Acting as </span>
            <span className="font-medium text-zinc-300">User Wallet</span>
          </>
        )}
      </span>
      <span className="hidden sm:block text-[10px] text-zinc-400">{activeIdentityHint}</span>
      {isSmartWalletMode ? (
        account.uiFlags.aaAvailable ? (
          <span className="flex items-center gap-1 text-emerald-400/70">
            <Zap className="w-3 h-3" aria-hidden="true" />
            <span>1-click</span>
          </span>
        ) : (
          <span className="text-[11px] text-zinc-500">Limited mode</span>
        )
      ) : (
        canSwitchToSmartWallet ? (
          <Link
            to="/accounts"
            className="text-brand-accent hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary rounded"
          >
            Switch →
          </Link>
        ) : account.uiFlags.shouldPromptToLinkOwner ? (
          <Link
            to="/accounts"
            className="text-brand-accent hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary rounded"
          >
            Unlock →
          </Link>
        ) : (
          <span className="text-[11px] text-zinc-500">User Wallet</span>
        )
      )}
    </div>
  )
}
