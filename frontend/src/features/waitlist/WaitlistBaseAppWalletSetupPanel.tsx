import { BaseAppCanonicalWalletLinkPanel } from '@/components/wallet/BaseAppCanonicalWalletLinkPanel'
import { WaitlistModernParentOwnerInstall } from '@/features/accountSetup/WaitlistModernParentOwnerInstall'
import type { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { useEnsureCanonicalBaseAccountWallet } from '@/hooks/useEnsureCanonicalBaseAccountWallet'
import { usePrivyWalletsFromContext } from '@/lib/privy/walletHooksContext'
import {
  isBaseAppWalletSetupReady,
  resolveBaseAppWalletSetupPhase,
} from '@/lib/wallet/resolveBaseAppWalletSetupPhase'
import type { UserFrontendExecutionTrack } from '@/lib/wallet/userExecutionTrack'

type Controller = ReturnType<typeof useAccountSetupController>

type Props = {
  controller: Controller
  embeddedEoaAddress: string | null | undefined
  privyAuthenticated: boolean
  parentEmbeddedOwnerOnChain: boolean
  executionTrack?: UserFrontendExecutionTrack
  onOwnerInstallSuccess?: () => void | Promise<void>
}

/**
 * Base App waitlist Step 2 — parent CSW only.
 * 1. Connect Base Account wallet (must match profiles.csw_address).
 * 2. Enable 4626 signing via parent-CSW owner install.
 */
export function WaitlistBaseAppWalletSetupPanel(props: Props) {
  const {
    controller,
    embeddedEoaAddress,
    privyAuthenticated,
    parentEmbeddedOwnerOnChain,
    executionTrack,
    onOwnerInstallSuccess,
  } = props
  const { canonicalCswAddress, me } = controller
  const wallets = usePrivyWalletsFromContext()

  const baseWalletLink = useEnsureCanonicalBaseAccountWallet({
    enabled: Boolean(privyAuthenticated && canonicalCswAddress),
    canonicalCswAddress,
    autoConnect: false,
  })

  const phase = resolveBaseAppWalletSetupPhase({
    privyAuthenticated,
    embeddedEoaAddress,
    canonicalCswAddress,
    wallets,
    providerAccounts: baseWalletLink.providerAccounts,
    parentEmbeddedOwnerOnChain,
    executionTrack,
  })

  if (isBaseAppWalletSetupReady(phase)) {
    return (
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-4 text-sm text-emerald-100/90">
        4626 signing is enabled on your Coinbase Smart Wallet.
      </div>
    )
  }

  if (phase === 'needs-base-wallet-connect' || phase === 'needs-canonical-csw') {
    return (
      <BaseAppCanonicalWalletLinkPanel
        enabled
        canonicalCswAddress={canonicalCswAddress}
        ready={baseWalletLink.ready}
        linking={baseWalletLink.linking}
        linkError={baseWalletLink.linkError}
        onLink={async () => {
          const ok = await baseWalletLink.link()
          if (ok) await controller.loadMe({ showSpinner: false })
        }}
        missingCanonicalCsw={!canonicalCswAddress}
      />
    )
  }

  return (
    <div className="space-y-4">
      <WaitlistModernParentOwnerInstall
        controller={controller}
        embeddedEoaAddress={embeddedEoaAddress}
        onOwnerInstallSuccess={onOwnerInstallSuccess}
      />
      {me?.accountSignals?.canonicalCswAddress ? (
        <p className="text-xs leading-relaxed text-zinc-500">
          Approve one transaction in Base App to add your 4626 embedded signer as a co-owner of your main smart wallet.
        </p>
      ) : null}
    </div>
  )
}
