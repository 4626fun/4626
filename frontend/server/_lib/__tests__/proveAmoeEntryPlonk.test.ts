// PR 4 follow-up — `proveAmoeEntryPlonk` foundational tests.
//
// What this file covers:
//   1. `parsePlonkSolidityCallData` (pure parser):
//      * Happy path against the canonical fixture from
//        `amoe/circuits/build/plonk_fresh/calldata_plonk.txt`. We assert the
//        24-element proof and 8-element public inputs round-trip back to
//        the SAME values stored in `proof_plonk.json` / `public_plonk.json`.
//      * Malformed inputs throw typed AmoeProofGenerationError with stable
//        error codes.
//   2. `proveAmoeEntryPlonk` (snarkjs wrapper):
//      * With an injected SnarkjsLike mock that returns the canonical
//        fixture, end-to-end proves a result that round-trips through
//        `buildAmoeEntryZKCall`. This locks in the contract between the
//        proof generator and the calldata builder — if either side drifts,
//        this test fails.
//      * Witness-input validation: missing/invalid signals + wrong
//        path-array length surface as typed errors.
//      * snarkjs failures wrap as `plonk_snarkjs_failed`.
//
// What this file deliberately does NOT cover:
//   * Actual cryptographic proof generation. Running snarkjs against the
//     real 86 MB `amoe_plonk_final.zkey` is out-of-band — see
//     `amoe/tools/zk/regen_amoe_plonk_verifier.sh` for the offline regen path.
//     Production CI will gain a separate gated job once #403 §1 (trusted
//     setup ceremony) lands.
//   * Witness construction (Poseidon hashes, Merkle paths). That work is
//     scoped to the next PR in #403 §2.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import {
  AMOE_BN254_SCALAR_FIELD_Q,
  AMOE_PLONK_PROOF_LEN,
  AMOE_PLONK_PUB_INPUTS_LEN,
  AMOE_PLONK_PUB_INPUT_SLOT,
  buildAmoeEntryZKCall,
} from '../lottery/lotteryAmoe.js'
import {
  AMOE_MERKLE_DEPTH,
  AmoeProofGenerationError,
  parsePlonkSolidityCallData,
  proveAmoeEntryPlonk,
  type AmoeEligibilityWitness,
  type SnarkjsLike,
} from '../lottery/proveAmoeEntryPlonk.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, 'fixtures', 'amoe-plonk')

const FIXTURE_CALLDATA = readFileSync(join(FIXTURES_DIR, 'calldata.txt'), 'utf8')
const FIXTURE_PROOF = JSON.parse(
  readFileSync(join(FIXTURES_DIR, 'proof.json'), 'utf8'),
) as Record<string, unknown>
const FIXTURE_PUBLIC = JSON.parse(
  readFileSync(join(FIXTURES_DIR, 'public.json'), 'utf8'),
) as readonly string[]

// The canonical creator coin from the on-chain test fixture
// (`amoe/tests/zk/AmoePlonkVerifier.t.sol::_fixture()`). Public input slot 1 stores
// `uint256(uint160(this address))`. The fixture's encoded value
// `256540653394130413744119705557698342592` decodes to 0x00000000... +
// 16 bytes of `0xc0ffee...` (i.e. only the bottom 128 bits are non-zero, so
// the 20-byte address has 4 leading zero bytes). Match this byte-pattern
// EXACTLY or `buildAmoeEntryZKCall` will reject the round-trip with
// `zk_creator_coin_pub_input_mismatch`.
const FIXTURE_CREATOR_COIN = '0x00000000c0ffeec0ffeec0ffeec0ffeec0ffeec0' as const

const FIXTURE_ROUTER = '0x000000000000000000000000000000000000ABCD' as const
const FIXTURE_WALLET = '0x1111111111111111111111111111111111111111' as const

// ---------------------------------------------------------------------------
// parsePlonkSolidityCallData
// ---------------------------------------------------------------------------

