import { useMemo } from 'react'
import { ChevronDown } from 'lucide-react'

import type { CanonicalIdentity } from '@/hooks/useCanonicalIdentity'
import { useBasenameForAddress } from '@/hooks/useBasenameForAddress'
import { useCreatorCoinBadge } from '@/hooks/useCreatorCoinBadge'
import { JazziconAvatar } from '@/components/account/JazziconAvatar'
import { CopyableAddress } from '@/components/account/CopyableAddress'

const BASE_CHAIN_LOGO = '/base/base-chain-light.svg'
const RABBY_LOGO_URL = 'https://raw.githubusercontent.com/RabbyHub/logo/master/symbol.svg'
const METAMASK_LOGO_URL = 'https://raw.githubusercontent.com/MetaMask/metamask-mobile/main/app/images/fox.svg'
const COINBASE_WALLET_LOGO_URL = 'https://gist.githubusercontent.com/taycaldwell/2291907115c0bb5589bc346661435007/raw/cbw.svg'

/**
 * Top-right identity surface for authenticated users.
 *
 * Displays the canonical smart wallet (CSW) as the primary identity,
 * with a clear "CSW" label so users never confuse it with their signing
 * EOA. Optional creator coin badge when the CSW owns a registered
 * creator coin via `CreatorRegistry.getTokenForVault(csw)`.
 *
 * Used from within `ConnectButton.tsx` — the parent component still
 * owns the dropdown menu + auth actions; this component just renders
 * the trigger surface.
 *
 * See `docs/design/identity-surface-spec.md` for the full design rationale.
 */
