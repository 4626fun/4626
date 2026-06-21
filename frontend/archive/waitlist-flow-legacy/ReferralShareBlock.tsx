import { useEffect, useRef, useState } from 'react'
import { Check, Copy, UserPlus } from 'lucide-react'

import { getMarketingWaitlistReferralUrl } from '@/lib/auth/waitlistEntry'

type ReferralShareBlockProps = {
  referralCode: string | null
  qualifiedCount?: number
  pendingCount?: number
  className?: string
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
      <div className="flex flex-wrap items-start justify-between gap-3">
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
        <a
          href={shareUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.08]"
        >
          Open invite page
        </a>
      </div>
    </div>
  )
}
