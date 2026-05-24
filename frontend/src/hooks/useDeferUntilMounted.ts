import { useSyncExternalStore } from 'react'

/** True after client mount — avoids wagmi Hydrate setState during SSR/first paint. */
export function useDeferUntilMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

const deferAfterCommitStore = (() => {
  let committed = false
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      if (!committed) {
        queueMicrotask(() => {
          if (committed) return
          committed = true
          for (const listener of listeners) listener()
        })
      }
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => committed,
    getServerSnapshot: () => false,
  }
})()

/** True after the first client commit — avoids wagmi Hydrate reconnect setState during render. */
export function useDeferUntilAfterCommit(): boolean {
  return useSyncExternalStore(
    deferAfterCommitStore.subscribe,
    deferAfterCommitStore.getSnapshot,
    deferAfterCommitStore.getServerSnapshot,
  )
}
