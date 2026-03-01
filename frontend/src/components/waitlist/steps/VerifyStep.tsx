import { memo, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Coins,
  Fingerprint,
  Loader2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import type { WaitlistState } from '../waitlistTypes'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { Alert } from '@/components/ui/Alert'

// Base brand motion: cubic-bezier(0.4, 0, 0.2, 1), 120-240ms for snappy UI
const baseEase = [0.4, 0, 0.2, 1] as const
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
  emailValue: string
  isEmailValid: boolean
  onEmailChange: (value: string) => void
  showPrivy: boolean
  showPrivyReady: boolean
  privyReady: boolean
  privyVerifyBusy: boolean
  privyVerifyError: string | null
  showSiwf?: boolean
  siwfFid?: number | null
  siwfBusy?: boolean
  siwfError?: string | null
  onSiwfContinue?: () => void
  walletOwnershipValid: boolean
  ownershipEvidenceAvailable: boolean
  cswMismatch?: boolean
  // Auto-fetched Creator Coin
  creatorCoin: WaitlistState['creatorCoin']
  creatorCoinDeclaredMissing: boolean
  creatorCoinBusy: boolean
  showCswProof?: boolean
  // CSW ERC-1271 ownership proof
  cswProofVerified?: boolean
  cswProofBusy?: boolean
  cswProofError?: string | null
  onProveCswOwnership?: () => void | Promise<void>
  // Submission
  busy: boolean
  canSubmit: boolean
  simpleVerifiedMode?: boolean
  submitError?: string | null
  // Owner-install prerequisite gating
  mappingStatus?: WaitlistState['mappingStatus']
  embeddedEoaAddress?: string | null
  zoraProviderAddresses?: string[]
  canonicalZoraCswAddress?: string | null
  canonicalZoraCswUnresolvedReason?: string | null
  mappingError?: string | null
  mappingPrimaryCtaLabel?: string | null
  mappingPrimaryHelperText?: string | null
  mappingPrimaryBusy?: boolean
  onMappingPrimaryAction?: () => void
  onPrivyContinue: () => void
  onPrivyFallback?: () => void
  onSubmit: () => void | Promise<void>
}

