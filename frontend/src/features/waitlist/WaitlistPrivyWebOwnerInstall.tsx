import { Button } from '@/components/ui/Button'
import { APP_ORIGIN } from '@/lib/env/host'

import { usePrivyCswWebOwnerInstall } from './usePrivyCswWebOwnerInstall'

type WaitlistPrivyWebOwnerInstallProps = {
  canonicalCswAddress: string | null
  embeddedEoaAddress: string | null
  onSuccess?: () => void | Promise<void>
}

export function WaitlistPrivyWebOwnerInstall(props: WaitlistPrivyWebOwnerInstallProps) {
  const install = usePrivyCswWebOwnerInstall({
    enabled: Boolean(props.canonicalCswAddress && props.embeddedEoaAddress),
    canonicalCswAddress: props.canonicalCswAddress,
    embeddedEoaAddress: props.embeddedEoaAddress,
    onSuccess: props.onSuccess,
  })

  if (install.alreadyOwner) {
    return (
      <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-100">
        4626 signing is enabled on your smart wallet.
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid="waitlist-privy-web-owner-install">
      <p className="text-xs leading-relaxed text-zinc-400">
        Add your embedded signer as an owner on your 4626 smart wallet to unlock waitlist chat.
      </p>
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={install.busy}
        loading={install.busy}
        onClick={() => void install.handleEnableSigning()}
      >
        Enable 4626 signing
      </Button>
      {install.pageNotice ? <p className="text-xs text-emerald-200">{install.pageNotice}</p> : null}
      {install.pageError ? (
        <div className="space-y-2">
          <p className="text-xs text-rose-300/90">{install.pageError}</p>
          <p className="text-xs leading-relaxed text-zinc-500">
            If signing fails in this browser, open{' '}
            <a
              href={`${APP_ORIGIN}/waitlist`}
              className="font-medium text-zinc-300 underline underline-offset-2"
            >
              4626 in Base App
            </a>{' '}
            to finish owner install with your smart wallet connected.
          </p>
        </div>
      ) : null}
    </div>
  )
}
