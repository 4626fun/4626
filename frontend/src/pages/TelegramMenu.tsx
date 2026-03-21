import { useEffect, useState } from 'react'
import { ArrowRight, Bot, Search, Share2, Sparkles } from 'lucide-react'

import { PageMeta } from '@/components/seo/PageMeta'
import {
  type TelegramInlineQueryChatType,
  loadTelegramWebApp,
  setupTelegramMiniAppUi,
  switchTelegramMiniAppInlineQuery,
} from '@/lib/telegramWebApp'

export type TelegramMenuLaunchMode = 'search' | 'share'

export function resolveTelegramMenuChatTypes(mode: TelegramMenuLaunchMode): TelegramInlineQueryChatType[] {
  return mode === 'share' ? ['users', 'groups', 'channels'] : []
}

export function buildTelegramMenuLaunch(params: {
  mode: TelegramMenuLaunchMode
  query?: string
}): { query: string; chatTypes: TelegramInlineQueryChatType[] } {
  return {
    query: String(params.query ?? '').trim(),
    chatTypes: resolveTelegramMenuChatTypes(params.mode),
  }
}

type QuickAction = {
  label: string
  hint: string
  query: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Ask AI',
    hint: 'Open inline AI suggestions',
    query: 'ai What should I do next?',
  },
  {
    label: 'Market',
    hint: 'Start with a quote',
    query: 'mkt quote BTC',
  },
  {
    label: 'CRE',
    hint: 'Operator snapshot',
    query: 'ai summarize current CRE status, auctions, health, and next operator actions',
  },
  {
    label: 'Solana',
    hint: 'Bridge and keeper status',
    query: 'ai summarize current Solana health, pending entries, and fee settlement status',
  },
]

export function TelegramMenu() {
  const [ready, setReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    let teardown: (() => void) | null = null
    void (async () => {
      const webApp = await loadTelegramWebApp().catch(() => null)
      if (isCancelled) return
      teardown = setupTelegramMiniAppUi({ requestExpand: true })
      setReady(Boolean(webApp?.switchInlineQuery))
    })()
    return () => {
      isCancelled = true
      teardown?.()
    }
  }, [])

  const launchInline = (mode: TelegramMenuLaunchMode, query = '') => {
    const launch = buildTelegramMenuLaunch({ mode, query })
    const ok = switchTelegramMiniAppInlineQuery(launch)
    if (!ok) {
      setErrorMessage('Telegram inline mode is unavailable. Reopen this from the bot menu in Telegram and try again.')
      return
    }
    setErrorMessage(null)
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#081017] text-white">
      <PageMeta
        title="Telegram Menu"
        description="Launch 4626 inline tools from Telegram."
        canonicalPath="/telegram/menu"
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-12 h-64 w-64 rounded-full bg-emerald-400/12 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-lime-300/8 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-xl items-center px-5 py-8">
        <div className="w-full space-y-5 rounded-[28px] border border-white/10 bg-[#0d1821]/92 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="space-y-3 rounded-[24px] border border-emerald-300/15 bg-[linear-gradient(180deg,rgba(44,71,58,0.9),rgba(14,24,33,0.85))] p-5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
              <Bot className="h-4 w-4" />
              AKITA | INLINE
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white">Put @akitai_bot in the box with one tap.</h1>
              <p className="text-sm leading-6 text-zinc-300">
                Search keeps you in the current chat. Share opens Telegram&apos;s chat picker so you can drop the inline
                query into any group or DM.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => launchInline('search')}
              className="group rounded-[22px] border border-cyan-300/20 bg-cyan-400/[0.07] p-4 text-left transition hover:border-cyan-300/35 hover:bg-cyan-400/[0.12]"
            >
              <div className="mb-3 inline-flex rounded-full border border-cyan-200/20 bg-cyan-200/10 p-2 text-cyan-100">
                <Search className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-lg font-semibold text-white">Search</div>
                  <ArrowRight className="h-4 w-4 text-cyan-100 transition group-hover:translate-x-0.5" />
                </div>
                <p className="text-sm leading-6 text-zinc-300">Insert the inline query in this chat and open results immediately.</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => launchInline('share')}
              className="group rounded-[22px] border border-emerald-300/20 bg-emerald-400/[0.07] p-4 text-left transition hover:border-emerald-300/35 hover:bg-emerald-400/[0.12]"
            >
              <div className="mb-3 inline-flex rounded-full border border-emerald-200/20 bg-emerald-200/10 p-2 text-emerald-100">
                <Share2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-lg font-semibold text-white">Share</div>
                  <ArrowRight className="h-4 w-4 text-emerald-100 transition group-hover:translate-x-0.5" />
                </div>
                <p className="text-sm leading-6 text-zinc-300">Pick another chat and prefill @akitai_bot there for instant inline use.</p>
              </div>
            </button>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
              <Sparkles className="h-4 w-4 text-emerald-200" />
              Quick Starts
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => launchInline('search', action.query)}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/15 hover:bg-white/[0.06]"
                >
                  <div className="text-sm font-medium text-white">{action.label}</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-400">{action.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-zinc-400">
            {errorMessage
              ? errorMessage
              : ready
                ? 'This screen is only a launcher. After you tap Search or Share, Telegram will move you back into inline mode.'
                : 'Connecting to Telegram Mini App controls...'}
          </div>
        </div>
      </div>
    </div>
  )
}
