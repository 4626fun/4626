import { useState, type ReactNode } from 'react'
import { Check, ChevronDown, Copy, ExternalLink, Link2 } from 'lucide-react'
import { RiTelegram2Fill } from 'react-icons/ri'
import { SiFarcaster, SiX } from 'react-icons/si'

import { apiFetch } from '@/lib/api/apiBase'
import { getMarketingBaseUrl } from '@/lib/env/host'
import { buildTwitterIntent, buildWarpcastIntent } from '@/components/share/ShareVaultButton'
import { PROVIDER_POINTS } from '@/features/waitlist/waitlistTiers'
import { ReferralShareBlock } from './ReferralShareBlock'

type WaitlistDailyActionsHubProps = {
  linkedMethods: Record<string, string[]>
  busyProvider: string | null
  onLinkProvider?: (provider: string) => void | Promise<void>
  shareUrl: string
  telegramGroupUrl: string
  copiedPrompt: boolean
  onCopyTelegramPrompt: () => void | Promise<void>
  referralCode: string | null
  qualifiedCount: number
  pendingCount: number
}

type ApiEnvelope<T> = {
  success?: boolean
  data?: T
  error?: string
}

type TwitterCheckinResponse = {
  awarded: boolean
  awardedCredits: number
}

function openWindow(href: string) {
  try {
    window.open(href, '_blank', 'noopener,noreferrer')
  } catch {
    // ignore popup blockers
  }
}

function rewardPill(text: string) {
  return (
    <span className="inline-flex items-center rounded-md border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
      {text}
    </span>
  )
}

function mutedPill(text: string) {
  return (
    <span className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-zinc-400">
      {text}
    </span>
  )
}

