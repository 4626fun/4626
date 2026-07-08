import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'

import { AccountTray } from '@/components/ui/AccountTray'
import { Button } from '@/components/ui/Button'
import { JazziconAvatar } from '@/components/account/JazziconAvatar'
import { CanonicalIdentityDropdown } from '@/components/account/CanonicalIdentityCard'
import {
  RelayTrayPointsModule,
  RelayTrayPrimaryTabs,
  useIsPhoneViewport,
  type TrayPointsOverview,
} from '@/components/account/ConnectButton'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { APP_ORIGIN } from '@/lib/env/host'
import { fetchAccountTrayPoints, isAccountTrayPointsAuthError } from '@/lib/waitlist/accountTrayPoints'
import { resolvePublicPointsDisplay } from '@/lib/waitlist/canonicalAccountScore'

import { WaitlistPostJoinShell } from './WaitlistPostJoinShell'
import { useWaitlistCanonicalIdentity } from './useWaitlistCanonicalIdentity'
import { useWaitlistPostJoinAttention } from './useWaitlistPostJoinAttention'

// Local copy of `WaitlistFlow.tsx`'s decorative button-hover sheen — small
// enough that duplicating it here is cheaper than exporting a private
// helper out of that already-large file.
function ButtonSheen() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover/btn:translate-x-full motion-reduce:hidden"
    />
  )
}

type WaitlistTraySection = 'account' | 'points'

export type WaitlistAccountTrayProps = {
  accountMe: AccountSetupMe | null
  accountMeLoading: boolean
  joinedSessionAddress: string | null
  /** The user's linked external wallet address, if any (waitlist's own link flow). */
  externalEoaAddress: string | null
  appAccepted: boolean
  getPrivyAccessToken: (() => Promise<string | null>) | null
  onRequestConnectWallet: () => void
  onRequestDisconnectMainWallet: () => void
  disconnectingMainWallet: boolean
  onSignOut: () => void | Promise<void>
  signOutBusy: boolean
  signOutDisabled: boolean
  /** Linked-accounts summary + linking wizard panels, built by the caller
   * (`WaitlistFlow`) so this shell doesn't need to know about X / wallet /
   * Zora linking internals — it just renders this slot inside the Account tab. */
  accountTabExtra: ReactNode
}

/**
 * Top-right account tray for the waitlist route — the wagmi-free counterpart
 * to the app's `ConnectButton` tray. Reuses the same presentational shell
 * (`AccountTray`), tab bar, identity dropdown, and points module; the only
 * new piece is `useWaitlistCanonicalIdentity`, a wagmi-free identity adapter
 * (see that file for why `/waitlist` can't use `useCanonicalIdentity` as-is).
 */