describe('parsePlonkSolidityCallData', () => {
  it('parses the canonical PLONK calldata fixture', () => {
    const parsed = parsePlonkSolidityCallData(FIXTURE_CALLDATA)

    expect(parsed.proof.length).toBe(AMOE_PLONK_PROOF_LEN)
    expect(parsed.pubInputs.length).toBe(AMOE_PLONK_PUB_INPUTS_LEN)

    // Public inputs must equal the fixture's `public_plonk.json` exactly —
    // snarkjs preserves circuit-declared order, which matches our slot
    // layout, so no permutation should be needed at parse time.
    for (let i = 0; i < FIXTURE_PUBLIC.length; i++) {
      expect(parsed.pubInputs[i]?.toString()).toBe(FIXTURE_PUBLIC[i])
    }

    // The fixture's pubInputs[5] is the proven `pointsBurnedAsUSD`. We
    // additionally assert the value is in the protocol's $1..$10K window
    // so a regression in the fixture's circuit witness would be caught.
    const pointsBurnedAsUSD = parsed.pubInputs[AMOE_PLONK_PUB_INPUT_SLOT.pointsBurnedAsUSD]!
    expect(pointsBurnedAsUSD).toBeGreaterThan(0n)
    expect(pointsBurnedAsUSD).toBeLessThanOrEqual(10_000n * 1_000_000n)
  })

  it('every parsed proof scalar is a valid BN254 field element', () => {
    const parsed = parsePlonkSolidityCallData(FIXTURE_CALLDATA)
    for (const s of parsed.proof) {
      expect(s).toBeGreaterThanOrEqual(0n)
      expect(s).toBeLessThan(AMOE_BN254_SCALAR_FIELD_Q)
    }
  })

  it('rejects an empty input', () => {
    const err = (() => {
      try {
        parsePlonkSolidityCallData('')
      } catch (e) {
        return e
      }
      return null
    })()
    expect(err).toBeInstanceOf(AmoeProofGenerationError)
    expect((err as AmoeProofGenerationError).code).toBe('plonk_calldata_parse_failed')
  })

  it('rejects a string with no proof/public boundary', () => {
    const err = (() => {
      try {
        parsePlonkSolidityCallData('["0x1","0x2","0x3"]')
      } catch (e) {
        return e
      }
      return null
    })()
    expect(err).toBeInstanceOf(AmoeProofGenerationError)
    expect((err as AmoeProofGenerationError).code).toBe('plonk_calldata_parse_failed')
  })

  it('rejects a proof with the wrong number of scalars', () => {
    // Build a clearly-too-short proof array to verify the length-mismatch
    // path. We append a non-empty pub array so the parser reaches the
    // length check rather than the empty-public guard.
    const malformed = '["0x1","0x2","0x3"]["0x9"]'
    const err = (() => {
      try {
        parsePlonkSolidityCallData(malformed)
      } catch (e) {
        return e
      }
      return null
    })()
    expect(err).toBeInstanceOf(AmoeProofGenerationError)
    expect((err as AmoeProofGenerationError).code).toBe('plonk_calldata_proof_length_mismatch')
  })

  it('rejects a calldata with an empty public-signals array', () => {
    // 24 valid proof scalars with no trailing public-signal scalars.
    const proofPart = '[' + Array.from({ length: 24 }, () => '"0x1"').join(',') + ']'
    const malformed = `${proofPart}[]`
    const err = (() => {
      try {
        parsePlonkSolidityCallData(malformed)
      } catch (e) {
        return e
      }
      return null
    })()
    expect(err).toBeInstanceOf(AmoeProofGenerationError)
    expect((err as AmoeProofGenerationError).code).toBe('plonk_calldata_parse_failed')
  })

  it('rejects a scalar at or above the BN254 field modulus', () => {
    // Use a value >= Q in the proof position. snarkjs would never emit
    // this; we validate that our own parser would reject it before any
    // gas was burned on a guaranteed-revert tx.
    const overQ = `0x${AMOE_BN254_SCALAR_FIELD_Q.toString(16)}`
    const proofPart =
      '[' +
      `"${overQ}",` +
      Array.from({ length: 23 }, () => '"0x1"').join(',') +
      ']'
    const malformed = `${proofPart}["0x1","0x2","0x3","0x4","0x5","0x6","0x7","0x8"]`
    const err = (() => {
      try {
        parsePlonkSolidityCallData(malformed)
      } catch (e) {
        return e
      }
      return null
    })()
    expect(err).toBeInstanceOf(AmoeProofGenerationError)
    expect((err as AmoeProofGenerationError).code).toBe('plonk_calldata_scalar_out_of_field')
  })

  it('rejects a hex scalar wider than 256 bits', () => {
    // 65-hex-char scalar is structurally invalid for BN254 (max 64 hex chars).
    const tooWide = '0x' + 'f'.repeat(65)
    const proofPart =
      '[' +
      `"${tooWide}",` +
      Array.from({ length: 23 }, () => '"0x1"').join(',') +
      ']'
    const malformed = `${proofPart}["0x1","0x2","0x3","0x4","0x5","0x6","0x7","0x8"]`
    const err = (() => {
      try {
        parsePlonkSolidityCallData(malformed)
      } catch (e) {
        return e
      }
      return null
    })()
    expect(err).toBeInstanceOf(AmoeProofGenerationError)
    expect((err as AmoeProofGenerationError).code).toBe('plonk_calldata_scalar_not_hex')
  })
})

