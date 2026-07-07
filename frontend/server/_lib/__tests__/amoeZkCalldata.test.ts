// PR 4 — AMOE PLONK ZK relayer calldata builder tests.
//
// Locks in the contract between the off-chain proof-generation pipeline (out
// of scope here — see issue #403 §2) and the on-chain `submitAmoeEntryZK`
// entrypoint. The fixture is the SAME 24-element proof + 8 public inputs
// used in `amoe/tests/zk/AmoePlonkVerifier.t.sol::_fixture()` so a regression in
// this builder OR in the slot layout will fail at least one of the two
// tests.
//
// What this file tests:
//   * Happy path: well-formed proof+pubInputs → calldata that decodes back
//     to identical args (round-trip).
//   * Length checks: wrong proof / pubInputs arity → AmoeBadRequestError.
//   * Field bounds: any scalar ≥ Q → AmoeBadRequestError. (Mirrors the
//     on-chain `checkField` loop — without this guard a malformed proof
//     burns gas before reverting.)
//   * Calldata→pubInputs binding: creatorCoin / epoch mismatches caught
//     locally so we never broadcast a guaranteed-revert tx.
//
// What it does NOT test:
//   * Actual PLONK validity. That is the job of
//     `amoe/tests/zk/AmoePlonkVerifier.t.sol`. We assert SHAPE, BOUNDS, and
//     ENCODING here — proof correctness is on-chain's responsibility.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { decodeFunctionData } from 'viem'

import {
  AMOE_BN254_SCALAR_FIELD_Q,
  AMOE_MAX_POINTS_AS_USD,
  AMOE_PLONK_PROOF_LEN,
  AMOE_PLONK_PUB_INPUTS_LEN,
  AMOE_PLONK_PUB_INPUT_SLOT,
  buildAmoeEntryZKCall,
  type AmoeZKBuildInputs,
} from '../lottery/lotteryAmoe.js'
import { AmoeBadRequestError } from '../lottery/lotteryAmoeErrors.js'

// ---------------------------------------------------------------------------
// Fixture — must mirror `amoe/tests/zk/AmoePlonkVerifier.t.sol::_fixture()` exactly.
// ---------------------------------------------------------------------------

// Fixture — mirrors `amoe/tests/zk/AmoePlonkVerifier.t.sol::_fixture()` (circuit v3).

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, 'fixtures', 'amoe-plonk')

function plonkProofScalars(proofJson: Record<string, string[] | string>): bigint[] {
  const pairKeys = ['A', 'B', 'C', 'Z', 'T1', 'T2', 'T3', 'Wxi', 'Wxiw'] as const
  const scalarKeys = ['eval_a', 'eval_b', 'eval_c', 'eval_s1', 'eval_s2', 'eval_zw'] as const
  const out: bigint[] = []
  for (const key of pairKeys) {
    const pair = proofJson[key]
    if (!Array.isArray(pair) || pair.length < 2) throw new Error(`missing proof field ${key}`)
    out.push(BigInt(pair[0]!), BigInt(pair[1]!))
  }
  for (const key of scalarKeys) {
    const scalar = proofJson[key]
    if (typeof scalar !== 'string') throw new Error(`missing proof field ${key}`)
    out.push(BigInt(scalar))
  }
  return out
}

const FIXTURE_PROOF_JSON = JSON.parse(
  readFileSync(join(FIXTURES_DIR, 'proof.json'), 'utf8'),
) as Record<string, string[]>
const FIXTURE_PROOF = plonkProofScalars(FIXTURE_PROOF_JSON)

const FIXTURE_PUB: readonly bigint[] = JSON.parse(
  readFileSync(join(FIXTURES_DIR, 'public.json'), 'utf8'),
).map((s: string) => BigInt(s))

const FIXTURE_CREATOR_COIN_ADDR =
  '0x00000000c0ffeec0ffeec0ffeec0ffeec0ffeec0' as const

