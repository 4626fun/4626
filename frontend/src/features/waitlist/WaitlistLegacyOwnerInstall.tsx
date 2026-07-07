import { WaitlistModernParentOwnerInstall } from '@/features/accountSetup/WaitlistModernParentOwnerInstall'
import { ZoraAddOwnerSigningPanel } from '@/features/accountSetup/ZoraAddOwnerSigningPanel'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'

type WaitlistLegacyOwnerInstallProps = {
  canonicalCswAddress: string | null
  embeddedEoaAddress: string | null
  onSuccess?: () => void | Promise<void>
  preferBaseAppPath?: boolean
}

/**
 * Zora / Base App owner install — mounts the full account-setup controller only
 * when this lazy chunk loads (keeps the default email-only waitlist path light).
 */
export function WaitlistLegacyOwnerInstall(props: WaitlistLegacyOwnerInstallProps) {
  const controller = useAccountSetupController({ zoraReturnPath: '/waitlist' })

  if (props.preferBaseAppPath || controller.requiresBaseAppForOwnerInstall) {
    return (
      <div className="space-y-3" data-testid="waitlist-base-app-owner-install">
        {controller.requiresBaseAppForOwnerInstall ? (
          <p className="text-xs leading-relaxed text-amber-200/90">
            Your smart wallet is passkey-controlled in this browser. Open{' '}
            <a href="/waitlist" className="font-semibold text-amber-50 underline underline-offset-2">
              waitlist in Base App
            </a>{' '}
            to finish owner install with your Coinbase Smart Wallet connected.
          </p>
        ) : null}
        <WaitlistModernParentOwnerInstall
          controller={controller}
          embeddedEoaAddress={props.embeddedEoaAddress}
          onOwnerInstallSuccess={props.onSuccess}
        />
      </div>
    )
  }

  return (
    <ZoraAddOwnerSigningPanel
      controller={controller}
      onOwnerInstallSuccess={props.onSuccess}
    />
  )
}
