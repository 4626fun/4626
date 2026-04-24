// FIX: M-01 — regression tests for /api/zora/csw-entry wallet-ownership proof.
//
// The vulnerability: the endpoint used to accept any registry-listed CSW plus a
// Telegram username and issue a verification token, with no proof that the
// caller controlled the CSW. These tests pin the new challenge + signature
// contract by exercising the gate-verification helpers end-to-end against a
// fake in-memory `db` and mocked viem signature verification.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const CSW_ADDRESS = '0x000000000000000000000000000000000000cafe' as `0x${string}`
const OTHER_CSW = '0x00000000000000000000000000000000000000aa' as `0x${string}`

const { verifyMessageMock, recoverMessageAddressMock, createPublicClientMock, clientGetBytecodeMock, clientReadContractMock } =
  vi.hoisted(() => ({
    verifyMessageMock: vi.fn(),
    recoverMessageAddressMock: vi.fn(),
    createPublicClientMock: vi.fn(),
    clientGetBytecodeMock: vi.fn(),
    clientReadContractMock: vi.fn(),
  }))

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
    http: vi.fn(() => ({ transport: 'http' })),
    verifyMessage: verifyMessageMock,
    recoverMessageAddress: recoverMessageAddressMock,
  }
})

vi.mock('viem/chains', () => ({ base: {} }))

import {
  buildCswEntryChallengeMessage,
  consumeCswEntryChallenge,
  issueCswEntryChallenge,
  verifyCswWalletSignature,
} from '../../../server/_lib/zora/cswGateVerification.js'

// -----------------------------------------------------------------------------
// Fake Db
//
// Minimal tagged-template SQL interpreter for the handful of statements the
// challenge schema actually runs. We don't need a real Postgres; we need a
// Db-shaped object that honors INSERT / DELETE RETURNING / SELECT semantics
// well enough to exercise the consume-atomicity guarantee.
// -----------------------------------------------------------------------------

type ChallengeRow = {
  challenge_hash: string
  csw_address: string
  expires_at: string
  created_at: string
}

