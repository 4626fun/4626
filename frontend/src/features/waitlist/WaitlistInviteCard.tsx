import { useCallback, useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { toast } from '@/components/ui/Toast'
import { WAITLIST_REFERRAL_EARN_COPY } from '@/features/waitlist/waitlistGameConstants'
import { cn } from '@/lib/shared/utils'

export function WaitlistInviteCard({
  inviteUrl,
  displayPath,
  referralCode,
}: {
  inviteUrl: string | null
  displayPath: string | null
  referralCode: string | null
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success('Referral link copied')
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Copy failed')
    }
  }, [inviteUrl])

  if (!inviteUrl || !referralCode) {
    return (
      <div
        className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]"
        data-testid="waitlist-invite-card"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Your invite link
        </p>
        <p className="mt-2 text-sm text-zinc-400">Generating your referral link…</p>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]"
      data-testid="waitlist-invite-card"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        Your invite link
      </p>
      <div className="mt-2 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-200">
          {displayPath ?? inviteUrl}
        </p>
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label="Copy referral link"
          className={cn(
            'inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 transition',
            'hover:border-[rgb(var(--brand-gold)/0.35)] hover:text-[rgb(var(--brand-gold))]',
            'active:scale-[0.96]',
          )}
        >
          {copied ? (
            <Check className="size-4 text-emerald-400" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{WAITLIST_REFERRAL_EARN_COPY}</p>
    </div>
  )
}
