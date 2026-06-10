/** Public URLs for Explore analytics methodology and third-party dashboards. */

const DEFAULT_DOCS_ORIGIN = 'https://docs.4626.fun'

export function getDocsOrigin(): string {
  const raw = String(import.meta.env.VITE_DOCS_ORIGIN ?? '').trim()
  return raw || DEFAULT_DOCS_ORIGIN
}

export function getExploreAnalyticsDocsUrl(): string {
  const override = String(import.meta.env.VITE_EXPLORE_ANALYTICS_DOCS_URL ?? '').trim()
  if (override) return override
  return `${getDocsOrigin()}/users/explore-analytics`
}

export function getDuneDashboardUrl(): string | null {
  const raw = String(import.meta.env.VITE_DUNE_DASHBOARD_URL ?? '').trim()
  return raw || null
}

export function getExploreAssetsManifestUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/data/explore-assets-manifest.json`
  }
  return '/data/explore-assets-manifest.json'
}
