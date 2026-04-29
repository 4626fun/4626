// PR 4 follow-up — `amoeWitness` cross-validation against the canonical
// circuit fixture.
//
// What this file covers:
//   1. Each individual hash helper (walletAddrCommit, nonceCommit,
//      pointsBurnNullifier, allowlistLeaf, ledgerLeaf) bit-exactly
//      matches the canonical fixture from
//      `circuits/amoe/build/input_v2.json`.
//   2. End-to-end `assembleAmoeWitness` produces:
//      * Public commits matching the fixture's pre-baked values.
//      * `allowlistRoot` and `pointsLedgerRoot` matching the fixture.
//      * `pathElements` / `pathIndices` matching the fixture (all zeros).
//      * Witness shape consumable by `proveAmoeEntryPlonk` (we don't run
//        the prover here — that requires the 86 MB zkey).
//   3. Validation: every raw input is field-checked, bit-bound checked,
//      and snapshot-shape-checked. Each error path surfaces a typed
//      AmoeProofGenerationError with the `plonk_witness_input_invalid`
//      code.
//   4. Snapshot/leaf binding: if the caller hands in a snapshot whose
//      level-0 entry at the claimed index doesn't match the derived
//      leaf, we throw rather than silently producing an unprovable
//      witness.
//
// Why we read input_v2.json instead of hardcoding:
//   The fixture is the single source of truth for "what witness the
//   circuit accepts". If a circuit author regenerates it, this test
//   should re-check against the new file rather than be locked to a
//   stale set of constants.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  buildAmoeMerkleSnapshot,
} from '../lottery/amoeMerkleTree.js'
import {
  AMOE_BYTES32_DOMAIN_MAX,
  AMOE_MAX_CREATOR_COIN_ADDR,
  AMOE_MAX_EPOCH,
  AMOE_MAX_POINTS_BURNED_AS_USD,
  AMOE_BN254_FIELD_MODULUS,
  assembleAmoeWitness,
  buildAmoeAllowlistSnapshotFromSingleWallet,
  buildAmoeLedgerSnapshotFromSingleEntry,
  canonicalizeAmoeBytes32ToField,
  computeAmoeAllowlistLeaf,
  computeAmoeLedgerLeaf,
  computeAmoeNonceCommit,
  computeAmoePointsBurnNullifier,
  computeAmoeWalletAddrCommit,
} from '../lottery/amoeWitness.js'
import { AmoeProofGenerationError } from '../lottery/proveAmoeEntryPlonk.js'

// ----------------------------------------------------------------------------
// Fixture loader
// ----------------------------------------------------------------------------

const FIXTURE_PATH = (() => {
  const here = dirname(fileURLToPath(import.meta.url))
  // __tests__ → _lib → server → frontend → repo-root → circuits/...
  return join(here, '..', '..', '..', '..', 'circuits', 'amoe', 'build', 'input_v2.json')
})()

interface CircuitInputV2 {
  walletAddrCommit: string
  creatorCoinAddr: string
  nonceCommit: string
  epoch: string
  allowlistRoot: string
  pointsBurnedAsUSD: string
  pointsLedgerRoot: string
  pointsBurnNullifier: string
  wallet: string
  nonce: string
  twitterCreditNullifier: string
  pathElements: string[]
  pathIndices: string[]
  signupIdHash: string
  spendRefIdHash: string
  pointsLedgerPathElements: string[]
  pointsLedgerPathIndices: string[]
}

function loadFixture(): CircuitInputV2 {
  const raw = readFileSync(FIXTURE_PATH, 'utf8')
  return JSON.parse(raw) as CircuitInputV2
}

