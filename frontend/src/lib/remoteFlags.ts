/**
 * Client-side remote flag resolution.
 *
 * Fetches Vercel-managed flag values from /api/flags/evaluate (server-side
 * evaluation via @vercel/flags-core) and caches them for the session.
 *
 * Only `ui` category flags are eligible for remote override.
 * Security, operational, and debug flags are never remote.
 */

type RemoteFlagValues = Record<string, unknown>

let cachedValues: RemoteFlagValues | null = null
let fetchPromise: Promise<RemoteFlagValues> | null = null

async function doFetch(): Promise<RemoteFlagValues> {
  try {
    const res = await fetch('/api/flags/evaluate', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return {}
    const json = await res.json()
    if (json?.success && json.data) return json.data as RemoteFlagValues
    return {}
  } catch {
    return {}
  }
}

/**
 * Fetch remote flag values from the server.
 * Deduplicates concurrent calls and caches the result for the session.
 */
export async function fetchRemoteFlags(): Promise<RemoteFlagValues> {
  if (cachedValues) return cachedValues
  if (!fetchPromise) {
    fetchPromise = doFetch().then((v) => {
      cachedValues = v
      return v
    })
  }
  return fetchPromise
}

/**
 * Synchronous access to the cached remote flag values.
 * Returns null if the fetch hasn't completed yet.
 */
export function getRemoteFlagValues(): RemoteFlagValues | null {
  return cachedValues
}

/**
 * Get a specific remote flag value, or undefined if not available.
 */
export function getRemoteFlag<T = unknown>(key: string): T | undefined {
  if (!cachedValues) return undefined
  return cachedValues[key] as T | undefined
}

/**
 * Force a refresh of remote flags (ignores cache).
 */
export async function refreshRemoteFlags(): Promise<RemoteFlagValues> {
  cachedValues = null
  fetchPromise = null
  return fetchRemoteFlags()
}
