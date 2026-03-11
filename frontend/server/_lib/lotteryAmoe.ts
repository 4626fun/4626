import { createHash, randomBytes } from 'node:crypto'

import { getDb } from './postgres.js'

declare const process: { env: Record<string, string | undefined> }

const AMOE_NONCE_TTL_SECONDS = 10 * 60 // 10m
const AMOE_MESSAGE_TITLE = '4626 Lottery AMOE Entry' as const
export const AMOE_CREDITS_PER_ENTRY = 100
export const AMOE_DAILY_TWITTER_CREDIT = 1

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

type AmoeNonceRecord = {
  wallet: `0x${string}`
  creatorCoin: `0x${string}`
  issuedAt: string
  expiresAt: string
  consumed: boolean
}

const memNonces = new Map<string, AmoeNonceRecord>()
const memCredits = new Map<string, number>()
const memDailyTwitterCheckins = new Set<string>()
let amoeSchemaEnsured = false

const eip1271Abi = [
  {
    type: 'function',
    name: 'isValidSignature',
    stateMutability: 'view',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'magicValue', type: 'bytes4' }],
  },
] as const

const EIP1271_MAGICVALUE = '0x1626ba7e'

const coinbaseSmartWalletOwnersAbi = [
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'nextOwnerIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

const lotteryAmoeAbi = [
  {
    type: 'function',
    name: 'getAmoeMessageHash',
    stateMutability: 'view',
    inputs: [
      { name: 'buyer', type: 'address' },
      { name: 'creatorCoin', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'submitAmoeEntry',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'buyer', type: 'address' },
      { name: 'creatorCoin', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'entryId', type: 'uint256' }],
  },
] as const

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function isBytes32Like(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(value)
}

function normalizeRpcUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (!t.startsWith('http://') && !t.startsWith('https://')) return `https://${t}`
  return t
}

