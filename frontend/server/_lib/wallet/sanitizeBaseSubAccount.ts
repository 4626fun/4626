import type { PrivyUserLike } from './walletMapping.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

/**
 * Sub-accounts are retired from user-facing execution surfaces.
 * Parent CSW + embedded-owner install is the only waitlist/app track.
 */
export async function sanitizePersistedSubAccountAddress(_params: {
  db: Db
  profileId: number
  canonicalCswAddress: string | null | undefined
  baseSubAccountAddress: string | null | undefined
  privyUser: PrivyUserLike | null
}): Promise<string | null> {
  return null
}
