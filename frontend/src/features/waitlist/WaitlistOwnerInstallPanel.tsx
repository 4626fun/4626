import { Suspense, lazy } from 'react'

import { LoadingInline } from '@/components/ui/LoadingState'
import { APP_ORIGIN } from '@/lib/env/host'
import { detectInAppEnvironment, isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'

import { WaitlistPrivyWebOwnerInstall } from './WaitlistPrivyWebOwnerInstall'
import type { WaitlistConnectTrack } from './waitlistFlowState'

const LazyWaitlistLegacyOwnerInstall = lazy(async () => {
  const mod = await import('./WaitlistLegacyOwnerInstall')
  return { default: mod.WaitlistLegacyOwnerInstall }
})

type WaitlistOwnerInstallPanelProps = {
  connectTrack: WaitlistConnectTrack
  canonicalCswAddress: string | null
  embeddedEoaAddress: string | null
  onSuccess?: () => void | Promise<void>
}

export function WaitlistOwnerInstallPanel(props: WaitlistOwnerInstallPanelProps) {
  if (!props.canonicalCswAddress || !props.embeddedEoaAddress) return null

  if (props.connectTrack === 'privy-owner-install') {
    return (
      <WaitlistPrivyWebOwnerInstall
        canonicalCswAddress={props.canonicalCswAddress}
        embeddedEoaAddress={props.embeddedEoaAddress}
        onSuccess={props.onSuccess}
      />
    )
  }

  if (props.connectTrack === 'zora-owner-install') {
    const inBaseApp = isBaseAppInAppContext(detectInAppEnvironment())
    if (!inBaseApp) {
      return (
        <Suspense
          fallback={
            <div className="py-2">
              <LoadingInline labelOverride="Loading owner install…" />
            </div>
          }
        >
          <LazyWaitlistLegacyOwnerInstall
            canonicalCswAddress={props.canonicalCswAddress}
            embeddedEoaAddress={props.embeddedEoaAddress}
            onSuccess={props.onSuccess}
          />
        </Suspense>
      )
    }

    return (
      <Suspense
        fallback={
          <div className="py-2">
            <LoadingInline labelOverride="Loading Base App owner install…" />
          </div>
        }
      >
        <LazyWaitlistLegacyOwnerInstall
          canonicalCswAddress={props.canonicalCswAddress}
          embeddedEoaAddress={props.embeddedEoaAddress}
          onSuccess={props.onSuccess}
          preferBaseAppPath
        />
      </Suspense>
    )
  }

  return (
    <p className="text-xs text-zinc-500">
      Finish wallet setup, then retry. If you use Base App, open{' '}
      <a href={`${APP_ORIGIN}/waitlist`} className="text-zinc-300 underline underline-offset-2">
        waitlist in Base App
      </a>
      .
    </p>
  )
}