// All decimal strings → bigint helper (the JSON ships as strings to avoid
// JS number precision loss — never `Number(...)` these).
const B = (s: string): bigint => BigInt(s)

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('amoeWitness — hash helpers vs. canonical fixture', () => {
  const fx = loadFixture()

  it('walletAddrCommit = Poseidon2(wallet, twitterCreditNullifier)', () => {
    expect(
      computeAmoeWalletAddrCommit(B(fx.wallet), B(fx.twitterCreditNullifier)),
    ).toBe(B(fx.walletAddrCommit))
  })

  it('nonceCommit = Poseidon3(nonce, wallet, creatorCoinAddr)', () => {
    expect(
      computeAmoeNonceCommit(
        B(fx.nonce),
        B(fx.wallet),
        B(fx.creatorCoinAddr),
      ),
    ).toBe(B(fx.nonceCommit))
  })

  it('pointsBurnNullifier = Poseidon4(signupIdHash, spendRefIdHash, pointsBurnedAsUSD, epoch)', () => {
    expect(
      computeAmoePointsBurnNullifier(
        B(fx.signupIdHash),
        B(fx.spendRefIdHash),
        B(fx.pointsBurnedAsUSD),
        B(fx.epoch),
      ),
    ).toBe(B(fx.pointsBurnNullifier))
  })

  it('allowlist single-leaf snapshot root matches fixture allowlistRoot', () => {
    const leaf = computeAmoeAllowlistLeaf(B(fx.wallet), B(fx.epoch))
    const snap = buildAmoeMerkleSnapshot([leaf])
    expect(snap.root).toBe(B(fx.allowlistRoot))
  })

  it('ledger single-leaf snapshot root matches fixture pointsLedgerRoot', () => {
    const wac = computeAmoeWalletAddrCommit(
      B(fx.wallet),
      B(fx.twitterCreditNullifier),
    )
    const leaf = computeAmoeLedgerLeaf(
      B(fx.signupIdHash),
      B(fx.spendRefIdHash),
      B(fx.pointsBurnedAsUSD),
      B(fx.epoch),
      wac,
    )
    const snap = buildAmoeMerkleSnapshot([leaf])
    expect(snap.root).toBe(B(fx.pointsLedgerRoot))
  })
})

describe('amoeWitness — assembleAmoeWitness end-to-end vs. fixture', () => {
  const fx = loadFixture()

  function buildArgsFromFixture() {
    const wac = computeAmoeWalletAddrCommit(
      B(fx.wallet),
      B(fx.twitterCreditNullifier),
    )
    return {
      raw: {
        wallet: B(fx.wallet),
        nonce: B(fx.nonce),
        twitterCreditNullifier: B(fx.twitterCreditNullifier),
        creatorCoinAddr: B(fx.creatorCoinAddr),
        epoch: B(fx.epoch),
        signupIdHash: B(fx.signupIdHash),
        spendRefIdHash: B(fx.spendRefIdHash),
        pointsBurnedAsUSD: B(fx.pointsBurnedAsUSD),
      },
      trees: {
        allowlistSnapshot: buildAmoeAllowlistSnapshotFromSingleWallet(
          B(fx.wallet),
          B(fx.epoch),
        ),
        allowlistLeafIndex: 0,
        pointsLedgerSnapshot: buildAmoeLedgerSnapshotFromSingleEntry({
          signupIdHash: B(fx.signupIdHash),
          spendRefIdHash: B(fx.spendRefIdHash),
          pointsBurnedAsUSD: B(fx.pointsBurnedAsUSD),
          epoch: B(fx.epoch),
          walletAddrCommit: wac,
        }),
        pointsLedgerLeafIndex: 0,
      },
    }
  }

  it('produces public signals that match the fixture bit-exactly', () => {
    const w = assembleAmoeWitness(buildArgsFromFixture())
    expect(w.walletAddrCommit).toBe(B(fx.walletAddrCommit))
    expect(w.creatorCoinAddr).toBe(B(fx.creatorCoinAddr))
    expect(w.nonceCommit).toBe(B(fx.nonceCommit))
    expect(w.epoch).toBe(B(fx.epoch))
    expect(w.allowlistRoot).toBe(B(fx.allowlistRoot))
    expect(w.pointsBurnedAsUSD).toBe(B(fx.pointsBurnedAsUSD))
    expect(w.pointsLedgerRoot).toBe(B(fx.pointsLedgerRoot))
    expect(w.pointsBurnNullifier).toBe(B(fx.pointsBurnNullifier))
  })

  it('produces private signals that match the fixture', () => {
    const w = assembleAmoeWitness(buildArgsFromFixture())
    expect(w.wallet).toBe(B(fx.wallet))
    expect(w.nonce).toBe(B(fx.nonce))
    expect(w.twitterCreditNullifier).toBe(B(fx.twitterCreditNullifier))
    expect(w.signupIdHash).toBe(B(fx.signupIdHash))
    expect(w.spendRefIdHash).toBe(B(fx.spendRefIdHash))
  })

  it('produces all-zero pathElements / pathIndices for the canonical (single-leaf, index 0) layout', () => {
    const w = assembleAmoeWitness(buildArgsFromFixture())
    expect(w.pathElements).toHaveLength(20)
    expect(w.pathIndices).toHaveLength(20)
    for (let i = 0; i < 20; i++) {
      expect(w.pathElements[i]).toBe(B(fx.pathElements[i]!))
      expect(w.pathIndices[i]).toBe(B(fx.pathIndices[i]!))
      expect(w.pointsLedgerPathElements[i]).toBe(
        B(fx.pointsLedgerPathElements[i]!),
      )
      expect(w.pointsLedgerPathIndices[i]).toBe(
        B(fx.pointsLedgerPathIndices[i]!),
      )
    }
  })
})