function DailyCard(props: {
  title: string
  subtitle?: string
  connectReward: string
  brandIcon?: ReactNode
  connected?: boolean
  collapsedHint?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const {
    title,
    subtitle,
    connectReward,
    brandIcon,
    connected = true,
    collapsedHint,
    defaultOpen = false,
    children,
  } = props
  const [open, setOpen] = useState(defaultOpen)
  return (
    <article className="rounded-xl border border-white/[0.08] bg-black/30">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 border-b border-white/[0.06] px-3.5 py-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-zinc-100">
            {brandIcon}
            {title}
          </p>
          {subtitle ? <p className="mt-1 text-xs text-zinc-400">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {rewardPill(connectReward)}
          <ChevronDown
            className={`h-4 w-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </div>
      </button>
      {open ? (
        <div className="space-y-3 px-3.5 py-3">
          {children}
          {!connected && collapsedHint ? <p className="text-[11px] text-amber-200/90">{collapsedHint}</p> : null}
        </div>
      ) : null}
    </article>
  )
}

function StepRow(props: {
  label: string
  value: ReactNode
}) {
  const { label, value } = props
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
      <p className="text-xs text-zinc-300">{label}</p>
      <div className="shrink-0">{value}</div>
    </div>
  )
}

function ConnectStepAction(props: {
  connected: boolean
  busy: boolean
  onClick?: () => void
}) {
  const { connected, busy, onClick } = props
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-200">
        <Check className="h-3 w-3" />
        Linked
      </span>
    )
  }

  return (
    <button
      type="button"
      disabled={busy || typeof onClick !== 'function'}
      onClick={() => onClick?.()}
      className="inline-flex items-center gap-1.5 rounded-md border border-brand-primary/30 bg-brand-primary/10 px-2.5 py-1 text-[11px] font-medium text-brand-200 hover:bg-brand-primary/20 disabled:opacity-50"
    >
      <Link2 className="h-3 w-3" />
      {busy ? '...' : 'Link'}
    </button>
  )
}

function TwitterDailyCard(props: {
  linked: boolean
  busy: boolean
  onLinkProvider?: (provider: string) => void | Promise<void>
}) {
  const { linked, busy, onLinkProvider } = props
  const [tweetUrl, setTweetUrl] = useState('')
  const [checkinBusy, setCheckinBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const verifyCheckin = async () => {
    const trimmed = tweetUrl.trim()
    if (!trimmed) {
      setError('Paste your posted X link first.')
      return
    }
    setCheckinBusy(true)
    setStatus(null)
    setError(null)
    try {
      const response = await apiFetch('/api/v1/lottery/amoe/twitter-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetUrl: trimmed }),
        withCredentials: true,
      })
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<TwitterCheckinResponse> | null
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || 'Could not verify this X check-in.')
      }
      setTweetUrl('')
      setStatus(payload.data.awarded ? 'Verified. Daily reward claimed.' : 'Already claimed today.')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not verify this X check-in.'
      setError(message)
    } finally {
      setCheckinBusy(false)
    }
  }

  return (
    <DailyCard
      title="X"
      subtitle="connect -> verify"
      connectReward="+16"
      brandIcon={<SiX className="h-3.5 w-3.5" />}
      connected={linked}
      collapsedHint="Step 1 unlocks 2/3."
      defaultOpen
    >
      <StepRow
        label="1 Connect"
        value={
          <ConnectStepAction
            connected={linked}
            busy={busy}
            onClick={() => void onLinkProvider?.('twitter')}
          />
        }
      />

      {linked ? (
        <>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-300">2 Action</p>
              <a
                href={buildTwitterIntent(
                  getMarketingBaseUrl(),
                  'Checking in for 4626 AMOE. No purchase necessary. Join me:',
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200"
              >
                <SiX className="h-3 w-3" />
                Compose
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="url"
                value={tweetUrl}
                onChange={(event) => setTweetUrl(event.target.value)}
                placeholder="Paste tweet URL"
                disabled={checkinBusy}
                className="h-8 min-w-[180px] flex-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[11px] text-zinc-200 placeholder:text-zinc-500 disabled:opacity-40"
              />
              <button
                type="button"
                disabled={checkinBusy || tweetUrl.trim().length === 0}
                onClick={() => void verifyCheckin()}
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-primary/30 bg-brand-primary/80 px-3 py-1.5 text-[11px] font-medium text-white shadow-[0_10px_24px_-14px_rgb(var(--brand-primary)/0.95)] hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {checkinBusy ? '...' : 'Verify'}
              </button>
            </div>
            {status ? <p className="mt-2 text-[11px] text-emerald-300">{status}</p> : null}
            {error ? <p className="mt-2 text-[11px] text-rose-300">{error}</p> : null}
          </div>

          <StepRow label="3 Reward" value={rewardPill('+6')} />
        </>
      ) : null}
    </DailyCard>
  )
}

function FarcasterDailyCard(props: {
  linked: boolean
  busy: boolean
  onLinkProvider?: (provider: string) => void | Promise<void>
  shareUrl: string
}) {
  const { linked, busy, onLinkProvider, shareUrl } = props
  return (
    <DailyCard
      title="Farcaster"
      subtitle="connect -> post"
      connectReward="+40"
      brandIcon={<SiFarcaster className="h-3.5 w-3.5" />}
      connected={linked}
      collapsedHint="Step 1 unlocks 2/3."
    >
      <StepRow
        label="1 Connect"
        value={
          <ConnectStepAction
            connected={linked}
            busy={busy}
            onClick={() => void onLinkProvider?.('zora_cross_app')}
          />
        }
      />

      {linked ? (
        <>
          <StepRow
            label="2 Action"
            value={
              <button
                type="button"
                onClick={() => openWindow(buildWarpcastIntent(shareUrl, 'Join me on 4626:'))}
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-primary/30 bg-brand-primary/80 px-3 py-1.5 text-[11px] font-medium text-white shadow-[0_10px_24px_-14px_rgb(var(--brand-primary)/0.95)] hover:bg-brand-hover"
              >
                <SiFarcaster className="h-3 w-3" />
                Post
              </button>
            }
          />

          <StepRow label="3 Reward" value={mutedPill('Boost only')} />
        </>
      ) : null}
    </DailyCard>
  )
}

function TelegramDailyCard(props: {
  linked: boolean
  busy: boolean
  onLinkProvider?: (provider: string) => void | Promise<void>
  telegramGroupUrl: string
  copiedPrompt: boolean
  onCopyTelegramPrompt: () => void | Promise<void>
}) {
  const { linked, busy, onLinkProvider, telegramGroupUrl, copiedPrompt, onCopyTelegramPrompt } = props
  return (
    <DailyCard
      title="Telegram"
      subtitle="connect -> join"
      connectReward={`+${PROVIDER_POINTS.telegram}`}
      brandIcon={<RiTelegram2Fill className="h-3.5 w-3.5" />}
      connected={linked}
      collapsedHint="Step 1 unlocks 2/3."
    >
      <StepRow
        label="1 Connect"
        value={
          <ConnectStepAction
            connected={linked}
            busy={busy}
            onClick={() => void onLinkProvider?.('telegram')}
          />
        }
      />

      {linked ? (
        <>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-300">2 Action</p>
              <button
                type="button"
                onClick={() => void onCopyTelegramPrompt()}
                className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200"
              >
                {copiedPrompt ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedPrompt ? 'Copied' : 'Copy text'}
              </button>
            </div>
            <a
              href={telegramGroupUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-brand-primary/30 bg-brand-primary/80 px-3 py-1.5 text-[11px] font-medium text-white shadow-[0_10px_24px_-14px_rgb(var(--brand-primary)/0.95)] hover:bg-brand-hover"
            >
              <RiTelegram2Fill className="h-3 w-3" />
              Join
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <StepRow label="3 Reward" value={mutedPill('Boost only')} />
        </>
      ) : null}
    </DailyCard>
  )
}

function ReferralCard(props: {
  referralCode: string | null
  qualifiedCount: number
  pendingCount: number
}) {
  const { referralCode, qualifiedCount, pendingCount } = props
  if (!referralCode) return null
  return (
    <article className="rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">Referrals</p>
          <p className="mt-1 text-xs text-zinc-400">share link</p>
        </div>
        {rewardPill('+6 / +2')}
      </div>
      <ReferralShareBlock
        referralCode={referralCode}
        qualifiedCount={qualifiedCount}
        pendingCount={pendingCount}
      />
    </article>
  )
}

export function WaitlistDailyActionsHub(props: WaitlistDailyActionsHubProps) {
  const {
    linkedMethods,
    busyProvider,
    onLinkProvider,
    shareUrl,
    telegramGroupUrl,
    copiedPrompt,
    onCopyTelegramPrompt,
    referralCode,
    qualifiedCount,
    pendingCount,
  } = props

  const hasLinkedTwitter = Array.isArray(linkedMethods.twitter) && linkedMethods.twitter.length > 0
  const hasLinkedFarcaster =
    Array.isArray(linkedMethods.zora_cross_app) && linkedMethods.zora_cross_app.length > 0
  const hasLinkedTelegram =
    Array.isArray(linkedMethods.telegram) && linkedMethods.telegram.length > 0

  return (
    <div className="space-y-3">
      <TwitterDailyCard linked={hasLinkedTwitter} busy={busyProvider === 'twitter'} onLinkProvider={onLinkProvider} />
      <FarcasterDailyCard
        linked={hasLinkedFarcaster}
        busy={busyProvider === 'zora_cross_app'}
        onLinkProvider={onLinkProvider}
        shareUrl={shareUrl}
      />
      <TelegramDailyCard
        linked={hasLinkedTelegram}
        busy={busyProvider === 'telegram'}
        onLinkProvider={onLinkProvider}
        telegramGroupUrl={telegramGroupUrl}
        copiedPrompt={copiedPrompt}
        onCopyTelegramPrompt={onCopyTelegramPrompt}
      />
      <ReferralCard referralCode={referralCode} qualifiedCount={qualifiedCount} pendingCount={pendingCount} />
    </div>
  )
}
