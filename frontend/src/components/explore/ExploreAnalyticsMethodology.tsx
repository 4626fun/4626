import { ExternalLink } from 'lucide-react'

import {
  getDuneDashboardUrl,
  getExploreAnalyticsDocsUrl,
  getExploreAssetsManifestUrl,
} from '@/lib/explore/analyticsLinks'
import { cn } from '@/lib/shared/utils'

type ExploreAnalyticsMethodologyProps = {
  className?: string
  /** When true, show integrator manifest link (developers). */
  showManifest?: boolean
}

export function ExploreAnalyticsMethodology({
  className,
  showManifest = false,
}: ExploreAnalyticsMethodologyProps) {
  const docsUrl = getExploreAnalyticsDocsUrl()
  const duneUrl = getDuneDashboardUrl()
  const manifestUrl = getExploreAssetsManifestUrl()

  return (
    <footer
      className={cn(
        'rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 sm:px-4 text-[11px] sm:text-xs text-zinc-500 leading-relaxed',
        className,
      )}
    >
      <p>
        Explore metrics are <span className="text-zinc-400">indexed on Base</span> from Supabase creator-coin
        tables and Uniswap V4 subgraph history (Zora swap fallback when subgraph data is missing). We do not blend
        live Zora samples into hero totals during partial backfill.
      </p>
      <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <li>
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
          >
            Methodology
            <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          </a>
        </li>
        {duneUrl ? (
          <li>
            <a
              href={duneUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
            >
              Verify on Dune
              <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            </a>
          </li>
        ) : null}
        {showManifest ? (
          <li>
            <a
              href={manifestUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
            >
              Token manifest (JSON)
              <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            </a>
          </li>
        ) : null}
      </ul>
    </footer>
  )
}