function getBaseRpcUrls(): string[] {
  const fromEnv = (process.env.BASE_RPC_URL ?? '')
    .split(/[\s,]+/g)
    .map(normalizeRpcUrl)
    .filter((x): x is string => Boolean(x))
  const fallback = ['https://mainnet.base.org', 'https://base.llamarpc.com']
  return Array.from(new Set([...fromEnv, ...fallback]))
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

function nowIso(): string {
  return new Date().toISOString()
}

async function ensureAmoeSchema(db: Db): Promise<void> {
  if (amoeSchemaEnsured) return
  await db.sql`
    CREATE TABLE IF NOT EXISTS lottery_amoe_nonces (
      nonce TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      creator_coin TEXT NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ
    );
  `
  await db.sql`CREATE INDEX IF NOT EXISTS lottery_amoe_nonces_wallet_creator_idx ON lottery_amoe_nonces (wallet_address, creator_coin, expires_at);`

  await db.sql`
    CREATE TABLE IF NOT EXISTS lottery_amoe_entries (
      id BIGSERIAL PRIMARY KEY,
      nonce_hash TEXT NOT NULL UNIQUE,
      nonce TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      creator_coin TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'attested',
      attestation_deadline BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  await db.sql`
    CREATE TABLE IF NOT EXISTS lottery_amoe_credits (
      wallet_address TEXT PRIMARY KEY,
      credits BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  await db.sql`
    CREATE TABLE IF NOT EXISTS lottery_amoe_credit_ledger (
      id BIGSERIAL PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      delta BIGINT NOT NULL,
      reason TEXT NOT NULL,
      ref_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  await db.sql`CREATE INDEX IF NOT EXISTS lottery_amoe_credit_ledger_wallet_idx ON lottery_amoe_credit_ledger (wallet_address, created_at DESC);`
  await db.sql`
    CREATE TABLE IF NOT EXISTS lottery_amoe_daily_twitter_checkins (
      wallet_address TEXT NOT NULL,
      checkin_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (wallet_address, checkin_date)
    );
  `
  amoeSchemaEnsured = true
}

function normalizeWallet(wallet: `0x${string}`): `0x${string}` {
  return wallet.toLowerCase() as `0x${string}`
}

function dayKeyUtc(tsMs: number): string {
  return new Date(tsMs).toISOString().slice(0, 10)
}

function toCreditSnapshot(wallet: `0x${string}`, credits: number) {
  const normalizedCredits = Math.max(0, Math.floor(credits))
  const entriesAvailable = Math.floor(normalizedCredits / AMOE_CREDITS_PER_ENTRY)
  const nextEntryAtCredits =
    entriesAvailable > 0
      ? (entriesAvailable + 1) * AMOE_CREDITS_PER_ENTRY
      : AMOE_CREDITS_PER_ENTRY
  return {
    wallet,
    credits: normalizedCredits,
    creditsPerEntry: AMOE_CREDITS_PER_ENTRY,
    entriesAvailable,
    nextEntryAtCredits,
  }
}

export async function getAmoeCreditSnapshot(params: { wallet: `0x${string}` }): Promise<{
  wallet: `0x${string}`
  credits: number
  creditsPerEntry: number
  entriesAvailable: number
  nextEntryAtCredits: number
}> {
  const wallet = normalizeWallet(params.wallet)
  const db = await getDb()
  if (!db) {
    return toCreditSnapshot(wallet, memCredits.get(wallet) ?? 0)
  }

  await ensureAmoeSchema(db)
  const result = await db.sql`
    SELECT credits
    FROM lottery_amoe_credits
    WHERE wallet_address = ${wallet}
    LIMIT 1;
  `
  const row = result.rows?.[0]
  const credits = Number(row?.credits ?? 0)
  return toCreditSnapshot(wallet, Number.isFinite(credits) ? credits : 0)
}

export async function claimDailyTwitterCheckin(params: { wallet: `0x${string}` }): Promise<{
  wallet: `0x${string}`
  awarded: boolean
  awardedCredits: number
  credits: number
  creditsPerEntry: number
  entriesAvailable: number
}> {
  const wallet = normalizeWallet(params.wallet)
  const now = Date.now()
  const dayKey = dayKeyUtc(now)

  const db = await getDb()
  if (!db) {
    const memKey = `${wallet}:${dayKey}`
    const alreadyClaimed = memDailyTwitterCheckins.has(memKey)
    if (!alreadyClaimed) {
      memDailyTwitterCheckins.add(memKey)
      memCredits.set(wallet, (memCredits.get(wallet) ?? 0) + AMOE_DAILY_TWITTER_CREDIT)
    }
    const snapshot = toCreditSnapshot(wallet, memCredits.get(wallet) ?? 0)
    return {
      wallet,
      awarded: !alreadyClaimed,
      awardedCredits: alreadyClaimed ? 0 : AMOE_DAILY_TWITTER_CREDIT,
      credits: snapshot.credits,
      creditsPerEntry: snapshot.creditsPerEntry,
      entriesAvailable: snapshot.entriesAvailable,
    }
  }

  await ensureAmoeSchema(db)
  const inserted = await db.sql`
    INSERT INTO lottery_amoe_daily_twitter_checkins (wallet_address, checkin_date)
    VALUES (${wallet}, ${dayKey})
    ON CONFLICT (wallet_address, checkin_date) DO NOTHING
    RETURNING wallet_address;
  `
  const awarded = Boolean(inserted.rows?.[0]?.wallet_address)

  let credits = 0
  if (awarded) {
    const upsert = await db.sql`
      INSERT INTO lottery_amoe_credits (wallet_address, credits)
      VALUES (${wallet}, ${AMOE_DAILY_TWITTER_CREDIT})
      ON CONFLICT (wallet_address)
      DO UPDATE SET credits = lottery_amoe_credits.credits + ${AMOE_DAILY_TWITTER_CREDIT}, updated_at = NOW()
      RETURNING credits;
    `
    credits = Number(upsert.rows?.[0]?.credits ?? 0)
    await db.sql`
      INSERT INTO lottery_amoe_credit_ledger (wallet_address, delta, reason, ref_id)
      VALUES (${wallet}, ${AMOE_DAILY_TWITTER_CREDIT}, ${'twitter_daily_checkin'}, ${dayKey});
    `
  } else {
    const current = await db.sql`
      SELECT credits
      FROM lottery_amoe_credits
      WHERE wallet_address = ${wallet}
      LIMIT 1;
    `
    credits = Number(current.rows?.[0]?.credits ?? 0)
  }

  const snapshot = toCreditSnapshot(wallet, Number.isFinite(credits) ? credits : 0)
  return {
    wallet,
    awarded,
    awardedCredits: awarded ? AMOE_DAILY_TWITTER_CREDIT : 0,
    credits: snapshot.credits,
    creditsPerEntry: snapshot.creditsPerEntry,
    entriesAvailable: snapshot.entriesAvailable,
  }
}

export async function consumeAmoeCreditsForEntry(params: {
  wallet: `0x${string}`
  requiredCredits?: number
  refId?: string
}): Promise<{
  wallet: `0x${string}`
  consumed: number
  creditsRemaining: number
  creditsPerEntry: number
  entriesAvailable: number
}> {
  const wallet = normalizeWallet(params.wallet)
  const requiredCredits =
    typeof params.requiredCredits === 'number' && Number.isFinite(params.requiredCredits)
      ? Math.max(1, Math.floor(params.requiredCredits))
      : AMOE_CREDITS_PER_ENTRY

  const db = await getDb()
  if (!db) {
    const current = memCredits.get(wallet) ?? 0
    if (current < requiredCredits) throw new Error('insufficient_amoe_credits')
    const nextCredits = current - requiredCredits
    memCredits.set(wallet, nextCredits)
    const snapshot = toCreditSnapshot(wallet, nextCredits)
    return {
      wallet,
      consumed: requiredCredits,
      creditsRemaining: snapshot.credits,
      creditsPerEntry: snapshot.creditsPerEntry,
      entriesAvailable: snapshot.entriesAvailable,
    }
  }

  await ensureAmoeSchema(db)
  const updated = await db.sql`
    UPDATE lottery_amoe_credits
    SET credits = credits - ${requiredCredits}, updated_at = NOW()
    WHERE wallet_address = ${wallet}
      AND credits >= ${requiredCredits}
    RETURNING credits;
  `
  const row = updated.rows?.[0]
  if (!row) throw new Error('insufficient_amoe_credits')

  const creditsRemainingRaw = Number(row.credits ?? 0)
  const creditsRemaining = Number.isFinite(creditsRemainingRaw) ? creditsRemainingRaw : 0

  await db.sql`
    INSERT INTO lottery_amoe_credit_ledger (wallet_address, delta, reason, ref_id)
    VALUES (${wallet}, ${-requiredCredits}, ${'amoe_entry_spend'}, ${params.refId ?? ''});
  `

  const snapshot = toCreditSnapshot(wallet, creditsRemaining)
  return {
    wallet,
    consumed: requiredCredits,
    creditsRemaining: snapshot.credits,
    creditsPerEntry: snapshot.creditsPerEntry,
    entriesAvailable: snapshot.entriesAvailable,
  }
}

type AmoeMessageFields = {
  wallet: `0x${string}`
  creatorCoin: `0x${string}`
  nonce: `0x${string}`
  issuedAt: string
  expiresAt: string
  chainId: number
  lotteryManager: `0x${string}`
}

export function buildAmoeEntryMessage(fields: AmoeMessageFields): string {
  return [
    AMOE_MESSAGE_TITLE,
    '',
    `Wallet: ${fields.wallet}`,
    `Creator Coin: ${fields.creatorCoin}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
    `Expires At: ${fields.expiresAt}`,
    `Chain ID: ${fields.chainId}`,
    `Lottery Manager: ${fields.lotteryManager}`,
  ].join('\n')
}

function parseAmoeEntryMessage(message: string): AmoeMessageFields | null {
  if (typeof message !== 'string' || message.trim().length === 0) return null
  const lines = message.split('\n').map((line) => line.trim())
  if (lines[0] !== AMOE_MESSAGE_TITLE) return null

  const readField = (prefix: string): string | null => {
    const line = lines.find((l) => l.toLowerCase().startsWith(prefix.toLowerCase()))
    if (!line) return null
    const raw = line.slice(prefix.length).trim()
    return raw.length > 0 ? raw : null
  }

  const wallet = readField('Wallet:')
  const creatorCoin = readField('Creator Coin:')
  const nonce = readField('Nonce:')
  const issuedAt = readField('Issued At:')
  const expiresAt = readField('Expires At:')
  const chainIdRaw = readField('Chain ID:')
  const lotteryManager = readField('Lottery Manager:')
  if (!wallet || !creatorCoin || !nonce || !issuedAt || !expiresAt || !chainIdRaw || !lotteryManager) return null
  if (!isAddressLike(wallet) || !isAddressLike(creatorCoin) || !isAddressLike(lotteryManager)) return null
  if (!isBytes32Like(nonce)) return null
  const chainId = Number(chainIdRaw)
  if (!Number.isFinite(chainId)) return null

  return {
    wallet: wallet.toLowerCase() as `0x${string}`,
    creatorCoin: creatorCoin.toLowerCase() as `0x${string}`,
    nonce: nonce.toLowerCase() as `0x${string}`,
    issuedAt,
    expiresAt,
    chainId: Math.floor(chainId),
    lotteryManager: lotteryManager.toLowerCase() as `0x${string}`,
  }
}

export async function issueAmoeNonce(params: { wallet: `0x${string}`; creatorCoin: `0x${string}` }): Promise<{
  nonce: `0x${string}`
  issuedAt: string
  expiresAt: string
}> {
  const wallet = params.wallet.toLowerCase() as `0x${string}`
  const creatorCoin = params.creatorCoin.toLowerCase() as `0x${string}`
  const issuedAt = nowIso()
  const expiresAt = new Date(Date.now() + AMOE_NONCE_TTL_SECONDS * 1000).toISOString()
  const nonce = `0x${randomBytes(32).toString('hex')}` as `0x${string}`

  const db = await getDb()
  if (!db) {
    memNonces.set(nonce, { wallet, creatorCoin, issuedAt, expiresAt, consumed: false })
    return { nonce, issuedAt, expiresAt }
  }

  await ensureAmoeSchema(db)
  await db.sql`
    INSERT INTO lottery_amoe_nonces (nonce, wallet_address, creator_coin, expires_at)
    VALUES (${nonce}, ${wallet}, ${creatorCoin}, ${expiresAt});
  `
  return { nonce, issuedAt, expiresAt }
}

function encodeSignatureWrapper(ownerIndex: number, signatureData: `0x${string}`, encodeAbiParameters: any): `0x${string}` {
  return encodeAbiParameters(
    [
      {
        type: 'tuple' as const,
        components: [
          { name: 'ownerIndex', type: 'uint256' as const },
          { name: 'signatureData', type: 'bytes' as const },
        ],
      },
    ],
    [{ ownerIndex: BigInt(ownerIndex), signatureData }],
  )
}

async function verifyWalletMessageSignature(params: {
  wallet: `0x${string}`
  message: string
  signature: `0x${string}`
}): Promise<boolean> {
  const { verifyMessage, createPublicClient, hashMessage, http, encodeAbiParameters } = await import('viem')
  const { base } = await import('viem/chains')

  try {
    const ok = await verifyMessage({
      address: params.wallet,
      message: params.message,
      signature: params.signature,
    })
    if (ok) return true
  } catch {
    // fall through to EIP-1271 verification
  }

  const digest = hashMessage(params.message)
  for (const url of getBaseRpcUrls()) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(url, { timeout: 12_000 }),
      })
      const code = await client.getBytecode({ address: params.wallet })
      if (!code || code === '0x') continue

      let scanLimit = 16
      try {
        const ownerCountRaw = (await client.readContract({
          address: params.wallet,
          abi: coinbaseSmartWalletOwnersAbi,
          functionName: 'ownerCount',
          args: [],
        })) as bigint
        let upperBound = Number(ownerCountRaw)
        if (!Number.isFinite(upperBound) || upperBound < 0) upperBound = 0
        try {
          const nextOwnerIndexRaw = (await client.readContract({
            address: params.wallet,
            abi: coinbaseSmartWalletOwnersAbi,
            functionName: 'nextOwnerIndex',
            args: [],
          })) as bigint
          const nextOwnerIndex = Number(nextOwnerIndexRaw)
          if (Number.isFinite(nextOwnerIndex) && nextOwnerIndex > 0) upperBound = nextOwnerIndex
        } catch {
          // ignore and keep ownerCount bound
        }
        scanLimit = Math.min(Math.max(upperBound, 1), 128)
      } catch {
        // ignore and keep default scan limit
      }

      const candidateSignatures: `0x${string}`[] = [params.signature]
      for (let i = 0; i < scanLimit; i += 1) {
        candidateSignatures.push(encodeSignatureWrapper(i, params.signature, encodeAbiParameters))
      }

      for (const candidateSignature of candidateSignatures) {
        try {
          const magic = await client.readContract({
            address: params.wallet,
            abi: eip1271Abi,
            functionName: 'isValidSignature',
            args: [digest, candidateSignature],
          })
          if (String(magic).toLowerCase() === EIP1271_MAGICVALUE) return true
        } catch {
          continue
        }
      }
    } catch {
      continue
    }
  }

  return false
}

