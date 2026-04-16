import { Zap } from 'lucide-react'

type RouteNode = {
  label: string
  type?: 'chain' | 'protocol'
}

function buildNodes(routeSummary: string | null | undefined): RouteNode[] {
  // Default: same-chain swap on Base
  if (!routeSummary) {
    return [
      { label: 'Base', type: 'chain' },
      { label: 'Uniswap', type: 'protocol' },
      { label: 'Base', type: 'chain' },
    ]
  }
  // If route string contains '→' or '->', try to parse it
  const arrow = routeSummary.includes('→') ? '→' : routeSummary.includes('->') ? '->' : null
  if (arrow) {
    const parts = routeSummary.split(arrow).map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2) {
      return parts.map((label) => ({ label, type: 'protocol' as const }))
    }
  }
  // Fallback: show summary as single action node
  return [
    { label: 'Base', type: 'chain' },
    { label: routeSummary.slice(0, 20), type: 'protocol' },
    { label: 'Base', type: 'chain' },
  ]
}

export function RouteVisualization(props: {
  routeSummary?: string | null
  className?: string
  compact?: boolean
}) {
  const nodes = buildNodes(props.routeSummary)
  const isSameChain = nodes.length === 3 && nodes[0]!.label === nodes[2]!.label

  if (props.compact) {
    return (
      <div className={`inline-flex items-center gap-1 ${props.className ?? ''}`}>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300 border border-white/8">
          {nodes[0]!.label}
        </span>
        <svg width="16" height="6" viewBox="0 0 16 6" fill="none" aria-hidden>
          <path d="M0 3 L12 3 M10 1 L14 3 L10 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600" />
        </svg>
        {isSameChain ? (
          <span className="flex items-center gap-0.5 text-[10px] text-zinc-500">
            <Zap className="h-2.5 w-2.5" />
            Smart routed
          </span>
        ) : (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300 border border-white/8">
            {nodes[nodes.length - 1]!.label}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-0 overflow-hidden ${props.className ?? ''}`}>
      {nodes.map((node, i) => (
        <span key={`${node.label}-${i}`} className="flex items-center">
          {i > 0 && (
            <span className="flex items-center px-1">
              <svg width="20" height="6" viewBox="0 0 20 6" fill="none" aria-hidden>
                <line x1="0" y1="3" x2="16" y2="3" stroke="currentColor" strokeWidth="1" className="text-zinc-700" />
                <path d="M13 1 L17 3 L13 5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600" />
              </svg>
            </span>
          )}
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
              node.type === 'chain'
                ? 'border-brand-primary/25 bg-brand-primary/10 text-brand-300'
                : 'border-white/8 bg-white/4 text-zinc-400'
            }`}
          >
            {node.label}
          </span>
        </span>
      ))}
      {isSameChain && (
        <span className="ml-2 flex items-center gap-1 text-[10px] text-zinc-600">
          <Zap className="h-3 w-3" />
          Smart routed
        </span>
      )}
    </div>
  )
}
