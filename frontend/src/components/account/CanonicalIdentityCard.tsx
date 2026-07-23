import { useMemo } from 'react'
import { ChevronDown } from 'lucide-react'

import type { CanonicalIdentity } from '@/hooks/useCanonicalIdentity'
import { useBasenameForAddress } from '@/hooks/useBasenameForAddress'
import { useCreatorCoinBadge } from '@/hooks/useCreatorCoinBadge'
import { JazziconAvatar } from '@/components/account/JazziconAvatar'
import { CopyableAddress } from '@/components/account/CopyableAddress'
import { WalletProviderIcon } from '@/components/ui/WalletProviderIcon'
import { siteAssets } from '@/config/site'
import { resolveLinkedExternalWalletProvider } from '@/features/waitlist/resolveLinkedExternalWalletProvider'
import { useEmbeddedOwnerOnCsw } from '@/features/waitlist/useEmbeddedOwnerOnCsw'
import { useSafePrivy } from '@/lib/privy/safeHooks'
import { usePrivyWalletsFromContext } from '@/lib/privy/walletHooksContext'
import { inferWalletProvider, walletProviderLabel } from '@/lib/wallet/providerIdentity'

const BASE_CHAIN_LOGO = '/base/base-chain-light.svg'
const RABBY_LOGO_URL = 'https://raw.githubusercontent.com/RabbyHub/logo/master/symbol.svg'
const METAMASK_LOGO_URL = 'https://raw.githubusercontent.com/MetaMask/metamask-mobile/main/app/images/fox.svg'
/** Official Coinbase Wallet / Smart Wallet mark (blue disc + white square). */
const COINBASE_WALLET_LOGO_URL = '/brands/coinbase-wallet.svg'
const ZORA_LOGO_URL = '/brands/zora-token.svg'
const PRIVY_LOGO_URL = '/brands/privy-symbol-white.svg'

/**
 * Top-right identity surface for authenticated users.
 *
 * Displays the canonical smart wallet (CSW) as the primary identity,
 * with a clear "CSW" label so users never confuse it with their signing
 * EOA. Optional creator coin badge when the CSW owns a registered
 * creator coin via `Registry4626.getTokenForVault(csw)`.
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
  activeNetworkLabel = 'Base',
  activeNetworkUsd = null,
}: {
  identity: CanonicalIdentity
  onToggle: () => void
  menuOpen: boolean
  variant?: 'nav' | 'compact'
  activeNetworkLabel?: string | null
  activeNetworkUsd?: number | null
}) {
  // Nav trigger only shows Base + USD — skip basename/coin lookups there.
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
    <CanonicalIdentityCompactCard
      identity={identity}
      onToggle={onToggle}
      menuOpen={menuOpen}
      activeNetworkLabel={activeNetworkLabel}
      activeNetworkUsd={activeNetworkUsd}
    />
  )
}

function CanonicalIdentityCompactCard({
  identity,
  onToggle,
  menuOpen,
}: {
  identity: CanonicalIdentity
  onToggle: () => void
  menuOpen: boolean
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
  const avatarSize = 20

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      className="group flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-2.5 py-1.5 text-left hover:bg-white/[0.04] hover:border-white/12 transition-colors"
    >
      {primary.avatarUrl ? (
        <img
          src={primary.avatarUrl}
          alt=""
          width={avatarSize}
          height={avatarSize}
          className="rounded-full flex-shrink-0 object-cover"
          style={{ width: avatarSize, height: avatarSize }}
          onError={(e) => {
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
 */
