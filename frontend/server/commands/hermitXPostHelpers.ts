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

/**
 * Twitter rejects identical tweet text (especially with the same media).
 * Append meme id + compact UTC stamp so repeated /gmeow drops stay distinct.
 */
export function uniquifyHermitTweetCaption(
  caption: string,
  params: { memeId?: string | null; mediaUrl?: string | null; now?: () => number },
): string {
  const base = caption.trim() || 'Hermit meme drop'
  const tags: string[] = []
  const memeId = String(params.memeId ?? '').trim()
  if (memeId) tags.push(memeId)

  const mediaUrl = String(params.mediaUrl ?? '').trim()
  if (mediaUrl) {
    try {
      const path = new URL(mediaUrl).pathname.split('/').filter(Boolean).pop() ?? ''
      if (path && path.length <= 32) tags.push(path)
    } catch {
      // ignore invalid URL
    }
  }

  const now = params.now ?? Date.now
  const utc = new Date(now()).toISOString().slice(0, 16).replace('T', ' ')
  tags.push(utc)

  const suffix = tags.length > 0 ? ` · ${tags.join(' · ')}` : ''
  return truncateWithEllipsis(`${base}${suffix}`, 280)
}
