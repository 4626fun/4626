export type OAuthReturnSyncProvider = 'google' | 'apple' | 'twitter' | 'tiktok'

export const OAUTH_RETURN_SYNC_PROVIDERS: readonly OAuthReturnSyncProvider[] = [
  'google',
  'apple',
  'twitter',
  'tiktok',
]

function normalizeLower(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function readPrivyLinkedAccounts(user: unknown): unknown[] {
  const record = user && typeof user === 'object' ? (user as Record<string, unknown>) : null
  if (!record) return []
  const camel = Array.isArray(record.linkedAccounts) ? record.linkedAccounts : []
  const snake = Array.isArray(record.linked_accounts) ? record.linked_accounts : []
  return [...camel, ...snake]
}

const PROVIDER_TYPE_MATCHERS: Record<OAuthReturnSyncProvider, (type: string) => boolean> = {
  google: (type) => type.includes('google'),
  apple: (type) => type.includes('apple'),
  twitter: (type) => type.includes('twitter') || type === 'x',
  tiktok: (type) => type.includes('tiktok'),
}

export function isPrivyProviderLinked(user: unknown, provider: OAuthReturnSyncProvider): boolean {
  const matches = PROVIDER_TYPE_MATCHERS[provider]
  for (const account of readPrivyLinkedAccounts(user)) {
    const record = account && typeof account === 'object' ? (account as Record<string, unknown>) : null
    if (!record) continue
    if (matches(normalizeLower(record.type))) return true
  }
  return false
}
