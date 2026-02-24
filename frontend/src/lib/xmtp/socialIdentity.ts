import { getBasename } from '@/lib/basename-api'

/**
 * Chat identity helpers.
 *
 * NOTE: Basenames reverse resolution can't be done reliably using `viem` on Base L2 in browsers
 * because the chain config may not include ENS universal resolver info (and some RPCs can fail
 * under CORS). This wrapper keeps the logic in one place.
 */

export async function getBasenameName(address: string): Promise<string | null> {
  const raw = await getBasename(address).catch(() => null)
  if (!raw) return null
  // Ensure we only treat *.base.eth as a basename.
  if (!raw.toLowerCase().endsWith('.base.eth')) return null
  return raw
}

