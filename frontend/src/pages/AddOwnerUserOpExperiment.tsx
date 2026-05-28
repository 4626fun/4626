import { useMemo } from 'react'
import { base } from 'viem/chains'
import { usePublicClient } from 'wagmi'

import { Button } from '@/components/ui/Button'
import { PageMeta } from '@/components/seo/PageMeta'
import {
  useAddUserOpOwnerInstall,
  type AddUserOpOwnerInstallPublicClient,
} from '@/features/accountSetup/addUserOp/useAddUserOpOwnerInstall'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { pickPrivyEmbeddedEoaWallet } from '@/lib/privy/privyEmbeddedEoa'
import { RELAY_ROUTER_BASE } from '@/lib/wallet/addOwnerCallShape'
import { ENTRY_POINT_V06_BASE } from '@/lib/wallet/cswOwnerAbi'
import { externalBrowserUrlFor } from '@/lib/wallet/inAppBrowser'
import { formatEthCompact } from '@/lib/wallet/cswEntryPointFunding'

function basescanTxUrl(hash: string): string {
  return `https://basescan.org/tx/${hash}`
}

export function AddOwnerUserOpExperiment() {
  const controller = useAccountSetupController({ zoraReturnPath: '/add' })
  const {
    authHeaders,
    canonicalCswAddress,
    loadMe,
    loading,
    login,
    privyAuthed,
    privyWallets,
  } = controller

  const publicClient = usePublicClient({ chainId: base.id })

  const privyEmbeddedEoaAddress = useMemo(() => {
    const candidates = (Array.isArray(privyWallets) ? privyWallets : []) as Array<Record<string, unknown>>
    const found = pickPrivyEmbeddedEoaWallet(candidates)
    const address = found?.address
    return typeof address === 'string' ? address.toLowerCase() : null
  }, [privyWallets])

  const userOpFlow = useAddUserOpOwnerInstall({
    canonicalCswAddress,
    privyEmbeddedEoaAddress,
    authHeaders,
    publicClient: (publicClient ?? undefined) as AddUserOpOwnerInstallPublicClient | undefined,
    enabled: Boolean(privyAuthed && canonicalCswAddress && privyEmbeddedEoaAddress),
    onSuccess: () => loadMe({ showSpinner: false }),
  })

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
    !fundingPending

  const fundingSnapshot = userOpFlow.fundingAssessment?.snapshot

  return (
    <div className="relative min-h-0 w-full bg-transparent text-white">
      <PageMeta
        title="Enable 4626 signing (experiment)"
        description="Submit addOwnerAddress as an ERC-4337 UserOperation through EntryPoint handleOps — CSW self-call only, never RelayRouter multicall."
        canonicalPath="/add"
        robots="noindex,nofollow"
      />
      <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-16">
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Experiment</div>
          <h1 className="text-3xl font-semibold tracking-tight">/add — EntryPoint UserOp</h1>
          <div className="space-y-2 text-sm leading-relaxed text-zinc-400">
            <p>
              Successful owner installs go through the ERC-4337 EntryPoint (
              <span className="font-mono text-zinc-300">{ENTRY_POINT_V06_BASE}</span>, via{' '}
              <span className="font-mono text-zinc-300">handleOps</span>). In that flow{' '}
              <span className="font-mono text-zinc-300">addOwnerAddress</span> runs inside a UserOperation
              the smart wallet executes on itself, so{' '}
              <span className="font-mono text-zinc-300">msg.sender == address(this)</span> and the
              owner-management check passes.
            </p>
            <p>
              This page does <strong className="font-medium text-zinc-300">not</strong> embed{' '}
              <span className="font-mono text-zinc-300">addOwnerAddress</span> in RelayRouter multicall (
              <span className="font-mono text-zinc-300">{RELAY_ROUTER_BASE}</span>). There the caller is
              the router — not the wallet and not a current owner — so authorization rejects and Relay
              never indexes. Your CSW funds stay untouched.
            </p>
            <p>
              To reproduce the working shape: submit one{' '}
              <span className="font-mono text-zinc-300">wallet_sendCalls</span> bundle with a single
              CSW → CSW <span className="font-mono text-zinc-300">addOwnerAddress</span> self-call. Base
              App builds the UserOp, signs it, and broadcasts via{' '}
              <span className="font-mono text-zinc-300">eth_sendUserOperation</span> → EntryPoint.
            </p>
          </div>
        </div>

        {!privyAuthed ? (
          <div className="card space-y-3 rounded-2xl border border-white/10 bg-black/40 p-6">
            <p className="text-sm text-zinc-300">Sign in to prepare the owner-install payload.</p>
            <Button
              type="button"
              variant="primary"
              onClick={() => void login({ loginMethods: ['email', 'wallet'] } as any)}
            >
              Sign in / Continue
            </Button>
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

            <div className="card space-y-4 rounded-2xl border border-white/10 bg-black/40 p-6">
              <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Canonical CSW</dt>
                  <dd className="mt-1 break-all font-mono text-zinc-300">
                    {canonicalCswAddress ?? 'not linked'}
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
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 space-y-2 text-xs text-amber-100">
                  <div className="font-semibold">Smart wallet needs gas prefund</div>
                  <p className="leading-relaxed text-amber-100/90">
                    Base App builds an ERC-4337 UserOp for this self-call. Your CSW currently has{' '}
                    <span className="font-mono">
                      {fundingSnapshot ? formatEthCompact(fundingSnapshot.totalAvailableWei) : '0 ETH'}
                    </span>{' '}
                    available for gas (native{' '}
                    {fundingSnapshot ? formatEthCompact(fundingSnapshot.cswNativeWei) : '0 ETH'} + EntryPoint
                    deposit{' '}
                    {fundingSnapshot ? formatEthCompact(fundingSnapshot.entryPointDepositWei) : '0 ETH'}).
                    Send about <strong className="font-medium">0.001 ETH</strong> to your canonical CSW in Base
                    App (Assets → your wallet → Receive), then tap Rebuild preview.
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
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[10px] text-zinc-500">
                  Gas prefund: {formatEthCompact(fundingSnapshot.totalAvailableWei)} available on CSW (
                  native {formatEthCompact(fundingSnapshot.cswNativeWei)}, EntryPoint{' '}
                  {formatEthCompact(fundingSnapshot.entryPointDepositWei)})
                </div>
              ) : null}

              {userOpFlow.busy && userOpFlow.submitPhase === 'awaiting_signature' ? (
                <div className="rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2.5 text-xs text-sky-100">
                  Confirm the add-owner request in Base App (passkey or device sign). This page
                  stays on &quot;Submitting…&quot; until Base App returns from{' '}
                  <span className="font-mono">wallet_sendCalls</span>.
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
                      ? userOpFlow.submitPhase === 'awaiting_signature'
                        ? 'Waiting for Base App signature…'
                        : userOpFlow.submitPhase === 'confirming'
                          ? 'Waiting for on-chain confirmation…'
                          : userOpFlow.submitPhase === 'verifying'
                            ? 'Verifying EntryPoint trace…'
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

              {userOpFlow.pageError ? (
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

export default AddOwnerUserOpExperiment
