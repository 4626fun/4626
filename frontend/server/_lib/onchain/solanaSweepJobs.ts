import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'

import { ensureCanonicalWalletsSchema } from '../wallet/canonicalWalletsSchema.js'
import { ensureWalletOnchainOpsAuditSchema } from '../db/schemaBootstrap.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

type SweepStatus = 'pending' | 'retrying' | 'processing' | 'succeeded' | 'failed' | 'blocked' | 'cancelled'

type SolanaSweepJobRow = {
  id: number
  profile_id: number
  operational_wallet: string
  canonical_wallet: string
  min_lamports: string
  attempt_count: number
  max_attempts: number
  status: SweepStatus
  tx_sig: string | null
  last_error: string | null
  next_retry_at: string | null
  created_at: string
  updated_at: string
  idempotency_key: string
}

let schemaEnsured = false

function isSolanaAddress(value: unknown): value is string {
  const s = typeof value === 'string' ? value.trim() : ''
  if (!s) return false
  if (s.length < 32 || s.length > 44) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

function normalizeJobRow(row: any): SolanaSweepJobRow {
  return {
    id: Number(row?.id),
    profile_id: Number(row?.profile_id),
    operational_wallet: String(row?.operational_wallet ?? ''),
    canonical_wallet: String(row?.canonical_wallet ?? ''),
    min_lamports: String(row?.min_lamports ?? '0'),
    attempt_count: Number(row?.attempt_count ?? 0),
    max_attempts: Number(row?.max_attempts ?? 5),
    status: String(row?.status ?? 'pending') as SweepStatus,
    tx_sig: typeof row?.tx_sig === 'string' ? row.tx_sig : null,
    last_error: typeof row?.last_error === 'string' ? row.last_error : null,
    next_retry_at: row?.next_retry_at ? new Date(row.next_retry_at).toISOString() : null,
    created_at: new Date(row?.created_at ?? Date.now()).toISOString(),
    updated_at: new Date(row?.updated_at ?? Date.now()).toISOString(),
    idempotency_key: String(row?.idempotency_key ?? ''),
  }
}

function parseLamports(value: unknown, fallback: bigint): bigint {
  if (typeof value === 'bigint') return value >= 0n ? value : fallback
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return BigInt(Math.floor(value))
  if (typeof value === 'string' && value.trim()) {
    try {
      const v = BigInt(value.trim())
      return v >= 0n ? v : fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

function parseSignerFromEnv(raw: string): Keypair | null {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) return null
    const ints = parsed.map((v) => Number(v))
    if (!ints.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) return null
    return Keypair.fromSecretKey(Uint8Array.from(ints))
  } catch {
    return null
  }
}

function retryDelaySeconds(attempt: number): number {
  const clamped = Math.max(1, Math.min(attempt, 8))
  return Math.min(3600, 30 * 2 ** (clamped - 1))
}

export async function ensureSolanaSweepJobsSchema(db: Db): Promise<void> {
  if (schemaEnsured) return
  await ensureCanonicalWalletsSchema(db)
  await ensureWalletOnchainOpsAuditSchema(db as any)
  schemaEnsured = true
}

export async function enqueueSolanaSweepJob(params: {
  db: Db
  profileId: number
  operationalWallet: string
  canonicalWallet: string
  minLamports?: bigint | number | string
}): Promise<SolanaSweepJobRow> {
  const { db, profileId } = params
  const operationalWallet = String(params.operationalWallet || '').trim()
  const canonicalWallet = String(params.canonicalWallet || '').trim()
  if (!Number.isFinite(profileId) || profileId <= 0) throw new Error('invalid_profile_id')
  if (!isSolanaAddress(operationalWallet) || !isSolanaAddress(canonicalWallet)) throw new Error('invalid_solana_wallet')
  if (operationalWallet === canonicalWallet) throw new Error('operational_equals_canonical')
  await ensureSolanaSweepJobsSchema(db)

  const minLamports = parseLamports(params.minLamports, 50_000n)
  const idempotencyKey = `profile:${profileId}:from:${operationalWallet}:to:${canonicalWallet}`

  const existing = await db.sql`
    SELECT *
    FROM solana_sweep_jobs
    WHERE idempotency_key = ${idempotencyKey}
      AND status IN ('pending', 'retrying', 'processing')
    LIMIT 1;
  `
  const existingRow = existing?.rows?.[0]
  if (existingRow) return normalizeJobRow(existingRow)

  const created = await db.sql`
    INSERT INTO solana_sweep_jobs (
      profile_id,
      operational_wallet,
      canonical_wallet,
      min_lamports,
      idempotency_key,
      status,
      next_retry_at,
      updated_at
    )
    VALUES (
      ${profileId},
      ${operationalWallet},
      ${canonicalWallet},
      ${minLamports.toString()},
      ${idempotencyKey},
      'pending',
      NOW(),
      NOW()
    )
    RETURNING *;
  `
  const row = created?.rows?.[0]
  if (!row) throw new Error('enqueue_failed')
  return normalizeJobRow(row)
}

async function isProfileWalletOwnershipStillValid(params: {
  db: Db
  profileId: number
  canonicalWallet: string
  operationalWallet: string
}): Promise<boolean> {
  const { db, profileId, canonicalWallet, operationalWallet } = params
  const row = await db.sql`
    SELECT
      p.canonical_solana_wallet,
      p.solana_wallet,
      p.operational_solana_wallet,
      EXISTS (
        SELECT 1
        FROM profile_wallets pw
        LEFT JOIN wallets w ON LOWER(w.address) = LOWER(pw.address)
        WHERE pw.profile_id = p.id
          AND pw.address = ${canonicalWallet}
          AND pw.is_canonical_solana_wallet = true
          AND (LOWER(COALESCE(w.chain, '')) = 'solana' OR w.chain IS NULL)
      ) AS canonical_role_ok,
      EXISTS (
        SELECT 1
        FROM profile_wallets pw
        LEFT JOIN wallets w ON LOWER(w.address) = LOWER(pw.address)
        WHERE pw.profile_id = p.id
          AND pw.address = ${operationalWallet}
          AND pw.is_operational_solana_wallet = true
          AND (LOWER(COALESCE(w.chain, '')) = 'solana' OR w.chain IS NULL)
      ) AS operational_role_ok
    FROM profiles p
    WHERE p.id = ${profileId}
    LIMIT 1;
  `
  const profile = row?.rows?.[0] as any
  if (!profile) return false
  const profileCanonical = String(profile?.canonical_solana_wallet ?? profile?.solana_wallet ?? '').trim()
  const profileOperational = String(profile?.operational_solana_wallet ?? '').trim()
  const canonicalRoleOk = profile?.canonical_role_ok === true
  const operationalRoleOk = profile?.operational_role_ok === true
  return profileCanonical === canonicalWallet && profileOperational === operationalWallet && canonicalRoleOk && operationalRoleOk
}

async function setJobState(params: {
  db: Db
  jobId: number
  status: SweepStatus
  attemptCount?: number
  txSig?: string | null
  lastError?: string | null
  nextRetryAtSql?: Date | null
}): Promise<void> {
  const { db, jobId, status, attemptCount, txSig, lastError, nextRetryAtSql } = params
  await db.sql`
    UPDATE solana_sweep_jobs
    SET
      status = ${status},
      attempt_count = COALESCE(${attemptCount ?? null}, attempt_count),
      tx_sig = COALESCE(${txSig ?? null}, tx_sig),
      last_error = ${lastError ?? null},
      next_retry_at = ${nextRetryAtSql ?? null},
      updated_at = NOW()
    WHERE id = ${jobId};
  `
}

export async function processSolanaSweepJobs(params: {
  db: Db
  limit?: number
}): Promise<{ processed: number; succeeded: number; retried: number; blocked: number; failed: number; jobIds: number[] }> {
  const { db } = params
  const limit = Math.max(1, Math.min(Number(params.limit ?? 10), 50))
  await ensureSolanaSweepJobsSchema(db)

  const jobsResult = await db.sql`
    SELECT *
    FROM solana_sweep_jobs
    WHERE status IN ('pending', 'retrying')
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    ORDER BY created_at ASC
    LIMIT ${limit};
  `
  const jobs = (jobsResult?.rows ?? []).map(normalizeJobRow)
  if (jobs.length === 0) {
    return { processed: 0, succeeded: 0, retried: 0, blocked: 0, failed: 0, jobIds: [] }
  }

  const signerSecret = String(process.env.SOLANA_SWEEP_SIGNER_SECRET_KEY ?? '').trim()
  const signer = parseSignerFromEnv(signerSecret)
  const rpcUrl = String(process.env.SOLANA_SWEEP_RPC_URL ?? process.env.SOLANA_RPC_URL ?? '').trim()
  const reserveLamports = parseLamports(process.env.SOLANA_SWEEP_RESERVE_LAMPORTS, 5_000n)

  let connection: Connection | null = null
  if (signer && rpcUrl) {
    connection = new Connection(rpcUrl, 'confirmed')
  }

  let succeeded = 0
  let retried = 0
  let blocked = 0
  let failed = 0

  for (const job of jobs) {
    const attempt = Math.max(1, job.attempt_count + 1)
    await setJobState({ db, jobId: job.id, status: 'processing', attemptCount: attempt, lastError: null })

    const ownershipValid = await isProfileWalletOwnershipStillValid({
      db,
      profileId: job.profile_id,
      canonicalWallet: job.canonical_wallet,
      operationalWallet: job.operational_wallet,
    })
    if (!ownershipValid) {
      await setJobState({
        db,
        jobId: job.id,
        status: 'blocked',
        attemptCount: attempt,
        lastError: 'ownership_or_role_changed',
      })
      blocked += 1
      continue
    }

    if (!connection || !signer) {
      await setJobState({
        db,
        jobId: job.id,
        status: 'blocked',
        attemptCount: attempt,
        lastError: 'processor_signer_or_rpc_not_configured',
      })
      blocked += 1
      continue
    }

    const signerAddress = signer.publicKey.toBase58()
    if (signerAddress !== job.operational_wallet) {
      await setJobState({
        db,
        jobId: job.id,
        status: 'blocked',
        attemptCount: attempt,
        lastError: 'signer_does_not_match_operational_wallet',
      })
      blocked += 1
      continue
    }

    try {
      const canonicalPubkey = new PublicKey(job.canonical_wallet)
      const balance = await connection.getBalance(signer.publicKey, 'confirmed')
      const minLamports = parseLamports(job.min_lamports, 0n)
      const transferable = BigInt(balance) - reserveLamports
      if (transferable <= minLamports) {
        await setJobState({
          db,
          jobId: job.id,
          status: 'blocked',
          attemptCount: attempt,
          lastError: 'insufficient_transferable_balance',
        })
        blocked += 1
        continue
      }

      const lamports = Number(transferable)
      if (!Number.isFinite(lamports) || lamports <= 0) {
        throw new Error('invalid_transfer_amount')
      }

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: signer.publicKey,
          toPubkey: canonicalPubkey,
          lamports,
        }),
      )
      tx.feePayer = signer.publicKey
      tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash
      const sig = await connection.sendTransaction(tx, [signer], {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      })
      await connection.confirmTransaction(sig, 'confirmed')

      await setJobState({
        db,
        jobId: job.id,
        status: 'succeeded',
        attemptCount: attempt,
        txSig: sig,
        lastError: null,
      })
      succeeded += 1
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : 'solana_sweep_failed'
      if (attempt >= job.max_attempts) {
        await setJobState({
          db,
          jobId: job.id,
          status: 'failed',
          attemptCount: attempt,
          lastError: message,
        })
        failed += 1
      } else {
        const nextRetryAt = new Date(Date.now() + retryDelaySeconds(attempt) * 1000)
        await setJobState({
          db,
          jobId: job.id,
          status: 'retrying',
          attemptCount: attempt,
          lastError: message,
          nextRetryAtSql: nextRetryAt,
        })
        retried += 1
      }
    }
  }

  return {
    processed: jobs.length,
    succeeded,
    retried,
    blocked,
    failed,
    jobIds: jobs.map((job) => job.id),
  }
}

