import { memo, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Coins,
  Mail,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import type { WaitlistState } from '../waitlistTypes'
import { ConnectButtonWeb3 } from '@/components/ConnectButtonWeb3'

// Note: ConnectButtonWeb3 and Wallet are used in the "Having trouble?" sheet

// Base brand motion: cubic-bezier(0.4, 0, 0.2, 1), 120-240ms for snappy UI
const baseEase = [0.4, 0, 0.2, 1] as const
const BASE_SQUARE_WHITE = '/base/1_Base%20Brand%20Assets/The%20Square/Base_square_white.svg'
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: baseEase },
}
const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.18, ease: baseEase },
}
const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.03,
    },
  },
}
const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: baseEase },
  },
}

const usdCompactFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const numberCompactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function shortAddress(value: string | null | undefined, head = 6, tail = 4): string {
  const addr = typeof value === 'string' ? value.trim() : ''
  if (!addr) return 'Unavailable'
  if (addr.length <= head + tail + 1) return addr
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`
}

function formatUsdCompact(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return usdCompactFormatter.format(value)
}

function formatCountCompact(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return numberCompactFormatter.format(value)
}

type VerifyStepProps = {
  verifiedWallet: string | null
  showPrivy: boolean
  showPrivyReady: boolean
  privyReady: boolean
  privyVerifyBusy: boolean
  privyVerifyError: string | null
  // CSW detection (simplified - just show detection, no owner linking at signup)
  showDeployOwnerLink?: boolean
  cswAddress?: string | null
  isBaseApp?: boolean
  coinbaseSmartWalletAddress?: string | null
  walletOwnershipValid: boolean
  ownershipEvidenceAvailable: boolean
  cswMismatch?: boolean
  // Auto-fetched Creator Coin
  creatorCoin: WaitlistState['creatorCoin']
  creatorCoinDeclaredMissing: boolean
  creatorCoinBusy: boolean
  // Submission
  busy: boolean
  canSubmit: boolean
  onPrivyContinue: () => void
  onPrivyEmailContinue?: () => void
  onFallbackSignIn?: () => void | Promise<void>
  onSubmit: () => void | Promise<void>
}

export const VerifyStep = memo(function VerifyStep({
  verifiedWallet,
  showPrivy,
  showPrivyReady,
  privyReady,
  privyVerifyBusy,
  privyVerifyError,
  isBaseApp,
  walletOwnershipValid,
  ownershipEvidenceAvailable,
  cswMismatch,
  creatorCoin,
  creatorCoinDeclaredMissing,
  creatorCoinBusy,
  busy,
  canSubmit,
  onPrivyContinue,
  onPrivyEmailContinue,
  onFallbackSignIn,
  onSubmit,
}: VerifyStepProps) {
  const hasCreatorCoin = !!creatorCoin?.address
  const showSubmitButton = verifiedWallet && (hasCreatorCoin || creatorCoinDeclaredMissing)
  const ownerWallets = useMemo(() => creatorCoin?.ownerWallets ?? [], [creatorCoin?.ownerWallets])
  const payoutRecipient = useMemo(() => creatorCoin?.payoutRecipient ?? null, [creatorCoin?.payoutRecipient])
  const canonicalSmartWallet = useMemo(() => creatorCoin?.canonicalSmartWallet ?? null, [creatorCoin?.canonicalSmartWallet])
  const ownershipGateActive = Boolean(hasCreatorCoin && ownershipEvidenceAvailable)
  const headerTitle = !verifiedWallet ? 'Connect owner wallet' : showSubmitButton ? 'Join the waitlist' : 'Checking ownership'
  const headerSubtitle = !verifiedWallet
    ? isBaseApp
      ? 'Base app detected. Connect the wallet that owns your creator coin.'
      : 'Connect the wallet that owns your creator coin. We will verify on-chain ownership.'
    : showSubmitButton
      ? ownershipGateActive && !walletOwnershipValid
        ? 'Connect a payout recipient or owner wallet to continue.'
        : 'Ownership verified. Join the waitlist for early access updates.'
      : 'One moment…'
  const looksLikeWalletLoginDisabled =
    typeof privyVerifyError === 'string' && /wallet (login|sign-in) is not enabled|wallet sign-in isn’t available/i.test(privyVerifyError)
  const [showTrouble, setShowTrouble] = useState(false)
  const canContinue = showPrivyReady && privyReady && !privyVerifyBusy && !busy

  const helperText = useMemo(() => {
    if (privyVerifyBusy) return 'Opening…'
    if (!showPrivyReady) return 'Privy is not ready.'
    if (!privyReady) return 'Loading…'
    return ''
  }, [privyReady, privyVerifyBusy, showPrivyReady])
  const ownershipError =
    ownershipGateActive && !walletOwnershipValid
      ? 'Connected wallet is not in the creator coin owner set. Switch to an owner or payout recipient wallet.'
      : null
  const connectedWalletShort = useMemo(() => shortAddress(verifiedWallet, 8, 6), [verifiedWallet])
  const creatorCoinAddressShort = useMemo(() => shortAddress(creatorCoin?.address, 8, 6), [creatorCoin?.address])
  const payoutRecipientShort = useMemo(() => shortAddress(payoutRecipient, 8, 6), [payoutRecipient])
  const coinMarketCap = useMemo(() => formatUsdCompact(creatorCoin?.marketCapUsd), [creatorCoin?.marketCapUsd])
  const coinVolume = useMemo(() => formatUsdCompact(creatorCoin?.volume24hUsd), [creatorCoin?.volume24hUsd])
  const coinHolders = useMemo(() => formatCountCompact(creatorCoin?.holders), [creatorCoin?.holders])
  const keyMetrics = useMemo(
    () =>
      [
        { label: 'Market cap', value: coinMarketCap, icon: Coins },
        { label: 'Holders', value: coinHolders, icon: Users },
        { label: '24h volume', value: coinVolume, icon: TrendingUp },
      ].filter((metric) => Boolean(metric.value)),
    [coinHolders, coinMarketCap, coinVolume],
  )
  const ownerWalletCountLabel =
    ownerWallets.length > 0 ? `${ownerWallets.length} wallet${ownerWallets.length === 1 ? '' : 's'} on record` : 'Owner list unavailable'
  const ownershipStatusLabel = walletOwnershipValid ? 'Owner verified' : 'Owner wallet required'
  const ownershipStatusClass = walletOwnershipValid
    ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
    : 'border-amber-400/35 bg-amber-500/10 text-amber-100'
  const panelClass = 'rounded-2xl border border-white/[0.09] bg-zinc-950/70'
  const microPanelClass = 'rounded-xl border border-white/[0.08] bg-white/[0.02]'

  return (
    <motion.div
      key="verify"
      {...fadeUp}
      className="space-y-5 sm:space-y-6"
    >
      {/* Header */}
      <motion.div {...scaleIn} className="space-y-3">
        <h1 className="font-display text-[30px] sm:text-[35px] font-medium tracking-[-0.022em] text-white leading-[1.05]">
          {headerTitle}
        </h1>
        <div className="max-w-[34ch] text-[13px] text-zinc-400 leading-relaxed">{headerSubtitle}</div>
        {verifiedWallet ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300">
            <Sparkles className="h-3 w-3 text-[#8AB5FF]" />
            Founding Creator Access
          </div>
        ) : null}
      </motion.div>

      {/* Single primary CTA + progressive disclosure */}
      {!verifiedWallet ? (
        <motion.div {...scaleIn} className="space-y-3.5">
          <button
            type="button"
            className="group relative w-full overflow-hidden flex items-center justify-between gap-3 min-h-[58px] rounded-2xl border border-[#5A96FF]/35 bg-gradient-to-r from-[#004CE8] via-[#005CFF] to-[#2A79FF] text-white font-medium text-[15px] px-5 py-4 shadow-[0_16px_48px_-20px_rgba(0,82,255,0.95)] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:brightness-110 hover:shadow-[0_20px_56px_-22px_rgba(26,105,255,0.98)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            disabled={!canContinue}
            onClick={() => {
              if (looksLikeWalletLoginDisabled && typeof onPrivyEmailContinue === 'function') {
                onPrivyEmailContinue()
              } else {
                onPrivyContinue()
              }
            }}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/70 opacity-70" />
            <span className="pointer-events-none absolute -left-16 top-0 h-full w-16 -skew-x-12 bg-white/20 blur-md transition-transform duration-700 ease-out group-hover:translate-x-[400px]" />
            <span className="relative flex items-center gap-3">
              <img src={BASE_SQUARE_WHITE} alt="" className="w-3.5 h-3.5" aria-hidden="true" />
              Continue
            </span>
            <ChevronRight className="relative w-4 h-4 opacity-90" />
          </button>

          <div className="flex items-center justify-between">
            <div className="text-[12px] text-zinc-500">{helperText || '\u00A0'}</div>
            <button
              type="button"
              className="text-[12px] text-zinc-400 hover:text-zinc-200 transition-colors"
              onClick={() => setShowTrouble(true)}
            >
              Having trouble?
            </button>
          </div>

          {privyVerifyError ? (
            <motion.div
              {...fadeUp}
              className="rounded-2xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-[12px] text-red-200/90"
            >
              {privyVerifyError}
            </motion.div>
          ) : null}
        </motion.div>
      ) : null}

      {/* Trouble sheet */}
      <AnimatePresence>
        {showTrouble ? (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: baseEase }}
              onClick={() => setShowTrouble(false)}
            />
            <motion.div
              className="fixed left-0 right-0 bottom-0 z-50"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.2, ease: baseEase }}
            >
              <div className="mx-auto w-full max-w-[440px] px-4 pb-4">
                <div className="rounded-3xl border border-zinc-700/60 bg-zinc-950/90 backdrop-blur-2xl p-4 shadow-[0_30px_90px_-45px_rgba(0,0,0,0.85)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Having trouble?</div>
                      <div className="text-[16px] text-white mt-1 font-display">Try another option</div>
                    </div>
                    <button
                      type="button"
                      className="rounded-xl border border-zinc-700 bg-black/30 p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
                      onClick={() => setShowTrouble(false)}
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {looksLikeWalletLoginDisabled ? (
                    <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-200/90">
                      Wallet sign-in is disabled for this Privy app. Enable Wallet login in Privy to link Base Account.
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-2">
                    <div className="rounded-2xl border border-zinc-800/70 bg-black/25 px-4 py-3">
                      <div className="flex items-center gap-2 text-[12px] text-zinc-300">
                        <Wallet className="w-4 h-4 text-zinc-500" />
                        Use Coinbase Wallet / WalletConnect
                      </div>
                      <div className="mt-3">
                        <ConnectButtonWeb3 />
                      </div>
                      {onFallbackSignIn ? (
                        <button
                          type="button"
                          className="mt-3 w-full rounded-xl border border-zinc-800 bg-black/30 px-4 py-3 text-[13px] text-zinc-200 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/40 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50"
                          disabled={busy}
                          onClick={() => void onFallbackSignIn()}
                        >
                          Sign in (no transaction)
                        </button>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-zinc-800/70 bg-black/25 px-4 py-3">
                      <div className="flex items-center gap-2 text-[12px] text-zinc-300">
                        <Mail className="w-4 h-4 text-zinc-500" />
                        Continue with email
                      </div>
                      <div className="text-[11px] text-zinc-600 mt-1">
                        Useful if wallet popups are blocked. Deploy still requires Wallet login enabled in Privy.
                      </div>
                      <button
                        type="button"
                        className="mt-3 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-[13px] text-zinc-200 hover:text-white hover:border-white/20 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50"
                        disabled={busy || privyVerifyBusy || typeof onPrivyEmailContinue !== 'function'}
                        onClick={() => void onPrivyEmailContinue?.()}
                      >
                        Continue with email
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {/* Loading Creator Coin */}
      {verifiedWallet && creatorCoinBusy ? (
        <motion.div
          {...fadeUp}
          className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] py-4"
        >
          <div className="w-5 h-5 rounded-full border-2 border-zinc-700 border-t-[#0052FF] animate-spin" />
          <span className="text-[13px] text-zinc-400">Reading Zora profile and creator coin owners…</span>
        </motion.div>
      ) : null}

      {/* Verified summary (fills the empty state) */}
      {verifiedWallet && (hasCreatorCoin || creatorCoinDeclaredMissing) ? (
        <motion.div
          {...scaleIn}
          className="relative overflow-hidden rounded-[26px] border border-white/12 bg-black p-4 sm:p-5 shadow-[0_34px_110px_-70px_rgba(0,0,0,0.96)]"
        >
          <motion.div
            className="relative space-y-3"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.div variants={staggerItem} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.17em] text-zinc-500">Ownership</div>
                <div className="mt-1 text-[18px] text-white font-display">Review before join</div>
              </div>
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] ${ownershipStatusClass}`}>
                <BadgeCheck className="h-3.5 w-3.5" />
                {ownershipStatusLabel}
              </div>
            </motion.div>

            <motion.div variants={staggerItem} className={`${panelClass} p-3.5 sm:p-4`}>
              <div className="flex items-center gap-3">
                {creatorCoin?.imageUrl ? (
                  <img
                    src={creatorCoin.imageUrl}
                    alt={creatorCoin.symbol || 'Creator Coin'}
                    className="h-12 w-12 rounded-2xl border border-white/15 object-cover shadow-[0_14px_30px_-18px_rgba(58,123,255,0.85)]"
                    loading="lazy"
                  />
                ) : (
                    <div className="h-12 w-12 rounded-2xl border border-white/15 bg-gradient-to-br from-zinc-900 to-zinc-800 flex items-center justify-center text-[12px] text-zinc-300 font-semibold">
                      {(creatorCoin?.symbol || 'CC').slice(0, 2)}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] text-white font-medium truncate">
                    {creatorCoin?.symbol ? creatorCoin.symbol : creatorCoinDeclaredMissing ? 'No coin found' : 'Creator Coin'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-400 font-mono truncate" title={creatorCoin?.address || undefined}>
                    {creatorCoin?.address ? creatorCoinAddressShort : creatorCoinDeclaredMissing ? 'No on-chain coin detected' : 'Creator coin lookup'}
                  </div>
                </div>
                <div className="shrink-0">
                  {creatorCoin?.symbol ? (
                    <CheckCircle2 className="h-5 w-5 text-[#84B2FF]" />
                  ) : (
                    <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                      Ready
                    </div>
                  )}
                </div>
              </div>

              {keyMetrics.length > 0 ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {keyMetrics.map(({ label, value, icon: Icon }) => (
                    <div key={label} className={`${microPanelClass} px-3 py-2.5`}>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </div>
                      <div className="mt-1 text-[13px] text-zinc-100">{value}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </motion.div>

            <motion.div variants={staggerItem} className={`${panelClass} px-4 py-3`}>
              <div className="space-y-2.5">
                <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Connected wallet</div>
                  <div className="text-[12px] font-mono text-zinc-100">{connectedWalletShort}</div>
                </div>

                {ownershipGateActive ? (
                  <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Owner match</div>
                    <div className={`text-[12px] ${walletOwnershipValid ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {walletOwnershipValid ? 'Matched' : 'Not matched'}
                    </div>
                  </div>
                ) : null}

                {hasCreatorCoin ? (
                  <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Payout recipient</div>
                    <div className="text-[12px] font-mono text-zinc-100">{payoutRecipientShort}</div>
                  </div>
                ) : null}

                {hasCreatorCoin ? (
                  <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Owner wallets</div>
                    <div className="text-[12px] text-zinc-200">{ownerWalletCountLabel}</div>
                  </div>
                ) : null}

                {canonicalSmartWallet ? (
                  <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Canonical smart wallet</div>
                    <div className="text-[12px] font-mono text-zinc-100">{shortAddress(canonicalSmartWallet, 8, 6)}</div>
                  </div>
                ) : null}
              </div>
            </motion.div>

            {cswMismatch ? (
              <motion.div variants={staggerItem} className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-200/90">
                Base app smart wallet differs from Zora canonical wallet. Connect the owner wallet you control.
              </motion.div>
            ) : null}

            {ownershipError ? (
              <motion.div variants={staggerItem} className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-200/90">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>{ownershipError}</div>
                </div>
              </motion.div>
            ) : null}
            {creatorCoinDeclaredMissing ? (
              <motion.div variants={staggerItem} className={`${panelClass} px-4 py-3 text-[12px] text-zinc-400`}>
                Creator coin not found for this wallet. You can still join and update ownership later.
              </motion.div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}

      {/* Submit button */}
      {showSubmitButton ? (
        <motion.div {...scaleIn} className="pt-2">
          <button
            type="button"
            className="group relative w-full overflow-hidden flex items-center justify-center gap-2 min-h-[58px] rounded-2xl border border-[#5A96FF]/35 bg-gradient-to-r from-[#004CE8] via-[#005CFF] to-[#2A79FF] text-white font-semibold text-[15px] px-6 py-4 shadow-[0_16px_48px_-20px_rgba(0,82,255,0.95)] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:brightness-110 hover:shadow-[0_20px_56px_-22px_rgba(26,105,255,0.98)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            disabled={busy || !canSubmit}
            onClick={onSubmit}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/70 opacity-70" />
            <span className="pointer-events-none absolute -left-16 top-0 h-full w-16 -skew-x-12 bg-white/20 blur-md transition-transform duration-700 ease-out group-hover:translate-x-[420px]" />
            {busy ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Joining…
              </>
            ) : (
              'Join Waitlist'
            )}
          </button>
        </motion.div>
      ) : null}

      {!showPrivy ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-center text-[13px] text-zinc-500">
          Wallet login unavailable
        </div>
      ) : null}
    </motion.div>
  )
})
