export function AppLoadingState() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 72% 58% at 50% 38%, rgba(0,82,255,0.16) 0%, rgba(0,82,255,0.06) 38%, transparent 72%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-140px] h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-blue-300/10 blur-[110px]"
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-16">
        <div className="vault-surface-elevated relative w-full max-w-xl overflow-hidden rounded-3xl border-white/10 p-8 sm:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-primary/18 blur-[88px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-blue-400/12 blur-[88px]"
          />

          <div className="relative z-10 space-y-7" role="status" aria-live="polite">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary shadow-[0_0_12px_rgba(0,82,255,0.9)] motion-safe:animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">Access Guard</span>
            </div>

            <div className="flex items-start gap-5 sm:gap-6">
              <div className="relative mt-0.5 h-14 w-14 shrink-0">
                <div className="absolute inset-0 rounded-full border border-white/10 bg-black/35" />
                <div className="absolute inset-1.5 rounded-full border border-brand-primary/45 border-t-transparent motion-safe:animate-spin" />
                <div className="absolute inset-3 rounded-full border border-blue-300/30 border-b-transparent motion-safe:animate-spin [animation-direction:reverse] [animation-duration:2.6s]" />
                <div className="guard-loading-core absolute inset-[21px] rounded-full bg-brand-primary/85" />
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <h2 className="text-xl font-medium leading-tight text-zinc-100 sm:text-2xl">Loading your access state</h2>
                <p className="max-w-md text-sm leading-relaxed text-zinc-400">
                  Verifying wallet identity and session permissions before entering the app.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="guard-loading-bar h-2.5 w-full rounded-full" />
              <div className="guard-loading-bar h-2.5 w-[86%] rounded-full" />
              <div className="guard-loading-bar h-2.5 w-[68%] rounded-full" />
            </div>

            <div className="grid grid-cols-1 gap-2.5 pt-1 text-xs text-zinc-500 sm:grid-cols-3">
              <div className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-500/70 motion-safe:animate-pulse" />
                Wallet check
              </div>
              <div className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-500/70 motion-safe:animate-pulse" />
                Session sync
              </div>
              <div className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-500/70 motion-safe:animate-pulse" />
                Route prepare
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
