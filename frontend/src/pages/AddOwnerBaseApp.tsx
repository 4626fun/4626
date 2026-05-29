import { useCallback, useMemo, useState } from 'react'
import { base } from 'viem/chains'
import { usePublicClient } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'

import { Button } from '@/components/ui/Button'
import { PageMeta } from '@/components/seo/PageMeta'
import {
  AddOwnerConnectionStatusPanel,
  resolveAddOwnerBaseWalletAddress,
} from '@/components/wallet/AddOwnerConnectionStatusPanel'
import { BaseAppCanonicalWalletLinkPanel } from '@/components/wallet/BaseAppCanonicalWalletLinkPanel'
import { useEnsureCanonicalBaseAccountWallet } from '@/hooks/useEnsureCanonicalBaseAccountWallet'
import { useSubAccountSetup } from '@/hooks/useSubAccountSetup'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { usePrivyWalletsFromContext } from '@/lib/privy/walletHooksContext'
import { runWaitlistPrivyLogout } from '@/features/waitlist/waitlistAuthState'
import {
  useAddUserOpOwnerInstall,
  type AddUserOpOwnerInstallPublicClient,
} from '@/features/accountSetup/addUserOp/useAddUserOpOwnerInstall'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { pickPrivyEmbeddedEoaWallet } from '@/lib/privy/privyEmbeddedEoa'
import { RELAY_ROUTER_BASE } from '@/lib/wallet/addOwnerCallShape'
import { ENTRY_POINT_V06_BASE } from '@/lib/wallet/cswOwnerAbi'
import { externalBrowserUrlFor, detectInAppEnvironment, isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'
import { formatEthCompact } from '@/lib/wallet/cswEntryPointFunding'

const BASE_ACCOUNT_LOGO = '/base/base-square-blue.svg'

function basescanTxUrl(hash: string): string {
  return `https://basescan.org/tx/${hash}`
}

/**
 * Supported Base App CSW owner install path (EntryPoint self-call via wallet_sendCalls).
 *
 * Uses wallet_sendCalls + EntryPoint handleOps so the user's Coinbase Smart Wallet
 * self-calls addOwnerAddress. This is the validated, recommended shape.
 *
 * Do not route addOwner through RelayRouter multicall — it will fail the onlyOwner check.
 */
export function AddOwnerBaseApp() {
  const controller = useAccountSetupController({ zoraReturnPath: '/add' })
  const {
    authHeaders,
    canonicalCswAddress,
    loadMe,
    loading,
    login,
    me,
    privyAuthed,
    privyWallets,
  } = controller

  const privyClientStatus = usePrivyClientStatus()
  const { logout: privyLogout } = usePrivy() as { logout?: () => Promise<void> }
  const { signIn, signOut, busy: authBusy, error: authError, hasSession, authAddress } = useSiweAuth()
  const privyContextWallets = usePrivyWalletsFromContext()
  const { connectBaseAccountWallet } = useSubAccountSetup()
  const [privySignOutBusy, setPrivySignOutBusy] = useState(false)
  const [baseDisconnectBusy, setBaseDisconnectBusy] = useState(false)
  const inBaseApp = isBaseAppInAppContext(detectInAppEnvironment())
  const privyReady = privyClientStatus === 'ready'
  const authControlsDisabled = authBusy || !privyReady
  const authStatusLabel = !privyReady
    ? privyClientStatus === 'disabled'
      ? 'Sign-in is unavailable in this environment.'
      : 'Loading sign-in…'
    : authBusy
      ? 'Signing in…'
      : null

  const handleEmailSignIn = useCallback(() => {
    if (authControlsDisabled) return
    void login({ loginMethods: ['email', 'wallet'] } as any)
  }, [authControlsDisabled, login])

  const handleBaseSignIn = useCallback(async () => {
    if (authControlsDisabled) return
    const address = await signIn({ method: 'privy', preferBaseAccountWallet: true })
    if (address) {
      await connectBaseAccountWallet({
        canonicalCswAddress,
        requireEmbeddedEoa: false,
      }).catch(() => false)
      void loadMe({ showSpinner: true })
    }
  }, [authControlsDisabled, canonicalCswAddress, connectBaseAccountWallet, loadMe, signIn])

  const handleSignOutPrivy = useCallback(async () => {
    if (authBusy || privySignOutBusy) return
    setPrivySignOutBusy(true)
    try {
      await runWaitlistPrivyLogout({
        logout: typeof privyLogout === 'function' ? privyLogout : undefined,
        shouldLogout: true,
      })
      await signOut()
      if (typeof window !== 'undefined') {
        window.location.assign('/add')
      }
    } finally {
      setPrivySignOutBusy(false)
    }
  }, [authBusy, privyLogout, privySignOutBusy, signOut])

  const publicClient = usePublicClient({ chainId: base.id })

  // Stabilize the public client reference. usePublicClient can return a new object
  // on re-renders (especially during Base App wallet_sendCalls prompts), which can
  // cause effects and callbacks inside the owner install hook to churn and trigger
  // React maximum update depth errors.
  const stablePublicClient = useMemo(
    () => publicClient as AddUserOpOwnerInstallPublicClient | undefined,
    [publicClient],
  )

  const privyEmbeddedEoaAddress = useMemo(() => {
    const candidates = (Array.isArray(privyWallets) ? privyWallets : []) as Array<Record<string, unknown>>
    const found = pickPrivyEmbeddedEoaWallet(candidates)
    const address = found?.address
    return typeof address === 'string' ? address.toLowerCase() : null
  }, [privyWallets])

  const baseWalletLink = useEnsureCanonicalBaseAccountWallet({
    enabled: Boolean(privyAuthed && inBaseApp),
    canonicalCswAddress,
    autoConnect: Boolean(canonicalCswAddress),
  })

  const handleLinkBaseAccount = useCallback(async () => {
    const linked = await baseWalletLink.link()
    if (linked) {
      await loadMe({ showSpinner: true })
      await baseWalletLink.refreshProviderAccounts()
    }
  }, [baseWalletLink, loadMe])

  const handleDisconnectBase = useCallback(async () => {
    if (baseDisconnectBusy || baseWalletLink.linking) return
    setBaseDisconnectBusy(true)
    try {
      await baseWalletLink.disconnect()
      await loadMe({ showSpinner: false })
    } finally {
      setBaseDisconnectBusy(false)
    }
  }, [baseDisconnectBusy, baseWalletLink, loadMe])

  const privyEmail = useMemo(() => {
    if (me?.email) return me.email
    return null
  }, [me?.email])

  const connectedBaseWalletAddress = useMemo(
    () => resolveAddOwnerBaseWalletAddress(privyContextWallets, baseWalletLink.providerAccounts),
    [baseWalletLink.providerAccounts, privyContextWallets],
  )

  // Stabilize onSuccess so it doesn't cause the hook's useCallbacks / effects to
  // be recreated on every render of this page (common source of React #185 during
  // long async wallet operations).
  const handleInstallSuccess = useCallback(() => {
    void loadMe({ showSpinner: false })
  }, [loadMe])

  const userOpFlow = useAddUserOpOwnerInstall({
    canonicalCswAddress,
    privyEmbeddedEoaAddress,
    authHeaders,
    publicClient: stablePublicClient,
    enabled: Boolean(privyAuthed && canonicalCswAddress && privyEmbeddedEoaAddress),
    onSuccess: handleInstallSuccess,
  })

  const { pendingUserOpHash } = userOpFlow

  const fundingBlocksSubmit =
    userOpFlow.fundingAssessment != null && !userOpFlow.fundingAssessment.ok
  const fundingPending =
    userOpFlow.fundingLoading ||
    (userOpFlow.fundingAssessment == null && Boolean(publicClient && canonicalCswAddress))

  const canSubmitUserOp =
    Boolean(canonicalCswAddress && privyEmbeddedEoaAddress) &&
    !userOpFlow.alreadyOwner &&
    !userOpFlow.prepareLoading &&
    !fundingBlocksSubmit &&
    !fundingPending &&
    (!inBaseApp || baseWalletLink.ready)

  const fundingSnapshot = userOpFlow.fundingAssessment?.snapshot

  return (
    <div className="relative min-h-0 w-full bg-transparent text-white">
      <PageMeta
        title="Enable 4626 signing (Base App)"
        description="Add your Privy embedded EOA as an owner on your Base App Coinbase Smart Wallet using an ERC-4337 UserOp self-call through EntryPoint handleOps. This is the supported path for Base App CSWs — never use RelayRouter multicall for addOwner."
        canonicalPath="/add"
        robots="noindex,nofollow"
      />

      {/* Status banner confirming this is the supported production path */}
      <div className="mx-auto max-w-2xl px-6 pt-4">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-400">
          This is the supported Base App owner install path (EntryPoint self-call). Sub-account registration is the limited fallback.
        </div>
      </div>
      <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-16">
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-500">Base App owner install</div>
          <h1 className="text-3xl font-semibold tracking-tight">Enable 4626 signing on your Base App wallet</h1>
          <div className="space-y-2 text-sm leading-relaxed text-zinc-400">
            <p>
              Both successful transactions went through the ERC-4337 EntryPoint (
              <span className="font-mono text-zinc-300">{ENTRY_POINT_V06_BASE}</span>) via{' '}
              <span className="font-mono text-zinc-300">handleOps</span>. The{' '}
              <span className="font-mono text-zinc-300">addOwnerAddress</span> call runs inside a UserOperation
              that the smart wallet executes on itself, so{' '}
              <span className="font-mono text-zinc-300">msg.sender == address(this)</span> and the
              <code className="mx-1 rounded bg-white/10 px-1 py-px text-[10px]">onlyOwner</code> check passes.
            </p>
            <p>
              <strong className="font-medium text-red-400">Do not</strong> embed the call in a RelayRouter
              multicall (<span className="font-mono text-zinc-300">{RELAY_ROUTER_BASE}</span>). From the
              wallet’s perspective the caller becomes the router — not the wallet and not a current owner —
              so the authorization check rejects it. Your funds remain untouched and the operation never
              indexes.
            </p>
            <p className="text-zinc-300">
              Correct shape: one <span className="font-mono">wallet_sendCalls</span> bundle containing a
              single CSW → CSW <span className="font-mono">addOwnerAddress</span> self-call (zero value).
              Base App turns this into a UserOp that the wallet itself executes.
            </p>
          </div>
        </div>

        <AddOwnerConnectionStatusPanel
          inBaseApp={inBaseApp}
          privyReady={privyReady}
          privyAuthenticated={privyAuthed}
          privyEmail={privyEmail}
          privyEmbeddedEoa={privyEmbeddedEoaAddress}
          has4626Session={hasSession}
          sessionAddress={authAddress}
          canonicalCswAddress={canonicalCswAddress}
          baseAccountReady={baseWalletLink.ready}
          baseProviderAccounts={baseWalletLink.providerAccounts}
          baseWalletAddress={connectedBaseWalletAddress}
          privySignOutBusy={privySignOutBusy || authBusy}
          baseDisconnectBusy={baseDisconnectBusy}
          baseLinkBusy={baseWalletLink.linking}
          onSignOutPrivy={handleSignOutPrivy}
          onDisconnectBase={handleDisconnectBase}
          onConnectBase={handleLinkBaseAccount}
        />

        {!privyAuthed ? (
          <div className="card space-y-4 rounded-2xl border border-white/10 bg-black/40 p-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">Sign in to prepare the owner-install payload</p>
              <p className="text-xs leading-relaxed text-zinc-500">
                Use Base Account if you are opening this from Base App. Email OTP works in any browser.
              </p>
            </div>
            <div className="space-y-2.5">
              <Button
                type="button"
                variant="primary"
                className="inline-flex w-full items-center justify-center gap-2"
                disabled={authControlsDisabled}
                onClick={() => void handleBaseSignIn()}
              >
                <img src={BASE_ACCOUNT_LOGO} alt="" className="h-4 w-4 object-contain" aria-hidden />
                {authControlsDisabled ? authStatusLabel ?? 'Sign in with Base' : 'Sign in with Base'}
              </Button>
              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t border-white/10" />
                <span className="px-3 text-[10px] uppercase tracking-wider text-zinc-500">or</span>
                <div className="flex-1 border-t border-white/10" />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={authControlsDisabled}
                onClick={handleEmailSignIn}
              >
                Sign in with email
              </Button>
            </div>
            {authStatusLabel && privyReady ? (
              <p className="text-xs text-zinc-500">{authStatusLabel}</p>
            ) : null}
            {authError ? (
              <div className="text-xs text-red-400/90" role="alert">
                {authError}
              </div>
            ) : null}
          </div>
        ) : null}

        {privyAuthed && loading ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">
            Loading your account…
          </div>
        ) : null}

        {privyAuthed && !loading ? (
          <>
            {!userOpFlow.inBaseApp ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-6 space-y-3 text-amber-100">
                <div className="text-sm font-semibold">Open in Base App</div>
                <p className="text-xs leading-relaxed text-amber-100/85">
                  This lane requires Base App with your parent CSW connected so{' '}
                  <span className="font-mono">wallet_sendCalls</span> can build the EntryPoint UserOp
                  internally.
                </p>
                <a
                  href={externalBrowserUrlFor('/add')}
                  className="inline-flex items-center justify-center rounded-xl bg-amber-300 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-200"
                >
                  Open 4626.fun/add in Base App
                </a>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-4 text-xs text-emerald-100/85">
                Base App detected. Submit uses EntryPoint UserOp (CSW self-call) — not RelayRouter
                multicall.
              </div>
            )}

            {inBaseApp && !baseWalletLink.ready ? (
              <BaseAppCanonicalWalletLinkPanel
                enabled={Boolean(privyAuthed)}
                canonicalCswAddress={canonicalCswAddress}
                missingCanonicalCsw={!canonicalCswAddress}
                ready={baseWalletLink.ready}
                linking={baseWalletLink.linking}
                linkError={baseWalletLink.linkError}
                onLink={handleLinkBaseAccount}
                onSignOut={() => void handleSignOutPrivy()}
                signOutBusy={privySignOutBusy || authBusy}
              />
            ) : null}

            <div className="card space-y-4 rounded-2xl border border-white/10 bg-black/40 p-6">
              <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Canonical CSW</dt>
                  <dd className="mt-1 break-all font-mono text-zinc-300">
                    {canonicalCswAddress ?? (inBaseApp ? 'Connect Base Account below' : 'not linked')}
                  </dd>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Privy signer to add</dt>
                  <dd className="mt-1 break-all font-mono text-zinc-300">
                    {privyEmbeddedEoaAddress ?? 'resolving…'}
                  </dd>
                </div>
              </dl>

              {userOpFlow.fundingAssessment && !userOpFlow.fundingAssessment.ok ? (
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 space-y-3 text-xs text-amber-100">
                  <div>
                    <div className="font-semibold">CSW needs gas prefund for the EntryPoint UserOp</div>
                    <p className="mt-1 leading-relaxed text-amber-100/90">
                      Current available:{' '}
                      <span className="font-mono font-medium">
                        {fundingSnapshot ? formatEthCompact(fundingSnapshot.totalAvailableWei) : '0 ETH'}
                      </span>{' '}
                      (native {fundingSnapshot ? formatEthCompact(fundingSnapshot.cswNativeWei) : '0'} + EntryPoint deposit{' '}
                      {fundingSnapshot ? formatEthCompact(fundingSnapshot.entryPointDepositWei) : '0'}).
                    </p>
                  </div>
                  <p className="leading-relaxed text-amber-100/90">
                    Send <strong className="font-medium">~0.001 ETH</strong> directly to your canonical CSW address inside Base App
                    (Assets → your smart wallet → Receive). Wait 5–10 seconds, then tap the button below.
                    The actual <span className="font-mono">addOwnerAddress</span> call sends 0 value — this is only gas for the self-call UserOp.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={userOpFlow.fundingLoading || userOpFlow.busy}
                    onClick={() => void userOpFlow.refreshFunding()}
                  >
                    {userOpFlow.fundingLoading ? 'Checking balance…' : 'Recheck CSW gas balance'}
                  </Button>
                </div>
              ) : null}

              {userOpFlow.fundingAssessment?.ok && fundingSnapshot ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[10px] text-emerald-400/90">
                  Gas prefund ready: {formatEthCompact(fundingSnapshot.totalAvailableWei)} on CSW
                  (native {formatEthCompact(fundingSnapshot.cswNativeWei)} + EntryPoint deposit{' '}
                  {formatEthCompact(fundingSnapshot.entryPointDepositWei)})
                </div>
              ) : null}

              {userOpFlow.busy && userOpFlow.submitPhase === 'preflight' ? (
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-zinc-300">
                  Checking CSW gas and Base App wallet connection…
                </div>
              ) : null}

              {userOpFlow.busy && userOpFlow.submitPhase === 'awaiting_signature' ? (
                <div className="rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2.5 text-xs text-sky-100">
                  Confirm the add-owner request in Base App (passkey or device sign). Swipe up if the
                  prompt is behind this page — this step can take up to 3 minutes.
                </div>
              ) : null}

              {userOpFlow.busy &&
              (userOpFlow.submitPhase === 'broadcasting' ||
                userOpFlow.submitPhase === 'confirming' ||
                userOpFlow.submitPhase === 'verifying') ? (
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-zinc-300 space-y-1">
                  <div>UserOp broadcasted — waiting for EntryPoint confirmation on Base…</div>
                  {pendingUserOpHash && (
                    <div className="font-mono text-[10px] text-zinc-400 break-all">
                      UserOp: {pendingUserOpHash}
                    </div>
                  )}
                </div>
              ) : null}

              {pendingUserOpHash && !userOpFlow.busy ? (
                <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-4 space-y-3 text-xs text-sky-100">
                  <div>
                    <div className="font-semibold">UserOp submitted — waiting for bundle tx</div>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(pendingUserOpHash)}
                      className="mt-1 block w-full text-left font-mono text-[10px] text-sky-200/80 break-all hover:text-sky-100 active:text-white"
                      title="Click to copy full UserOp hash"
                    >
                      {pendingUserOpHash}
                    </button>
                  </div>

                  <p className="leading-relaxed text-sky-100/90">
                    The UserOperation was accepted by the bundler. Base App (or the bundler) is still
                    waiting for the bundle transaction to be mined. This can take 30–120 seconds.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        void userOpFlow.loadPrepare()
                        void userOpFlow.refreshFunding()
                      }}
                    >
                      Check now (also refresh gas)
                    </Button>

                    {userOpFlow.txHash && (
                      <a
                        href={basescanTxUrl(userOpFlow.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md border border-sky-300/40 px-3 py-1 text-xs font-medium text-sky-100 hover:bg-sky-500/20"
                      >
                        View on Basescan
                      </a>
                    )}
                  </div>

                  <div className="text-[10px] text-sky-200/70">
                    Tip: Look for a transaction to the EntryPoint (0x5FF137...) that contains an
                    internal CSW self-call to addOwnerAddress.
                  </div>
                </div>
              ) : null}

              {userOpFlow.alreadyOwner ? (
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-100">
                  4626 signing is already enabled on this wallet.
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!canSubmitUserOp || userOpFlow.busy || !userOpFlow.inBaseApp}
                    onClick={() => void userOpFlow.handleSubmitUserOp()}
                  >
                    {userOpFlow.busy
                      ? userOpFlow.submitPhase === 'preflight'
                        ? 'Preflight checks…'
                        : userOpFlow.submitPhase === 'awaiting_signature'
                        ? 'Waiting for Base App signature…'
                        : userOpFlow.submitPhase === 'confirming'
                          ? 'Waiting for on-chain confirmation…'
                          : userOpFlow.submitPhase === 'verifying'
                            ? 'Verifying EntryPoint trace…'
                            : userOpFlow.submitPhase === 'broadcasting'
                              ? 'Broadcasting UserOp…'
                              : 'Submitting EntryPoint UserOp…'
                      : userOpFlow.prepareLoading
                        ? 'Preparing…'
                        : 'Submit CSW self-UserOp (wallet_sendCalls)'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={userOpFlow.prepareLoading || userOpFlow.busy}
                    onClick={() => void userOpFlow.loadPrepare()}
                  >
                    Rebuild preview
                  </Button>
                </div>
              )}

              {userOpFlow.pageNotice ? (
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-100">
                  {userOpFlow.pageNotice}
                  {userOpFlow.txHash ? (
                    <>
                      {' '}
                      <a
                        href={basescanTxUrl(userOpFlow.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                      >
                        View on Basescan
                      </a>
                    </>
                  ) : null}
                </div>
              ) : null}

              {userOpFlow.pageError && !pendingUserOpHash ? (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-100">
                  {userOpFlow.pageError}
                </div>
              ) : null}

              {userOpFlow.preparedTx ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[10px] text-zinc-500 break-all">
                  preview: selector={userOpFlow.preparedTx.data.slice(0, 10)} to={userOpFlow.preparedTx.to}{' '}
                  (submission uses locally encoded CSW self-call only)
                </div>
              ) : null}

              {userOpFlow.callBundleId ? (
                <div className="text-[10px] font-mono text-zinc-500">bundle_id={userOpFlow.callBundleId}</div>
              ) : null}
            </div>

            {userOpFlow.eventLog.length > 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Event log</div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-400">
                  {userOpFlow.eventLog.join('\n')}
                </pre>
              </div>
            ) : null}
          </>
        ) : null}

        <div className="text-[11px] leading-relaxed text-zinc-500">
          After submit, Basescan should show the outer transaction calling EntryPoint{' '}
          <span className="font-mono">{ENTRY_POINT_V06_BASE}</span> with an internal CSW → CSW{' '}
          <span className="font-mono">addOwnerAddress</span> trace — not a call to RelayRouter{' '}
          <span className="font-mono">{RELAY_ROUTER_BASE}</span>.
        </div>
      </div>
    </div>
  )
}

export default AddOwnerBaseApp
