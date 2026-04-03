import { toTrimmed } from './types.js'

export type ReplayGuard = {
  isReplay: (replayKey: string) => boolean
}

export function normalizeReplayKeys(values: Array<string | null | undefined>): string[] {
  const deduped = new Set<string>()
  for (const value of values) {
    const normalized = toTrimmed(value)
    if (!normalized) continue
    deduped.add(normalized)
  }
  return [...deduped]
}

export function createStaticReplayGuard(values: Iterable<string>): ReplayGuard {
  const keys = new Set(normalizeReplayKeys([...values]))
  return {
    isReplay(replayKey: string): boolean {
      return keys.has(toTrimmed(replayKey))
    },
  }
}
