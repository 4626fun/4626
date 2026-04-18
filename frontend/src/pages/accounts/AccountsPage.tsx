import { useState } from 'react'
import { Link } from 'react-router-dom'

import { getMarketingWaitlistEntryUrl } from '@/lib/auth/waitlistEntry'
import { PageMeta } from '@/components/seo/PageMeta'
import { ArchBRevokeControl } from '@/features/archB/ArchBRevokeControl'
import { AccountSetupWorkspaceView } from '@/features/accountSetup/AccountSetupWorkspaceView'
import type { AccountSetupInitialData } from '@/features/accountSetup/types'
import { shortValue } from '@/features/accountSetup/shared'
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
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [advancedOwnerAddress, setAdvancedOwnerAddress] = useState('')

  const {
    activePrivyWallet,
    advancedBusy,
    busyProvider,
    canShowAdvanced,
    connectedCanonicalWalletSelected,
    connectedOwnerState,
    me,
    ownerSignerAddress,
    ownerSignerChainId,
    onAddRabbyCoOwner,
    onLinkProvider,
    onUnlinkProvider,
    ownerDelegationFlags,
    privyWallets,
    privyAuthed,
    providerCards,
    telegramLaunchParamsAvailable,
  } = controller

  const linkedPrivyWalletRows = Array.isArray(privyWallets)
    ? privyWallets
        .filter((wallet: any) => typeof wallet?.address === 'string' && wallet.address.length > 0)
        .map((wallet: any) => ({
          address: String(wallet.address),
          type: String(wallet.type ?? 'unknown'),
          walletClientType: String(wallet.walletClientType ?? wallet.wallet_client_type ?? 'unknown'),
          chainId: wallet.chainId ?? wallet.chain_id ?? null,
        }))
    : []
  const activePrivyWalletAddress =
    activePrivyWallet && typeof (activePrivyWallet as any).address === 'string'
      ? String((activePrivyWallet as any).address)
      : null
  const ownerSignerStatus =
    connectedOwnerState.value === true
      ? 'Owner verified'
      : connectedOwnerState.reason === 'network_mismatch'
        ? 'Switch wallet to Base'
        : ownerSignerAddress
          ? 'Owner verification pending'
          : 'No owner signer connected'

  return (
    <div className="min-h-screen bg-black text-white">
      <PageMeta
        title="Accounts"
        description="Advanced account settings, linked identities, recovery tools, and canonical Coinbase Smart Wallet setup."
        canonicalPath="/accounts"
      />
      <div className="mx-auto w-full max-w-4xl px-6 py-10 space-y-6">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Accounts</div>
          <h1 className="text-3xl font-semibold tracking-tight">Advanced account settings</h1>
          <p className="text-sm text-zinc-400">
            `/waitlist` is now the primary setup-first workspace after verified email and embedded wallet creation. Keep this page for recovery flows, secondary identity tools, Telegram/browser escapes, and advanced owner actions.
          </p>
        </div>

        {!privyAuthed ? (
          <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
            <p className="text-sm text-zinc-300">Sign in with Privy to manage account identities.</p>
            <button type="button" onClick={() => void controller.login({ loginMethods: ['email', 'wallet'] } as any)} className="btn-accent btn-no-icon inline-flex">
              Sign in / Continue
            </button>
            <a href={getMarketingWaitlistEntryUrl()} className="text-xs text-zinc-500 hover:text-zinc-300">
              Back to waitlist
            </a>
          </div>
        ) : null}

        {!controller.loading && privyAuthed && me ? (
          <>
            <AccountSetupWorkspaceView
              context="accounts"
              controller={controller}
              summaryActions={
                <>
                  <Link to="/leaderboard" className="btn-secondary btn-no-icon inline-flex">
                    Open leaderboard
                  </Link>
                  <button
                    type="button"
                    disabled={busyProvider === 'email'}
                    onClick={() => void onLinkProvider('email')}
                    className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:border-white/30"
                  >
                    {busyProvider === 'email' ? 'Syncing...' : 'Verify / update email'}
                  </button>
                </>
              }
            />

            {/* Arch B revoke control — visible when provisioned for bot-initiated transfers */}
            <ArchBRevokeControl />

            <section className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Active wallets & signers</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Current signer state for owner actions and wallet methods currently linked in Privy.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Owner signer</div>
                  <div className="text-sm text-zinc-200">
                    {ownerSignerAddress ? shortValue(ownerSignerAddress) : 'No connected signer'}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {ownerSignerChainId ? `Chain ${ownerSignerChainId}` : 'Chain unknown'} · {ownerSignerStatus}
                  </div>
                  {connectedCanonicalWalletSelected ? (
                    <div className="text-xs text-emerald-300">Canonical CSW currently selected as active wallet.</div>
                  ) : null}
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Active Privy wallet</div>
                  <div className="text-sm text-zinc-200">
                    {activePrivyWalletAddress ? shortValue(activePrivyWalletAddress) : 'No active Privy wallet'}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {activePrivyWallet
                      ? `${String((activePrivyWallet as any).type ?? 'unknown')} · ${String((activePrivyWallet as any).walletClientType ?? (activePrivyWallet as any).wallet_client_type ?? 'unknown')}`
                      : 'No wallet selected in Privy'}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2">
                <div className="text-xs uppercase tracking-wide text-zinc-500">Linked Privy wallets</div>
                {linkedPrivyWalletRows.length > 0 ? (
                  <div className="space-y-2">
                    {linkedPrivyWalletRows.map((wallet) => (
                      <div key={`${wallet.address}-${wallet.walletClientType}`} className="flex items-center justify-between gap-3 text-xs text-zinc-300">
                        <span>{shortValue(wallet.address)}</span>
                        <span className="text-zinc-500">
                          {wallet.type} · {wallet.walletClientType}
                          {wallet.chainId ? ` · chain ${wallet.chainId}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500">No Privy wallets linked yet.</div>
                )}
              </div>
            </section>

            <section className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Linked identities</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Secondary account controls live here after the primary Zora and CSW setup is done.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {providerCards.map((provider) => (
                  <div key={provider.provider} className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{provider.label}</div>
                        <div className="text-xs text-zinc-500">{provider.hint}</div>
                      </div>
                      <span className={`text-xs ${provider.linked ? 'text-emerald-300' : 'text-zinc-500'}`}>
                        {provider.linked ? 'Linked' : 'Unlinked'}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400">
                      {provider.values.length > 0 ? provider.values.map((value) => shortValue(value)).join(', ') : 'No linked values'}
                    </div>
                    {provider.provider === 'telegram' && !provider.linked && !telegramLaunchParamsAvailable ? (
                      <div className="text-[11px] text-amber-300/90">
                        Run <span className="font-mono">/link</span> in Telegram, then open the Mini App to link.
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={
                          busyProvider === provider.provider ||
                          (provider.provider === 'telegram' && !provider.linked && !telegramLaunchParamsAvailable)
                        }
                        onClick={() => void onLinkProvider(provider.provider)}
                        className="btn-secondary btn-no-icon inline-flex"
                      >
                        {busyProvider === provider.provider
                          ? 'Working...'
                          : provider.provider === 'telegram' && !provider.linked && !telegramLaunchParamsAvailable
                            ? 'Link in Telegram'
                            : 'Link'}
                      </button>
                      {provider.linked ? (
                        <button
                          type="button"
                          disabled={busyProvider === provider.provider}
                          onClick={() => void onUnlinkProvider(provider.provider)}
                          className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:border-white/30"
                        >
                          Unlink
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Advanced recovery</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Use this only for exceptional owner-management or recovery actions after the normal waitlist setup flow.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((prev) => !prev)}
                  className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:border-white/30"
                >
                  {advancedOpen ? 'Collapse' : 'Expand'}
                </button>
              </div>
              {advancedOpen ? (
                <div className="space-y-4">
                  {!canShowAdvanced ? (
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-400">
                      <div>No canonical Coinbase Smart Wallet is linked yet.</div>
                      {ownerDelegationFlags?.needsBaseAppSetup ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <a
                            href={ownerDelegationFlags.baseAppUrl ?? '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary btn-no-icon inline-flex"
                          >
                            Get Base app
                          </a>
                          <span className="text-xs text-zinc-500">Create or connect your CSW in Base app, then return here to resume.</span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      {ownerDelegationFlags ? (
                        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4 text-xs text-amber-100 space-y-1">
                          {ownerDelegationFlags.needsBaseAppSetup ? (
                            <div>
                              Finish Coinbase Smart Wallet setup in Base app, then return here and retry.
                              {ownerDelegationFlags.baseAppUrl ? (
                                <>
                                  {' '}
                                  <a
                                    href={ownerDelegationFlags.baseAppUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline underline-offset-2"
                                  >
                                    Open Base app
                                  </a>
                                  .
                                </>
                              ) : null}
                            </div>
                          ) : null}
                          {ownerDelegationFlags.needsEmbeddedWallet ? (
                            <div>Privy embedded wallet provisioning is still settling. Retry signer setup in a moment.</div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 space-y-3">
                        <div className="text-sm font-medium text-amber-100">Add Rabby as co-owner (advanced)</div>
                        <p className="text-xs text-amber-200/80">
                          Never automatic. Requires explicit confirmation and owner wallet signature.
                        </p>
                        <input
                          value={advancedOwnerAddress}
                          onChange={(event) => setAdvancedOwnerAddress(event.target.value)}
                          placeholder="0x..."
                          className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-300/40"
                        />
                        <button
                          type="button"
                          disabled={advancedBusy}
                          onClick={() => void onAddRabbyCoOwner(advancedOwnerAddress)}
                          className="rounded-lg border border-amber-300/30 px-3 py-2 text-xs text-amber-100 hover:border-amber-300/50"
                        >
                          {advancedBusy ? 'Preparing...' : 'Add Rabby co-owner'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
