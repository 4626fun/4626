import { useSyncExternalStore } from 'react'

/** True after client mount — avoids wagmi Hydrate setState during SSR/first paint. */
export function useDeferUntilMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}