export function WaitlistAccountTray(props: WaitlistAccountTrayProps) {
  const hasSession = Boolean(props.joinedSessionAddress)
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<WaitlistTraySection>('account')
  const isPhoneViewport = useIsPhoneViewport()
  const [autoOpened, setAutoOpened] = useState(false)

  const identity = useWaitlistCanonicalIdentity({
    accountMe: props.accountMe,
    accountMeLoading: props.accountMeLoading,
    hasSession,
    externalEoaAddress: props.externalEoaAddress,
  })

  // Always-mounted (regardless of `open`) so we can auto-open the tray the
  // first time a required setup step (wallet provisioning / owner-install
  // signing) appears, instead of leaving it hidden behind a closed tray.
  // Shares its underlying `/api/accounts/me` fetch with the `WaitlistPostJoinShell`
  // instance rendered below via `useAccountMe`'s module-level cache.
  const { setupRequired } = useWaitlistPostJoinAttention()

  // Adjust state during render (React's documented alternative to an
  // effect for "state that depends on a prop/computed value") instead of
  // an effect + setState, so the auto-open doesn't cost an extra render
  // pass. Guarded by `autoOpened` so it only ever fires once per mount.
  if (hasSession && setupRequired && !autoOpened) {
    setAutoOpened(true)
    setOpen(true)
  }

  const trayAccountPointsQuery = useQuery({
    queryKey: ['waitlist-account-tray', 'accounts-me-points', props.joinedSessionAddress],
    enabled: hasSession && open,
    staleTime: 15_000,
    retry: (failureCount, error) => !isAccountTrayPointsAuthError(error) && failureCount < 1,
    queryFn: async () => {
      const token = props.getPrivyAccessToken ? await props.getPrivyAccessToken().catch(() => null) : null
      return fetchAccountTrayPoints(40, token)
    },
  })
  const trayPointsAuthRequired = isAccountTrayPointsAuthError(trayAccountPointsQuery.error)
  const trayPointsOverview: TrayPointsOverview | null = (() => {
    const tray = trayAccountPointsQuery.data
    if (!tray || tray.signupId <= 0) return null
    return { points: tray.points, rank: tray.rank, totalCount: tray.totalCount }
  })()
  const trayPointsDisplay = resolvePublicPointsDisplay({
    score: props.accountMe?.score ?? null,
    positionTotal: trayAccountPointsQuery.data?.points.total ?? null,
  })

  if (!hasSession) return null

  const avatarAddress = identity.cswAddress ?? identity.externalEoaAddress ?? identity.privyEmbeddedAddress

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="fixed right-3 top-3 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 backdrop-blur-md transition hover:border-white/20 hover:bg-black/55 sm:right-5 sm:top-5"
      >
        <span className="relative flex-shrink-0">
          <JazziconAvatar address={avatarAddress} size={22} />
          {setupRequired ? (
            <span
              className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-400 ring-2 ring-black"
              aria-hidden="true"
              title="Wallet setup needs your attention"
            />
          ) : null}
        </span>
        <span className="text-[12px] font-semibold tabular-nums text-white">
          {trayPointsDisplay.points.toLocaleString()}
        </span>
      </button>

      {open ? (
        <AccountTray
          pin={isPhoneViewport ? 'bottom' : 'right'}
          showHandleBar={isPhoneViewport}
          accessibilityLabel="4626 account menu"
          closeAccessibilityLabel="Close account menu"
          onRequestClose={() => setOpen(false)}
        >
          <RelayTrayPrimaryTabs
            section={section}
            onChange={(next) => setSection(next === 'portfolio' ? 'account' : next)}
            sections={['account', 'points']}
          />

          {section === 'account' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <CanonicalIdentityDropdown
                identity={identity}
                onRequestConnectWallet={props.onRequestConnectWallet}
                onRequestDisconnectMainWallet={props.onRequestDisconnectMainWallet}
                disconnectingMainWallet={props.disconnectingMainWallet}
              />
              <div className="mx-4 my-2 h-px bg-white/8" />

              <div className="px-4">
                <WaitlistPostJoinShell enabled onSignOut={props.onSignOut} signOutBusy={props.signOutBusy} />
                {props.accountTabExtra}
              </div>

              <div className="mt-2 flex flex-col items-stretch gap-3 px-4 pb-4">
                {props.appAccepted ? (
                  <Button
                    variant="primary"
                    size="lg"
                    className="btn-3d group/btn relative w-full overflow-hidden !rounded-full !min-h-[52px] !text-[15px] !font-bold !tracking-wide"
                    asChild
                  >
                    <a href={`${APP_ORIGIN}/swap?restorePrivy=1`}>
                      <ButtonSheen />
                      <span className="relative z-10 inline-flex items-center gap-2.5">
                        Enter app
                        <ArrowRight
                          className="size-[18px] transition-transform duration-200 ease-out group-hover/btn:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </a>
                  </Button>
                ) : null}
                <button
                  type="button"
                  className="text-xs tracking-wide text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
                  onClick={() => void props.onSignOut()}
                  disabled={props.signOutDisabled}
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <RelayTrayPointsModule
              pointsTotal={trayPointsDisplay.points}
              position={trayPointsOverview}
              pointsLoading={trayAccountPointsQuery.isLoading}
              activity={trayAccountPointsQuery.data?.activity ?? []}
              activityLoading={trayAccountPointsQuery.isLoading}
              activityError={trayAccountPointsQuery.isError && !trayPointsAuthRequired}
              activityAuthRequired={trayPointsAuthRequired}
              leaderboardEligible={trayAccountPointsQuery.data?.leaderboardEligible ?? false}
              hasAccountProfile={(trayAccountPointsQuery.data?.signupId ?? 0) > 0}
              signupId={trayAccountPointsQuery.data?.signupId ?? 0}
            />
          )}
        </AccountTray>
      ) : null}
    </>
  )
}
