import { useEffect, useRef, useState } from 'react'
import { Check, Copy, UserPlus } from 'lucide-react'
import { RiTelegram2Fill } from 'react-icons/ri'
import { SiFarcaster, SiX } from 'react-icons/si'

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
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400 flex items-center gap-1.5">
            <UserPlus className="w-3 h-3" /> Invite friends
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            Earn +6 per qualified referral (+2 while pending).
          </div>
        </div>
        <div className="text-[11px] tabular-nums text-zinc-400 flex items-center gap-3">
          <span>
            <span className="text-zinc-300">{qualifiedCount}</span> qualified
          </span>
          <span>
            <span className="text-zinc-400">{pendingCount}</span> pending
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
        <code className="flex-1 truncate text-xs text-zinc-300" title={shareUrl}>
          {shareUrl}
        </code>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.08]"
          title="Copy referral link"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy invite link'}
        </button>
        <button
          type="button"
          onClick={() => openWindow(buildTwitterIntent(shareUrl, SHARE_TEXT))}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 hover:border-white/20 hover:text-white transition-colors"
        >
          <SiX className="w-3 h-3" aria-hidden="true" /> Share on X
        </button>
        <button
          type="button"
          onClick={() => openWindow(buildWarpcastIntent(shareUrl, SHARE_TEXT))}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 hover:border-white/20 hover:text-white transition-colors"
        >
          <SiFarcaster className="w-3 h-3" aria-hidden="true" />
          Cast on Warpcast
        </button>
        <button
          type="button"
          onClick={() => openWindow(buildTelegramIntent(shareUrl, SHARE_TEXT))}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 hover:border-white/20 hover:text-white transition-colors"
        >
          <RiTelegram2Fill className="w-3 h-3" aria-hidden="true" /> Telegram
        </button>
      </div>
    </div>
  )
}