export function CanonicalIdentityDropdown({
  identity,
  onRequestConnectWallet,
  onRequestSignOut,
  signingOut,
  /** Aggregate busy flag from the caller (e.g. other in-flight linking
   * actions) that should also disable sign-out, distinct from `signingOut`
   * which drives the "Signing out…" label. */
  signOutDisabled,
  onRequestDisconnectMainWallet,
  disconnectingMainWallet,
}: {
  identity: CanonicalIdentity
  onRequestConnectWallet?: () => void
  onRequestSignOut?: () => void
  signingOut?: boolean
  signOutDisabled?: boolean
  onRequestDisconnectMainWallet?: () => void
  disconnectingMainWallet?: boolean
}) {
  const externalEoaBasename = useBasenameForAddress(identity.externalEoaAddress)
  const embeddedAddress = identity.privyEmbeddedAddress
  const privy = useSafePrivy()
  const wallets = usePrivyWalletsFromContext()
  const mainWalletIdentity = useMemo(
    () =>
      resolveLinkedExternalWalletProvider({
        linkedAddress: identity.externalEoaAddress,
        wallets,
        privyUser: privy.user,
      }),
    [identity.externalEoaAddress, wallets, privy.user],
  )
  const mainWalletProviderId = inferWalletProvider({
    provider: mainWalletIdentity.provider,
    connectorId: mainWalletIdentity.connectorId,
    walletType: 'external_eoa',
  })
  const mainWalletProviderLabel = walletProviderLabel(mainWalletProviderId)
  const { status: mainWalletOwnerStatus } = useEmbeddedOwnerOnCsw({
    cswAddress: identity.cswAddress,
    embeddedEoaAddress: identity.externalEoaAddress,
    enabled: Boolean(identity.cswAddress && identity.externalEoaAddress),
  })
  const mainWalletOwnerDotClass =
    mainWalletOwnerStatus === 'owner'
      ? 'bg-emerald-400'
      : mainWalletOwnerStatus === 'not-owner'
        ? 'bg-amber-400'
        : mainWalletOwnerStatus === 'checking'
          ? 'bg-zinc-500'
          : null
  const mainWalletOwnerLabel =
    mainWalletOwnerStatus === 'owner'
      ? 'Main wallet is an owner on the smart wallet'
      : mainWalletOwnerStatus === 'not-owner'
        ? 'Main wallet is not an owner on the smart wallet'
        : mainWalletOwnerStatus === 'checking'
          ? 'Checking whether main wallet is an owner on the smart wallet'
          : null
  const sectionClassName = 'px-0 py-3'
  const dividerClassName = 'my-1 h-px bg-white/[0.06]'
  const showMainWalletBlock = Boolean(identity.externalEoaAddress) || Boolean(onRequestConnectWallet)
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
    <div className="flex flex-col">
      {identity.cswAddress ? (
        <div className={sectionClassName}>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Smart wallet</div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <CoinbaseSmartWalletAvatar size={32} />
            <div className="min-w-0 flex-1">
              <AddressWithBasescan
                address={identity.cswAddress}
                display="full"
                className="text-sm leading-snug text-white"
              />
              <div className="text-[11px] text-zinc-500 truncate">Coinbase Smart Wallet</div>
            </div>
          </div>
        </div>
      ) : identity.loadingCsw ? (
        <div className={sectionClassName}>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
            Smart wallet
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-white/5 animate-pulse" />
            <div className="min-w-0 flex-1">
              <div className="h-3 w-32 rounded bg-white/10 animate-pulse" />
              <div className="mt-1.5 h-2 w-40 rounded bg-white/5 animate-pulse" />
            </div>
          </div>
        </div>
      ) : identity.cswMissing ? (
        <div className={sectionClassName}>
          <div className="text-[10px] uppercase tracking-wider text-amber-300/80 font-medium">
            Smart wallet · needs setup
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <IdentityAvatarPlaceholder size={32} />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-zinc-300">No smart wallet linked yet.</div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Finish setup in Accounts to link your Coinbase Smart Wallet.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {identity.cswAddress || identity.loadingCsw || identity.cswMissing ? (
        <div className={dividerClassName} />
      ) : null}

      <div className={sectionClassName}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
            Embedded signer
          </div>
          {onRequestSignOut ? (
            <button
              type="button"
              onClick={onRequestSignOut}
              disabled={signingOut === true || signOutDisabled === true}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-60"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          ) : null}
        </div>
        {embeddedAddress ? (
          <div className="mt-1.5 flex items-center gap-2.5">
            <div className="relative shrink-0" title={embeddedSignerStatusLabel}>
              <EmbeddedSignerMark size={24} />
              <span
                className={`absolute -right-0.5 -top-0.5 size-2 rounded-full border border-[rgb(var(--vault-card))] ${embeddedSignerStatusClass}`}
                aria-label={embeddedSignerStatusLabel}
              />
            </div>
            <div className="min-w-0 flex-1">
              <AddressWithBasescan
                address={embeddedAddress}
                display="full"
                variant="muted"
                className="text-xs text-zinc-300"
              />
              <div className="text-[10px] text-zinc-600 truncate">Privy embedded</div>
            </div>
          </div>
        ) : (
          <div className="mt-1.5 flex items-center gap-2.5">
            <IdentityAvatarPlaceholder size={24} />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-zinc-300">Not connected</div>
              <div className="text-[10px] text-zinc-600 truncate">Privy embedded</div>
            </div>
          </div>
        )}
      </div>

      {showMainWalletBlock ? <div className={dividerClassName} /> : null}

      {identity.externalEoaAddress ? (
        <div className={sectionClassName}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
              Main wallet
            </div>
            {onRequestDisconnectMainWallet ? (
              <button
                type="button"
                onClick={onRequestDisconnectMainWallet}
                disabled={disconnectingMainWallet === true}
                className="shrink-0 text-[10px] text-rose-400/90 transition-colors hover:text-rose-300 disabled:opacity-60"
              >
                {disconnectingMainWallet ? 'Disconnecting…' : 'Disconnect'}
              </button>
            ) : null}
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <div
              className="relative shrink-0"
              title={mainWalletOwnerLabel ?? mainWalletProviderLabel}
            >
              <WalletProviderIcon
                provider={mainWalletIdentity.provider}
                connectorId={mainWalletIdentity.connectorId}
                walletType="external_eoa"
                size={24}
                className="shrink-0"
              />
              {mainWalletOwnerDotClass && mainWalletOwnerLabel ? (
                <span
                  className={`absolute -right-0.5 -top-0.5 size-2 rounded-full border border-[rgb(var(--vault-card))] ${mainWalletOwnerDotClass}`}
                  aria-label={mainWalletOwnerLabel}
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <AddressWithBasescan
                address={identity.externalEoaAddress}
                label={externalEoaBasename.displayName}
                display="full"
                variant="muted"
                className="text-xs text-zinc-300"
              />
              <div className="text-[10px] text-zinc-600 truncate">
                {mainWalletProviderId !== 'unknown' ? mainWalletProviderLabel : 'External wallet'}
              </div>
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

/**
 * Coinbase Smart Wallet mark — full Coinbase Wallet disc + small Zora corner badge.
 */
export function CoinbaseSmartWalletAvatar({
  size = 56,
  className,
}: {
  /** Kept for call-site compatibility; unused — this mark is brand logos only. */
  address?: string | null
  basenameAvatar?: string | null
  size?: number
  className?: string
}) {
  const badge = Math.max(16, Math.round(size * 0.36))
  return (
    <span
      className={`relative inline-flex shrink-0 ${className ?? ''}`}
      style={{ width: size, height: size }}
      title="Coinbase Smart Wallet (Zora)"
      aria-label="Coinbase Smart Wallet (Zora)"
    >
      <img
        src={COINBASE_WALLET_LOGO_URL}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
      <span
        className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center overflow-hidden rounded-full border-2 border-[rgb(var(--vault-card))] bg-black"
        style={{ width: badge, height: badge }}
        aria-hidden="true"
      >
        <img src={ZORA_LOGO_URL} alt="" className="size-full object-cover" />
      </span>
    </span>
  )
}

/** 4626 “4” as the primary mark, Privy badge bottom-right (same pattern as CSW + Zora). */
export function EmbeddedSignerMark({ size = 24, className }: { size?: number; className?: string }) {
  const badge = Math.max(12, Math.round(size * 0.42))
  return (
    <span
      className={`relative inline-flex shrink-0 ${className ?? ''}`}
      style={{ width: size, height: size }}
      title="4626 Privy embedded EOA"
      aria-label="4626 Privy embedded EOA"
    >
      <img
        src={siteAssets.logo}
        alt=""
        className="rounded-[5px] object-contain"
        style={{ width: size, height: size }}
      />
      <span
        className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-[rgb(var(--vault-card))] bg-[#111]"
        style={{ width: badge, height: badge }}
        aria-hidden="true"
      >
        <img
          src={PRIVY_LOGO_URL}
          alt=""
          className="object-contain"
          style={{ width: badge * 0.58, height: badge * 0.58 }}
        />
      </span>
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

export function AddressWithBasescan({
  address,
  label,
  className,
  variant = 'default',
  display = 'short',
}: {
  address: string
  label?: string | null
  className?: string
  variant?: 'default' | 'muted' | 'pill'
  display?: 'short' | 'full'
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-start gap-1.5">
      <CopyableAddress
        address={address}
        label={label}
        className={className}
        variant={variant}
        display={display}
      />
      <a
        href={`https://basescan.org/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        title="View on Basescan"
        aria-label="View on Basescan"
        className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-zinc-200 opacity-80 transition hover:text-white hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-sky-300/50"
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