export const VerifyStep = memo(function VerifyStep({
  verifiedWallet,
  emailValue,
  isEmailValid,
  onEmailChange,
  showPrivy,
  showPrivyReady,
  privyReady,
  privyVerifyBusy,
  privyVerifyError,
  showSiwf,
  siwfFid,
  siwfBusy,
  siwfError,
  onSiwfContinue,
  walletOwnershipValid,
  ownershipEvidenceAvailable,
  cswMismatch,
  creatorCoin,
  creatorCoinDeclaredMissing,
  creatorCoinBusy,
  showCswProof,
  cswProofVerified,
  cswProofBusy,
  cswProofError,
  onProveCswOwnership,
  busy,
  canSubmit,
  simpleVerifiedMode,
  submitError,
  mappingStatus,
  embeddedEoaAddress,
  zoraProviderAddresses,
  canonicalZoraCswAddress,
  canonicalZoraCswUnresolvedReason,
  mappingError,
  mappingPrimaryCtaLabel,
  mappingPrimaryHelperText,
  mappingPrimaryBusy,
  onMappingPrimaryAction,
  onPrivyContinue,
  onPrivyFallback,
  onSubmit,
}: VerifyStepProps) {
  const hasVerification = Boolean(verifiedWallet) || Boolean(siwfFid)
  const hasCreatorCoin = !!creatorCoin?.address
  const showSubmitButton = hasVerification && (hasCreatorCoin || creatorCoinDeclaredMissing)
  const ownerWallets = useMemo(() => creatorCoin?.ownerWallets ?? [], [creatorCoin?.ownerWallets])
  const payoutRecipient = useMemo(() => creatorCoin?.payoutRecipient ?? null, [creatorCoin?.payoutRecipient])
  const canonicalSmartWallet = useMemo(() => creatorCoin?.canonicalSmartWallet ?? null, [creatorCoin?.canonicalSmartWallet])
  const ownershipGateActive = Boolean(hasCreatorCoin && ownershipEvidenceAvailable)
  const headerTitle = !hasVerification ? 'Get started' : showSubmitButton ? 'Review and join' : 'Setting up'
  const headerSubtitle = !hasVerification
    ? 'Create your account in one tap.'
    : showSubmitButton
      ? ownershipGateActive && !walletOwnershipValid
        ? 'Connect the wallet linked to your creator profile to continue.'
        : 'Everything looks good. Review your details and join the waitlist.'
      : 'Verifying your profile…'

  const stepperSteps = useMemo(() => {
    const connectStatus = hasVerification ? 'complete' as const : 'active' as const
    const verifyStatus = !hasVerification
      ? 'pending' as const
      : (hasCreatorCoin || creatorCoinDeclaredMissing) ? 'complete' as const : 'active' as const
    const joinStatus = showSubmitButton ? 'active' as const : 'pending' as const
    return [
      { label: 'Connect', status: connectStatus },
      { label: 'Verify', status: verifyStatus },
      { label: 'Join', status: joinStatus },
    ]
  }, [hasVerification, hasCreatorCoin, creatorCoinDeclaredMissing, showSubmitButton])
  const [showTrouble, setShowTrouble] = useState(false)
  const canContinue = !privyVerifyBusy && !busy && !mappingPrimaryBusy
  const showPrivyError = Boolean(privyVerifyError) || Boolean(siwfError) || Boolean(mappingError)
  const emailError = emailValue.trim().length > 0 && !isEmailValid ? 'Enter a valid email address.' : null

  const helperText = useMemo(() => {
    if (mappingPrimaryHelperText) return mappingPrimaryHelperText
    if (privyVerifyBusy) return 'Opening…'
    if (!showPrivyReady) return 'Wallet login is initializing…'
    if (!privyReady) return 'Loading wallet login…'
    return ''
  }, [mappingPrimaryHelperText, privyReady, privyVerifyBusy, showPrivyReady])
  const ownershipError =
    ownershipGateActive && !walletOwnershipValid
      ? 'Switch to a payout or owner wallet to continue.'
      : null
  const connectedWalletShort = useMemo(() => {
    if (verifiedWallet) return shortAddress(verifiedWallet, 8, 6)
    if (siwfFid) return `FID ${siwfFid}`
    return 'Unavailable'
  }, [siwfFid, verifiedWallet])
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
  const panelClass = 'rounded-2xl border border-white/6 bg-white/2'
  const microPanelClass = 'rounded-xl border border-white/4 bg-white/1'
  const mappingReady = mappingStatus === 'READY_FOR_OWNER_INSTALL'
  const mappingAction = onMappingPrimaryAction ?? onPrivyContinue
  const embeddedReady = Boolean(embeddedEoaAddress)
  const zoraLinked = (zoraProviderAddresses?.length ?? 0) > 0
  const canonicalReady = Boolean(canonicalZoraCswAddress)
  const mappingBusyLabel =
    mappingStatus === 'WAITING_FOR_WALLETS'
      ? 'Waiting'
      : mappingStatus === 'EMBEDDED_WALLET_CREATING'
        ? 'Creating'
        : mappingStatus === 'ZORA_LINKING'
          ? 'Linking'
          : mappingStatus === 'CANONICAL_RESOLVING'
            ? 'Resolving'
            : 'Running'

  if (hasVerification && simpleVerifiedMode) {
    const profileReady = Boolean(hasCreatorCoin || creatorCoinDeclaredMissing)
    const ownerReady = !ownershipGateActive || walletOwnershipValid
    const setupReady = profileReady && ownerReady && mappingReady

    return (
      <motion.div key="verify-simple" {...fadeUp} className="space-y-6 sm:space-y-7">
        <StepIndicator steps={stepperSteps} className="mb-2" />
        <motion.div {...scaleIn} className="space-y-3">
          <h1 className="font-doto text-2xl sm:text-3xl font-bold tracking-tight text-white leading-[1.08]">
            Setting up your account
          </h1>
          <p className="max-w-[48ch] text-sm text-zinc-500 leading-relaxed">
            We handle wallet verification and setup for you automatically.
          </p>
          <p className="max-w-[48ch] text-xs text-zinc-600 leading-relaxed">
            After joining, the app header always shows your connected signer and acting account mode.
          </p>
        </motion.div>

        <motion.div {...scaleIn} className={`${panelClass} p-4 space-y-3`}>
          <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
            <span className="text-[12px] text-zinc-500">Wallet connected</span>
            <span className="text-[12px] text-emerald-300 inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ready
            </span>
          </div>

          <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
            <span className="text-[12px] text-zinc-500">Creator profile check</span>
            {creatorCoinBusy ? (
              <span className="text-[12px] text-zinc-300 inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Running
              </span>
            ) : (
              <span className="text-[12px] text-emerald-300 inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Done
              </span>
            )}
          </div>

          {ownershipGateActive ? (
            <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
              <span className="text-[12px] text-zinc-500">Ownership check</span>
              {walletOwnershipValid ? (
                <span className="text-[12px] text-emerald-300 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Verified
                </span>
              ) : (
                <span className="text-[12px] text-amber-300 inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Wallet mismatch
                </span>
              )}
            </div>
          ) : null}

          <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
            <span className="text-[12px] text-zinc-500">Embedded signer wallet</span>
            {embeddedReady ? (
              <span className="text-[12px] text-emerald-300 inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {shortAddress(embeddedEoaAddress, 7, 5)}
              </span>
            ) : mappingStatus === 'EMBEDDED_WALLET_CREATING' || mappingStatus === 'WAITING_FOR_WALLETS' ? (
              <span className="text-[12px] text-zinc-300 inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {mappingBusyLabel}
              </span>
            ) : (
              <span className="text-[12px] text-amber-300 inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Required
              </span>
            )}
          </div>

          <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
            <span className="text-[12px] text-zinc-500">Zora wallet link (read-only)</span>
            {zoraLinked ? (
              <span className="text-[12px] text-emerald-300 inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Linked
              </span>
            ) : mappingStatus === 'ZORA_LINKING' ? (
              <span className="text-[12px] text-zinc-300 inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Linking
              </span>
            ) : (
              <span className="text-[12px] text-amber-300 inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Required
              </span>
            )}
          </div>

          <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
            <span className="text-[12px] text-zinc-500">Canonical Zora smart wallet</span>
            {canonicalReady ? (
              <span className="text-[12px] text-emerald-300 inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {shortAddress(canonicalZoraCswAddress, 7, 5)}
              </span>
            ) : mappingStatus === 'CANONICAL_RESOLVING' ? (
              <span className="text-[12px] text-zinc-300 inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Resolving
              </span>
            ) : (
              <span className="text-[12px] text-amber-300 inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Unresolved
              </span>
            )}
          </div>

          <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
            <span className="text-[12px] text-zinc-500">Backend setup</span>
            {busy ? (
              <span className="text-[12px] text-zinc-200 inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Finalizing
              </span>
            ) : setupReady ? (
              <span className="text-[12px] text-emerald-300 inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ready
              </span>
            ) : (
              <span className="text-[12px] text-zinc-300 inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Waiting
              </span>
            )}
          </div>
        </motion.div>

        {!mappingReady && mappingPrimaryCtaLabel ? (
          <motion.div {...scaleIn}>
            <button
              type="button"
              className="btn-primary w-full min-h-[56px] px-6 py-4 text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={mappingAction}
              disabled={Boolean(mappingPrimaryBusy) || busy}
            >
              {mappingPrimaryCtaLabel}
            </button>
          </motion.div>
        ) : null}

        {mappingError ? (
          <motion.div {...fadeUp}>
            <Alert variant="error">{mappingError}</Alert>
          </motion.div>
        ) : null}

        {!mappingError && canonicalZoraCswUnresolvedReason && !canonicalReady ? (
          <motion.div {...fadeUp}>
            <Alert variant="warning">{canonicalZoraCswUnresolvedReason}</Alert>
          </motion.div>
        ) : null}

        {submitError ? (
          <motion.div {...fadeUp}>
            <Alert variant="error">{submitError}</Alert>
          </motion.div>
        ) : null}

        <motion.div {...fadeUp} className={`${panelClass} p-4 space-y-2.5`}>
          <label htmlFor="waitlist-email-simple" className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            Email <span className="text-zinc-700">(optional)</span>
          </label>
          <input
            id="waitlist-email-simple"
            type="email"
            value={emailValue}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="you@example.com"
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? 'email-error-simple' : 'email-hint-simple'}
            className="w-full rounded-xl border border-white/10 bg-white/3 px-3 py-2.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#0052FF]/50"
          />
          <div id="email-hint-simple" className="text-[11px] text-zinc-600">Optional. You can add a recovery email later.</div>
          {emailError ? <div id="email-error-simple" role="alert" className="text-[11px] text-amber-300">{emailError}</div> : null}
        </motion.div>

        {!busy && canSubmit ? (
          <motion.div {...scaleIn}>
            <button
              type="button"
              className="btn-primary w-full min-h-[56px] px-6 py-4 text-[15px]"
              onClick={onSubmit}
            >
              Continue
            </button>
          </motion.div>
        ) : null}
      </motion.div>
    )
  }

  return (
    <motion.div
      key="verify"
      {...fadeUp}
      className="space-y-6 sm:space-y-7"
    >
      {/* Progress stepper */}
      <StepIndicator steps={stepperSteps} className="mb-2" />

      {/* Header */}
      <motion.div {...scaleIn} className="space-y-3">
        <h1 className="font-doto text-2xl sm:text-3xl font-bold tracking-tight text-white leading-[1.08]">
          {headerTitle}
        </h1>
        {headerSubtitle ? (
          <p className="max-w-[48ch] text-sm text-zinc-500 leading-relaxed">{headerSubtitle}</p>
        ) : null}
        {hasVerification ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0052FF]/20 bg-[#0052FF]/5 px-3 py-1.5 text-[11px] font-medium text-[#8AB5FF]">
            <Sparkles className="h-3.5 w-3.5" />
            Founding Creator Access
          </div>
        ) : null}
      </motion.div>

      {/* Single primary CTA + progressive disclosure */}
      {!hasVerification ? (
        <motion.div {...scaleIn} className="space-y-4">
          <button
            type="button"
            className="btn-primary group relative w-full min-h-[56px] justify-center px-5 py-4 pr-12 text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canContinue}
            onClick={mappingAction}
          >
            <span className="relative">{mappingPrimaryCtaLabel || (mappingPrimaryBusy ? 'Please wait' : 'Continue with Privy')}</span>
            <ChevronRight className="absolute right-5 w-4 h-4 opacity-80" />
          </button>

          <p className="text-sm text-zinc-500">We'll continue automatically.</p>

          {showSiwf ? (
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-2xl border border-white/10 bg-white/2 text-zinc-200 font-medium text-[14px] px-4 py-3 transition-all duration-200 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={Boolean(siwfBusy) || busy}
              onClick={onSiwfContinue}
            >
              {siwfBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying Farcaster…
                </>
              ) : (
                <>
                  <Fingerprint className="w-4 h-4" />
                  Verify with Farcaster
                </>
              )}
            </button>
          ) : null}

          <div className="flex items-center justify-between">
            <div className="text-[12px] text-zinc-500">{helperText || '\u00A0'}</div>
            <div className="flex items-center gap-3">
              {onPrivyFallback ? (
                <button
                  type="button"
                  className="text-[12px] text-zinc-400 hover:text-zinc-200 transition-colors"
                  onClick={onPrivyFallback}
                >
                  Try another way
                </button>
              ) : null}
              <button
                type="button"
                className="text-[12px] text-zinc-400 hover:text-zinc-200 transition-colors"
                onClick={() => setShowTrouble(true)}
              >
                Need help?
              </button>
            </div>
          </div>

          {showPrivyError ? (
            <motion.div {...fadeUp}>
              <Alert variant="error">{mappingError || siwfError || privyVerifyError}</Alert>
            </motion.div>
          ) : null}

          <motion.div {...fadeUp}>
            <Alert variant="info">
              <span className="font-medium">Zora sync:</span> We only check your Zora profile to prefill this step. No transaction is sent.
            </Alert>
          </motion.div>
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
              className="fixed inset-0 z-50 flex items-center justify-center px-4"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.2, ease: baseEase }}
            >
              <div className="w-full max-w-[440px]">
                <div className="rounded-3xl border border-zinc-700/60 bg-zinc-950/90 backdrop-blur-2xl p-5 shadow-[0_30px_90px_-45px_rgba(0,0,0,0.85)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Having trouble?</div>
                      <div className="text-[16px] text-white mt-1 font-display">Try these quick fixes</div>
                      <div className="mt-2 text-[12px] text-zinc-400">
                        If the sign up button does not open, try:
                      </div>
                      <div className="mt-2 space-y-1 text-[12px] text-zinc-300">
                        <div>1) Allow popups for this site.</div>
                        <div>2) Refresh and try again.</div>
                        <div>3) Switch browsers or devices.</div>
                      </div>
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

                  <div className="mt-3 text-[11px] text-zinc-500">
                    Need help? <a className="text-zinc-300 hover:text-white" href="mailto:4626dotfun@gmail.com">4626dotfun@gmail.com</a>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {/* Loading Creator Coin */}
      {hasVerification && creatorCoinBusy ? (
        <motion.div
          {...fadeUp}
          className="flex items-center justify-center gap-3 rounded-2xl border border-white/6 bg-white/2 py-4"
        >
          <div className="w-5 h-5 rounded-full border-2 border-zinc-600 border-t-[#0052FF] animate-spin" />
          <span className="text-[13px] text-zinc-500">Reading Zora profile and creator coin owners…</span>
        </motion.div>
      ) : null}

      {/* Verified summary (fills the empty state) */}
      {hasVerification && (hasCreatorCoin || creatorCoinDeclaredMissing) ? (
        <motion.div
          {...scaleIn}
          className="relative overflow-hidden rounded-2xl border border-white/6 bg-white/2 p-4 sm:p-5"
        >
          <motion.div
            className="relative space-y-3"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.div variants={staggerItem} className="rounded-2xl border border-[#0052FF]/20 bg-[#0052FF]/6 px-3.5 py-2.5 text-[11px] leading-relaxed text-zinc-300">
              <span className="text-[#8AB5FF] font-medium">Using Zora data:</span> ownership and creator coin info are auto-filled so you can review before joining.
            </motion.div>

            <motion.div variants={staggerItem} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12px] text-zinc-500">Ownership</div>
                <div className="mt-0.5 text-[17px] font-semibold text-white">Review before join</div>
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
                    <div className="h-12 w-12 rounded-2xl border border-white/15 bg-linear-to-br from-zinc-900 to-zinc-800 flex items-center justify-center text-[12px] text-zinc-300 font-semibold">
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
                  <span className="text-[12px] text-zinc-500">Connected wallet</span>
                  <span className="text-[12px] font-mono text-zinc-200">{connectedWalletShort}</span>
                </div>

                {ownershipGateActive ? (
                  <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
                    <span className="text-[12px] text-zinc-500">Owner match</span>
                    <span className={`text-[12px] font-medium ${walletOwnershipValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {walletOwnershipValid ? 'Matched' : 'Not matched'}
                    </span>
                  </div>
                ) : null}

                {hasCreatorCoin ? (
                  <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
                    <span className="text-[12px] text-zinc-500">Payout recipient</span>
                    <span className="text-[12px] font-mono text-zinc-200">{payoutRecipientShort}</span>
                  </div>
                ) : null}

                {hasCreatorCoin ? (
                  <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
                    <span className="text-[12px] text-zinc-500">Owner wallets</span>
                    <span className="text-[12px] text-zinc-300">{ownerWalletCountLabel}</span>
                  </div>
                ) : null}

                {canonicalSmartWallet ? (
                  <div className={`${microPanelClass} px-3 py-2.5 flex items-center justify-between gap-3`}>
                    <span className="text-[12px] text-zinc-500">Canonical smart wallet</span>
                    <span className="text-[12px] font-mono text-zinc-200">{shortAddress(canonicalSmartWallet, 8, 6)}</span>
                  </div>
                ) : null}
              </div>
            </motion.div>

            {/* CSW ERC-1271 Ownership Proof */}
            {showCswProof && canonicalSmartWallet && walletOwnershipValid ? (
              <motion.div variants={staggerItem} className={`${panelClass} px-4 py-3`}>
                {cswProofVerified ? (
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-emerald-200 font-medium">Wallet ownership verified</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        Your smart wallet has been confirmed on Base.
                      </div>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Fingerprint className="h-5 w-5 text-[#8AB5FF] mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-zinc-200 font-medium">Prove smart wallet ownership</span>
                          <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Optional</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                          Sign a message to cryptographically prove you control this Coinbase Smart Wallet. You can still join without this.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#0052FF]/20 bg-[#0052FF]/8 hover:bg-[#0052FF]/15 text-[#8AB5FF] text-[13px] font-medium px-4 py-2.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={cswProofBusy || busy}
                      onClick={onProveCswOwnership}
                    >
                      {cswProofBusy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Verifying…
                        </>
                      ) : (
                        <>
                          <Fingerprint className="h-4 w-4" />
                          Sign to Prove Ownership
                        </>
                      )}
                    </button>
                    {cswProofError ? (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90">
                        {cswProofError} You can still join the waitlist below.
                      </div>
                    ) : null}
                  </div>
                )}
              </motion.div>
            ) : null}

            {cswMismatch ? (
              <motion.div variants={staggerItem}>
                <Alert variant="warning">
                  The connected wallet doesn't match your Zora creator profile. Try connecting the wallet you use on Zora.
                </Alert>
              </motion.div>
            ) : null}

            {ownershipError ? (
              <motion.div variants={staggerItem}>
                <Alert variant="warning">
                  Connect the wallet linked to your creator profile to continue.
                </Alert>
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

      {/* Review & submit */}
      {showSubmitButton ? (
        <motion.div {...scaleIn} className="pt-2 space-y-3">
          {/* Review summary */}
          <div className={`${panelClass} p-4 space-y-2`}>
            <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" aria-hidden="true" />
              Review before joining
            </div>
            <div className={`${microPanelClass} px-3 py-2 flex items-center justify-between gap-3`}>
              <span className="text-xs text-zinc-500">Wallet</span>
              <span className="text-xs font-mono text-zinc-200">{connectedWalletShort}</span>
            </div>
            {hasCreatorCoin ? (
              <div className={`${microPanelClass} px-3 py-2 flex items-center justify-between gap-3`}>
                <span className="text-xs text-zinc-500">Creator coin</span>
                <span className="text-xs text-zinc-200">{creatorCoin?.symbol || 'Detected'}</span>
              </div>
            ) : (
              <div className={`${microPanelClass} px-3 py-2 flex items-center justify-between gap-3`}>
                <span className="text-xs text-zinc-500">Creator coin</span>
                <span className="text-xs text-zinc-400">Not detected — you can add one later</span>
              </div>
            )}
            {walletOwnershipValid ? (
              <div className={`${microPanelClass} px-3 py-2 flex items-center justify-between gap-3`}>
                <span className="text-xs text-zinc-500">Ownership</span>
                <span className="text-xs text-emerald-400">Verified</span>
              </div>
            ) : null}
          </div>

          <div className={`${panelClass} p-4 space-y-2.5`}>
            <label htmlFor="waitlist-email" className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
              Email <span className="text-zinc-700">(optional)</span>
            </label>
            <input
              id="waitlist-email"
              type="email"
              value={emailValue}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="you@example.com"
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? 'email-error' : 'email-hint'}
              className="w-full rounded-xl border border-white/10 bg-white/3 px-3 py-2.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#0052FF]/50"
            />
            <div id="email-hint" className="text-[11px] text-zinc-600">Optional. You can add a recovery email later.</div>
            {emailError ? <div id="email-error" role="alert" className="text-[11px] text-amber-300">{emailError}</div> : null}
          </div>
          <button
            type="button"
            className={[
              'btn-primary w-full min-h-[56px] px-6 py-4 text-[15px] disabled:opacity-50 disabled:cursor-not-allowed',
              busy ? 'btn-no-icon' : '',
            ].join(' ')}
            disabled={busy || !canSubmit}
            onClick={onSubmit}
          >
            {busy ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                Joining…
              </>
            ) : (
              <>
                Join Waitlist
              </>
            )}
          </button>
          {submitError ? (
            <Alert variant="error">{submitError}</Alert>
          ) : null}
        </motion.div>
      ) : null}

      {!showPrivy ? (
        <Alert variant="warning">
          Wallet sign-in is loading. If this persists, try refreshing the page or switching browsers.
        </Alert>
      ) : null}
    </motion.div>
  )
})
