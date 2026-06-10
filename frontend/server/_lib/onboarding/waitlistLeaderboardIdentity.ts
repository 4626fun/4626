import { basenameToHandle } from '../identity/basenameResolver.js'

export function normalizeLeaderboardLabelHint(raw: string | null | undefined): string | null {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (!trimmed) return null
  if (trimmed.toLowerCase().endsWith('.base.eth')) {
    return basenameToHandle(trimmed) ?? trimmed.replace(/\.base\.eth$/i, '')
  }
  return trimmed.replace(/^@/, '')
}
