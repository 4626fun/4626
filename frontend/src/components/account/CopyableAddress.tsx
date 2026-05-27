import { useCallback, useState, type MouseEvent } from 'react'
import { Check, Copy } from 'lucide-react'

/**
 * Display an Ethereum address in short form with a copy-to-clipboard
 * action. Shows the full address in a tooltip on hover; click anywhere
 * on the component copies the full address and briefly flashes a check
 * icon to confirm.
 *
 * Optionally accepts a `label` prop (e.g. the address's basename/ENS)
 * — when provided, the label renders instead of the short hex and the
 * short hex shifts to a subtle secondary slot.
 */
export function CopyableAddress({
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
  const [copied, setCopied] = useState(false)
  const short = formatShort(address)

  const onCopy = useCallback(() => {
    if (!address) return
    try {
      void navigator.clipboard.writeText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      /* non-fatal */
    }
  }, [address])

  const base = 'inline-flex items-center gap-1.5 font-mono text-xs transition-colors'
  const variantClass =
    variant === 'muted'
      ? 'text-zinc-500 hover:text-zinc-300'
      : variant === 'pill'
      ? 'text-zinc-300 hover:text-white rounded-full border border-white/10 bg-white/[0.02] px-2 py-0.5'
      : 'text-zinc-300 hover:text-white'

  return (
    <button
      type="button"
      onClick={onCopy}
      title={address}
      className={`${base} ${variantClass} ${className ?? ''}`}
      aria-label={`Copy ${label ?? short}`}
    >
      {label ? <span className="truncate">{label}</span> : null}
      <span className={label ? 'text-zinc-500' : ''}>{short}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-300" />
      ) : (
        <Copy className="h-3 w-3 opacity-60" />
      )}
    </button>
  )
}

function formatShort(address: string): string {
  if (!address) return ''
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * Compact copy control for placing next to a primary address label.
 * Copies the full address; shows a brief check after success.
 */
export function InlineAddressCopyButton({
  address,
  className,
}: {
  address: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const onCopy = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      if (!address) return
      try {
        void navigator.clipboard.writeText(address)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      } catch {
        /* non-fatal */
      }
    },
    [address],
  )

  return (
    <button
      type="button"
      onClick={onCopy}
      title={`Copy ${formatShort(address)}`}
      aria-label={`Copy address ${formatShort(address)}`}
      className={`inline-flex shrink-0 items-center justify-center rounded-md p-1 text-zinc-500 transition-colors hover:text-zinc-200 ${className ?? ''}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
      ) : (
        <span className="text-sm leading-none" aria-hidden>
          ⧉
        </span>
      )}
    </button>
  )
}