const FIXTURE_WALLET = '0x1234567890abcdef1234567890abcdef12345678' as const
const FIXTURE_ROUTER = '0x1111111111111111111111111111111111111111' as const

function happyInputs(): AmoeZKBuildInputs {
  return {
    wallet: FIXTURE_WALLET,
    creatorCoin: FIXTURE_CREATOR_COIN_ADDR,
    epoch: 1n,
    proof: FIXTURE_PROOF,
    pubInputs: FIXTURE_PUB,
    lotteryAmoeRouter: FIXTURE_ROUTER,
  }
}

// Minimal ABI subset that decodes whatever `submitAmoeEntryZK` encodes —
// keeps the test independent from the module's internal ABI export.
const decodeAbi = [
  {
    type: 'function',
    name: 'submitAmoeEntryZK',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'buyer', type: 'address' },
      { name: 'creatorCoin', type: 'address' },
      { name: 'epoch', type: 'uint64' },
      { name: 'proof', type: 'uint256[24]' },
      { name: 'pubInputs', type: 'uint256[9]' },
    ],
    outputs: [{ name: 'entryId', type: 'uint256' }],
  },
] as const

// ---------------------------------------------------------------------------
// Locked layout sanity — if these break the on-chain verifier silently
// stops accepting valid proofs, so we trip-wire on the constants directly.
// ---------------------------------------------------------------------------

describe('AMOE PLONK — locked constants', () => {
  it('proof length is 24 (snarkjs PLONK calldata format)', () => {
    expect(AMOE_PLONK_PROOF_LEN).toBe(24)
  })

  it('public inputs length is 9 (circuit v3 — IAmoePlonkVerifier)', () => {
    expect(AMOE_PLONK_PUB_INPUTS_LEN).toBe(9)
  })

  it('pub-input slot map matches the on-chain spec', () => {
    expect(AMOE_PLONK_PUB_INPUT_SLOT).toEqual({
      walletAddrCommit: 0,
      creatorCoinAddr: 1,
      nonceCommit: 2,
      epoch: 3,
      allowlistRoot: 4,
      pointsBurnedAsUSD: 5,
      pointsLedgerRoot: 6,
      pointsBurnNullifier: 7,
      walletAddr: 8,
    })
  })

  it('BN254 scalar field Q matches the canonical bn128 modulus', () => {
    expect(AMOE_BN254_SCALAR_FIELD_Q).toBe(
      21888242871839275222246405745257275088548364400416034343698204186575808495617n,
    )
  })
})

// ---------------------------------------------------------------------------
// Happy path — round-trip the calldata.
// ---------------------------------------------------------------------------

