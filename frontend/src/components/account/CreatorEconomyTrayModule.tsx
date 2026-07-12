import { useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

import type { CreatorEconomyView } from '@/lib/creatorEconomy/types'
import { APP_ORIGIN } from '@/lib/env/host'
import { cn } from '@/lib/shared/utils'

function appHref(path: string, absolute: boolean): string {
  if (!absolute) return path
  if (path.startsWith('http')) return path
  return `${APP_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}

function MetricCell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-zinc-400">{label}</div>
      <div className="mt-0.5 truncate text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-white">
        {value ?? '—'}
      </div>
    </div>
  )
}

function ActionLink({
  href,
  absolute,
  className,
  children,
}: {
  href: string
  absolute: boolean
  className?: string
  children: ReactNode
}) {
  const resolved = appHref(href, absolute)
  if (absolute) {
    return (
      <a href={resolved} className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link to={resolved} className={className}>
      {children}
    </Link>
  )
}

function ThreeTokenRail({
  symbol,
  active,
}: {
  symbol: string
  active: boolean
}) {
  const reduceMotion = useReducedMotion()
  const ticker = symbol.startsWith('$') ? symbol.slice(1) : symbol
  const steps = [
    { mark: `$${ticker}`, caption: 'Creator', tip: `$${ticker}: creator coin deposited into the vault` },
    { mark: `▢${ticker}`, caption: 'Vault share', tip: `▢${ticker}: ERC-4626 claim on the vault` },
    { mark: `■${ticker}`, caption: 'Tradable', tip: `■${ticker}: wrapped tradable and omnichain share` },
  ] as const

  return (
    <div className="relative mt-3" role="group" aria-label="Creator coin to vault share to tradable share">
      <div className="grid grid-cols-3 gap-2">
        {steps.map((step, index) => (
          <div key={step.mark} className="min-w-0 text-center" title={step.tip}>
            <div className="truncate text-[13px] font-semibold tracking-[-0.02em] text-white">
              {step.mark}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-400">{step.caption}</div>
            {index < steps.length - 1 ? (
              <span className="sr-only">then</span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-6 top-[0.55rem] flex items-center justify-between px-8" aria-hidden>
        <span className="text-[10px] text-zinc-500">→</span>
        <span className="text-[10px] text-zinc-500">→</span>
      </div>
      {active && !reduceMotion ? (
        <motion.div
          className="pointer-events-none absolute inset-x-8 top-[0.7rem] h-px overflow-hidden"
          aria-hidden
        >
          <motion.span
            className="block h-full w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '300%' }}
            transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.2 }}
          />
        </motion.div>
      ) : null}
    </div>
  )
}

function ExpandablePlan({
  title,
  body,
}: {
  title: string
  body: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-white/[0.06]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="text-[12px] font-medium text-zinc-300">{title}</span>
        <span className="text-[11px] text-zinc-400">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? <p className="pb-2.5 text-[12px] leading-relaxed text-zinc-400">{body}</p> : null}
    </div>
  )
}

export type CreatorEconomyTrayModuleProps = {
  view: CreatorEconomyView
  loading?: boolean
  variant: 'waitlist' | 'app'
  /** Waitlist is on the marketing host — deep-link into the app origin. */
  absoluteAppLinks?: boolean
  className?: string
}

export function CreatorEconomyTrayModule({
  view,
  loading = false,
  variant,
  absoluteAppLinks,
  className,
}: CreatorEconomyTrayModuleProps) {
  const absolute = absoluteAppLinks ?? variant === 'waitlist'
  const isHolder = view.role === 'holder'
  const isApp = variant === 'app'

  return (
    <section className={cn('min-w-0', className)} aria-busy={loading || undefined}>
      {view.showThreeTokenRail ? (
        <ThreeTokenRail symbol={view.symbolDisplay} active={view.railActive} />
      ) : null}

      <div className="mt-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
          {isHolder ? 'Your position' : 'Your economy'}
        </div>
        <div className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-white">
          {view.statusLabel}
        </div>
        {view.statusDetail ? (
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{view.statusDetail}</p>
        ) : null}
      </div>

      {isHolder && view.holder ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <MetricCell label={`■${view.symbolDisplay.replace(/^\$/, '')} balance`} value={view.holder.shareOftBalance} />
          <MetricCell label="Share PPS" value={view.metrics.sharePpsUsd} />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <MetricCell label="TVL" value={view.metrics.tvlUsd} />
          <MetricCell label="Share PPS" value={view.metrics.sharePpsUsd} />
        </div>
      )}

      {isApp && view.role === 'creator' && view.metrics.claimableCreatorEarningsEth ? (
        <div className="mt-3">
          <div className="text-[11px] text-zinc-400">Creator earnings</div>
          <div className="mt-0.5 text-[14px] font-medium tabular-nums text-white">
            {view.metrics.claimableCreatorEarningsEth} claimable
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {view.primaryAction ? (
          <ActionLink
            href={view.primaryAction.href}
            absolute={absolute}
            className="inline-flex items-center justify-center rounded-lg bg-white px-3.5 py-2 text-[13px] font-semibold text-black transition hover:bg-zinc-100"
          >
            {view.primaryAction.label}
          </ActionLink>
        ) : null}
        {view.secondaryLink ? (
          <ActionLink
            href={view.secondaryLink.href}
            absolute={absolute}
            className="text-[13px] font-medium text-zinc-300 transition hover:text-white"
          >
            {view.secondaryLink.label} ›
          </ActionLink>
        ) : null}
      </div>

      {isApp && (view.role === 'creator' || view.role === 'prelaunch_creator') ? (
        <div className="mt-4">
          <ExpandablePlan title="Launch allocation" body={view.launchAllocationLabel} />
          {view.strategyPlanLabel ? (
            <ExpandablePlan title="Strategy plan" body={view.strategyPlanLabel} />
          ) : null}
          <ExpandablePlan title="Infrastructure" body={view.infrastructureLabel} />
        </div>
      ) : null}
    </section>
  )
}
