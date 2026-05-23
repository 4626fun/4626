import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { getMarketingWaitlistEntryUrl } from '@/lib/auth/waitlistEntry'
import { PageMeta } from '@/components/seo/PageMeta'
import {
  AdvancedDisclosure,
  SignersSection,
  YourIdentityHero,
} from '@/components/account/YourIdentityHero'
import { ExecutionScopeCard } from '@/features/executionScope/ExecutionScopeCard'
import { AutoProvisionMount } from '@/features/executionScope/AutoProvisionMount'
import { AccountSetupWorkspaceView } from '@/features/accountSetup/AccountSetupWorkspaceView'
import type { AccountSetupInitialData } from '@/features/accountSetup/types'
import {
  readOptionalZoraStatus,
  shouldRefreshAccountsOnForeground,
  useAccountSetupController,
} from '@/features/accountSetup/useAccountSetupController'

export { readOptionalZoraStatus, shouldRefreshAccountsOnForeground }

export function AccountsPage(props: {
  initialData?: AccountSetupInitialData
}) {
  const controller = useAccountSetupController({
    initialData: props.initialData,
    zoraReturnPath: '/accounts',
  })

  const { busyProvider, me, privyAuthed } = controller

  return (
    <div className="relative min-h-0 w-full bg-transparent text-white">
      <PageMeta
        title="Accounts"
        description="Advanced account settings, linked identities, recovery tools, and canonical Coinbase Smart Wallet setup."
        canonicalPath="/accounts"
      />
      <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-10">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Accounts</div>
          <h1 className="text-3xl font-semibold tracking-tight">Your identity</h1>
          <p className="text-sm text-zinc-400">
            Your canonical CSW anchors identity and assets, your app sub-account handles in-app execution, and delegated
            server signers power deploy and agent automation.
          </p>
        </div>

        <YourIdentityHero />
        <SignersSection />
        <ExecutionScopeCard />
        <AutoProvisionMount />

        {!privyAuthed ? (
          <div className="card space-y-3 rounded-2xl border border-white/10 bg-black/40 p-6">
            <p className="text-sm text-zinc-300">Sign in with Privy to manage account identities.</p>
            <Button
              type="button"
              variant="primary"
              onClick={() => void controller.login({ loginMethods: ['email', 'wallet'] } as any)}
            >
              Sign in / Continue
            </Button>
            <a href={getMarketingWaitlistEntryUrl()} className="text-xs text-zinc-500 hover:text-zinc-300">
              Back to waitlist
            </a>
          </div>
        ) : null}

        {!controller.loading && privyAuthed && me ? (
          <AdvancedDisclosure
            title="Advanced settings"
            summary="Account setup workspace, linked providers, Arch B owner controls, recovery tools."
          >
            <div className="space-y-6 pt-4">
              <AccountSetupWorkspaceView
                context="accounts"
                controller={controller}
                summaryActions={
                  <>
                    <Button variant="secondary" asChild>
                      <Link to="/leaderboard">Open leaderboard</Link>
                    </Button>
                    <button
                      type="button"
                      disabled={busyProvider === 'email'}
                      onClick={() => void controller.onLinkProvider('email')}
                      className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:border-white/30"
                    >
                      {busyProvider === 'email' ? 'Syncing...' : 'Verify / update email'}
                    </button>
                  </>
                }
              />
            </div>
          </AdvancedDisclosure>
        ) : null}
      </div>
    </div>
  )
}
