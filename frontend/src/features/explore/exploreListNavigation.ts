import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export const EXPLORE_LIST_TAB_PATHS = [
  '/explore/creators',
  '/explore/content',
  '/explore/vaults',
  '/explore/trends',
  '/explore/transactions',
] as const

export type ExploreListTabPath = (typeof EXPLORE_LIST_TAB_PATHS)[number]

export function isExploreListTabPath(pathname: string): pathname is ExploreListTabPath {
  return (EXPLORE_LIST_TAB_PATHS as readonly string[]).includes(pathname)
}

export function getExploreListTabKey(pathname: string): ExploreListTabPath | null {
  return isExploreListTabPath(pathname) ? pathname : null
}

/** Preserve search (`q`) only when switching list tabs — drop sort/time that may be tab-specific. */
export function buildExploreTabSearchParams(currentSearch: string | undefined | null): string {
  const raw = (currentSearch ?? '').trim()
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw)
  const query = params.get('q')?.trim()
  if (!query) return ''
  return `?q=${encodeURIComponent(query)}`
}

export function shouldShowExploreTableLoading({
  isLoading,
  isFetching,
  hasRows,
}: {
  isLoading: boolean
  isFetching: boolean
  hasRows: boolean
}): boolean {
  if (isLoading) return true
  return isFetching && !hasRows
}

export function useExploreListTabScrollReset(): void {
  const location = useLocation()
  const tabKey = getExploreListTabKey(location.pathname)
  const previousTabKey = useRef<ExploreListTabPath | null>(null)

  useEffect(() => {
    if (!tabKey) return
    if (previousTabKey.current != null && previousTabKey.current !== tabKey) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
    previousTabKey.current = tabKey
  }, [tabKey])
}