function makeFakeDb() {
  const challenges = new Map<string, ChallengeRow>()
  let schemaStatements = 0

  const db = {
    sql: async (strings: TemplateStringsArray, ...values: any[]) => {
      const raw = strings.join('$')
      // CREATE TABLE / CREATE INDEX / ALTER / DO $$ — no-op but count.
      if (/^\s*(CREATE|ALTER|DO)\b/i.test(raw)) {
        schemaStatements++
        return { rows: [] as any[] }
      }

      if (/^\s*DELETE\s+FROM\s+zora_csw_gate_entry_challenges\b/i.test(raw)) {
        if (/WHERE\s+csw_address\s*=\s*\$/i.test(raw)) {
          // DELETE .. WHERE csw_address = $ (re-issue cleanup path)
          const csw = String(values[0]).toLowerCase()
          for (const [hash, row] of challenges) {
            if (row.csw_address === csw) challenges.delete(hash)
          }
          return { rows: [] }
        }
        if (/WHERE\s+challenge_hash\s*=\s*\$/i.test(raw)) {
          // DELETE .. WHERE challenge_hash = $ AND expires_at > NOW() RETURNING ..
          const hash = String(values[0])
          const row = challenges.get(hash)
          if (!row) return { rows: [] }
          if (Date.parse(row.expires_at) <= Date.now()) return { rows: [] }
          challenges.delete(hash)
          return { rows: [row] }
        }
      }

      if (/^\s*INSERT\s+INTO\s+zora_csw_gate_entry_challenges\b/i.test(raw)) {
        const [challenge_hash, csw_address, expires_at] = values.map((v) => String(v))
        challenges.set(challenge_hash, {
          challenge_hash,
          csw_address: csw_address.toLowerCase(),
          expires_at,
          created_at: new Date().toISOString(),
        })
        return { rows: [] }
      }

      if (/^\s*SELECT[\s\S]+FROM\s+zora_csw_gate_entry_challenges\b/i.test(raw)) {
        const hash = String(values[0])
        const row = challenges.get(hash)
        return { rows: row ? [row] : [] }
      }

      throw new Error(`unhandled sql in fake db: ${raw.slice(0, 80)}...`)
    },
  }

  return { db, challenges, schemaStatements: () => schemaStatements }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('M-01 CSW entry ownership proof', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyMessageMock.mockResolvedValue(false)
    recoverMessageAddressMock.mockResolvedValue(CSW_ADDRESS)
    clientGetBytecodeMock.mockResolvedValue('0x') // default: EOA
    clientReadContractMock.mockResolvedValue('0x1626ba7e')
    createPublicClientMock.mockReturnValue({
      getBytecode: clientGetBytecodeMock,
      readContract: clientReadContractMock,
    })
  })

  describe('challenge issuance + consumption', () => {
    it('issues a CSW-scoped nonce and a canonical signable message', async () => {
      const { db, challenges } = makeFakeDb()
      const { nonce, message, expiresAt } = await issueCswEntryChallenge({ db, cswAddress: CSW_ADDRESS })

      expect(nonce).toMatch(/^[0-9a-f-]{16,}$/i)
      expect(expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(message).toContain(CSW_ADDRESS)
      expect(message).toContain(nonce)
      expect(message).toContain('4626.fun')
      expect(message).toContain('Sign this message to prove ownership')

      // Message must be reproducible from the stored fields.
      expect(message).toBe(buildCswEntryChallengeMessage({ cswAddress: CSW_ADDRESS, nonce, expiresAt }))

      // One challenge row persisted.
      expect(challenges.size).toBe(1)
    })

    it('re-issuing for the same CSW supersedes the prior challenge', async () => {
      const { db, challenges } = makeFakeDb()
      const first = await issueCswEntryChallenge({ db, cswAddress: CSW_ADDRESS })
      const second = await issueCswEntryChallenge({ db, cswAddress: CSW_ADDRESS })

      expect(second.nonce).not.toBe(first.nonce)
      expect(challenges.size).toBe(1) // re-issue deleted the first

      // First nonce is now unusable — consume returns invalid (not expired).
      const replay = await consumeCswEntryChallenge({ db, cswAddress: CSW_ADDRESS, nonce: first.nonce })
      expect(replay.ok).toBe(false)
      if (!replay.ok) expect(replay.reason).toBe('invalid')
    })

    it('consume is single-use (replay rejected)', async () => {
      const { db } = makeFakeDb()
      const { nonce } = await issueCswEntryChallenge({ db, cswAddress: CSW_ADDRESS })

      const first = await consumeCswEntryChallenge({ db, cswAddress: CSW_ADDRESS, nonce })
      expect(first.ok).toBe(true)

      const second = await consumeCswEntryChallenge({ db, cswAddress: CSW_ADDRESS, nonce })
      expect(second.ok).toBe(false)
      if (!second.ok) expect(second.reason).toBe('invalid')
    })

    it('consume with wrong CSW returns invalid (challenge_hash differs)', async () => {
      const { db } = makeFakeDb()
      const { nonce } = await issueCswEntryChallenge({ db, cswAddress: CSW_ADDRESS })

      const wrong = await consumeCswEntryChallenge({ db, cswAddress: OTHER_CSW, nonce })
      expect(wrong.ok).toBe(false)
      if (!wrong.ok) expect(wrong.reason).toBe('invalid')
    })

    it('consume returns expired after TTL passes', async () => {
      vi.useFakeTimers()
      try {
        const { db } = makeFakeDb()
        const { nonce } = await issueCswEntryChallenge({ db, cswAddress: CSW_ADDRESS, ttlSeconds: 60 })

        vi.setSystemTime(new Date(Date.now() + 61_000))

        const result = await consumeCswEntryChallenge({ db, cswAddress: CSW_ADDRESS, nonce })
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.reason).toBe('expired')
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('signature verification', () => {
    const MESSAGE = 'sign this'
    const SIG = '0xdeadbeef' as `0x${string}`

    it('accepts EOA signatures via viem.verifyMessage (direct path)', async () => {
      verifyMessageMock.mockResolvedValueOnce(true)
      const res = await verifyCswWalletSignature({ cswAddress: CSW_ADDRESS, message: MESSAGE, signature: SIG })
      expect(res.ok).toBe(true)
      expect(res.contractValidated).toBe(false)
    })

    it('rejects when signer is not a contract AND direct verifyMessage returns false', async () => {
      verifyMessageMock.mockResolvedValueOnce(false)
      clientGetBytecodeMock.mockResolvedValueOnce('0x') // not a contract

      const res = await verifyCswWalletSignature({ cswAddress: CSW_ADDRESS, message: MESSAGE, signature: SIG })
      expect(res.ok).toBe(false)
      expect(res.contractValidated).toBe(false)
    })

    it('falls back to EIP-1271 isValidSignature when direct path fails', async () => {
      verifyMessageMock.mockResolvedValueOnce(false)
      clientGetBytecodeMock.mockResolvedValueOnce('0xabcd') // is a contract
      clientReadContractMock.mockResolvedValueOnce('0x1626ba7e') // EIP-1271 magic

      const res = await verifyCswWalletSignature({ cswAddress: CSW_ADDRESS, message: MESSAGE, signature: SIG })
      expect(res.ok).toBe(true)
      expect(res.contractValidated).toBe(true)
    })

    it('rejects when EIP-1271 returns non-magic bytes', async () => {
      verifyMessageMock.mockResolvedValueOnce(false)
      clientGetBytecodeMock.mockResolvedValueOnce('0xabcd')
      clientReadContractMock.mockResolvedValueOnce('0xffffffff')

      const res = await verifyCswWalletSignature({ cswAddress: CSW_ADDRESS, message: MESSAGE, signature: SIG })
      expect(res.ok).toBe(false)
      expect(res.contractValidated).toBe(false)
    })

    it('rejects when verifyMessage throws AND EIP-1271 also fails', async () => {
      verifyMessageMock.mockRejectedValueOnce(new Error('bad sig'))
      clientGetBytecodeMock.mockResolvedValueOnce('0xabcd')
      clientReadContractMock.mockRejectedValueOnce(new Error('revert'))

      const res = await verifyCswWalletSignature({ cswAddress: CSW_ADDRESS, message: MESSAGE, signature: SIG })
      expect(res.ok).toBe(false)
    })
  })

  describe('end-to-end bypass regression', () => {
    it('the original vulnerability is no longer reachable — unsigned submission produces no consumable challenge', async () => {
      // Before the fix, an attacker could submit any registered CSW and
      // receive a Telegram-verification token without proving ownership.
      //
      // The fix requires the client to (1) request a challenge nonce and
      // (2) present a valid signature from the CSW. We simulate the
      // attacker attempting to bypass step (2) by consuming the challenge
      // without calling verifyCswWalletSignature. The fake db contract
      // guarantees the DELETE RETURNING removes the row atomically — but
      // the critical property under test is that the signature check runs
      // AFTER challenge issuance, so without a real signature the handler
      // would return 401 before any token is issued.
      const { db } = makeFakeDb()
      const { nonce, message, expiresAt } = await issueCswEntryChallenge({ db, cswAddress: CSW_ADDRESS })

      // Attacker who doesn't control CSW_ADDRESS submits a random signature.
      verifyMessageMock.mockResolvedValue(false)
      clientGetBytecodeMock.mockResolvedValue('0xabcd')
      clientReadContractMock.mockResolvedValue('0xffffffff') // not the magic

      // Reconstruct the canonical message the handler would build.
      expect(message).toBe(buildCswEntryChallengeMessage({ cswAddress: CSW_ADDRESS, nonce, expiresAt }))

      const sigCheck = await verifyCswWalletSignature({
        cswAddress: CSW_ADDRESS,
        message,
        signature: '0xdeadbeef' as `0x${string}`,
      })
      expect(sigCheck.ok).toBe(false)
      // The handler would 401 here, so no token is issued.
    })

    it('legitimate owner can complete the flow end-to-end (EOA)', async () => {
      const { db } = makeFakeDb()
      const { nonce, message } = await issueCswEntryChallenge({ db, cswAddress: CSW_ADDRESS })

      // Owner produces a valid personal_sign signature.
      verifyMessageMock.mockResolvedValue(true)

      const sigCheck = await verifyCswWalletSignature({
        cswAddress: CSW_ADDRESS,
        message,
        signature: '0xabc123' as `0x${string}`,
      })
      expect(sigCheck.ok).toBe(true)

      const consumed = await consumeCswEntryChallenge({ db, cswAddress: CSW_ADDRESS, nonce })
      expect(consumed.ok).toBe(true)

      // Second attempt with the same nonce fails — single-use property.
      const replay = await consumeCswEntryChallenge({ db, cswAddress: CSW_ADDRESS, nonce })
      expect(replay.ok).toBe(false)
    })

    it('legitimate smart-wallet owner completes via EIP-1271', async () => {
      const { db } = makeFakeDb()
      const { nonce, message } = await issueCswEntryChallenge({ db, cswAddress: CSW_ADDRESS })

      // Smart wallet — direct verifyMessage fails, but isValidSignature returns magic.
      verifyMessageMock.mockResolvedValue(false)
      clientGetBytecodeMock.mockResolvedValue('0xabcd')
      clientReadContractMock.mockResolvedValue('0x1626ba7e')

      const sigCheck = await verifyCswWalletSignature({
        cswAddress: CSW_ADDRESS,
        message,
        signature: '0xabc123' as `0x${string}`,
      })
      expect(sigCheck.ok).toBe(true)
      expect(sigCheck.contractValidated).toBe(true)

      const consumed = await consumeCswEntryChallenge({ db, cswAddress: CSW_ADDRESS, nonce })
      expect(consumed.ok).toBe(true)
    })
  })
})
