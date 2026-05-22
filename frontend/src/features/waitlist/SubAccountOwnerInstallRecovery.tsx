import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { buildWaitlistSetupPath, buildWaitlistSetupUrl } from '@/lib/auth/waitlistEntry'

type Props = {
  inBaseApp: boolean
  onRecheck: () => void
  recheckBusy?: boolean
}

async function copyText(value: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

export function SubAccountOwnerInstallRecovery(props: Props) {
  const { inBaseApp, onRecheck, recheckBusy = false } = props
  const navigate = useNavigate()
  const baseAppSetupUrl = buildWaitlistSetupUrl('base-app')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const handleCopyBaseAppLink = useCallback(async () => {
    const ok = await copyText(baseAppSetupUrl)
    setCopyState(ok ? 'copied' : 'failed')
  }, [baseAppSetupUrl])

  const handleDesktopSigningSetup = useCallback(() => {
    navigate(buildWaitlistSetupPath('owner-install'))
  }, [navigate])

  if (inBaseApp) {
    return (
      <div
        className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3"
        data-testid="sub-account-owner-install-recovery"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Still stuck?</p>
        <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-zinc-400">
          <li>
            Confirm Base App is on <span className="text-zinc-300">Base Mainnet</span>, not testnet.
          </li>
          <li>Force-close 4626 in Base App, then reopen the setup link below.</li>
          <li>
            Tap <span className="text-zinc-300">Enable 4626 signing</span> once and approve the wallet prompt.
          </li>
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
          <span className="text-zinc-300">Base App path (recommended):</span> copy the setup link, open Base App on
          your phone, paste it in the in-app browser, then tap Enable 4626 signing.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCopyBaseAppLink()}
            className="inline-flex h-8 items-center rounded-lg bg-brand-primary px-3 text-xs font-semibold text-white shadow-[0_4px_16px_rgb(var(--brand-primary)/0.22)] hover:bg-brand-hover"
          >
            Copy Base App setup link
          </button>
        </div>
        {copyState === 'copied' ? (
          <p className="text-emerald-200/90" role="status">
            Link copied. Open Base App, paste into the browser, and finish Enable 4626 signing there.
          </p>
        ) : null}
        {copyState === 'failed' ? (
          <p className="text-amber-200/90" role="status">
            Could not copy automatically. Open{' '}
            <a href={baseAppSetupUrl} className="underline underline-offset-2">
              {baseAppSetupUrl}
            </a>{' '}
            on a phone with Base App.
          </p>
        ) : null}
      </div>
      <div className="space-y-2 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-zinc-400">
        <p>
          <span className="text-zinc-300">Desktop / MetaMask path:</span> skip the app wallet and enable signing on
          your parent smart wallet instead (no sub-account).
        </p>
        <button
          type="button"
          onClick={handleDesktopSigningSetup}
          className="inline-flex h-8 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08]"
          data-testid="sub-account-desktop-signing-setup-button"
        >
          Use desktop signing setup
        </button>
      </div>
    </div>
  )
}
