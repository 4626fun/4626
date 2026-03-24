import { Link } from 'react-router-dom'

import { PageMeta } from '@/components/seo/PageMeta'

export function TelegramLink() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-2xl items-center px-4 py-10 sm:px-6">
      <PageMeta title="Telegram Link" description="Link your Telegram identity to 4626." canonicalPath="/telegram/link" />
      <div className="w-full rounded-3xl border border-white/10 bg-black/40 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-8">
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-cyan-300/80">Telegram Mini App</div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Telegram link flow removed for rebuild</h1>
          <p className="max-w-xl text-sm leading-6 text-zinc-400">
            The previous Telegram account-link implementation has been intentionally removed so the flow can be rebuilt from
            first principles.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
          This route is currently a placeholder. Use the rebuild handoff document before writing a new Telegram linking flow.
        </div>

        <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-300">
          <div className="font-medium text-zinc-100">Next steps</div>
          <div>Rebuild the flow with an explicit state machine for Telegram session verification, inline email OTP, sync, and final bind.</div>
          <div>Handoff doc: <span className="font-mono text-zinc-100">frontend/docs/telegram-link-rebuild-handoff.md</span></div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/accounts"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
          >
            Go to accounts
          </Link>
        </div>
      </div>
    </div>
  )
}
