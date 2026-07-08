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
        // Use a macrotask (not microtask) so wagmi Hydrate can finish its
        // reconnect render pass before we mount hook consumers.
        setTimeout(() => {
          if (committed) return
          committed = true
          for (const listener of listeners) listener()
        }, 0)
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

function createDeferOneMacrotaskStore() {
  let ready = false
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      if (!ready) {
        setTimeout(() => {
          if (ready) return
          ready = true
          for (const listener of listeners) listener()
        }, 0)
      }
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => ready,
    getServerSnapshot: () => false,
  }
}

const deferWagmiHookConsumersStore = (() => {
  let ready = false
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      if (!ready) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              if (ready) return
              ready = true
              for (const listener of listeners) listener()
            }, 0)
          })
        })
      }
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => ready,
    getServerSnapshot: () => false,
  }
})()

/** True after rAF + macrotask — lets wagmi Hydrate finish before hook consumers mount. */
export function useDeferWagmiHookConsumers(): boolean {
  return useSyncExternalStore(
    deferWagmiHookConsumersStore.subscribe,
    deferWagmiHookConsumersStore.getSnapshot,
    deferWagmiHookConsumersStore.getServerSnapshot,
  )
}

const deferOneMacrotaskStore = createDeferOneMacrotaskStore()

/** True one macrotask after mount — shared deferral for nested provider gates. */
export function useDeferOneMacrotask(): boolean {
  return useSyncExternalStore(
    deferOneMacrotaskStore.subscribe,
    deferOneMacrotaskStore.getSnapshot,
    deferOneMacrotaskStore.getServerSnapshot,
  )
}
