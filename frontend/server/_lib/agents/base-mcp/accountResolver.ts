import { getDb, isDbConfigured } from '../../db/postgres.js'

export type BaseMcpAccountExecutionContext = {
  userId: string
  canonicalSender: string | null
  eoaSender: string | null
}

const normalizeAddress = (value: unknown): string | null => {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!candidate) return null
  if (!/^0x[a-f0-9]{40}$/.test(candidate)) return null
  return candidate
}

function parseProfileId(userId: string): number | null {
  const trimmed = userId.trim()
  const withoutPrefix = trimmed.toLowerCase().startsWith('profile:') ? trimmed.slice('profile:'.length) : trimmed
  if (!/^\d+$/.test(withoutPrefix)) return null
  const parsed = Number(withoutPrefix)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function parseEnvAccountMap(): Record<string, BaseMcpAccountExecutionContext> {
  const raw = (process.env.BASE_MCP_ACCOUNT_SENDERS_JSON ?? '').trim()
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    const entries: Record<string, BaseMcpAccountExecutionContext> = {}
    for (const [userId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!userId.trim() || !value || typeof value !== 'object' || Array.isArray(value)) continue
      const record = value as Record<string, unknown>
      entries[userId] = {
        userId,
        canonicalSender: normalizeAddress(record.canonicalSender),
        eoaSender: normalizeAddress(record.eoaSender),
      }
    }
    return entries
  } catch {
    return {}
  }
}

function deriveEoaSender(row: Record<string, unknown>, canonicalSender: string | null): string | null {
  const primaryWallet = normalizeAddress(row.primary_wallet)
  if (!primaryWallet) return null
  if (canonicalSender && primaryWallet === canonicalSender) return null
  return primaryWallet
}

async function resolveFromProfiles(userId: string): Promise<BaseMcpAccountExecutionContext | null> {
  if (!isDbConfigured()) return null
  const db = await getDb()
  if (!db) return null

  try {
    const profileId = parseProfileId(userId)
    const result = profileId
      ? await db.sql`
          SELECT id, primary_wallet, primary_embedded_eoa, primary_smart_wallet, csw_address
          FROM profiles
          WHERE id = ${profileId}
            AND merged_into_profile_id IS NULL
          LIMIT 1;
        `
      : await db.sql`
          SELECT id, primary_wallet, primary_embedded_eoa, primary_smart_wallet, csw_address
          FROM profiles
          WHERE privy_user_id = ${userId}
            AND merged_into_profile_id IS NULL
          LIMIT 1;
        `

    const row = result.rows?.[0] as Record<string, unknown> | undefined
    if (!row) return null

    const canonicalSender = normalizeAddress(row.csw_address) ?? normalizeAddress(row.primary_smart_wallet)
    const embeddedOwner = normalizeAddress(row.primary_embedded_eoa)

    return {
      userId,
      // User-initiated canonical routing is only ready when the account has both
      // the canonical parent CSW and its embedded EOA signer recorded. This keeps
      // Base MCP from treating a linked profile as execution-ready.
      canonicalSender: canonicalSender && embeddedOwner ? canonicalSender : null,
      eoaSender: deriveEoaSender(row, canonicalSender),
    }
  } catch {
    return null
  }
}

export async function resolveBaseMcpAccountExecutionContext(
  userId: string,
): Promise<BaseMcpAccountExecutionContext | null> {
  const trimmed = userId.trim()
  if (!trimmed) return null

  const fromProfiles = await resolveFromProfiles(trimmed)
  if (fromProfiles) return fromProfiles

  return parseEnvAccountMap()[trimmed] ?? null
}
