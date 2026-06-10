import { PageMeta, META } from '@/components/seo/PageMeta'
import { ExploreMetricsDashboard } from '@/components/explore/ExploreMetricsDashboard'
import { ExploreTabNav } from '@/components/explore/ExploreTabNav'
import { PageTransitionNestedOutlet } from '@/components/layout/PageTransition'
import { useExploreListTabScrollReset } from '@/features/explore/exploreListNavigation'

export const EXPLORE_LIST_TITLE = 'Explore on Base'
export const EXPLORE_LIST_SUBTITLE =
  'Creator coins, content, vaults, and live activity across the Zora ecosystem.'

export function ExploreListLayout() {
  useExploreListTabScrollReset()

  return (
    <div className="relative w-full pt-1 sm:pt-2">
      <PageMeta title={META.explore.title} description={META.explore.description} canonicalPath="/explore/creators" />
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 pt-2 sm:pt-4 pb-4 sm:pb-8">
        <header className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-medium text-white mb-1 sm:mb-2">{EXPLORE_LIST_TITLE}</h1>
          <p className="text-zinc-400 text-[13px] sm:text-sm">{EXPLORE_LIST_SUBTITLE}</p>
          <ExploreMetricsDashboard className="mt-4 sm:mt-6" />
        </header>

        <ExploreTabNav className="mb-4 sm:mb-6" />

        <PageTransitionNestedOutlet />
      </div>
    </div>
  )
}

