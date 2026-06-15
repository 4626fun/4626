import { useState, type ReactNode } from 'react'
import { Check, ChevronDown, Copy, ExternalLink, Link2 } from 'lucide-react'

import { apiFetch } from '@/lib/api/apiBase'
import { getMarketingBaseUrl } from '@/lib/env/host'
import { buildTwitterIntent, buildWarpcastIntent } from '@/components/share/ShareVaultButton'
import { PROVIDER_POINTS } from '@/features/waitlist/waitlistTiers'
import { ReferralShareBlock } from './ReferralShareBlock'

type WaitlistDailyActionsHubProps = {
  linkedMethods: Record<string, string[]>
  busyProvider: string | null
  onLinkProvider?: (provider: string) => void | Promise<void>
  zoraHandle?: string | null
  canonicalCswAddress?: string | null
  signingStepComplete?: boolean
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
    <span className="inline-flex items-center text-[12px] font-semibold tracking-tight text-emerald-300">
      {text}
    </span>
  )
}

function mutedPill(text: string) {
  return (
    <span className="inline-flex items-center text-[12px] font-medium text-zinc-400">
      {text}
    </span>
  )
}

function BrandLogoIcon(props: { src: string; alt: string; className?: string }) {
  const { src, alt, className = 'h-3.5 w-3.5' } = props
  return <img src={src} alt={alt} className={className} loading="lazy" />
}

