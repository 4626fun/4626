export function AppLoadingState() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="vault-surface-elevated relative overflow-hidden rounded-2xl p-8 sm:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full bg-brand-primary/14 blur-[72px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 -left-20 h-56 w-56 rounded-full bg-blue-400/10 blur-[72px]"
          />

          <div className="relative z-10 flex items-start gap-4 sm:gap-5" role="status" aria-live="polite">
            <div className="relative mt-0.5 h-10 w-10 shrink-0 rounded-full border border-white/12 bg-black/25">
              <div className="absolute inset-1.5 rounded-full border border-brand-primary/45 border-t-transparent motion-safe:animate-spin" />
              <div className="guard-loading-core absolute inset-[13px] rounded-full bg-brand-primary/80" />
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="label text-zinc-500">Access Guard</div>
              <h2 className="text-lg sm:text-xl font-medium text-zinc-100 leading-tight">Loading access state...</h2>
              <p className="text-sm text-zinc-400">Resolving wallet/session permissions.</p>

              <div className="pt-2 space-y-2">
                <div className="guard-loading-bar h-2.5 w-full max-w-[320px] rounded-full" />
                <div className="guard-loading-bar h-2.5 w-full max-w-[240px] rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
