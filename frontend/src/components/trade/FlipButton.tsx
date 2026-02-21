import { ArrowDown } from 'lucide-react'

export function FlipButton(props: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="rounded-full border border-white/20 bg-black/40 p-2 text-zinc-300 shadow-[0_12px_24px_-18px_rgba(0,0,0,0.9)] transition hover:text-white motion-safe:hover:rotate-180"
      title="Switch tokens"
      aria-label="Switch token direction"
    >
      <ArrowDown className="h-4 w-4" />
    </button>
  )
}
