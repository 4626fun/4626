export function AppLoadingState() {
  return (
    <div className="app-loading-root fixed inset-0 z-[120] isolate overflow-hidden bg-[#05070b] text-zinc-100">
      <div aria-hidden="true" className="app-loading-glow app-loading-glow-primary" />
      <div aria-hidden="true" className="app-loading-glow app-loading-glow-secondary" />
      <div aria-hidden="true" className="app-loading-grid-mask" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-3xl items-center justify-center px-6 py-16">
        <div className="app-loading-panel w-full max-w-md">
          <div className="app-loading-orb" aria-hidden="true">
            <span className="app-loading-orb-ring app-loading-orb-ring-outer" />
            <span className="app-loading-orb-ring app-loading-orb-ring-inner" />
            <span className="app-loading-orb-core" />
          </div>

          <div className="space-y-2 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500">4626</p>
            <h2 className="text-xl font-medium tracking-tight text-zinc-100 sm:text-2xl">Preparing your workspace</h2>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-zinc-400">
              Verifying wallet identity and synchronizing access before entering the app.
            </p>
          </div>

          <div className="app-loading-progress" aria-hidden="true">
            <span className="app-loading-progress-bar" />
          </div>
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        Loading your account session.
      </div>
    </div>
  )
}
