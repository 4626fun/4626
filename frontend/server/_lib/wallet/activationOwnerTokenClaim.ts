import type { Address } from 'viem'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{ rows: unknown[] }>
}

export type ActivationOwnerTokenClaimInput = {
  jti: string
  profileId: number
  privyUserId: string
  parentCswAddress: Address
  serverOwnerAddress: Address
  expiresAtMs: number
}

function normalizeJti(jti: string): string {
  const normalized = String(jti ?? '').trim()
  if (!normalized || normalized.length < 8 || normalized.length > 128) {
    throw new Error('activation_token_jti_invalid')
  }
  return normalized
}

export async function registerActivationOwnerTokenClaim(
  db: Db,
  input: ActivationOwnerTokenClaimInput,
): Promise<void> {
  const jti = normalizeJti(input.jti)
  await db.sql`
    INSERT INTO activation_owner_token_claims (
      jti,
      profile_id,
      privy_user_id,
      parent_csw_address,
      server_owner_address,
      expires_at
    ) VALUES (
      ${jti},
      ${Math.trunc(input.profileId)},
      ${String(input.privyUserId).trim()},
      ${input.parentCswAddress.toLowerCase()},
      ${input.serverOwnerAddress.toLowerCase()},
      ${new Date(input.expiresAtMs).toISOString()}
    )
    ON CONFLICT (jti) DO NOTHING;
  `
}

export async function assertActivationOwnerTokenClaimActive(
  db: Db,
  params: {
    jti: string
    profileId: number
    privyUserId: string
    parentCswAddress: Address
    serverOwnerAddress: Address
    nowMs?: number
  },
): Promise<void> {
  const jti = normalizeJti(params.jti)
  const nowIso = new Date(params.nowMs ?? Date.now()).toISOString()
  const result = await db.sql`
    SELECT jti, consumed_at, expires_at,
           profile_id, privy_user_id, parent_csw_address, server_owner_address
    FROM activation_owner_token_claims
    WHERE jti = ${jti}
    LIMIT 1;
  `
  const row = result.rows?.[0] as Record<string, unknown> | undefined
  if (!row) throw new Error('activation_token_claim_missing')
  if (row.consumed_at != null) throw new Error('activation_token_already_consumed')
  const expiresAt = Date.parse(String(row.expires_at ?? ''))
  if (!Number.isFinite(expiresAt) || expiresAt < Date.parse(nowIso)) {
    throw new Error('activation_token_claim_expired')
  }
  const bindingMatches =
    Number(row.profile_id) === Math.trunc(params.profileId) &&
    String(row.privy_user_id ?? '') === String(params.privyUserId).trim() &&
    String(row.parent_csw_address ?? '').toLowerCase() ===
      params.parentCswAddress.toLowerCase() &&
    String(row.server_owner_address ?? '').toLowerCase() ===
      params.serverOwnerAddress.toLowerCase()
  if (!bindingMatches) throw new Error('activation_token_claim_binding_mismatch')
}

export async function consumeActivationOwnerTokenClaim(
  db: Db,
  params: {
    jti: string
    profileId: number
    privyUserId: string
    nowMs?: number
  },
): Promise<void> {
  const jti = normalizeJti(params.jti)
  const nowIso = new Date(params.nowMs ?? Date.now()).toISOString()
  const result = await db.sql`
    UPDATE activation_owner_token_claims
    SET consumed_at = ${nowIso}
    WHERE jti = ${jti}
      AND profile_id = ${Math.trunc(params.profileId)}
      AND privy_user_id = ${String(params.privyUserId).trim()}
      AND consumed_at IS NULL
      AND expires_at >= ${nowIso}
    RETURNING jti;
  `
  if (!result.rows?.[0]) throw new Error('activation_token_consume_failed')
}
