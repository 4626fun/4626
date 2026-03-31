import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'

import { WalletProviderIcon } from '@/components/ui/WalletProviderIcon'
import { useAccountContext } from '@/wallet/accountContext'

function shortAddress(value: string | undefined): string {
  if (!value) return '—'
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function formatPaymasterBadge(available: boolean): string {
  return available ? 'Paymaster on' : 'Paymaster off'
}

function formatAtomicBadge(status: 'supported' | 'ready' | 'unsupported' | 'unknown'): {
  label: string
  active: boolean
  pending: boolean
} {
  if (status === 'supported' || status === 'ready') {
    return { label: 'Bundling on', active: true, pending: false }
  }
  if (status === 'unsupported') {
    return { label: 'Bundling off', active: false, pending: false }
  }
  return { label: 'Bundling ...', active: false, pending: true }
}

function modeButtonTitle(params: {
  label: string
  address: string | undefined
  isActive: boolean
}): string {
  if (!params.address) return `${params.label} unavailable`
  return params.isActive
    ? `${params.label}: ${params.address} (click to copy)`
    : `${params.label}: ${params.address} (click to switch)`
}

export function AccountWalletRail() {
  const { connector } = useAccount()
  const account = useAccountContext()
  const [hoveredMode, setHoveredMode] = useState<'EOA' | 'SMART_WALLET' | null>(null)
  const [copiedMode, setCopiedMode] = useState<'EOA' | 'SMART_WALLET' | null>(null)

  const copyAddress = useCallback(async (address: string | undefined): Promise<boolean> => {
    if (!address) return false
    if (typeof navigator === 'undefined') return false
    if (!navigator.clipboard?.writeText) return false
    try {
      await navigator.clipboard.writeText(address)
      return true
    } catch {
      // Ignore clipboard write failures (for example insecure context).
      return false
    }
    return false
  }, [])

  const showModeToggle =
    account.signerType === 'EOA' &&
    account.eoaIsOwnerOfCsw === true &&
    Boolean(account.cswAddress && account.signerAddress)

  const desiredMode =
    account.preferredMode ??
    (account.activeAccountType === 'SMART_WALLET' ? 'SMART_WALLET' : 'EOA')
  const smartWalletConnected = account.activeAccountType === 'SMART_WALLET' || account.signerType === 'SMART_WALLET'
  const userWalletAddress = account.signerAddress || undefined
  const smartWalletAddress =
    account.cswAddress ||
    (account.activeAccountType === 'SMART_WALLET' ? account.activeAccount || undefined : undefined)
  const atomicBadge = formatAtomicBadge(account.capabilities.atomicStatus)
  const hasSignerChip = Boolean(account.signerAddress)
  const hasActiveChip = Boolean(account.activeAccount)
  const hideSignerChipOnMobile = !showModeToggle && hasSignerChip && hasActiveChip
  const paymasterLabelMobile = account.uiFlags.paymasterAvailable ? 'PM on' : 'PM off'
  const bundlingLabelMobile = atomicBadge.active ? 'Bundle on' : atomicBadge.pending ? 'Bundle ...' : 'Bundle off'
  const hasWalletContext = hasSignerChip || hasActiveChip || showModeToggle
  const hasPromptContext = account.uiFlags.shouldPromptToLinkOwner || account.uiFlags.shouldShowNetworkMismatch

  const handleModeClick = useCallback(
    async (mode: 'EOA' | 'SMART_WALLET') => {
      const isActive = desiredMode === mode
      if (isActive) {
        const addr = mode === 'EOA' ? userWalletAddress : smartWalletAddress
        const copied = await copyAddress(addr)
        if (copied) setCopiedMode(mode)
        return
      }
      account.actions.setPreferredMode(mode)
    },
    [account.actions, copyAddress, desiredMode, smartWalletAddress, userWalletAddress],
  )

  useEffect(() => {
    if (!copiedMode) return
    const timer = window.setTimeout(() => setCopiedMode(null), 1200)
    return () => window.clearTimeout(timer)
  }, [copiedMode])

  if (!hasWalletContext && !hasPromptContext) return null

  return (
    <div className="border-b border-white/7 bg-linear-to-b from-black/38 to-black/20 backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-12 py-1.5 min-h-[34px]">
        <div className="mx-auto flex w-fit max-w-full items-center gap-1.5 sm:gap-2 overflow-x-auto whitespace-nowrap rounded-full border border-white/10 bg-black/24 px-2 py-1 text-[10px] sm:text-[11px] scrollbar-hide">
          {!showModeToggle ? (
            <>
              {hasSignerChip ? (
                <button
                  type="button"
                  onClick={() => void copyAddress(account.signerAddress)}
                  className={`shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-zinc-300 cursor-copy transition-colors hover:text-white ${
                    hideSignerChipOnMobile ? 'hidden sm:inline-flex' : 'inline-flex'
                  }`}
                  title={
                    account.signerType === 'SMART_WALLET'
                      ? `Smart Wallet ${shortAddress(account.signerAddress)} (click to copy)`
                      : account.signerType === 'EOA'
                        ? `User Wallet ${shortAddress(account.signerAddress)} (click to copy)`
                        : 'Not connected'
                  }
                >
                  <WalletProviderIcon
                    provider={account.signerType === 'SMART_WALLET' ? 'coinbase' : undefined}
                    walletType={account.signerType === 'SMART_WALLET' ? 'smart_wallet' : 'embedded_eoa'}
                    connectorId={connector?.id}
                    isCanonicalSmartWallet={account.signerType === 'SMART_WALLET'}
                    size={12}
                  />
                  {account.signerType ? shortAddress(account.signerAddress) : '—'}
                </button>
              ) : null}
              {hasActiveChip ? (
                <button
                  type="button"
                  onClick={() => void copyAddress(account.activeAccount)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-zinc-300 cursor-copy transition-colors hover:text-white"
                  title={
                    account.activeAccountType === 'SMART_WALLET'
                      ? `Smart Wallet ${shortAddress(account.activeAccount)} (click to copy)`
                      : account.activeAccountType === 'EOA'
                        ? `User Wallet ${shortAddress(account.activeAccount)} (click to copy)`
                        : 'Unavailable'
                  }
                >
                  <WalletProviderIcon
                    provider={account.activeAccountType === 'SMART_WALLET' ? 'coinbase' : undefined}
                    walletType={account.activeAccountType === 'SMART_WALLET' ? 'smart_wallet' : 'embedded_eoa'}
                    connectorId={connector?.id}
                    isCanonicalSmartWallet={account.activeAccountType === 'SMART_WALLET'}
                    size={12}
                  />
                  {shortAddress(account.activeAccount)}
                </button>
              ) : null}
            </>
          ) : null}
          <span
            className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
              account.uiFlags.paymasterAvailable
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-white/5 text-zinc-400'
            }`}
            title="Paymaster"
          >
            <span className="sm:hidden">{paymasterLabelMobile}</span>
            <span className="hidden sm:inline">{formatPaymasterBadge(account.uiFlags.paymasterAvailable)}</span>
          </span>
          <span
            className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
              atomicBadge.active
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : atomicBadge.pending
                  ? 'border-amber-400/20 bg-amber-500/10 text-amber-200'
                  : 'border-white/10 bg-white/5 text-zinc-400'
            }`}
            title="Bundling"
          >
            <span className="sm:hidden">{bundlingLabelMobile}</span>
            <span className="hidden sm:inline">{atomicBadge.label}</span>
          </span>

          {showModeToggle ? (
            <div className="shrink-0 inline-flex items-center gap-1.5">
              <div className="inline-flex rounded-full border border-white/10 bg-black/40 p-0.5">
              <button
                type="button"
                aria-label={desiredMode === 'EOA' ? 'Copy User Wallet address' : 'Use User Wallet mode'}
                onClick={() => void handleModeClick('EOA')}
                title={modeButtonTitle({
                  label: 'User Wallet',
                  address: userWalletAddress,
                  isActive: desiredMode === 'EOA',
                })}
                onMouseEnter={() => setHoveredMode('EOA')}
                onMouseLeave={() => setHoveredMode(null)}
                onFocus={() => setHoveredMode('EOA')}
                onBlur={() => setHoveredMode(null)}
                className={`rounded-full px-2 py-0.5 transition-all duration-200 ${
                  desiredMode === 'EOA' ? 'bg-white/12 text-white' : 'text-zinc-400 hover:text-zinc-200'
                } ${desiredMode === 'EOA' && userWalletAddress ? 'cursor-copy' : ''}`}
              >
                {hoveredMode === 'EOA' && userWalletAddress ? shortAddress(userWalletAddress) : 'User Wallet'}
              </button>
              <button
                type="button"
                aria-label={desiredMode === 'SMART_WALLET' ? 'Copy Smart Wallet address' : 'Use Smart Wallet mode'}
                onClick={() => void handleModeClick('SMART_WALLET')}
                title={modeButtonTitle({
                  label: 'Smart Wallet',
                  address: smartWalletAddress,
                  isActive: desiredMode === 'SMART_WALLET',
                })}
                onMouseEnter={() => setHoveredMode('SMART_WALLET')}
                onMouseLeave={() => setHoveredMode(null)}
                onFocus={() => setHoveredMode('SMART_WALLET')}
                onBlur={() => setHoveredMode(null)}
                className={`rounded-full px-2 py-0.5 transition-all duration-200 ${
                  desiredMode === 'SMART_WALLET'
                    ? 'bg-brand-primary/25 text-brand-300'
                    : 'text-zinc-400 hover:text-zinc-200'
                } ${desiredMode === 'SMART_WALLET' && smartWalletAddress ? 'cursor-copy' : ''}`}
              >
                <span className="inline-flex items-center gap-1">
                  {smartWalletConnected ? (
                    <WalletProviderIcon
                      provider="coinbase"
                      walletType="smart_wallet"
                      isCanonicalSmartWallet
                      size={12}
                    />
                  ) : null}
                  {hoveredMode === 'SMART_WALLET' && smartWalletAddress ? shortAddress(smartWalletAddress) : 'Smart Wallet'}
                </span>
              </button>
              </div>
              {copiedMode ? (
                <span className="text-[10px] text-emerald-300/90">Copied</span>
              ) : null}
            </div>
          ) : null}

          {!showModeToggle && account.uiFlags.shouldPromptToLinkOwner ? (
            <Link
              to="/accounts"
              className="shrink-0 rounded-full border border-brand-primary/35 bg-brand-primary/10 px-2 py-0.5 text-brand-300 hover:bg-brand-primary/20"
            >
              <span className="sm:hidden">Unlock SW</span>
              <span className="hidden sm:inline">Unlock Smart Wallet features</span>
            </Link>
          ) : null}

          {account.uiFlags.shouldShowNetworkMismatch ? (
            <span className="shrink-0 rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-amber-300">
              <span className="sm:hidden">Switch to Base</span>
              <span className="hidden sm:inline">Switch to Base to verify smart-wallet ownership</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
