/**
 * Pure helpers for Hermit → X cross-post copy (uniquify text, duplicate detection).
 */

export function truncateWithEllipsis(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  if (maxLength <= 1) return '…'
  return `${value.slice(0, maxLength - 1).trimEnd()}…`
}

export function isTwitterDuplicateContentError(message: string): boolean {
  return /duplicate content/i.test(String(message ?? ''))
}

export function formatHermitXCrossPostSkipMessage(tweetResponse: string): string {
  if (isTwitterDuplicateContentError(tweetResponse)) {
    return 'X cross-post skipped — already posted this meme recently.'
  }
  const detail = String(tweetResponse ?? '').trim().slice(0, 120) || 'posting unavailable'
  return `X cross-post skipped — ${detail}.`
}