// ---------------------------------------------------------------------------
// proveAmoeEntryPlonk (with mock SnarkjsLike)
// ---------------------------------------------------------------------------

/**
 * Build a minimally-valid `AmoeEligibilityWitness`. The values aren't
 * cryptographically meaningful — every scalar passes through the mock
 * snarkjs which ignores the witness and returns the canonical fixture
 * proof/public. The point is to exercise our normalization layer.
 *
 * The mock does NOT verify witness consistency, so all we need is for
 * `_normalizeWitness` to accept these without throwing.
 */
function makeValidWitness(): AmoeEligibilityWitness {
  // Decimal-string filler. Using a non-zero value avoids accidentally
  // triggering a circuit-side "input must be non-zero" assertion if the
  // witness were ever piped to a real prover.
  const FILL = '1'
  const path = Array.from({ length: AMOE_MERKLE_DEPTH }, () => FILL)
  const indices = Array.from({ length: AMOE_MERKLE_DEPTH }, () => '0')
  return {
    walletAddrCommit: FILL,
    creatorCoinAddr: FILL,
    nonceCommit: FILL,
    epoch: '1',
    allowlistRoot: FILL,
    pointsBurnedAsUSD: '1000000',
    pointsLedgerRoot: FILL,
    pointsBurnNullifier: FILL,
    wallet: FILL,
    nonce: FILL,
    twitterCreditNullifier: FILL,
    pathElements: path,
    pathIndices: indices,
    signupIdHash: FILL,
    spendRefIdHash: FILL,
    pointsLedgerPathElements: path,
    pointsLedgerPathIndices: indices,
  }
}

/**
 * Mock snarkjs that returns the canonical fixture proof/public for any
 * input. The point is to test our wrapper plumbing — proof correctness is
 * covered by `amoe/tests/zk/AmoePlonkVerifier.t.sol`.
 */
function makeFixtureSnarkjs(overrides?: {
  fullProveImpl?: SnarkjsLike['plonk']['fullProve']
  exportImpl?: SnarkjsLike['plonk']['exportSolidityCallData']
}): SnarkjsLike {
  return {
    plonk: {
      fullProve: overrides?.fullProveImpl ??
        vi.fn(async () => ({
          proof: FIXTURE_PROOF,
          publicSignals: FIXTURE_PUBLIC.slice(),
        })),
      exportSolidityCallData: overrides?.exportImpl ??
        vi.fn(async () => FIXTURE_CALLDATA),
    },
  }
}

