type LensAccount = {
  address: string
  owner: string | null
  username: {
    value: string | null
    localName: string | null
  } | null
  metadata: {
    name: string | null
    picture: unknown
  } | null
}

export type LensUser = {
  displayName: string
  handle: string | null
  username: string | null
  avatar: string | null
  accountAddress: string
  ownerAddress: string | null
}

const LENS_API_URL = 'https://api.lens.xyz/graphql'
const LENS_SERVER_API_KEY = process.env.LENS_SERVER_API_KEY ?? ''

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function extractLensPictureUrl(value: unknown): string | null {
  const direct = getString(value)
  if (direct) return direct
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return (
    getString(record.uri) ??
    getString(record.url) ??
    getString(record.optimized) ??
    getString(record.original) ??
    null
  )
}

function normalizeLensHandle(input: LensAccount['username']): string | null {
  const local = getString(input?.localName)
  if (local) return local
  const value = getString(input?.value)
  if (!value) return null
  if (value.includes('/')) {
    const last = value.slice(value.lastIndexOf('/') + 1)
    return getString(last)
  }
  return value
}

function pickBestLensAccount(accounts: LensAccount[]): LensAccount | null {
  if (!accounts.length) return null
  const score = (account: LensAccount): number => {
    let rank = 0
    if (normalizeLensHandle(account.username)) rank += 3
    if (getString(account.metadata?.name)) rank += 2
    if (extractLensPictureUrl(account.metadata?.picture)) rank += 1
    return rank
  }
  return [...accounts].sort((a, b) => score(b) - score(a))[0] ?? null
}

async function fetchLensAccounts(request: { ownedBy?: string[] }): Promise<LensAccount[]> {
  const hasOwnedBy = Array.isArray(request.ownedBy) && request.ownedBy.length > 0
  if (!hasOwnedBy) return []

  const body = {
    query: `
      query AccountsBulk($request: AccountsBulkRequest!) {
        accountsBulk(request: $request) {
          address
          owner
          username {
            value
            localName
          }
          metadata {
            name
            picture
          }
        }
      }
    `,
    variables: { request },
  }

  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (LENS_SERVER_API_KEY) {
    headers['x-api-key'] = LENS_SERVER_API_KEY
  }

  const res = await fetch(LENS_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) return []

  const payload = (await res.json().catch(() => null)) as
    | { data?: { accountsBulk?: unknown }; errors?: unknown[] }
    | null
  if (!payload || !payload.data || !Array.isArray(payload.data.accountsBulk)) return []

  return payload.data.accountsBulk
    .map((item): LensAccount | null => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const address = getString(row.address)
      if (!address) return null
      const owner = getString(row.owner)
      const usernameValue =
        row.username && typeof row.username === 'object'
          ? (row.username as Record<string, unknown>)
          : null
      const metadata =
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : null
      const username = usernameValue
        ? { value: getString(usernameValue.value), localName: getString(usernameValue.localName) }
        : null
      return {
        address,
        owner,
        username,
        metadata: metadata ? { name: getString(metadata.name), picture: metadata.picture } : null,
      }
    })
    .filter((item): item is LensAccount => Boolean(item))
}

export async function resolveLensUserByOwner(address: string): Promise<LensUser | null> {
  const accounts = await fetchLensAccounts({ ownedBy: [address] })
  const best = pickBestLensAccount(accounts)
  if (!best) return null

  const handle = normalizeLensHandle(best.username)
  const displayName = getString(best.metadata?.name) ?? (handle ? `@${handle}` : best.address)
  const avatar = extractLensPictureUrl(best.metadata?.picture)

  return {
    displayName,
    handle,
    username: getString(best.username?.value),
    avatar,
    accountAddress: best.address,
    ownerAddress: best.owner,
  }
}
