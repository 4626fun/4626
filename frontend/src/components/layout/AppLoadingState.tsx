import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'

export function AppLoadingState() {
  return (
    <div className="app-loading-root fixed inset-0 z-[120] isolate overflow-hidden bg-[#05070b] text-zinc-100">
      <div className="relative z-10 flex h-full items-center justify-center px-6 py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <PixelWaveLoader
            className="shrink-0"
            color="rgb(var(--brand-primary))"
            delays={[0, 150, 300, 0, 150, 300, 0, 150, 300]}
            duration={1200}
            size={20}
          />
          <h2 className="text-sm font-medium tracking-tight text-zinc-200 sm:text-base">Preparing workspace</h2>
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        Loading your account session.
      </div>
    </div>
  )
}
