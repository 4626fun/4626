/**
 * Scroll-pinned placeholder between content coins and the publish timeline.
 * Signals that vault + strategy infrastructure will occupy this corridor.
 */
export function CreatorVaultReserveBeat() {
  return (
    <div className="mx-auto max-w-md text-center px-4">
      <span className="inline-flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.34em] text-zinc-600">
        <span className="h-px w-10 bg-white/15" aria-hidden />
        Reserved
        <span className="h-px w-10 bg-white/15" aria-hidden />
      </span>

      <p className="mt-8 text-[clamp(1.65rem,4.5vw,2.5rem)] font-semibold tracking-tight leading-[1.05] text-white">
        Creator vaults
        <br />
        <span className="text-white/30">&amp; strategies.</span>
      </p>

      <p className="mt-6 text-sm leading-relaxed text-zinc-500">
        This corridor is held open — vault infrastructure and yield allocation will surface here.
      </p>

      <p className="mt-4 text-[11px] font-mono uppercase tracking-[0.22em] text-zinc-600">
        Not yet deployed
      </p>
    </div>
  )
}