function DailyCard(props: {
  title: string
  connectReward: string
  brandIcon?: ReactNode
  backgroundLogoSrc?: string
  backgroundTintClass?: string
  connected?: boolean
  showConnectedAsCheck?: boolean
  collapsedHint?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const {
    title,
    connectReward,
    brandIcon,
    backgroundLogoSrc,
    backgroundTintClass,
    connected = true,
    showConnectedAsCheck = true,
    collapsedHint,
    defaultOpen = false,
    children,
  } = props
  const [open, setOpen] = useState(defaultOpen)
  return (
    <article className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-black/35">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className={`absolute inset-0 ${backgroundTintClass ?? 'bg-[radial-gradient(120%_120%_at_100%_0%,rgba(255,255,255,0.08),transparent_62%)]'}`}
        />
        {backgroundLogoSrc ? (
          <img
            src={backgroundLogoSrc}
            alt=""
            className="absolute -right-8 -top-8 h-28 w-28 select-none object-contain opacity-[0.11] saturate-0 brightness-200"
            loading="lazy"
            draggable={false}
          />
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative z-10 flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
        aria-expanded={open}
      >
        <p className="inline-flex items-center gap-2 text-sm font-medium text-zinc-100">
          {brandIcon}
          {title}
        </p>
        <div className="flex items-center gap-2">
          {connected && showConnectedAsCheck ? (
            <span className="inline-flex items-center text-[12px] font-semibold tracking-tight text-emerald-300">
              <Check className="h-3.5 w-3.5" />
            </span>
          ) : (
            rewardPill(connectReward)
          )}
          <ChevronDown
            className={`h-4 w-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </div>
      </button>
      {open ? (
        <div className="relative z-10 space-y-3 px-3.5 py-3">
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
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-2.5 py-2">
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
      <div className="flex items-center justify-end rounded-lg bg-white/[0.02] px-2.5 py-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-200">
          <Check className="h-3 w-3" />
          Connected
        </span>
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={busy || typeof onClick !== 'function'}
      onClick={() => onClick?.()}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-primary/15 px-2.5 py-2 text-[11px] font-medium text-brand-200 hover:bg-brand-primary/25 disabled:opacity-50"
    >
      <Link2 className="h-3 w-3" />
      {busy ? '...' : 'Connect'}
    </button>
  )
}

function ZoraDailyCard(props: {
  linked: boolean
  busy: boolean
  zoraHandle: string | null
  canonicalCswAddress: string | null
  signingStepComplete: boolean
  onLinkProvider?: (provider: string) => void | Promise<void>
}) {
  const { linked, busy, zoraHandle, canonicalCswAddress, signingStepComplete, onLinkProvider } = props
  const normalizedHandle = zoraHandle
    ? (zoraHandle.startsWith('@') ? zoraHandle : `@${zoraHandle}`)
    : null
  const zoraProfileUrl = normalizedHandle ? `https://zora.co/${normalizedHandle}` : null
  const shortAddr = canonicalCswAddress
    ? `${canonicalCswAddress.slice(0, 6)}…${canonicalCswAddress.slice(-4)}`
    : null
  return (
    <DailyCard
      title="Zora"
      connectReward="+40"
      brandIcon={<BrandLogoIcon src="/brands/zora-token.svg" alt="Zora" />}
      backgroundLogoSrc="/brands/zora-token.svg"
      backgroundTintClass="bg-[radial-gradient(120%_120%_at_100%_0%,rgba(138,99,210,0.24),transparent_62%)]"
      connected={linked}
      collapsedHint="Connect to unlock next cards."
      defaultOpen
    >
      <ConnectStepAction
        connected={linked}
        busy={busy}
        onClick={() => void onLinkProvider?.('zora_cross_app')}
      />
      {linked ? (
        <>
          <div className="rounded-lg bg-white/[0.02] px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {rewardPill('Setup complete')}
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                  signingStepComplete
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                    : 'border-white/10 bg-white/[0.03] text-zinc-400'
                }`}
              >
                {signingStepComplete ? 'Signing enabled' : 'Signing optional'}
              </span>
            </div>
            <p className="mt-2 text-xs text-zinc-300">
              {signingStepComplete
                ? 'Zora linked · ready for swaps and chat'
                : 'Zora linked · enable signing for swaps and chat'}
            </p>
            {normalizedHandle || shortAddr ? (
              <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                {normalizedHandle && zoraProfileUrl ? (
                  <a
                    href={zoraProfileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-zinc-400 transition-colors hover:text-zinc-200"
                  >
                    {normalizedHandle}
                    <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />
                  </a>
                ) : null}
                {normalizedHandle && shortAddr ? <span className="text-zinc-700">·</span> : null}
                {shortAddr ? (
                  <span className="font-mono text-[11px] text-zinc-500">
                    {shortAddr}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <StepRow label="Reward" value={rewardPill('+40')} />
        </>
      ) : null}
    </DailyCard>
  )
}

function TwitterDailyCard(props: {
  linked: boolean
  zoraLinked: boolean
  busy: boolean
  onLinkProvider?: (provider: string) => void | Promise<void>
}) {
  const { linked, zoraLinked, busy, onLinkProvider } = props
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
      setStatus(payload.data.awarded ? 'Verified.' : 'Already claimed today.')
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
      connectReward="+16"
      brandIcon={<BrandLogoIcon src="/brands/x-logo.svg" alt="X" />}
      backgroundLogoSrc="/brands/x-logo.svg"
      backgroundTintClass="bg-[radial-gradient(120%_120%_at_100%_0%,rgba(255,255,255,0.16),transparent_62%)]"
      connected={linked}
      showConnectedAsCheck
      collapsedHint="Connect to unlock action and reward."
    >
      <ConnectStepAction
        connected={linked}
        busy={busy}
        onClick={() => void onLinkProvider?.('twitter')}
      />

      {linked && zoraLinked ? (
        <>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-300">Action</p>
              <a
                href={buildTwitterIntent(
                  getMarketingBaseUrl(),
                  'Checking in for 4626 AMOE. No purchase necessary. Join me:',
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200"
              >
                <BrandLogoIcon src="/brands/x-logo.svg" alt="X" className="h-3 w-3" />
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
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary/80 px-3 py-1.5 text-[11px] font-medium text-white shadow-[0_10px_24px_-14px_rgb(var(--brand-primary)/0.95)] hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {checkinBusy ? '...' : 'Verify'}
              </button>
            </div>
            {status ? <p className="mt-2 text-[11px] text-emerald-300">{status}</p> : null}
            {error ? <p className="mt-2 text-[11px] text-rose-300">{error}</p> : null}
          </div>

          <StepRow label="Reward" value={rewardPill('+6')} />
        </>
      ) : null}
    </DailyCard>
  )
}

function FarcasterDailyCard(props: {
  linked: boolean
  shareUrl: string
}) {
  const { linked, shareUrl } = props
  return (
    <DailyCard
      title="Farcaster"
      connectReward="+0"
      brandIcon={<BrandLogoIcon src="/brands/farcaster-logo.svg" alt="Farcaster" />}
      backgroundLogoSrc="/brands/farcaster-logo.svg"
      backgroundTintClass="bg-[radial-gradient(120%_120%_at_100%_0%,rgba(138,99,210,0.24),transparent_62%)]"
      connected={linked}
      showConnectedAsCheck
      collapsedHint="Link Zora above to unlock."
    >
      {linked ? (
        <>
          <StepRow
            label="Action"
            value={
              <button
                type="button"
                onClick={() => openWindow(buildWarpcastIntent(shareUrl, 'Join me on 4626:'))}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary/80 px-3 py-1.5 text-[11px] font-medium text-white shadow-[0_10px_24px_-14px_rgb(var(--brand-primary)/0.95)] hover:bg-brand-hover"
              >
                <BrandLogoIcon src="/brands/farcaster-logo.svg" alt="Farcaster" className="h-3 w-3" />
                Post
              </button>
            }
          />
          <StepRow label="Reward" value={mutedPill('Boost')} />
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
      connectReward={`+${PROVIDER_POINTS.telegram}`}
      brandIcon={<BrandLogoIcon src="/brands/telegram-logo.svg" alt="Telegram" />}
      backgroundLogoSrc="/brands/telegram-logo.svg"
      backgroundTintClass="bg-[radial-gradient(120%_120%_at_100%_0%,rgba(34,158,217,0.24),transparent_62%)]"
      connected={linked}
      showConnectedAsCheck
      collapsedHint="Connect to unlock action and reward."
    >
      <ConnectStepAction
        connected={linked}
        busy={busy}
        onClick={() => void onLinkProvider?.('telegram')}
      />

      {linked ? (
        <>
          <div className="rounded-lg bg-white/[0.02] px-2.5 py-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-300">Action</p>
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
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary/80 px-3 py-1.5 text-[11px] font-medium text-white shadow-[0_10px_24px_-14px_rgb(var(--brand-primary)/0.95)] hover:bg-brand-hover"
            >
              <BrandLogoIcon src="/brands/telegram-logo.svg" alt="Telegram" className="h-3 w-3" />
              Join
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <StepRow label="Reward" value={mutedPill('Boost')} />
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
    zoraHandle = null,
    canonicalCswAddress = null,
    signingStepComplete = false,
    shareUrl,
    telegramGroupUrl,
    copiedPrompt,
    onCopyTelegramPrompt,
    referralCode,
    qualifiedCount,
    pendingCount,
  } = props

  const hasLinkedTwitter = Array.isArray(linkedMethods.twitter) && linkedMethods.twitter.length > 0
  const hasLinkedZora =
    Array.isArray(linkedMethods.zora_cross_app) && linkedMethods.zora_cross_app.length > 0
  const hasLinkedTelegram =
    Array.isArray(linkedMethods.telegram) && linkedMethods.telegram.length > 0

  return (
    <div className="space-y-3">
      <ZoraDailyCard
        linked={hasLinkedZora}
        busy={busyProvider === 'zora_cross_app'}
        zoraHandle={zoraHandle}
        canonicalCswAddress={canonicalCswAddress}
        signingStepComplete={signingStepComplete}
        onLinkProvider={onLinkProvider}
      />
      <TwitterDailyCard
        linked={hasLinkedTwitter}
        zoraLinked={hasLinkedZora}
        busy={busyProvider === 'twitter'}
        onLinkProvider={onLinkProvider}
      />
      <FarcasterDailyCard linked={hasLinkedZora} shareUrl={shareUrl} />
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
