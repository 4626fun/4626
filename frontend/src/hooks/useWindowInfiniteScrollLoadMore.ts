import { useEffect } from 'react'

type UseWindowInfiniteScrollLoadMoreParams = {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => unknown
  thresholdPx?: number
}

export function useWindowInfiniteScrollLoadMore({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  thresholdPx = 500,
}: UseWindowInfiniteScrollLoadMoreParams) {
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - thresholdPx
      ) {
        if (hasNextPage && !isFetchingNextPage) {
          onLoadMore()
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [hasNextPage, isFetchingNextPage, onLoadMore, thresholdPx])
}
