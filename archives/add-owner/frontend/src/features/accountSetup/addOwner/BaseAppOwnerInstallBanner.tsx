import { ownerInstallExternalBrowserUrl } from '@/lib/relay/baseAppOwnerInstallGuard'

type BaseAppOwnerInstallBannerProps = {
  className?: string
}

export function BaseAppOwnerInstallBanner(props: BaseAppOwnerInstallBannerProps) {
  const { className = '' } = props
  const externalUrl = ownerInstallExternalBrowserUrl()

  return (
    <div
      className={`rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-3 text-xs leading-relaxed text-amber-100 ${className}`}
      data-testid="base-app-owner-install-external-browser"
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300/90">Continue in Chrome or Safari</div>
      <p className="mt-2">
        The Base App browser cannot sign the Relay deposit for Enable 4626 signing on passkey-controlled
        smart wallets. Build the preview here if you want, then finish step 2 in a regular browser with
        the same email account.
      </p>
      <a
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer external"
        className="mt-3 inline-flex items-center justify-center rounded-lg bg-amber-300 px-3 py-2 text-[11px] font-semibold text-black hover:bg-amber-200"
      >
        Open owner install in browser
      </a>
    </div>
  )
}
