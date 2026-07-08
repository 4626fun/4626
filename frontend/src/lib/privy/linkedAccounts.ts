/** Shared low-level reader for Privy's `user.linkedAccounts` (or snake_case `linked_accounts`). */
export function readPrivyLinkedAccounts(user: unknown): unknown[] {
  const record = user && typeof user === 'object' ? (user as Record<string, unknown>) : null
  if (!record) return []
  const camel = Array.isArray(record.linkedAccounts) ? record.linkedAccounts : []
  const snake = Array.isArray(record.linked_accounts) ? record.linked_accounts : []
  return [...camel, ...snake]
}

/**
 * Reads the linked X/Twitter handle straight from Privy's client-side user
 * object. `accountMe.linkedMethods.twitter` mixes several candidate values
 * (subject, userId, username) in a non-guaranteed order, so it isn't safe to
 * index into for display — this reads the `username` field directly off the
 * matching linked account instead.
 */
function isLinkedTwitterAccount(record: Record<string, unknown>): boolean {
  const type = String(record.type ?? '').trim().toLowerCase()
  return type.includes('twitter') || type === 'x'
}

export function findLinkedTwitterHandle(user: unknown): string | null {
  for (const account of readPrivyLinkedAccounts(user)) {
    const record = account && typeof account === 'object' ? (account as Record<string, unknown>) : null
    if (!record || !isLinkedTwitterAccount(record)) continue
    const username = typeof record.username === 'string' ? record.username.trim() : ''
    if (username) return username.replace(/^@+/, '')
  }
  return null
}

/** Privy `unlinkTwitter` / `unlinkOAuth` require the linked account `subject`, not the handle. */
export function findLinkedTwitterSubject(user: unknown): string | null {
  for (const account of readPrivyLinkedAccounts(user)) {
    const record = account && typeof account === 'object' ? (account as Record<string, unknown>) : null
    if (!record || !isLinkedTwitterAccount(record)) continue
    const subject = typeof record.subject === 'string' ? record.subject.trim() : ''
    if (subject) return subject
  }
  return null
}
