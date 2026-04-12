import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'

export function AppLoadingState() {
  return (
    <div className="app-loading-root fixed inset-0 z-[120] isolate overflow-hidden bg-[#05070b] text-zinc-100">
      <div aria-hidden="true" className="app-loading-glow app-loading-glow-primary" />

      <div className="relative z-10 flex h-full items-center justify-center px-6 py-16">
        <div className="app-loading-pill">
          <PixelWaveLoader
            className="relative z-[1]"
            color="rgba(230, 238, 250, 0.92)"
            delays={[0, 150, 300, 0, 150, 300, 0, 150, 300]}
            duration={1200}
            size={18}
          />
          <h2 className="app-loading-pill__title relative z-[1]">Preparing workspace</h2>
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        Loading your account session.
      </div>
    </div>
  )
}