describe('amoeWitness — input validation', () => {
  // Build a baseline valid args object once, then mutate per case.
  const baseRaw = {
    wallet: 0x1234567890abcdef1234567890abcdef12345678n,
    nonce: 1n,
    twitterCreditNullifier: 2n,
    creatorCoinAddr: 0x00000000c0ffeec0ffeec0ffeec0ffeec0ffeec0n,
    epoch: 1n,
    signupIdHash: 3n,
    spendRefIdHash: 4n,
    pointsBurnedAsUSD: 1_000_000n,
  }

  function buildBaselineArgs() {
    const wac = computeAmoeWalletAddrCommit(
      baseRaw.wallet,
      baseRaw.twitterCreditNullifier,
    )
    return {
      raw: { ...baseRaw },
      trees: {
        allowlistSnapshot: buildAmoeAllowlistSnapshotFromSingleWallet(
          baseRaw.wallet,
          baseRaw.epoch,
        ),
        allowlistLeafIndex: 0,
        pointsLedgerSnapshot: buildAmoeLedgerSnapshotFromSingleEntry({
          signupIdHash: baseRaw.signupIdHash,
          spendRefIdHash: baseRaw.spendRefIdHash,
          pointsBurnedAsUSD: baseRaw.pointsBurnedAsUSD,
          epoch: baseRaw.epoch,
          walletAddrCommit: wac,
        }),
        pointsLedgerLeafIndex: 0,
      },
    }
  }

  it('baseline args produce a witness without throwing', () => {
    expect(() => assembleAmoeWitness(buildBaselineArgs())).not.toThrow()
  })

  it('rejects null args', () => {
    expect(() =>
      assembleAmoeWitness(null as unknown as ReturnType<typeof buildBaselineArgs>),
    ).toThrowError(AmoeProofGenerationError)
  })

  it('rejects missing raw block', () => {
    const args = buildBaselineArgs() as unknown as Record<string, unknown>
    delete args.raw
    expect(() =>
      assembleAmoeWitness(args as ReturnType<typeof buildBaselineArgs>),
    ).toThrowError(AmoeProofGenerationError)
  })

  it('rejects missing trees block', () => {
    const args = buildBaselineArgs() as unknown as Record<string, unknown>
    delete args.trees
    expect(() =>
      assembleAmoeWitness(args as ReturnType<typeof buildBaselineArgs>),
    ).toThrowError(AmoeProofGenerationError)
  })

  it('rejects non-bigint raw input', () => {
    const args = buildBaselineArgs()
    ;(args.raw as unknown as Record<string, unknown>).wallet = '123'
    expect(() => assembleAmoeWitness(args)).toThrowError(
      AmoeProofGenerationError,
    )
  })

  it('rejects negative bigint', () => {
    const args = buildBaselineArgs()
    args.raw.nonce = -1n
    expect(() => assembleAmoeWitness(args)).toThrowError(
      AmoeProofGenerationError,
    )
  })

  it('canonicalizes bytes32 inputs above Q (server-issued randomBytes(32) nonces, off-chain hash IDs)', () => {
    // ~81% of randomBytes(32) values exceed Q. Pre-fix this would have
    // thrown plonk_witness_input_invalid; post-fix it must succeed and
    // produce the same nonceCommit as if the caller had pre-reduced.
    const args = buildBaselineArgs()
    const overQNonce = AMOE_BN254_FIELD_MODULUS + 7n
    args.raw.nonce = overQNonce
    expect(() => assembleAmoeWitness(args)).not.toThrow()
    const w = assembleAmoeWitness(args)
    // The witness's nonce field is canonicalized.
    expect(w.nonce).toBe(7n)
    // And nonceCommit matches a pre-canonicalized re-derivation.
    const expected = computeAmoeNonceCommit(
      7n,
      baseRaw.wallet,
      baseRaw.creatorCoinAddr,
    )
    expect(w.nonceCommit).toBe(expected)
  })

  it('canonicalizes signupIdHash / spendRefIdHash / twitterCreditNullifier above Q', () => {
    // Server-issued off-chain identifier hashes are bytes32-domain values
    // and may exceed Q. Pre-fix this would have been hard-rejected; post-fix
    // we canonicalize via mod Q.
    //
    // Note: the ledger snapshot must be built with the *canonicalized* id
    // hash values, because the on-chain ledger root commits to canonical
    // field elements (the circuit cannot witness anything else). The
    // canonicalization happens in one place — assembleAmoeWitness — so
    // callers who mint snapshots must canonicalize the same way before
    // hashing leaves. We replicate that contract here.
    const overSignup = AMOE_BN254_FIELD_MODULUS + 1n
    const overSpend = AMOE_BN254_FIELD_MODULUS + 2n
    const overTwitter = AMOE_BN254_FIELD_MODULUS + 3n
    const canonSignup = canonicalizeAmoeBytes32ToField('signupIdHash', overSignup)
    const canonSpend = canonicalizeAmoeBytes32ToField('spendRefIdHash', overSpend)
    const canonTwitter = canonicalizeAmoeBytes32ToField(
      'twitterCreditNullifier',
      overTwitter,
    )
    expect(canonSignup).toBe(1n)
    expect(canonSpend).toBe(2n)
    expect(canonTwitter).toBe(3n)

    // Build a snapshot from canonicalized id-hash values + canonicalized wac.
    const wac = computeAmoeWalletAddrCommit(baseRaw.wallet, canonTwitter)
    const args = {
      raw: {
        ...baseRaw,
        signupIdHash: overSignup,
        spendRefIdHash: overSpend,
        twitterCreditNullifier: overTwitter,
      },
      trees: {
        allowlistSnapshot: buildAmoeAllowlistSnapshotFromSingleWallet(
          baseRaw.wallet,
          baseRaw.epoch,
        ),
        allowlistLeafIndex: 0,
        pointsLedgerSnapshot: buildAmoeLedgerSnapshotFromSingleEntry({
          signupIdHash: canonSignup,
          spendRefIdHash: canonSpend,
          pointsBurnedAsUSD: baseRaw.pointsBurnedAsUSD,
          epoch: baseRaw.epoch,
          walletAddrCommit: wac,
        }),
        pointsLedgerLeafIndex: 0,
      },
    }
    const w = assembleAmoeWitness(args)
    expect(w.signupIdHash).toBe(1n)
    expect(w.spendRefIdHash).toBe(2n)
    expect(w.twitterCreditNullifier).toBe(3n)
  })

  it('rejects bytes32 inputs above 2^256 - 1 (clearly a caller bug)', () => {
    const args = buildBaselineArgs()
    args.raw.nonce = AMOE_BYTES32_DOMAIN_MAX + 1n
    expect(() => assembleAmoeWitness(args)).toThrowError(
      AmoeProofGenerationError,
    )
  })

  it('rejects strict-domain wallet input above field modulus', () => {
    // wallet remains strict-checked — it is bounded by 2^160 by domain,
    // so a value above Q can only be a caller bug.
    const args = buildBaselineArgs()
    args.raw.wallet = AMOE_BN254_FIELD_MODULUS
    expect(() => assembleAmoeWitness(args)).toThrowError(
      AmoeProofGenerationError,
    )
  })

  it('rejects creatorCoinAddr > 2^160 - 1', () => {
    const args = buildBaselineArgs()
    args.raw.creatorCoinAddr = AMOE_MAX_CREATOR_COIN_ADDR + 1n
    expect(() => assembleAmoeWitness(args)).toThrowError(
      AmoeProofGenerationError,
    )
  })

  it('rejects epoch > 2^64 - 1', () => {
    const args = buildBaselineArgs()
    args.raw.epoch = AMOE_MAX_EPOCH + 1n
    // epoch overflow also breaks snapshot building (because the leaf
    // would change), but the validation runs first — check that we get
    // a typed error.
    expect(() => assembleAmoeWitness(args)).toThrowError(
      AmoeProofGenerationError,
    )
  })

  it('rejects pointsBurnedAsUSD > 2^64 - 1', () => {
    const args = buildBaselineArgs()
    args.raw.pointsBurnedAsUSD = AMOE_MAX_POINTS_BURNED_AS_USD + 1n
    expect(() => assembleAmoeWitness(args)).toThrowError(
      AmoeProofGenerationError,
    )
  })

  it('rejects malformed allowlist snapshot (missing nodes map)', () => {
    const args = buildBaselineArgs()
    args.trees.allowlistSnapshot = {
      ...args.trees.allowlistSnapshot,
      // Strip the Map → not a real snapshot anymore.
      nodes: undefined as unknown as ReadonlyMap<number, bigint>,
    }
    expect(() => assembleAmoeWitness(args)).toThrowError(
      AmoeProofGenerationError,
    )
  })

  it('rejects negative allowlistLeafIndex', () => {
    const args = buildBaselineArgs()
    args.trees.allowlistLeafIndex = -1
    expect(() => assembleAmoeWitness(args)).toThrowError(
      AmoeProofGenerationError,
    )
  })

  it('rejects non-integer pointsLedgerLeafIndex', () => {
    const args = buildBaselineArgs()
    args.trees.pointsLedgerLeafIndex = 1.5
    expect(() => assembleAmoeWitness(args)).toThrowError(
      AmoeProofGenerationError,
    )
  })

  it('rejects mismatched allowlist leaf at claimed index', () => {
    // Build a snapshot for a *different* wallet but pass the original
    // wallet in raw — the derived leaf won't match level0[0].
    const args = buildBaselineArgs()
    args.trees.allowlistSnapshot = buildAmoeAllowlistSnapshotFromSingleWallet(
      baseRaw.wallet + 1n,
      baseRaw.epoch,
    )
    expect(() => assembleAmoeWitness(args)).toThrowError(
      AmoeProofGenerationError,
    )
  })

  it('rejects mismatched ledger leaf at claimed index', () => {
    // Same idea but for the ledger — change one input in the published
    // snapshot so the leaf the assembler derives doesn't line up.
    const args = buildBaselineArgs()
    const wac = computeAmoeWalletAddrCommit(
      baseRaw.wallet,
      baseRaw.twitterCreditNullifier,
    )
    args.trees.pointsLedgerSnapshot = buildAmoeLedgerSnapshotFromSingleEntry({
      signupIdHash: baseRaw.signupIdHash + 999n,
      spendRefIdHash: baseRaw.spendRefIdHash,
      pointsBurnedAsUSD: baseRaw.pointsBurnedAsUSD,
      epoch: baseRaw.epoch,
      walletAddrCommit: wac,
    })
    expect(() => assembleAmoeWitness(args)).toThrowError(
      AmoeProofGenerationError,
    )
  })
})