async function consumeAmoeNonce(params: { wallet: `0x${string}`; creatorCoin: `0x${string}`; nonce: `0x${string}` }): Promise<void> {
  const db = await getDb()
  if (!db) {
    const rec = memNonces.get(params.nonce)
    if (!rec) throw new Error('nonce_not_found')
    if (rec.consumed) throw new Error('nonce_used')
    if (rec.wallet !== params.wallet.toLowerCase()) throw new Error('nonce_wallet_mismatch')
    if (rec.creatorCoin !== params.creatorCoin.toLowerCase()) throw new Error('nonce_creator_mismatch')
    if (Date.parse(rec.expiresAt) < Date.now()) throw new Error('nonce_expired')
    rec.consumed = true
    memNonces.set(params.nonce, rec)
    return
  }

  await ensureAmoeSchema(db)
  const updated = await db.sql`
    UPDATE lottery_amoe_nonces
    SET consumed_at = NOW()
    WHERE nonce = ${params.nonce}
      AND wallet_address = ${params.wallet.toLowerCase()}
      AND creator_coin = ${params.creatorCoin.toLowerCase()}
      AND consumed_at IS NULL
      AND expires_at > NOW()
    RETURNING nonce;
  `
  if (!updated.rows?.[0]?.nonce) throw new Error('nonce_invalid_or_used')
}

