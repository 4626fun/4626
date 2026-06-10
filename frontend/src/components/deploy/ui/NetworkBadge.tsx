import { cn } from '@/lib/shared/utils'

/** Compact network identity pill (Base). */
export function NetworkBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium tracking-[0.02em] text-zinc-300',
        className,
      )}
    >
      <img src="/protocols/base.png" alt="" aria-hidden="true" loading="lazy" className="size-3.5 opacity-90" />
      Base
    </span>
  )
}
