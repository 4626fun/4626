import { useEffect, useState, useSyncExternalStore } from 'react'

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
  const [value, setValue] = useState<T | undefined>(() => getRemoteFlag<T>(key))

  useEffect(() => {
    const current = getRemoteFlag<T>(key)
    if (current !== undefined) {
      setValue(current)
      return
    }
    fetchRemoteFlags().then(() => {
      setValue(getRemoteFlag<T>(key))
    })
  }, [key])

  return value
}