export async function verifyAmoeEntryProof(params: {
  creatorCoin: `0x${string}`
  message: string
  signature: `0x${string}`
  lotteryManager: `0x${string}`
}): Promise<{
  wallet: `0x${string}`
  creatorCoin: `0x${string}`
  nonce: `0x${string}`
  expiresAt: string
}> {
  const parsed = parseAmoeEntryMessage(params.message)
  if (!parsed) throw new Error('invalid_message')
  if (parsed.creatorCoin !== params.creatorCoin.toLowerCase()) throw new Error('creator_mismatch')
  if (parsed.lotteryManager !== params.lotteryManager.toLowerCase()) throw new Error('lottery_manager_mismatch')
  if (parsed.chainId !== 8453) throw new Error('invalid_chain')
  if (Date.parse(parsed.expiresAt) <= Date.now()) throw new Error('message_expired')

  const ok = await verifyWalletMessageSignature({
    wallet: parsed.wallet,
    message: params.message,
    signature: params.signature,
  })
  if (!ok) throw new Error('signature_invalid')

  await consumeAmoeNonce({
    wallet: parsed.wallet,
    creatorCoin: parsed.creatorCoin,
    nonce: parsed.nonce,
  })

  return {
    wallet: parsed.wallet,
    creatorCoin: parsed.creatorCoin,
    nonce: parsed.nonce,
    expiresAt: parsed.expiresAt,
  }
}

