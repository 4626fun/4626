import { useEffect, useSyncExternalStore } from 'react'

import {
  fetchRemoteFlags,
  getRemoteFlagValues,
  getRemoteFlag,
} from '@/lib/remoteFlags'

type RemoteFlagValues = Record<string, unknown>

const listeners = new Set<() => void>()

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function notifyAll() {
  for (const cb of listeners) cb()
}

let initialized = false

/**
 * Kicks off the remote flags fetch once.
 * Call this near the app root so flag values are available quickly.
 */
export function useRemoteFlagsInit() {
  useEffect(() => {
    if (initialized) return
    initialized = true
    fetchRemoteFlags().then(() => notifyAll())
  }, [])
}

/**
 * Subscribe to the remote flags cache. Returns null until the fetch completes,
 * then returns the resolved values.
 */
export function useRemoteFlags(): RemoteFlagValues | null {
  return useSyncExternalStore(subscribe, getRemoteFlagValues, () => null)
}

/**
 * Get a specific remote flag value. Returns undefined until the fetch
 * completes or if the flag isn't Vercel-managed.
 */
export function useRemoteFlag<T = unknown>(key: string): T | undefined {
  // FIX: FINDING-lint — avoid setState in effect; use useSyncExternalStore
  // for synchronous reads and subscribe for async updates
  const snapshot = useSyncExternalStore(
    subscribe,
    () => getRemoteFlag<T>(key),
    () => undefined,
  )

  useEffect(() => {
    // If not yet available, kick off a fetch and notify subscribers on resolve
    if (snapshot === undefined) {
      fetchRemoteFlags().then(() => notifyAll())
    }
  }, [key, snapshot])

  return snapshot
}
