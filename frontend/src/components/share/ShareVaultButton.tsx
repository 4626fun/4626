import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Share2, Twitter, MessageCircle } from 'lucide-react'

/**
 * Opens a compact share menu for a vault / creator detail page. The live URL is
 * the page URL itself; crawler requests are already rewritten to
 * /api/social-preview by vercel.json, so Twitter/Farcaster/Telegram will fetch
 * our OG image + metadata for the embed.
 */

type Network = 'twitter' | 'warpcast' | 'telegram'

type ShareVaultButtonProps = {
  /** Canonical page URL to share. Falls back to window.location.href when omitted. */
  url?: string
  /** Short share text prefix (e.g., "Check out $ZORA on 4626"). */
  text?: string
  className?: string
  /** Label for screen readers + desktop hover. */
  label?: string
  /** Show the label next to the share icon. */
  showLabel?: boolean
}

function buildTwitterIntent(url: string, text: string): string {
  const params = new URLSearchParams({ url, text })
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

function buildWarpcastIntent(url: string, text: string): string {
  // Farcaster/Warpcast compose intent — pass text and a single embed.
  const params = new URLSearchParams({ text })
  params.append('embeds[]', url)
  return `https://warpcast.com/~/compose?${params.toString()}`
}

function buildTelegramIntent(url: string, text: string): string {
  const params = new URLSearchParams({ url, text })
  return `https://t.me/share/url?${params.toString()}`
}

function openWindow(href: string) {
  try {
    window.open(href, '_blank', 'noopener,noreferrer')
  } catch {
    // ignore popup blockers; user can retry
  }
}

export function ShareVaultButton({
  url,
  text = 'Check this out on 4626',
  className = '',
  label = 'Share',
  showLabel = false,
}: ShareVaultButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const copyTimerRef = useRef<number | null>(null)

  const resolvedUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '')

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      const node = containerRef.current
      if (!node || !(event.target instanceof Node)) return
      if (!node.contains(event.target)) setOpen(false)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    }
  }, [])

  const handleCopy = async () => {
    if (!resolvedUrl) return
    try {
      await navigator.clipboard.writeText(resolvedUrl)
      setCopied(true)
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false)
        copyTimerRef.current = null
      }, 1600)
    } catch {
      // best-effort only; intentionally no toast coupling here
    }
  }

  const handleShareNetwork = (network: Network) => {
    if (!resolvedUrl) return
    const href =
      network === 'twitter'
        ? buildTwitterIntent(resolvedUrl, text)
        : network === 'warpcast'
          ? buildWarpcastIntent(resolvedUrl, text)
          : buildTelegramIntent(resolvedUrl, text)
    openWindow(href)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Share2 className="w-3.5 h-3.5" />
        {showLabel ? <span>{label}</span> : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-lg border border-white/10 bg-black/90 backdrop-blur shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleShareNetwork('twitter')}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5 hover:text-white"
          >
            <Twitter className="w-3.5 h-3.5" /> Share on X
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleShareNetwork('warpcast')}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5 hover:text-white"
          >
            <span className="inline-flex w-3.5 h-3.5 items-center justify-center font-bold">W</span>
            Cast on Warpcast
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleShareNetwork('telegram')}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5 hover:text-white"
          >
            <MessageCircle className="w-3.5 h-3.5" /> Share to Telegram
          </button>
          <div className="h-px bg-white/10" />
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleCopy()}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5 hover:text-white"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export { buildTwitterIntent, buildWarpcastIntent, buildTelegramIntent }