describe('proveAmoeEntryPlonk', () => {
  it('happy path: returns proof[24] + pubInputs[8] in the locked slot order', async () => {
    const result = await proveAmoeEntryPlonk(makeValidWitness(), {
      wasmPath: '/dev/null/amoe_eligibility.wasm',
      zkeyPath: '/dev/null/amoe_plonk_final.zkey',
      snarkjs: makeFixtureSnarkjs(),
    })

    expect(result.proof.length).toBe(AMOE_PLONK_PROOF_LEN)
    expect(result.pubInputs.length).toBe(AMOE_PLONK_PUB_INPUTS_LEN)

    // Slot order: pubInputs[i] equals the i-th entry of the fixture's
    // public.json — confirming snarkjs's circuit-declared order matches
    // `AMOE_PLONK_PUB_INPUT_SLOT` 1:1.
    for (let i = 0; i < FIXTURE_PUBLIC.length; i++) {
      expect(result.pubInputs[i]?.toString()).toBe(FIXTURE_PUBLIC[i])
    }
  })

  it('result round-trips through buildAmoeEntryZKCall (proof+pubInputs are calldata-ready)', async () => {
    const result = await proveAmoeEntryPlonk(makeValidWitness(), {
      wasmPath: '/dev/null/amoe_eligibility.wasm',
      zkeyPath: '/dev/null/amoe_plonk_final.zkey',
      snarkjs: makeFixtureSnarkjs(),
    })

    // The fixture's pubInputs[1] is the creator coin address as uint256.
    // We pass the matching address-form to `buildAmoeEntryZKCall` so the
    // calldata→pubInputs binding check inside the builder succeeds.
    const built = await buildAmoeEntryZKCall({
      wallet: FIXTURE_WALLET,
      creatorCoin: FIXTURE_CREATOR_COIN,
      epoch: result.pubInputs[AMOE_PLONK_PUB_INPUT_SLOT.epoch]!,
      proof: result.proof,
      pubInputs: result.pubInputs,
      lotteryAmoeRouter: FIXTURE_ROUTER,
    })

    expect(built.to).toBe(FIXTURE_ROUTER)
    expect(built.callData).toMatch(/^0x[0-9a-fA-F]+$/)
    // The builder pulls pointsBurnedAsUSD straight off pubInputs[5] for
    // UI preview — assert it's a non-zero stringified positive integer.
    expect(built.pointsBurnedAsUSD).toBe('1000000')
    expect(built.estimatedWinChancePPM).toBeGreaterThan(0)
  })

  it('rejects a missing scalar witness signal', async () => {
    const witness = makeValidWitness() as unknown as Record<string, unknown>
    delete witness.walletAddrCommit

    await expect(
      proveAmoeEntryPlonk(witness as unknown as AmoeEligibilityWitness, {
        wasmPath: '/dev/null',
        zkeyPath: '/dev/null',
        snarkjs: makeFixtureSnarkjs(),
      }),
    ).rejects.toMatchObject({
      name: 'AmoeProofGenerationError',
      code: 'plonk_witness_input_missing',
    })
  })

  it('rejects a negative scalar witness signal', async () => {
    const witness = makeValidWitness()
    witness.epoch = -1n

    await expect(
      proveAmoeEntryPlonk(witness, {
        wasmPath: '/dev/null',
        zkeyPath: '/dev/null',
        snarkjs: makeFixtureSnarkjs(),
      }),
    ).rejects.toMatchObject({
      code: 'plonk_witness_input_invalid',
    })
  })

  it('rejects a non-numeric string witness signal', async () => {
    const witness = makeValidWitness()
    witness.nonce = 'not-a-number'

    await expect(
      proveAmoeEntryPlonk(witness, {
        wasmPath: '/dev/null',
        zkeyPath: '/dev/null',
        snarkjs: makeFixtureSnarkjs(),
      }),
    ).rejects.toMatchObject({
      code: 'plonk_witness_input_invalid',
    })
  })

  it('rejects a path-elements array of the wrong length', async () => {
    const witness = makeValidWitness()
    // 19 elements instead of 20.
    witness.pathElements = Array.from({ length: AMOE_MERKLE_DEPTH - 1 }, () => '1')

    await expect(
      proveAmoeEntryPlonk(witness, {
        wasmPath: '/dev/null',
        zkeyPath: '/dev/null',
        snarkjs: makeFixtureSnarkjs(),
      }),
    ).rejects.toMatchObject({
      code: 'plonk_witness_input_invalid',
    })
  })

  it('rejects a points-ledger path that is not an array', async () => {
    const witness = makeValidWitness() as unknown as Record<string, unknown>
    witness.pointsLedgerPathElements = 'not an array'

    await expect(
      proveAmoeEntryPlonk(witness as unknown as AmoeEligibilityWitness, {
        wasmPath: '/dev/null',
        zkeyPath: '/dev/null',
        snarkjs: makeFixtureSnarkjs(),
      }),
    ).rejects.toMatchObject({
      code: 'plonk_witness_input_missing',
    })
  })

  it('wraps snarkjs.plonk.fullProve failures as plonk_snarkjs_failed', async () => {
    const failingSnarkjs = makeFixtureSnarkjs({
      fullProveImpl: vi.fn(async () => {
        throw new Error('upstream snarkjs blew up')
      }),
    })

    await expect(
      proveAmoeEntryPlonk(makeValidWitness(), {
        wasmPath: '/dev/null',
        zkeyPath: '/dev/null',
        snarkjs: failingSnarkjs,
      }),
    ).rejects.toMatchObject({
      code: 'plonk_snarkjs_failed',
    })
  })

  it('wraps snarkjs.plonk.exportSolidityCallData failures as plonk_snarkjs_failed', async () => {
    const failingSnarkjs = makeFixtureSnarkjs({
      exportImpl: vi.fn(async () => {
        throw new Error('export blew up')
      }),
    })

    await expect(
      proveAmoeEntryPlonk(makeValidWitness(), {
        wasmPath: '/dev/null',
        zkeyPath: '/dev/null',
        snarkjs: failingSnarkjs,
      }),
    ).rejects.toMatchObject({
      code: 'plonk_snarkjs_failed',
    })
  })

  it('wraps non-Error throws (snarkjs sometimes throws strings)', async () => {
    // snarkjs ≤0.7 occasionally rejects with a bare string (not an Error)
    // on witness-assertion failures; verify our wrapper still produces a
    // typed error in that case. We construct the rejection via
    // `Promise.reject` with a string payload — functionally identical to
    // `throw 'string'` from inside an async function but avoids triggering
    // strict throw-Error lint rules.
    const failingSnarkjs = makeFixtureSnarkjs({
      fullProveImpl: vi.fn(() =>
        Promise.reject('witness assertion failed') as Promise<never>,
      ),
    })

    await expect(
      proveAmoeEntryPlonk(makeValidWitness(), {
        wasmPath: '/dev/null',
        zkeyPath: '/dev/null',
        snarkjs: failingSnarkjs,
      }),
    ).rejects.toMatchObject({
      code: 'plonk_snarkjs_failed',
    })
  })

  it('rejects a calldata string with the wrong public-input count', async () => {
    // Mock returns a calldata with 7 public signals (legacy v1 shape).
    const proofPart =
      '[' + Array.from({ length: 24 }, () => '"0x1"').join(',') + ']'
    const malformedCalldata =
      `${proofPart}["0x1","0x2","0x3","0x4","0x5","0x6","0x7"]`
    const wrongShapeSnarkjs = makeFixtureSnarkjs({
      exportImpl: vi.fn(async () => malformedCalldata),
    })

    await expect(
      proveAmoeEntryPlonk(makeValidWitness(), {
        wasmPath: '/dev/null',
        zkeyPath: '/dev/null',
        snarkjs: wrongShapeSnarkjs,
      }),
    ).rejects.toMatchObject({
      code: 'plonk_calldata_pubinputs_length_mismatch',
    })
  })
})
