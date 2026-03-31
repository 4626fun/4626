import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'

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
  label: string
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
