import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'

import { WalletProviderIcon } from '@/components/ui/WalletProviderIcon'
import { useAccountContext } from '@/wallet/accountContext'

function shortAddress(value: string | undefined): string {
  if (!value) return '—'
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function formatAtomic(status: 'supported' | 'ready' | 'unsupported' | 'unknown'): string {
  if (status === 'supported' || status === 'ready') return '✓'
  if (status === 'unsupported') return '—'
  return '?'
}

export function AccountModeIndicator() {
  const { connector } = useAccount()
  const account = useAccountContext()

  const copyAddress = useCallback(async (address: string | undefined) => {
    if (!address) return
    if (typeof navigator === 'undefined') return
    if (!navigator.clipboard?.writeText) return
    try {
      await navigator.clipboard.writeText(address)
    } catch {
      // Ignore clipboard write failures (for example insecure context).
    }
  }, [])

  const showModeToggle =
    account.signerType === 'EOA' &&
    account.eoaIsOwnerOfCsw === true &&
    Boolean(account.cswAddress && account.signerAddress)

  const desiredMode = account.activeAccountType === 'SMART_WALLET' ? 'SMART_WALLET' : 'EOA'
  const smartWalletConnected = account.activeAccountType === 'SMART_WALLET' || account.signerType === 'SMART_WALLET'

  return (
    <div className="border-b border-vault-border/60 bg-black/45">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 min-h-[42px]">
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap text-[11px] scrollbar-hide">
          <button
            type="button"
            onClick={() => void copyAddress(account.signerAddress)}
            disabled={!account.signerAddress}
            className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-zinc-300 disabled:cursor-default enabled:cursor-copy enabled:hover:text-white"
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
          <button
            type="button"
            onClick={() => void copyAddress(account.activeAccount)}
            disabled={!account.activeAccount}
            className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-zinc-300 disabled:cursor-default enabled:cursor-copy enabled:hover:text-white"
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
            {account.activeAccountType !== 'UNKNOWN' ? shortAddress(account.activeAccount) : '—'}
          </button>
          <span
            className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
              account.uiFlags.paymasterAvailable
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-white/5 text-zinc-400'
            }`}
            title="Paymaster"
          >
            {account.uiFlags.paymasterAvailable ? '✓' : '—'}
          </span>
          <span
            className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
              account.capabilities.atomicStatus === 'supported' || account.capabilities.atomicStatus === 'ready'
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-white/5 text-zinc-400'
            }`}
            title="Bundling"
          >
            {formatAtomic(account.capabilities.atomicStatus)}
          </span>

          {showModeToggle ? (
            <div className="shrink-0 inline-flex rounded-full border border-white/10 bg-black/40 p-0.5">
              <button
                type="button"
                aria-label="Use User Wallet mode"
                onClick={() => account.actions.setPreferredMode('EOA')}
                className={`rounded-full px-2 py-0.5 transition ${
                  desiredMode === 'EOA' ? 'bg-white/12 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                User Wallet
              </button>
              <button
                type="button"
                aria-label="Use Smart Wallet mode"
                onClick={() => account.actions.setPreferredMode('SMART_WALLET')}
                className={`rounded-full px-2 py-0.5 transition ${
                  desiredMode === 'SMART_WALLET'
                    ? 'bg-brand-primary/25 text-brand-300'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
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
                  Smart Wallet
                </span>
              </button>
            </div>
          ) : null}

          {!showModeToggle && account.uiFlags.shouldPromptToLinkOwner ? (
            <Link
              to="/accounts"
              className="shrink-0 rounded-full border border-brand-primary/35 bg-brand-primary/10 px-2 py-0.5 text-brand-300 hover:bg-brand-primary/20"
            >
              Unlock Smart Wallet features
            </Link>
          ) : null}

          {account.uiFlags.shouldShowNetworkMismatch ? (
            <span className="shrink-0 rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-amber-300">
              Switch to Base to verify smart-wallet ownership
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

