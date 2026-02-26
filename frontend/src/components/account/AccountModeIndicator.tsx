import { Link } from 'react-router-dom'

import { useAccountContext } from '@/wallet/accountContext'

function shortAddress(value: string | undefined): string {
  if (!value) return '—'
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function formatAtomic(status: 'supported' | 'ready' | 'unsupported' | 'unknown'): string {
  if (status === 'supported' || status === 'ready') return 'Bundling ✓'
  if (status === 'unsupported') return 'Bundling —'
  return 'Bundling ?'
}

export function AccountModeIndicator() {
  const account = useAccountContext()

  const connectedLabel =
    account.signerType === 'SMART_WALLET'
      ? `Smart Wallet ${shortAddress(account.signerAddress)}`
      : account.signerType === 'EOA'
        ? `EOA ${shortAddress(account.signerAddress)}`
        : 'Not connected'

  const actingLabel =
    account.activeAccountType === 'SMART_WALLET'
      ? `Smart Wallet ${shortAddress(account.activeAccount)}`
      : account.activeAccountType === 'EOA'
        ? `EOA ${shortAddress(account.activeAccount)}`
        : 'Unavailable'

  const showModeToggle =
    account.signerType === 'EOA' &&
    account.eoaIsOwnerOfCsw === true &&
    Boolean(account.cswAddress && account.signerAddress)

  const desiredMode = account.activeAccountType === 'SMART_WALLET' ? 'SMART_WALLET' : 'EOA'

  return (
    <div className="border-b border-vault-border/60 bg-black/45">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-zinc-300">
            Connected as: {connectedLabel}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-zinc-300">
            Acting as: {actingLabel}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 ${
              account.uiFlags.paymasterAvailable
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-white/5 text-zinc-400'
            }`}
          >
            {account.uiFlags.paymasterAvailable ? 'Paymaster ✓' : 'Paymaster —'}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 ${
              account.capabilities.atomicStatus === 'supported' || account.capabilities.atomicStatus === 'ready'
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-white/5 text-zinc-400'
            }`}
          >
            {formatAtomic(account.capabilities.atomicStatus)}
          </span>

          {showModeToggle ? (
            <div className="inline-flex rounded-full border border-white/10 bg-black/40 p-0.5">
              <button
                type="button"
                aria-label="Use EOA mode"
                onClick={() => account.actions.setPreferredMode('EOA')}
                className={`rounded-full px-2 py-0.5 transition ${
                  desiredMode === 'EOA' ? 'bg-white/12 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                EOA mode
              </button>
              <button
                type="button"
                aria-label="Use smart wallet mode"
                onClick={() => account.actions.setPreferredMode('SMART_WALLET')}
                className={`rounded-full px-2 py-0.5 transition ${
                  desiredMode === 'SMART_WALLET'
                    ? 'bg-brand-primary/25 text-brand-300'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Smart Wallet mode
              </button>
            </div>
          ) : null}

          {!showModeToggle && account.uiFlags.shouldPromptToLinkOwner ? (
            <Link
              to="/account"
              className="rounded-full border border-brand-primary/35 bg-brand-primary/10 px-2 py-0.5 text-brand-300 hover:bg-brand-primary/20"
            >
              Unlock Smart Wallet features
            </Link>
          ) : null}

          {account.uiFlags.shouldShowNetworkMismatch ? (
            <span className="rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-amber-300">
              Switch to Base to verify smart-wallet ownership
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

