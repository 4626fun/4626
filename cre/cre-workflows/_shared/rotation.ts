// FIX: LOW-06 — Document that multiple CRE nodes within the same rotation window
// will select the same vault subset. The queue server MUST use INSERT...ON CONFLICT IGNORE
// (or equivalent atomic dedup) semantics to prevent duplicate enqueues from concurrent nodes.
export function selectRotatingItems<T>(
  items: T[],
  params: {
    now: Date
    rotationIntervalSeconds: number
    maxItems: number
  },
): T[] {
  if (items.length === 0) return []

  const rotationSeconds = Math.max(1, Math.floor(params.rotationIntervalSeconds))
  const maxItems = Math.max(1, Math.floor(params.maxItems))
  const slotsElapsed = Math.floor(params.now.getTime() / 1000 / rotationSeconds)
  const startIndex = slotsElapsed % items.length
  const itemCount = Math.min(maxItems, items.length)

  const out: T[] = []
  for (let i = 0; i < itemCount; i += 1) {
    out.push(items[(startIndex + i) % items.length])
  }
  return out
}
