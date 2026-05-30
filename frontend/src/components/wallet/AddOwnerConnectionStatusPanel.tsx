import { Button } from '@/components/ui/Button'
import {
  findBaseAccountWalletInList,
  normalizeWalletAddress,
} from '@/lib/wallet/ensureCanonicalBaseAccountWallet'

const BASE_ACCOUNT_LOGO = '/base/base-square-blue.svg'

function shortAddr(value: string | null | undefined): string {
  if (!value) return '—'
  if (value.length <= 14) return value
  return `${value.slice(0, 8)}…${value.slice(-6)}`
}

function StatusPill(props: { connected: boolean; label: string }) {
  const { connected, label } = props
  return (
    <span
      className={
        connected
          ? 'inline-flex rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300'
          : 'inline-flex rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300'
      }
    >
      {label}
    </span>
  )
}

type AddOwnerConnectionStatusPanelProps = {
  inBaseApp: boolean
  privyReady: boolean
  privyAuthenticated: boolean
  privyEmail: string | null
  privyEmbeddedEoa: string | null
  has4626Session: boolean
  sessionAddress: string | null
  /** Effective CSW for submit gating (profile CSW, or Base provider when profile not synced yet). */
  canonicalCswAddress: string | null
  /** Persisted profile CSW from `/api/accounts/me` — may lag behind the connected Base wallet. */
  profileCanonicalCswAddress?: string | null
  baseAccountReady: boolean
  baseProviderAccounts: string[] | null
  baseWalletAddress: string | null
  privySignOutBusy: boolean
  baseDisconnectBusy: boolean
  baseLinkBusy: boolean
  onSignOutPrivy: () => void | Promise<void>
  onDisconnectBase: () => void | Promise<void>
  onConnectBase: () => void | Promise<void>
}

export function AddOwnerConnectionStatusPanel(props: AddOwnerConnectionStatusPanelProps) {
  const {
    inBaseApp,
    privyReady,
    privyAuthenticated,
    privyEmail,
    privyEmbeddedEoa,
    has4626Session,
    sessionAddress,
    canonicalCswAddress,
    profileCanonicalCswAddress,
    baseAccountReady,
    baseProviderAccounts,
    baseWalletAddress,
    privySignOutBusy,
    baseDisconnectBusy,
    baseLinkBusy,
    onSignOutPrivy,
    onDisconnectBase,
    onConnectBase,
  } = props

  const expectedCsw = normalizeWalletAddress(canonicalCswAddress)
  const profileCsw = normalizeWalletAddress(profileCanonicalCswAddress)
  const providerAddr =
    normalizeWalletAddress(baseProviderAccounts?.[0]) ??
    normalizeWalletAddress(baseWalletAddress)
  const baseConnected = Boolean(providerAddr)
  const baseMatchesCsw =
    baseAccountReady && expectedCsw != null && providerAddr != null && providerAddr === expectedCsw

  const submitReady =
    privyAuthenticated &&
    Boolean(privyEmbeddedEoa) &&
    Boolean(expectedCsw) &&
    (!inBaseApp || baseMatchesCsw)

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Connection status</div>
        <StatusPill
          connected={submitReady}
          label={submitReady ? 'Ready to submit' : 'Not ready to submit'}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Privy / 4626 session */}
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium text-zinc-200">4626 Privy session</div>
            <StatusPill connected={privyAuthenticated} label={privyAuthenticated ? 'Signed in' : 'Signed out'} />
          </div>
          <dl className="space-y-1.5 text-zinc-400">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Privy SDK</dt>
              <dd className="mt-0.5 font-mono text-zinc-300">
                {!privyReady ? 'Loading…' : privyAuthenticated ? 'authenticated' : 'not authenticated'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Email</dt>
              <dd className="mt-0.5 break-all text-zinc-300">{privyEmail ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Embedded signer (to add)</dt>
              <dd className="mt-0.5 break-all font-mono text-zinc-300" title={privyEmbeddedEoa ?? undefined}>
                {shortAddr(privyEmbeddedEoa)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">4626 HttpOnly session</dt>
              <dd className="mt-0.5 font-mono text-zinc-300">
                {has4626Session ? `active (${shortAddr(sessionAddress)})` : 'none'}
              </dd>
            </div>
          </dl>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full text-rose-200 hover:text-rose-100"
            disabled={!privyAuthenticated || privySignOutBusy}
            loading={privySignOutBusy}
            onClick={() => void onSignOutPrivy()}
          >
            {privySignOutBusy ? 'Signing out…' : 'Sign out Privy / 4626 session'}
          </Button>
        </div>

        {/* Base Account signing */}
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 font-medium text-zinc-200">
              <img src={BASE_ACCOUNT_LOGO} alt="" className="h-3.5 w-3.5" aria-hidden />
              Base Account (signing)
            </div>
            <StatusPill
              connected={baseMatchesCsw}
              label={
                !inBaseApp
                  ? 'Need Base App'
                  : !baseConnected
                    ? 'Not connected'
                    : baseMatchesCsw
                      ? 'Connected'
                      : 'Mismatch'
              }
            />
          </div>
          <dl className="space-y-1.5 text-zinc-400">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Provider account</dt>
              <dd className="mt-0.5 break-all font-mono text-zinc-300" title={providerAddr ?? undefined}>
                {providerAddr ? shortAddr(providerAddr) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Profile canonical CSW</dt>
              <dd className="mt-0.5 break-all font-mono text-zinc-300" title={profileCsw ?? expectedCsw ?? undefined}>
                {profileCsw
                  ? shortAddr(profileCsw)
                  : expectedCsw && providerAddr === expectedCsw
                    ? `${shortAddr(expectedCsw)} (from Base connect)`
                    : 'Not on profile yet'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Addresses match</dt>
              <dd className="mt-0.5 text-zinc-300">
                {!expectedCsw || !providerAddr
                  ? '—'
                  : baseMatchesCsw
                    ? 'Yes — signing wallet matches CSW'
                    : 'No — reconnect Base Account'}
              </dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="inline-flex w-full items-center justify-center gap-2"
              disabled={!privyAuthenticated || !inBaseApp || baseLinkBusy}
              loading={baseLinkBusy}
              onClick={() => void onConnectBase()}
            >
              <img src={BASE_ACCOUNT_LOGO} alt="" className="h-3.5 w-3.5 object-contain" aria-hidden />
              {baseLinkBusy ? 'Connecting…' : baseConnected ? 'Reconnect Base Account' : 'Connect Base Account'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={!baseConnected || baseDisconnectBusy || baseLinkBusy}
              loading={baseDisconnectBusy}
              onClick={() => void onDisconnectBase()}
            >
              {baseDisconnectBusy ? 'Disconnecting…' : 'Disconnect Base Account'}
            </Button>
          </div>
        </div>
      </div>

      {!submitReady ? (
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Submit needs Privy signed in, embedded signer resolved, canonical CSW on profile, and Base Account connected
          to that CSW inside Base App.
        </p>
      ) : null}
    </div>
  )
}

export function resolveAddOwnerBaseWalletAddress(
  wallets: unknown[],
  providerAccounts: string[] | null | undefined,
): string | null {
  const fromProvider = normalizeWalletAddress(providerAccounts?.[0])
  if (fromProvider) return fromProvider
  const baseWallet = findBaseAccountWalletInList(wallets)
  return normalizeWalletAddress(baseWallet?.address as string | undefined)
}
