import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'

import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'

type ExploreCopyButtonProps = {
  text: string
  className?: string
  title?: string
  resetMs?: number
  iconClassName?: string
  copiedIconClassName?: string
}

export function ExploreCopyButton({
  text,
  className = '',
  title = 'Copy',
  resetMs = 1800,
  iconClassName = 'w-4 h-4',
  copiedIconClassName = 'w-4 h-4 text-emerald-400',
}: ExploreCopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current)
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false)
      resetTimerRef.current = null
    }, resetMs)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`text-zinc-400 hover:text-white transition-colors ${className}`}
      title={title}
    >
      {copied ? <Check className={copiedIconClassName} /> : <Copy className={iconClassName} />}
    </button>
  )
}

type ExploreStatRowProps = {
  label: ReactNode
  value: string
  note?: string
  icon?: ReactNode
  rowClassName?: string
  headerClassName?: string
  labelClassName?: string
  valueClassName?: string
  noteClassName?: string
  iconWrapperClassName?: string
}

export function ExploreStatRow({
  label,
  value,
  note,
  icon,
  rowClassName = 'py-3 border-b border-white/8 last:border-0',
  headerClassName = 'flex items-center justify-between gap-3',
  labelClassName = 'text-xs text-zinc-500 font-medium',
  valueClassName = 'text-sm text-white font-medium tabular-nums',
  noteClassName = 'text-[11px] text-zinc-600 mt-1',
  iconWrapperClassName = 'inline-flex items-center gap-2',
}: ExploreStatRowProps) {
  return (
    <div className={rowClassName}>
      <div className={headerClassName}>
        <span className={labelClassName}>
          {icon ? <span className={iconWrapperClassName}>{icon}{label}</span> : label}
        </span>
        <span className={valueClassName}>{value}</span>
      </div>
      {note ? <div className={noteClassName}>{note}</div> : null}
    </div>
  )
}

type ExploreTableMessageProps = {
  title: string
  detail?: string
  icon?: ReactNode
  className?: string
  titleClassName?: string
  detailClassName?: string
}

export function ExploreTableMessage({
  title,
  detail,
  icon,
  className = 'px-6 py-12 text-center',
  titleClassName = 'text-zinc-400',
  detailClassName = 'mt-2 text-xs text-zinc-600',
}: ExploreTableMessageProps) {
  return (
    <div className={className}>
      {icon ? (
        <div className="mb-4">
          {icon}
        </div>
      ) : null}
      <p className={titleClassName}>{title}</p>
      {detail ? <p className={detailClassName}>{detail}</p> : null}
    </div>
  )
}

type ExploreTableRowMessageProps = {
  colSpan: number
  title: string
  detail?: string
  cellClassName?: string
  titleClassName?: string
  detailClassName?: string
}

export function ExploreTableRowMessage({
  colSpan,
  title,
  detail,
  cellClassName = 'px-6 py-12 text-center',
  titleClassName = 'text-zinc-400',
  detailClassName = 'mt-2 text-xs text-zinc-600',
}: ExploreTableRowMessageProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={cellClassName}>
        <p className={titleClassName}>{title}</p>
        {detail ? <p className={detailClassName}>{detail}</p> : null}
      </td>
    </tr>
  )
}

type ExploreLoadingMoreRowsProps = {
  isFetchingNextPage: boolean
  renderSkeletonRow: (rowKey: string) => ReactNode
  count?: number
  keyPrefix?: string
}

export function ExploreLoadingMoreRows({
  isFetchingNextPage,
  renderSkeletonRow,
  count = 3,
  keyPrefix = 'next-skeleton',
}: ExploreLoadingMoreRowsProps) {
  if (!isFetchingNextPage) return null
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Fragment key={`${keyPrefix}-${i}`}>
          {renderSkeletonRow(`${keyPrefix}-${i}`)}
        </Fragment>
      ))}
    </>
  )
}

type ExploreLoadMoreButtonProps = {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  disabled?: boolean
  label?: string
  containerClassName?: string
  buttonClassName?: string
}

export function ExploreLoadMoreButton({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  disabled = false,
  label = 'Load more',
  containerClassName = 'px-6 py-4 border-t border-white/8 flex justify-center',
  buttonClassName = 'px-6 py-2 rounded-full text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors',
}: ExploreLoadMoreButtonProps) {
  if (!hasNextPage || isFetchingNextPage || disabled) return null
  return (
    <div className={containerClassName}>
      <button
        type="button"
        onClick={onLoadMore}
        className={buttonClassName}
      >
        {label}
      </button>
    </div>
  )
}

type ExploreHeroMetricProps = {
  label: string
  value: string
  hint?: string | null
  title?: string
  accent?: boolean
  trailing?: ReactNode
}

type ExploreTableLoadingOverlayProps = {
  active: boolean
  label?: string
}

export function ExploreTableLoadingOverlay({
  active,
  label = 'Loading…',
}: ExploreTableLoadingOverlayProps) {
  if (!active) return null

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/30 backdrop-blur-[1px]"
      aria-busy="true"
      aria-live="polite"
    >
      <PixelWaveLoader size="sm" />
      <p className="text-xs text-zinc-400">{label}</p>
    </div>
  )
}

export function ExploreHeroMetric({ label, value, hint, title, accent = false, trailing }: ExploreHeroMetricProps) {
  return (
    <div
      className={`vault-hover-lift rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 ${
        accent ? 'bg-blue-950/16' : 'bg-white/[0.03]'
      }`}
      title={title}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">{label}</div>
        {trailing ? <div className="shrink-0 pt-0.5">{trailing}</div> : null}
      </div>
      <div className="mt-1 text-xl sm:text-[26px] font-semibold tracking-tight text-white tabular-nums lining-nums">
        {value}
      </div>
      {hint ? <div className="app-meta-value mt-1 text-zinc-500">{hint}</div> : null}
    </div>
  )
}
