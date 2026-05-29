import { Button } from '@/components/ui/Button'

const BASE_ACCOUNT_LOGO = '/base/base-square-blue.svg'

type BaseAppCanonicalWalletLinkPanelProps = {
  enabled: boolean
  canonicalCswAddress: string | null | undefined
  ready: boolean
  linking: boolean
  linkError: string | null
  onLink: () => void | Promise<void>
  onSignOut?: () => void | Promise<void>
  signOutBusy?: boolean
  /** When true, profile has no CSW yet — connect Base first so wallet sync can populate it. */
  missingCanonicalCsw?: boolean
  footerLinkHref?: string
  footerLinkLabel?: string
}

export function BaseAppCanonicalWalletLinkPanel(props: BaseAppCanonicalWalletLinkPanelProps) {
  const {
    enabled,
    canonicalCswAddress,
    ready,
    linking,
    linkError,
    onLink,
    onSignOut,
    signOutBusy = false,
    footerLinkHref,
    footerLinkLabel,
    missingCanonicalCsw = false,
  } = props

  if (!enabled) return null

  if (ready) {
    return (
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-4 text-xs text-emerald-100/90">
        Base Account wallet connected for signing ({canonicalCswAddress?.slice(0, 10)}…).
      </div>
    )
  }

  return (
    <div className="mx-auto mb-6 max-w-[640px] rounded-2xl border border-amber-400/35 bg-amber-500/10 p-4 space-y-3 text-xs text-amber-100">
      <div className="font-semibold text-sm">
        {missingCanonicalCsw ? 'Connect Base Account wallet' : 'Link Base Account wallet'}
      </div>
      <p className="leading-relaxed text-amber-100/90">
        {missingCanonicalCsw ? (
          <>
            Your 4626 Privy session is active (email OTP). That is step 1 — you do <strong className="font-medium">not</strong> need
            to sign in with Privy again. Step 2 is connecting the Base App smart wallet Base uses for signing. That loads your
            canonical CSW onto your profile and unlocks submit.
          </>
        ) : (
          <>
            You have a 4626 Privy session (often from email), but Base App still needs your{' '}
            <span className="font-mono">base_account</span> smart wallet linked for signing. Email login alone does not connect
            the wallet Base App uses for transactions.
          </>
        )}
      </p>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
          <dt className="text-[10px] uppercase tracking-[0.16em] opacity-70">4626 Privy session</dt>
          <dd className="mt-1 font-medium text-emerald-200">Signed in</dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
          <dt className="text-[10px] uppercase tracking-[0.16em] opacity-70">Canonical CSW on profile</dt>
          <dd className="mt-1 font-medium text-rose-200">
            {missingCanonicalCsw ? 'Not loaded yet' : 'Not linked to CSW'}
          </dd>
        </div>
      </dl>
      <Button
        type="button"
        variant="primary"
        className="inline-flex w-full items-center justify-center gap-2"
        disabled={linking || !canonicalCswAddress}
        loading={linking}
        onClick={() => void onLink()}
      >
        <img src={BASE_ACCOUNT_LOGO} alt="" className="h-4 w-4 object-contain" aria-hidden />
        {linking ? 'Connecting Base Account…' : missingCanonicalCsw ? 'Connect Base Account wallet' : 'Link Base Account wallet'}
      </Button>
      {linkError ? (
        <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-rose-100" role="alert">
          {linkError}
        </div>
      ) : null}
      {onSignOut ? (
        <Button type="button" variant="secondary" className="w-full" disabled={signOutBusy} onClick={() => void onSignOut()}>
          {signOutBusy ? 'Signing out…' : 'Sign out & use Sign in with Base'}
        </Button>
      ) : null}
      {footerLinkHref && footerLinkLabel ? (
        <a
          href={footerLinkHref}
          className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-white/10 bg-black/20 px-4 text-sm font-medium text-zinc-200 transition hover:bg-black/30"
        >
          {footerLinkLabel}
        </a>
      ) : null}
    </div>
  )
}
