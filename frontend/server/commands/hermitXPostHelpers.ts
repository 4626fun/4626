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
  if (/Failed to download Twitter media/i.test(String(tweetResponse ?? ''))) {
    return 'X cross-post skipped — could not fetch GIF for upload (broken host link).'
  }
  if (/does not have OAuth 1\.0a write permission/i.test(String(tweetResponse ?? ''))) {
    const accountMatch = String(tweetResponse ?? '').match(/account:\s*@([A-Za-z0-9_]+)/i)
    const accountLabel = accountMatch?.[1] ? ` (@${accountMatch[1]})` : ''
    return `X cross-post skipped — wrong or read-only X app${accountLabel}. Run \`/x status\` and verify \`HERMIT_TWITTER_*\` OAuth1 credentials.`
  }
  const detail = String(tweetResponse ?? '').trim().slice(0, 120) || 'posting unavailable'
  return `X cross-post skipped — ${detail}.`
}

