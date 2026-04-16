type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

type EmailCollisionSource = 'accounts' | 'profiles'

export type IdentityRecoveryRequiredError = Error & {
  code: 'IDENTITY_RECOVERY_REQUIRED'
  reason: 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER'
  email: string
  requestedPrivyUserId: string
  existingPrivyUserId: string
  source: EmailCollisionSource
}

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeEmail(value: unknown): string | null {
  const email = normalizeLower(value)
  if (!email) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

function isMissingRelationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return lower.includes('does not exist') && lower.includes('relation')
}

function buildEmailCollisionError(params: {
  email: string
  requestedPrivyUserId: string
  existingPrivyUserId: string
  source: EmailCollisionSource
}): IdentityRecoveryRequiredError {
  const error = new Error(
    `Recovery required: email "${params.email}" is already linked to a different Privy account.`,
  ) as IdentityRecoveryRequiredError
  error.code = 'IDENTITY_RECOVERY_REQUIRED'
  error.reason = 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER'
  error.email = params.email
  error.requestedPrivyUserId = params.requestedPrivyUserId
  error.existingPrivyUserId = params.existingPrivyUserId
  error.source = params.source
  return error
}

async function readBoundPrivyUserIdFromAccounts(db: Db, email: string): Promise<string | null> {
  try {
    const result = await db.sql`
      SELECT privy_user_id
      FROM accounts
      WHERE LOWER(email) = LOWER(${email})
        AND privy_user_id IS NOT NULL
      LIMIT 1;
    `
    return normalizeLower(result.rows?.[0]?.privy_user_id) || null
  } catch (error) {
    if (isMissingRelationError(error)) return null
    throw error
  }
}

async function readBoundPrivyUserIdFromProfiles(db: Db, email: string): Promise<string | null> {
  try {
    const result = await db.sql`
      SELECT privy_user_id
      FROM profiles
      WHERE LOWER(email) = LOWER(${email})
        AND privy_user_id IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
      LIMIT 1;
    `
    return normalizeLower(result.rows?.[0]?.privy_user_id) || null
  } catch (error) {
    if (isMissingRelationError(error)) return null
    throw error
  }
}

export async function assertNoEmailPrivyCollision(params: {
  db: Db
  email: string | null | undefined
  privyUserId: string | null | undefined
}): Promise<void> {
  const email = normalizeEmail(params.email)
  const requestedPrivyUserId = normalizeLower(params.privyUserId)
  if (!email || !requestedPrivyUserId) return

  const boundInAccounts = await readBoundPrivyUserIdFromAccounts(params.db, email)
  if (boundInAccounts && boundInAccounts !== requestedPrivyUserId) {
    throw buildEmailCollisionError({
      email,
      requestedPrivyUserId,
      existingPrivyUserId: boundInAccounts,
      source: 'accounts',
    })
  }

  const boundInProfiles = await readBoundPrivyUserIdFromProfiles(params.db, email)
  if (boundInProfiles && boundInProfiles !== requestedPrivyUserId) {
    throw buildEmailCollisionError({
      email,
      requestedPrivyUserId,
      existingPrivyUserId: boundInProfiles,
      source: 'profiles',
    })
  }
}

export function isIdentityRecoveryRequiredError(error: unknown): error is IdentityRecoveryRequiredError {
  return (
    Boolean(error) &&
    typeof error === 'object' &&
    (error as { code?: unknown }).code === 'IDENTITY_RECOVERY_REQUIRED' &&
    (error as { reason?: unknown }).reason === 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER'
  )
}
