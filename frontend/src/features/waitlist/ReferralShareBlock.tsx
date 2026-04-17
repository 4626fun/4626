import { useEffect, useRef, useState } from 'react'
import { Check, Copy, MessageCircle, Twitter, UserPlus } from 'lucide-react'

import { getMarketingWaitlistReferralUrl } from '@/lib/auth/waitlistEntry'
import {
  buildTelegramIntent,
  buildTwitterIntent,
  buildWarpcastIntent,
} from '@/components/share/ShareVaultButton'

type ReferralShareBlockProps = {
  referralCode: string | null
  qualifiedCount?: number
  pendingCount?: number
  className?: string
}

const SHARE_TEXT = 'Join me on 4626 — creator vaults, shared upside. Use my link:'

function openWindow(href: string) {
  try {
    window.open(href, '_blank', 'noopener,noreferrer')
  } catch {
    // ignore popup blockers
  }
}

export function ReferralShareBlock({
  referralCode,
  qualifiedCount = 0,
  pendingCount = 0,
  className = '',
}: ReferralShareBlockProps) {
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    }
  }, [])

  if (!referralCode) return null

  const shareUrl = getMarketingWaitlistReferralUrl(referralCode)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false)
        copyTimerRef.current = null
      }, 1600)
    } catch {
      // best-effort
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="bv-kicker text-brand-300 flex items-center gap-1.5">
            <UserPlus className="w-3 h-3" /> Invite friends
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Each qualified referral earns you +6 points. Pending referrals earn +2.
          </div>
        </div>
        <div className="text-[11px] tabular-nums text-zinc-400 flex items-center gap-3">
          <span>
            <span className="text-emerald-300">{qualifiedCount}</span> qualified
          </span>
          <span>
            <span className="text-zinc-300">{pendingCount}</span> pending
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
        <code className="flex-1 truncate text-xs text-zinc-300" title={shareUrl}>
          {shareUrl}
        </code>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 hover:border-white/20 hover:text-white transition-colors"
          title="Copy referral link"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openWindow(buildTwitterIntent(shareUrl, SHARE_TEXT))}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 hover:border-white/20 hover:text-white transition-colors"
        >
          <Twitter className="w-3 h-3" /> Share on X
        </button>
        <button
          type="button"
          onClick={() => openWindow(buildWarpcastIntent(shareUrl, SHARE_TEXT))}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 hover:border-white/20 hover:text-white transition-colors"
        >
          <span className="inline-flex w-3 h-3 items-center justify-center font-bold">W</span>
          Cast on Warpcast
        </button>
        <button
          type="button"
          onClick={() => openWindow(buildTelegramIntent(shareUrl, SHARE_TEXT))}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 hover:border-white/20 hover:text-white transition-colors"
        >
          <MessageCircle className="w-3 h-3" /> Telegram
        </button>
      </div>
    </div>
  )
}
