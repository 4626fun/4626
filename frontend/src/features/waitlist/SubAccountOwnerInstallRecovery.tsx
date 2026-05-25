import { buildWaitlistSetupUrl } from '@/lib/auth/waitlistEntry'

type Props = {
  inBaseApp: boolean
  onRecheck: () => void
  recheckBusy?: boolean
}

export function SubAccountOwnerInstallRecovery(props: Props) {
  const { inBaseApp, onRecheck, recheckBusy = false } = props
  const baseAppSetupUrl = buildWaitlistSetupUrl('base-app')
  const legacySetupUrl = buildWaitlistSetupUrl('owner-install')

  if (inBaseApp) {
    return (
      <div
        className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3"
        data-testid="sub-account-owner-install-recovery"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Still stuck?</p>
        <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-zinc-400">
          <li>Confirm Base App is on <span className="text-zinc-300">Base Mainnet</span>, not testnet.</li>
          <li>Force-close 4626 in Base App, then reopen the setup link below.</li>
          <li>Tap <span className="text-zinc-300">Enable 4626 signing</span> once and approve the wallet prompt.</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <a
            href={baseAppSetupUrl}
            className="inline-flex h-8 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08]"
          >
            Reopen setup in Base App
          </a>
          <button
            type="button"
            disabled={recheckBusy}
            onClick={onRecheck}
            className="inline-flex h-8 items-center text-xs font-medium text-zinc-400 transition hover:text-zinc-300 disabled:opacity-50"
          >
            {recheckBusy ? 'Checking…' : 'Re-check signing status'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3"
      data-testid="sub-account-owner-install-recovery"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Other ways to finish</p>
      <div className="space-y-2 text-xs leading-relaxed text-zinc-400">
        <p>
          <span className="text-zinc-300">Base App path (recommended):</span> app-wallet signing must finish inside
          Base App on Base Mainnet.
        </p>
        <a
          href={baseAppSetupUrl}
          className="inline-flex h-8 items-center rounded-lg bg-brand-primary px-3 text-xs font-semibold text-white shadow-[0_4px_16px_rgb(var(--brand-primary)/0.22)] hover:bg-brand-hover"
        >
          Open setup in Base App
        </a>
      </div>
      <div className="space-y-2 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-zinc-400">
        <p>
          <span className="text-zinc-300">Desktop / MetaMask path:</span> skip the app wallet and enable signing on
          your parent smart wallet instead (no sub-account).
        </p>
        <a
          href={legacySetupUrl}
          className="inline-flex h-8 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08]"
        >
          Use desktop signing setup
        </a>
      </div>
    </div>
  )
}