export async function createAmoeAttestation(params: {
  wallet: `0x${string}`
  creatorCoin: `0x${string}`
  nonce: `0x${string}`
  expiresAt: string
  lotteryManager: `0x${string}`
}): Promise<{
  buyer: `0x${string}`
  creatorCoin: `0x${string}`
  nonce: `0x${string}`
  deadline: number
  signature: `0x${string}`
  callData: `0x${string}`
  to: `0x${string}`
}> {
  const pkRaw = (process.env.LOTTERY_AMOE_SIGNER_PRIVATE_KEY ?? '').trim()
  if (!/^0x[a-fA-F0-9]{64}$/.test(pkRaw)) {
    throw new Error('amoe_signer_private_key_missing')
  }
  const expiresAtMs = Date.parse(params.expiresAt)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new Error('message_expired')
  }
  if (!isBytes32Like(params.nonce)) throw new Error('invalid_nonce')

  const { createPublicClient, encodeFunctionData, http } = await import('viem')
  const { base } = await import('viem/chains')
  const { privateKeyToAccount } = await import('viem/accounts')

  // Keep attestation TTL short and bounded by the user challenge expiry.
  const nowSec = Math.floor(Date.now() / 1000)
  const maxDeadlineSec = nowSec + 15 * 60
  const expiresSec = Math.floor(expiresAtMs / 1000)
  const deadline = Math.min(maxDeadlineSec, expiresSec)
  if (deadline <= nowSec) throw new Error('message_expired')
  let amoeMessageHash: `0x${string}` | null = null
  for (const url of getBaseRpcUrls()) {
    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(url, { timeout: 12_000 }),
      })
      amoeMessageHash = await publicClient.readContract({
        address: params.lotteryManager,
        abi: lotteryAmoeAbi,
        functionName: 'getAmoeMessageHash',
        args: [params.wallet, params.creatorCoin, params.nonce, BigInt(deadline)],
      })
      break
    } catch {
      continue
    }
  }
  if (!amoeMessageHash) throw new Error('amoe_hash_read_failed')

  const signer = privateKeyToAccount(pkRaw as `0x${string}`)
  const signature = await signer.signMessage({ message: { raw: amoeMessageHash } })

  const callData = encodeFunctionData({
    abi: lotteryAmoeAbi,
    functionName: 'submitAmoeEntry',
    args: [params.wallet, params.creatorCoin, params.nonce, BigInt(deadline), signature],
  })

  const db = await getDb()
  if (db) {
    await ensureAmoeSchema(db)
    const nonceHash = sha256Hex(params.nonce)
    await db.sql`
      INSERT INTO lottery_amoe_entries (nonce_hash, nonce, wallet_address, creator_coin, attestation_deadline)
      VALUES (${nonceHash}, ${params.nonce}, ${params.wallet.toLowerCase()}, ${params.creatorCoin.toLowerCase()}, ${deadline})
      ON CONFLICT (nonce_hash) DO NOTHING;
    `
  }

  return {
    buyer: params.wallet,
    creatorCoin: params.creatorCoin,
    nonce: params.nonce,
    deadline,
    signature,
    callData,
    to: params.lotteryManager,
  }
}