export function CanonicalIdentityCard({
  identity,
  onToggle,
  menuOpen,
  variant = 'nav',
  activeNetworkLabel: _activeNetworkLabel = 'Base',
  activeNetworkUsd = null,
}: {
  identity: CanonicalIdentity
  onToggle: () => void
  menuOpen: boolean
  variant?: 'nav' | 'compact'
  activeNetworkLabel?: string | null
  activeNetworkUsd?: number | null
}) {
  const cswBasename = useBasenameForAddress(identity.cswAddress)
  const externalEoaBasename = useBasenameForAddress(identity.externalEoaAddress)
  const privyBasename = useBasenameForAddress(identity.privyEmbeddedAddress)
  const coinBadge = useCreatorCoinBadge(identity.creatorCoinAddress)

  const primary = useMemo(() => resolvePrimaryLabel({
    csw: cswBasename,
    externalEoa: externalEoaBasename,
    privy: privyBasename,
    cswAddress: identity.cswAddress,
  }), [cswBasename, externalEoaBasename, privyBasename, identity.cswAddress])

  const avatarAddress = identity.cswAddress ?? identity.externalEoaAddress ?? identity.privyEmbeddedAddress
  const avatarSize = variant === 'compact' ? 20 : 24

  if (variant === 'nav') {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="group flex min-h-[50px] items-center gap-2.5 rounded-2xl bg-white/[0.02] px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.045]"
      >
        <span
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          <img
            src={BASE_CHAIN_LOGO}
            alt=""
            className="h-3.5 w-3.5 object-contain"
            loading="lazy"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold tabular-nums text-white">
            {formatUsdCompact(activeNetworkUsd)}
          </span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-300" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      className="group flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-2.5 py-1.5 text-left hover:bg-white/[0.04] hover:border-white/12 transition-colors"
    >
      {primary.avatarUrl ? (
        // Real basename/ENS avatar.
        <img
          src={primary.avatarUrl}
          alt=""
          width={avatarSize}
          height={avatarSize}
          className="rounded-full flex-shrink-0 object-cover"
          style={{ width: avatarSize, height: avatarSize }}
          onError={(e) => {
            // If the avatar URL is broken, fall through to the jazzicon.
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      ) : (
        <JazziconAvatar address={avatarAddress} size={avatarSize} />
      )}

      <span className="flex flex-col items-start min-w-0 gap-0.5">
        <span className="text-sm text-white font-medium truncate max-w-[16ch]" title={primary.title}>
          {primary.label}
        </span>
        {identity.cswAddress ? (
          <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <span className="font-mono">{formatShort(identity.cswAddress)}</span>
            <span
              className="rounded-full border border-white/10 bg-white/[0.02] px-1 py-0 leading-none text-[9px] uppercase tracking-wide text-zinc-400"
              title="Coinbase Smart Wallet — your canonical onchain identity"
            >
              CSW
            </span>
          </span>
        ) : identity.loadingCsw ? (
          <span className="text-[10px] text-zinc-600">Linking smart wallet…</span>
        ) : identity.cswMissing ? (
          <span className="text-[10px] text-amber-300/80">No CSW linked yet</span>
        ) : (
          <span className="text-[10px] text-zinc-500">not signed in</span>
        )}
        {coinBadge && coinBadge.logoUrl && coinBadge.symbol ? (
          <span className="flex items-center gap-1 text-[10px] text-zinc-400">
            <img
              src={coinBadge.logoUrl}
              alt=""
              width={12}
              height={12}
              className="rounded-sm flex-shrink-0"
              style={{ width: 12, height: 12 }}
            />
            <span className="text-brand-accent">${coinBadge.symbol}</span>
          </span>
        ) : null}
      </span>

      <ChevronDown className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-300 flex-shrink-0" />
    </button>
  )
}

/**
 * Dropdown body content — canonical smart wallet first, then signer lanes.
 * Sub-account is surfaced only for population (b) when it is the effective swap lane.
 */
export function CanonicalIdentityDropdown({
  identity,
  onRequestConnectWallet,
  onRequestSignOut,
  signingOut,
  onRequestDisconnectMainWallet,
  disconnectingMainWallet,
}: {
  identity: CanonicalIdentity
  onRequestConnectWallet?: () => void
  onRequestSignOut?: () => void
  signingOut?: boolean
  onRequestDisconnectMainWallet?: () => void
  disconnectingMainWallet?: boolean
}) {
  const cswBasename = useBasenameForAddress(identity.cswAddress)
  const externalEoaBasename = useBasenameForAddress(identity.externalEoaAddress)
  const privyBasename = useBasenameForAddress(identity.privyEmbeddedAddress)
  const coinBadge = useCreatorCoinBadge(identity.creatorCoinAddress)
  const embeddedAddress = identity.privyEmbeddedAddress
  const sectionClassName = 'px-4 py-3'

  return (
    <div className="flex flex-col">
      {/* Canonical identity section — always rendered when a session exists
          so users aren't confused by a missing CSW slot. Falls back to
          loading / missing-CSW copy when the canonical address hasn't
          resolved yet. */}
      {identity.cswAddress ? (
        <div className={sectionClassName}>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Primary identity</div>
          <div className="mt-1.5 flex items-center gap-2.5">
            {cswBasename.avatar ? (
              <img
                src={cswBasename.avatar}
                alt=""
                width={32}
                height={32}
                className="rounded-full flex-shrink-0 object-cover"
                style={{ width: 32, height: 32 }}
              />
            ) : (
              <JazziconAvatar address={identity.cswAddress} size={32} />
            )}
            <div className="min-w-0 flex-1">
              <AddressWithBasescan address={identity.cswAddress} className="text-sm text-white" />
              <div className="text-[11px] text-zinc-500 truncate">
                Coinbase Smart Wallet | Holds assets and executes swaps
              </div>
            </div>
          </div>
          {coinBadge && coinBadge.logoUrl && coinBadge.symbol ? (
            <div className="mt-2 ml-10 flex items-center gap-1.5 text-[11px] text-zinc-400">
              <img
                src={coinBadge.logoUrl}
                alt=""
                width={14}
                height={14}
                className="rounded-sm flex-shrink-0"
                style={{ width: 14, height: 14 }}
              />
              <span className="text-brand-accent">${coinBadge.symbol}</span>
              {coinBadge.name ? <span className="text-zinc-500">{coinBadge.name}</span> : null}
            </div>
          ) : null}
        </div>
      ) : identity.loadingCsw ? (
        <div className={sectionClassName}>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
            Primary identity
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-white/5 animate-pulse" />
            <div className="min-w-0 flex-1">
              <div className="h-3 w-32 rounded bg-white/10 animate-pulse" />
              <div className="mt-1.5 h-2 w-40 rounded bg-white/5 animate-pulse" />
            </div>
          </div>
          <div className="mt-2 ml-10 text-[10px] text-zinc-600">
            Resolving your canonical smart wallet…
          </div>
        </div>
      ) : identity.cswMissing ? (
        <div className={sectionClassName}>
          <div className="text-[10px] uppercase tracking-wider text-amber-300/80 font-medium">
            Primary identity · needs setup
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <IdentityAvatarPlaceholder size={32} />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-zinc-300">
                No Coinbase Smart Wallet linked to this profile yet.
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Finish the Zora / Base App handoff in{' '}
                <span className="underline decoration-dotted">Accounts</span> to link your CSW.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {identity.accountChrome.showSubAccountInTray && identity.executionSubAccountAddress ? (
        <>
          <div className="mx-4 my-2 h-px bg-white/8" />
          <div className={sectionClassName}>
            <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
              {identity.accountChrome.executionLaneTitle}
            </div>
            <div className="mt-1.5 flex items-center gap-2.5">
              <JazziconAvatar address={identity.executionSubAccountAddress} size={24} />
              <div className="min-w-0 flex-1">
                <AddressWithBasescan
                  address={identity.executionSubAccountAddress}
                  variant="muted"
                  className="text-xs text-zinc-300"
                />
                <div className="text-[10px] text-zinc-600 truncate">
                  {identity.accountChrome.executionLaneDescription}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {(identity.cswAddress && (
        // Keep the primary->signer divider when a distinct main wallet lane
        // exists, or when embedded-owner authorization is not yet confirmed.
        identity.externalEoaAddress ||
        (identity.privyEmbeddedAddress && identity.embeddedSignerAuthorizedOnCsw !== true)
      )) ? (
        <div className="mx-4 my-2 h-px bg-white/8" />
      ) : null}

      {/* Privy embedded (auto-provisioned) */}
      {embeddedAddress ? (
        <div className={sectionClassName}>
          {(() => {
            const embeddedSignerStatusClass =
              identity.embeddedSignerAuthorizedOnCsw === true
                ? 'bg-emerald-400'
                : identity.embeddedSignerAuthorizedOnCsw === false
                  ? 'bg-amber-400'
                  : 'bg-zinc-500'
            const embeddedSignerStatusLabel =
              identity.embeddedSignerAuthorizedOnCsw === true
                ? 'Embedded signer is authorized on the smart wallet'
                : identity.embeddedSignerAuthorizedOnCsw === false
                  ? 'Embedded signer is not authorized on the smart wallet yet'
                  : 'Embedded signer authorization status is loading'

            return (
              <>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
              Embedded signer
            </div>
            {onRequestSignOut ? (
              <button
                type="button"
                onClick={onRequestSignOut}
                disabled={signingOut === true}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-60"
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            ) : null}
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <div className="relative flex-shrink-0" title={embeddedSignerStatusLabel}>
              {privyBasename.avatar ? (
                <img
                  src={privyBasename.avatar}
                  alt=""
                  width={24}
                  height={24}
                  className="rounded-full object-cover"
                  style={{ width: 24, height: 24 }}
                />
              ) : (
                <div className="rounded-full overflow-hidden">
                  <JazziconAvatar address={embeddedAddress} size={24} />
                </div>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[rgb(8,8,8)] ${embeddedSignerStatusClass}`}
                aria-label={embeddedSignerStatusLabel}
              />
            </div>
            <div className="min-w-0 flex-1">
              <AddressWithBasescan address={embeddedAddress} variant="muted" className="text-xs text-zinc-300" />
              <div className="text-[10px] text-zinc-600 truncate">Signs sponsored actions for your smart wallet</div>
            </div>
          </div>
              </>
            )
          })()}
        </div>
      ) : (
        <div className={sectionClassName}>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
            Embedded signer
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <IdentityAvatarPlaceholder size={24} />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-zinc-300">Not connected</div>
              <div className="text-[10px] text-zinc-600 truncate">
                Signs sponsored actions for your smart wallet
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Separate embedded signer from external main wallet lane. */}
      {(embeddedAddress && identity.externalEoaAddress) ? (
        <div className="mx-4 my-2 h-px bg-white/8" />
      ) : null}

      {/* Active external signer (Rabby / MetaMask / CBW) */}
      {identity.externalEoaAddress ? (
        <div className={sectionClassName}>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
            Main wallet
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            {externalEoaBasename.avatar ? (
              <img
                src={externalEoaBasename.avatar}
                alt=""
                width={24}
                height={24}
                className="rounded-full flex-shrink-0 object-cover"
                style={{ width: 24, height: 24 }}
              />
            ) : (
              <JazziconAvatar address={identity.externalEoaAddress} size={24} />
            )}
            <div className="min-w-0 flex-1">
              <AddressWithBasescan
                address={identity.externalEoaAddress}
                label={externalEoaBasename.displayName}
                variant="muted"
                className="text-xs text-zinc-300"
              />
              <div className="text-[10px] text-zinc-600 truncate">Used to approve smart wallet setup</div>
              {onRequestDisconnectMainWallet ? (
                <button
                  type="button"
                  onClick={onRequestDisconnectMainWallet}
                  disabled={disconnectingMainWallet === true}
                  className="mt-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-60"
                >
                  {disconnectingMainWallet ? 'Disconnecting…' : 'Disconnect main wallet'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : onRequestConnectWallet ? (
        <button
          type="button"
          onClick={onRequestConnectWallet}
          className={`w-full text-left ${sectionClassName} hover:bg-white/4 transition-colors`}
        >
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
            Main wallet
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <IdentityAvatarPlaceholder size={24} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <span>Connect</span>
                <WalletLogoBadge name="Rabby" src={RABBY_LOGO_URL} />
                <WalletLogoBadge name="MetaMask" src={METAMASK_LOGO_URL} />
                <WalletLogoBadge name="Coinbase Wallet" src={COINBASE_WALLET_LOGO_URL} />
              </div>
              <div
                className="text-[10px] text-zinc-600 mt-0.5 truncate"
                title="After you connect, 4626 finishes smart wallet setup."
              >
                After you connect, 4626 finishes setup.
              </div>
            </div>
          </div>
        </button>
      ) : null}
    </div>
  )
}

function WalletLogoBadge({ name, src }: { name: string; src: string }) {
  return (
    <span className="inline-flex items-center justify-center">
      <img
        src={src}
        alt={name}
        className="h-4 w-4 object-contain"
        loading="lazy"
      />
    </span>
  )
}

function IdentityAvatarPlaceholder({ size }: { size: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
    </span>
  )
}

type PrimaryLabelInput = {
  csw: ReturnType<typeof useBasenameForAddress>
  externalEoa: ReturnType<typeof useBasenameForAddress>
  privy: ReturnType<typeof useBasenameForAddress>
  cswAddress: string | null
}

type PrimaryLabel = {
  label: string
  title: string
  avatarUrl: string | null
}

function resolvePrimaryLabel(input: PrimaryLabelInput): PrimaryLabel {
  // Priority: CSW basename → CSW ENS → external EOA → Privy embedded → short CSW
  if (input.csw.displayName) {
    return {
      label: input.csw.displayName,
      title: input.csw.displayName,
      avatarUrl: input.csw.avatar,
    }
  }
  if (input.externalEoa.displayName) {
    return {
      label: input.externalEoa.displayName,
      title: input.externalEoa.displayName,
      avatarUrl: input.externalEoa.avatar,
    }
  }
  if (input.privy.displayName) {
    return {
      label: input.privy.displayName,
      title: input.privy.displayName,
      avatarUrl: input.privy.avatar,
    }
  }
  if (input.cswAddress) {
    return {
      label: formatShort(input.cswAddress),
      title: input.cswAddress,
      avatarUrl: null,
    }
  }
  return { label: 'Sign in', title: 'Sign in', avatarUrl: null }
}

function AddressWithBasescan({
  address,
  label,
  className,
  variant = 'default',
}: {
  address: string
  label?: string | null
  className?: string
  variant?: 'default' | 'muted' | 'pill'
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <CopyableAddress address={address} label={label} className={className} variant={variant} />
      <a
        href={`https://basescan.org/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        title="View on Basescan"
        aria-label="View on Basescan"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-zinc-200 opacity-80 transition hover:text-white hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-sky-300/50"
        onClick={(event) => event.stopPropagation()}
      >
        <BasescanIcon />
      </a>
    </span>
  )
}

function BasescanIcon() {
  return (
    <img src="/base/basescan-logo-symbol-light.svg" alt="" className="h-3.5 w-3.5 object-contain" />
  )
}

function formatShort(value: string | null | undefined): string {
  if (!value) return ''
  if (value.length <= 10) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function formatUsdCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--'
  const amount = Number(value)
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(2)}K`
  return `$${amount.toFixed(2)}`
}
