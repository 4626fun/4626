const MAD_SCALE = 1.4826
const EPSILON = 1e-12

export function median(values: number[]): number | null {
  const finite = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (finite.length === 0) return null
  const mid = Math.floor(finite.length / 2)
  if (finite.length % 2 === 0) {
    return (finite[mid - 1]! + finite[mid]!) / 2
  }
  return finite[mid]!
}

export function mad(values: number[], center?: number): number | null {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return null
  const med = center ?? median(finite)
  if (med == null) return null
  return median(finite.map((value) => Math.abs(value - med)))
}

/**
 * Robust z-score:
 * z = (x − median_W) / (1.4826 · MAD_W + ε)
 */
export function madZ(value: number | null, window: number[]): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const finite = window.filter((entry) => Number.isFinite(entry))
  if (finite.length < 3) return null
  const med = median(finite)
  if (med == null) return null
  const deviation = mad(finite, med)
  if (deviation == null) return null
  return (value - med) / (MAD_SCALE * deviation + EPSILON)
}

export function clip01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