describe('AMOE PLONK — buildAmoeEntryZKCall happy path', () => {
  it('returns calldata that round-trips through decodeFunctionData', async () => {
    const result = await buildAmoeEntryZKCall(happyInputs())

    expect(result.to).toBe(FIXTURE_ROUTER)
    expect(result.callData.startsWith('0x')).toBe(true)

    const decoded = decodeFunctionData({
      abi: decodeAbi,
      data: result.callData,
    })
    expect(decoded.functionName).toBe('submitAmoeEntryZK')
    const [buyer, coin, epoch, proof, pub] = decoded.args as readonly [
      `0x${string}`,
      `0x${string}`,
      bigint,
      readonly bigint[],
      readonly bigint[],
    ]
    expect(buyer.toLowerCase()).toBe(FIXTURE_WALLET.toLowerCase())
    expect(coin.toLowerCase()).toBe(FIXTURE_CREATOR_COIN_ADDR.toLowerCase())
    expect(epoch).toBe(1n)
    expect(proof.length).toBe(24)
    expect(pub.length).toBe(9)
    // Spot-check first/last proof scalars and every pub input.
    expect(proof[0]).toBe(FIXTURE_PROOF[0])
    expect(proof[23]).toBe(FIXTURE_PROOF[23])
    for (let i = 0; i < 9; i++) {
      expect(pub[i]).toBe(FIXTURE_PUB[i])
    }
  })

  it('exposes pointsBurnedAsUSD pulled from pubInputs[5]', async () => {
    const result = await buildAmoeEntryZKCall(happyInputs())
    // pub[5] = 0x0f4240 = 1_000_000
    expect(result.pointsBurnedAsUSD).toBe('1000000')
  })

  it('estimates win chance for $1 entry as 4 PPM (= 1_000_000 / 250_000)', async () => {
    const result = await buildAmoeEntryZKCall(happyInputs())
    expect(result.estimatedWinChancePPM).toBe(4)
  })

  it('accepts hex string scalars (not just bigints) for proof + pubInputs', async () => {
    const inputs = happyInputs()
    const result = await buildAmoeEntryZKCall({
      ...inputs,
      proof: FIXTURE_PROOF.map((s) => '0x' + s.toString(16)),
      pubInputs: FIXTURE_PUB.map((s) => '0x' + s.toString(16)),
    })
    expect(result.callData.startsWith('0x')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Negative paths — must surface AmoeBadRequestError BEFORE any encoding
// happens so the relayer never broadcasts a guaranteed-revert tx.
// ---------------------------------------------------------------------------

describe('AMOE PLONK — input validation', () => {
  it('rejects malformed wallet', async () => {
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), wallet: '0xnotanaddress' as `0x${string}` }),
    ).rejects.toThrow(AmoeBadRequestError)
  })

  it('rejects malformed creatorCoin', async () => {
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), creatorCoin: '0xshort' as `0x${string}` }),
    ).rejects.toThrow(AmoeBadRequestError)
  })

  it('rejects malformed router address', async () => {
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), lotteryAmoeRouter: '0x' as `0x${string}` }),
    ).rejects.toThrow(AmoeBadRequestError)
  })

  it('rejects proof with wrong length (23 instead of 24)', async () => {
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), proof: FIXTURE_PROOF.slice(0, 23) }),
    ).rejects.toThrow(/zk_proof_wrong_length/)
  })

  it('rejects pubInputs with wrong length (8 instead of 9)', async () => {
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), pubInputs: FIXTURE_PUB.slice(0, 8) }),
    ).rejects.toThrow(/zk_pub_inputs_wrong_length/)
  })

  it('rejects epoch above uint64', async () => {
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), epoch: 0x10000000000000000n }),
    ).rejects.toThrow(/zk_epoch_above_uint64/)
  })

  it('rejects proof scalar at exactly Q (out of field)', async () => {
    const badProof = [...FIXTURE_PROOF]
    badProof[5] = AMOE_BN254_SCALAR_FIELD_Q
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), proof: badProof }),
    ).rejects.toThrow(/zk_proof_5/)
  })

  it('rejects pubInput scalar above Q', async () => {
    const badPub = [...FIXTURE_PUB]
    badPub[2] = AMOE_BN254_SCALAR_FIELD_Q + 1n
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), pubInputs: badPub }),
    ).rejects.toThrow(/zk_pub_input_2/)
  })

  it('rejects negative scalar (not in field)', async () => {
    const badProof = [...FIXTURE_PROOF]
    badProof[0] = -1n
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), proof: badProof }),
    ).rejects.toThrow(/zk_proof_0/)
  })

  it('rejects creatorCoin that does not match pubInputs[1]', async () => {
    await expect(
      buildAmoeEntryZKCall({
        ...happyInputs(),
        creatorCoin: '0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead',
      }),
    ).rejects.toThrow(/zk_creator_coin_pub_input_mismatch/)
  })

  it('rejects epoch that does not match pubInputs[3]', async () => {
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), epoch: 2n }),
    ).rejects.toThrow(/zk_epoch_pub_input_mismatch/)
  })

  it('rejects unparseable string scalar', async () => {
    const badProof: (bigint | string)[] = [...FIXTURE_PROOF]
    badProof[0] = 'not-a-number'
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), proof: badProof }),
    ).rejects.toThrow(/zk_proof_0_unparseable/)
  })

  // ---- Number safety: PLONK scalars routinely exceed 2^53 - 1, so a JS
  // `number` would silently round before BigInt() sees it. The builder
  // must reject anything outside Number.isSafeInteger so an upstream
  // JSON.parse() of proof.json (which decodes large ints to lossy numbers)
  // can't slip a corrupted scalar through the field-bounds check.
  it('rejects a JS number above Number.MAX_SAFE_INTEGER (silent rounding hazard)', async () => {
    const badProof: (bigint | number)[] = [...FIXTURE_PROOF]
    // 2 ** 53 is the smallest unsafe integer. Any larger value is
    // already lossy by the time JS hands it to us.
    badProof[7] = 2 ** 53
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), proof: badProof }),
    ).rejects.toThrow(/zk_proof_7_not_safe_uint/)
  })

  it('rejects a non-integer JS number', async () => {
    const badProof: (bigint | number)[] = [...FIXTURE_PROOF]
    badProof[3] = 1.5
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), proof: badProof }),
    ).rejects.toThrow(/zk_proof_3_not_safe_uint/)
  })

  it('rejects a negative JS number', async () => {
    const badProof: (bigint | number)[] = [...FIXTURE_PROOF]
    badProof[1] = -1
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), proof: badProof }),
    ).rejects.toThrow(/zk_proof_1_not_safe_uint/)
  })

  it('accepts a small JS number scalar (within Number.MAX_SAFE_INTEGER)', async () => {
    // Sanity: small ints are still allowed — only unsafe ones are rejected.
    const okProof: (bigint | number)[] = [...FIXTURE_PROOF]
    okProof[0] = 42
    // pub[1] would also need updating to keep the binding check happy if
    // we mutated a public input; we mutate proof so binding still passes.
    const result = await buildAmoeEntryZKCall({
      ...happyInputs(),
      proof: okProof,
    })
    expect(result.callData.startsWith('0x')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// pointsBurnedAsUSD bounds — mirror the router's PointsValueOutOfRange
// guard so a malformed prover output fails locally instead of producing a
// guaranteed-revert tx on-chain.
// ---------------------------------------------------------------------------

describe('AMOE PLONK — pointsBurnedAsUSD bounds', () => {
  it('exposes AMOE_MAX_POINTS_AS_USD = 10_000 * 1e6', () => {
    expect(AMOE_MAX_POINTS_AS_USD).toBe(10_000n * 1_000_000n)
  })

  it('rejects pubInputs[5] === 0', async () => {
    const badPub = [...FIXTURE_PUB]
    badPub[5] = 0n
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), pubInputs: badPub }),
    ).rejects.toThrow(/zk_points_burned_zero/)
  })

  it('rejects pubInputs[5] > MAX_POINTS_AS_USD', async () => {
    const badPub = [...FIXTURE_PUB]
    badPub[5] = AMOE_MAX_POINTS_AS_USD + 1n
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), pubInputs: badPub }),
    ).rejects.toThrow(/zk_points_burned_above_max/)
  })

  it('accepts pubInputs[5] === MAX_POINTS_AS_USD (boundary)', async () => {
    const okPub = [...FIXTURE_PUB]
    okPub[5] = AMOE_MAX_POINTS_AS_USD
    const result = await buildAmoeEntryZKCall({
      ...happyInputs(),
      pubInputs: okPub,
    })
    expect(result.pointsBurnedAsUSD).toBe(AMOE_MAX_POINTS_AS_USD.toString())
  })

  it('accepts pubInputs[5] === 1 (minimum non-zero)', async () => {
    const okPub = [...FIXTURE_PUB]
    okPub[5] = 1n
    const result = await buildAmoeEntryZKCall({
      ...happyInputs(),
      pubInputs: okPub,
    })
    expect(result.pointsBurnedAsUSD).toBe('1')
  })
})
