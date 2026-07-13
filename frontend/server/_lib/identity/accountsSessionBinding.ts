import type { VercelRequest } from '@vercel/node'

import { readSessionFromRequest } from '../../auth/_shared.js'

type DbLike = {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{ rows?: any[] }>
}

export class AccountsSessionBindingError extends Error {
  readonly code = 'ACCOUNT_SESSION_IDENTITY_MISMATCH'

  constructor(message = 'Your Privy session does not match the signed-in 4626 account. Sign out and sign in again.') {
    super(message)
    this.name = 'AccountsSessionBindingError'
  }
}

export function isAccountsSessionBindingError(error: unknown): error is AccountsSessionBindingError {
  return (
    error instanceof AccountsSessionBindingError ||
    (typeof (error as { code?: unknown })?.code === 'string' &&
      (error as { code: string }).code === 'ACCOUNT_SESSION_IDENTITY_MISMATCH')
  )
}

/**
 * Bind a Privy-token mutation to the profile represented by the HttpOnly 4626
 * session. A token alone is insufficient: otherwise a restored Privy identity
 * could mutate a different email-joined profile whose cookie remained active.
 */
export async function assertAccountsSessionMatchesPrivyUser(params: {
  db: DbLike
  req: VercelRequest
  privyUserId: string
}): Promise<{ profileId: number }> {
  const session = readSessionFromRequest(params.req)
  const address = session?.address?.trim().toLowerCase() ?? ''
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    throw new AccountsSessionBindingError('Your 4626 session expired. Sign in again before changing linked accounts.')
  }

  const result = await params.db.sql`
    SELECT DISTINCT p.id, p.privy_user_id
    FROM profiles p
    LEFT JOIN profile_wallets pw
      ON pw.profile_id = p.id
    WHERE
      p.merged_into_profile_id IS NULL
      AND (
        LOWER(COALESCE(p.primary_wallet, '')) = ${address}
        OR LOWER(COALESCE(p.csw_address, '')) = ${address}
        OR LOWER(COALESCE(p.primary_embedded_eoa, '')) = ${address}
        OR LOWER(COALESCE(p.embedded_wallet, '')) = ${address}
        OR LOWER(COALESCE(pw.address, '')) = ${address}
      )
    LIMIT 2;
  `

  const rows = Array.isArray(result.rows) ? result.rows : []
  if (rows.length !== 1) {
    throw new AccountsSessionBindingError(
      rows.length > 1
        ? 'This wallet resolves to multiple 4626 accounts. Use account recovery before changing linked accounts.'
        : 'Your signed-in wallet is not attached to an active 4626 profile. Sign in again.',
    )
  }

  const row = rows[0] as { id?: unknown; privy_user_id?: unknown }
  const boundPrivyUserId = typeof row.privy_user_id === 'string' ? row.privy_user_id.trim() : ''
  if (!boundPrivyUserId || boundPrivyUserId !== params.privyUserId) {
    throw new AccountsSessionBindingError()
  }

  const profileId = Number(row.id)
  if (!Number.isSafeInteger(profileId) || profileId <= 0) {
    throw new AccountsSessionBindingError()
  }
  return { profileId }
}
