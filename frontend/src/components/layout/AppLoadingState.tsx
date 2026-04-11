import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'

export function AppLoadingState() {
  return (
    <div className="app-loading-root fixed inset-0 z-[120] isolate overflow-hidden bg-[#05070b] text-zinc-100">
      <div aria-hidden="true" className="app-loading-glow app-loading-glow-primary" />

      <div className="relative z-10 flex h-full items-center justify-center px-6 py-16">
        <div className="app-loading-pill">
          <div aria-hidden="true" className="app-loading-pill__scanner" />
          <PixelWaveLoader
            className="relative z-[1]"
            color="rgba(214, 235, 255, 0.96)"
            duration={620}
            size={24}
          />
          <div className="relative z-[1] flex flex-col">
            <h2 className="app-loading-pill__title">Preparing workspace</h2>
            <p className="app-loading-pill__subtitle">Syncing your account session</p>
          </div>
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        Loading your account session.
      </div>
    </div>
  )
}
