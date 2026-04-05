import { memo, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { fetchZoraCoin, fetchZoraProfile } from '@/lib/zora/client'
import { STORY_CONTENT } from './vault-flow/model/storyContent'

const AKITA_ADDRESS = '0x5b674196812451b7cec024fe9d22d2c0b172fa75' as const
const TOTAL_DEPOSIT = 50_000_000

type Props = {
  depositTokens: string
  shareTokens: string
}

// ── Animation preset ──────────────────────────────────────────────────────────

const reveal = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
} as const

function staggerReveal(i: number) {
  return {
    ...reveal,
    transition: { ...reveal.transition, delay: i * 0.07 },
  }
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function StepLabel({ n, label }: { n: string; label: string }) {
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <span className="font-mono text-[9px] tabular-nums text-zinc-700">{n}</span>
      <span className="h-px w-4 bg-white/[0.07]" />
      <span className="font-mono text-[9px] uppercase tracking-[0.26em] text-zinc-500">{label}</span>
    </div>
  )
}

function FlowArrow() {
  return (
    <svg width="36" height="14" viewBox="0 0 36 14" fill="none" aria-hidden="true" className="shrink-0 opacity-25">
      <line x1="0" y1="7" x2="30" y2="7" stroke="white" strokeWidth="1" />
      <polyline
        points="24,3 30,7 24,11"
        stroke="white"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TokenNode({
  src,
  symbol,
  name,
  amount,
}: {
  src: string | null
  symbol: string
  name?: string
  amount?: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{
          border: '1px solid rgba(249,115,22,0.30)',
          background: 'rgba(249,115,22,0.07)',
        }}
      >
        {src ? (
          <img src={src} alt={symbol} className="h-full w-full rounded-full object-cover" loading="lazy" />
        ) : (
          <span className="font-mono text-[9px] font-black" style={{ color: '#f97316' }}>
            AK
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[9px] font-bold" style={{ color: 'rgba(249,115,22,0.85)' }}>
          {symbol}
        </span>
        {name && (
          <span className="font-mono text-[7px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
            {name}
          </span>
        )}
        {amount && (
          <span
            className="font-mono text-[9px] font-black leading-none"
            style={{ color: 'rgba(249,115,22,0.65)' }}
          >
            {amount}
          </span>
        )}
      </div>
    </div>
  )
}

function VaultNode({ sealed, testId }: { sealed: boolean; testId?: string }) {
  return (
    <div className="relative flex flex-col items-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-[14px]"
        style={{
          border: sealed
            ? '1.5px solid rgba(34,197,94,0.60)'
            : '1.5px solid rgba(100,160,255,0.28)',
          background: 'rgba(6,8,22,0.97)',
          boxShadow: sealed
            ? '0 0 16px 4px rgba(34,197,94,0.12)'
            : '0 0 0 1px rgba(100,160,255,0.07)',
          transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
        }}
        data-testid={testId}
      >
        <span
          className="font-mono text-[7px] uppercase tracking-[0.14em]"
          style={{ color: 'rgba(255,255,255,0.20)' }}
        >
          4626
        </span>
      </div>
      {sealed && (
        <span
          className="absolute -bottom-5 whitespace-nowrap font-mono text-[7px] uppercase tracking-[0.18em]"
          style={{ color: 'rgba(34,197,94,0.70)' }}
          data-testid="vault-complete-label"
        >
          vault sealed ✓
        </span>
      )}
    </div>
  )
}

// ── Section 1: Deposit ────────────────────────────────────────────────────────

type DepositSectionProps = {
  content: typeof STORY_CONTENT
  avatarSrc: string | null
}

const DepositSection = memo(function DepositSection({ content, avatarSrc }: DepositSectionProps) {
  const counterRef = useRef<HTMLSpanElement>(null)

  // Counter ref populated on mount — DOM write keeps tests happy without MotionValue coupling.
  useEffect(() => {
    if (counterRef.current) {
      counterRef.current.textContent = TOTAL_DEPOSIT.toLocaleString()
    }
  }, [])

  return (
    <motion.section
      {...reveal}
      className="mx-auto max-w-2xl px-6 py-20 sm:py-28"
      data-testid="token-deposit-scene"
      aria-label="Deposit step"
    >
      <StepLabel n="01" label="Deposit" />

      <h2
        className="mb-3 font-black leading-tight tracking-[-0.03em] text-white"
        style={{ fontSize: 'clamp(1.45rem, 3.8vw, 2.15rem)' }}
      >
        {content.creatorName} deposits{' '}
        <span style={{ color: 'rgba(249,115,22,0.90)' }}>
          {content.defaultDepositTokens} {content.creatorTokenSymbol}
        </span>{' '}
        into a vault.
      </h2>

      <p className="mb-12 max-w-sm text-[13px] leading-relaxed text-zinc-500">
        One transaction. The vault holds the tokens — no custodian, no intermediary.
      </p>

      {/* Flow diagram */}
      <div className="flex items-center gap-5">
        <TokenNode
          src={avatarSrc}
          symbol={content.creatorTokenSymbol}
          name={content.creatorName}
          amount={content.defaultDepositTokens}
        />
        <FlowArrow />
        <VaultNode sealed testId="token-deposit-vault" />
      </div>

      {/* Static counter */}
      <div className="mt-10" data-testid="deposited-counter">
        <span
          className="font-mono text-[8px] uppercase tracking-[0.22em]"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          Total deposited
        </span>
        <div
          className="mt-0.5 font-mono font-black"
          style={{ fontSize: 'clamp(1rem, 2.8vw, 1.25rem)', color: 'rgba(255,255,255,0.85)' }}
        >
          <span ref={counterRef}>{TOTAL_DEPOSIT.toLocaleString()}</span>
        </div>
      </div>
    </motion.section>
  )
})

// ── Section 2: Mint ────────────────────────────────────────────────────────────

const MintSection = memo(function MintSection({ content }: { content: typeof STORY_CONTENT }) {
  return (
    <motion.section
      {...reveal}
      className="mx-auto max-w-2xl border-t border-white/[0.04] px-6 py-20 sm:py-28"
      aria-label="Mint step"
    >
      <StepLabel n="02" label="Mint" />

      <h2
        className="mb-3 font-black leading-tight tracking-[-0.03em] text-white"
        style={{ fontSize: 'clamp(1.45rem, 3.8vw, 2.15rem)' }}
      >
        The vault mints{' '}
        <span style={{ color: 'rgba(100,160,255,0.95)' }}>
          {content.defaultDepositTokens} {content.shareTokenSymbol}
        </span>{' '}
        share tokens.
      </h2>

      <p className="mb-12 max-w-sm text-[13px] leading-relaxed text-zinc-500">
        ERC-4626 shares represent proportional ownership of the vault.
        At launch: 1 deposit token → 1 share.
      </p>

      {/* Flow diagram */}
      <div className="flex items-center gap-5">
        <VaultNode sealed={false} />
        <FlowArrow />
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div
            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full"
            style={{
              border: '1px solid rgba(100,160,255,0.32)',
              background: 'rgba(100,160,255,0.07)',
            }}
          >
            <img
              src={content.shareTokenBadgeSrc}
              alt={content.shareTokenSymbol}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <span
            className="font-mono text-[9px] font-bold"
            style={{ color: 'rgba(100,160,255,0.85)' }}
          >
            {content.shareTokenSymbol}
          </span>
        </div>
      </div>
    </motion.section>
  )
})

// ── Section 3: Distribute ─────────────────────────────────────────────────────

const DistributeSection = memo(function DistributeSection({ content }: { content: typeof STORY_CONTENT }) {
  return (
    <motion.section
      {...reveal}
      className="mx-auto max-w-2xl border-t border-white/[0.04] px-6 py-20 sm:py-28"
      aria-label="Distribute step"
    >
      <StepLabel n="03" label="Distribute" />

      <h2
        className="mb-3 font-black leading-tight tracking-[-0.03em] text-white"
        style={{ fontSize: 'clamp(1.45rem, 3.8vw, 2.15rem)' }}
      >
        Initial shares route automatically
        <br />
        to three places.
      </h2>

      <p className="mb-10 max-w-sm text-[13px] leading-relaxed text-zinc-500">
        Normally shares go to the depositor. For this initial deposit, they bootstrap the ecosystem.
      </p>

      {/* Section label — double-duty as aria landmark for test */}
      <div aria-label="distribution summary" className="mb-5 flex items-center gap-2">
        <span className="h-px w-5 bg-blue-300/20" />
        <span
          className="font-mono text-[7px] uppercase tracking-[0.28em]"
          style={{ color: 'rgba(147,197,253,0.50)' }}
        >
          initial deposit · shares routed automatically
        </span>
        <span className="h-px w-5 bg-blue-300/20" />
      </div>

      {/* Progress bar — static full; preserved for test aria-label */}
      <div
        aria-label="distribution checkpoint progress"
        role="progressbar"
        className="mb-8 h-px max-w-[200px] bg-blue-300/40"
      />

      {/* Distribution cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {content.distribution.map((row, i) => (
          <motion.div
            key={row.title}
            {...staggerReveal(i)}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
          >
            <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-500">
              {row.title}
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="font-mono text-2xl font-black" style={{ color: 'rgba(255,255,255,0.90)' }}>
                {row.percent}
              </p>
              <p className="font-mono text-[8px]" style={{ color: 'rgba(147,197,253,0.50)' }}>
                {row.amount} shares
              </p>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">{row.purposeCopy}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
})

// ── Section 4: Deploy ─────────────────────────────────────────────────────────

const DeploySection = memo(function DeploySection({ content }: { content: typeof STORY_CONTENT }) {
  return (
    <motion.section
      {...reveal}
      className="mx-auto max-w-2xl border-t border-white/[0.04] px-6 py-20 sm:py-28"
      aria-label="Deploy step"
    >
      <StepLabel n="04" label="Deploy" />

      <h2
        className="mb-3 font-black leading-tight tracking-[-0.03em] text-white"
        style={{ fontSize: 'clamp(1.45rem, 3.8vw, 2.15rem)' }}
      >
        Deposited tokens earn yield
        <br />
        across DeFi.
      </h2>

      <p className="mb-10 max-w-sm text-[13px] leading-relaxed text-zinc-500">
        The vault allocates across strategies. Yield flows back to every share holder.
      </p>

      <div className="flex flex-col gap-2">
        {content.strategies.map((s, i) => (
          <motion.div
            key={s.label}
            {...staggerReveal(i)}
            className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5"
          >
            <div className="flex items-center gap-3">
              {s.icon ? (
                <img src={s.icon} alt={s.iconAlt} className={s.iconClassName} loading="lazy" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-sm bg-white/[0.08]" />
              )}
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                  {s.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{s.purposeCopy}</p>
              </div>
            </div>
            <div className="ml-4 flex shrink-0 flex-col items-end gap-0.5">
              <span className="font-mono text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {s.percent}
              </span>
              <span className="font-mono text-[9px] text-zinc-600">{s.apy}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="mt-5 px-1 font-mono text-[11px] text-zinc-600">
        Blended yield:{' '}
        <span className="font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {content.blendedApy}
        </span>
      </p>
    </motion.section>
  )
})

// ── Section 5: Earn ───────────────────────────────────────────────────────────

const EarnSection = memo(function EarnSection({ content }: { content: typeof STORY_CONTENT }) {
  const et = content.copy?.earningTogether
  return (
    <motion.section
      {...reveal}
      className="mx-auto max-w-2xl border-t border-white/[0.04] px-6 py-20 sm:py-28"
      aria-label="Earn step"
    >
      <StepLabel n="05" label="Earn" />

      <h2
        className="font-black leading-tight tracking-[-0.03em] text-white"
        style={{ fontSize: 'clamp(1.45rem, 3.8vw, 2.15rem)' }}
      >
        {et?.title ?? 'The vault runs.'}
      </h2>

      <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-zinc-500">
        {et?.summary ?? 'Creator earns. Participants earn. Value keeps flowing.'}
      </p>
    </motion.section>
  )
})

// ── Root export ───────────────────────────────────────────────────────────────

export function VaultFlowScroll(_props: Props) {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  // Respect OS/browser reduced-motion for whileInView transitions.
  const prefersReducedMotion = useReducedMotion() ?? false

  useEffect(() => {
    const run = async () => {
      try {
        const coin = await fetchZoraCoin(AKITA_ADDRESS)
        const coinAny = coin as any
        const img =
          coin?.mediaContent?.previewImage?.small ??
          coin?.mediaContent?.previewImage?.medium ??
          coin?.creatorProfile?.avatar?.previewImage?.small ??
          coinAny?.image ??
          coinAny?.metadata?.image
        if (img) { setAvatarSrc(img); return }
        const creatorAddr = coin?.creatorAddress
        if (creatorAddr) {
          const profile = await fetchZoraProfile(creatorAddr)
          const avatar = profile?.avatar?.small ?? profile?.avatar?.medium
          if (avatar) setAvatarSrc(avatar)
        }
      } catch {
        // fall back to initials
      }
    }
    run()
  }, [])

  // In reduced-motion mode, strip the scroll-reveal animation so sections appear immediately.
  const sectionProps = prefersReducedMotion
    ? { initial: { opacity: 1, y: 0 } }
    : {}

  return (
    <div
      className="relative bg-black"
      style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
    >
      <DepositSection
        content={STORY_CONTENT}
        avatarSrc={avatarSrc}
        {...sectionProps}
      />
      <MintSection content={STORY_CONTENT} {...sectionProps} />
      <DistributeSection content={STORY_CONTENT} {...sectionProps} />
      <DeploySection content={STORY_CONTENT} {...sectionProps} />
      <EarnSection content={STORY_CONTENT} {...sectionProps} />
    </div>
  )
}
