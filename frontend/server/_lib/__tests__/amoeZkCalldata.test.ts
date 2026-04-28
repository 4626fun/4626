// PR 4 — AMOE PLONK ZK relayer calldata builder tests.
//
// Locks in the contract between the off-chain proof-generation pipeline (out
// of scope here — see issue #403 §2) and the on-chain `submitAmoeEntryZK`
// entrypoint. The fixture is the SAME 24-element proof + 8 public inputs
// used in `test/zk/AmoePlonkVerifier.t.sol::_fixture()` so a regression in
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
//     `test/zk/AmoePlonkVerifier.t.sol`. We assert SHAPE, BOUNDS, and
//     ENCODING here — proof correctness is on-chain's responsibility.

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
// Fixture — must mirror `test/zk/AmoePlonkVerifier.t.sol::_fixture()` exactly.
// ---------------------------------------------------------------------------

const FIXTURE_PROOF: readonly bigint[] = [
  0x1a44fca81e6bbdf6a3cde5b7933a8d50323744c332d72c3c4453819f75ff50e5n,
  0x2becebd5241a74f96de452019edbec80270827d51c2de3bf893a739458fa097bn,
  0x02afc668d0cef97d04291c1e73dc257102d3eeda38a45e5b41ea833b4d26c016n,
  0x2c7e0f4ea786b191ffbd2db7bb312c4b21a628f9882f8fcd5ea54ac93dd8efa5n,
  0x1ec02acfa1db877238b908741c253528b8ba57dd15cd18823499d9c46fb4d09an,
  0x066a759d52f589a3dcbd03452fd4b3b8b85c863f2b894d4363f74af18312322cn,
  0x039a44f0dfb802e9506ded3543829ff80dc306f6bd7b404cf8f656f280cd2806n,
  0x2d72c9f10ec402bbd81185b37ac7b831a2d08f0471e0960dd89927a7ba1877ccn,
  0x0d0e814571023ff2b983723d38b9da36d9afb9de34a803fcc7f9fb5561459da9n,
  0x00a85b3c39e759845895053e9cf2881e6f9d928712a8f9725bdfa25f2bc242c8n,
  0x27f0b0340edd6a95c9cca7fd3dd8efb41af964add75be6e1ac2b95da59caa46en,
  0x0781f9ad765b5d7d4e2c86a7b16070f10e5c73c3a0c6461e0b9960e7448c3146n,
  0x052b68286cd53177c8852d66100a4819511a955f341c00d159e910e369c675b7n,
  0x27dfe0cc923706fe200d2d3672694545624c4d87753f211e9023f21dbb78d2bcn,
  0x25520a560afd12bfbd4208870708b08e2716b7e59095e45db9041365d18fca37n,
  0x09c642db3edcf25f8ecd350ee80e3e8fb24c4227cada7a4c4907cacebc621cdan,
  0x1a779119ced970ec3ea0038f1ea7a7addf6dcd0e482d8142cb05838c08389f25n,
  0x1252458f38e92b09883396f035948d9385480d2661040b752ed4085b792bbe56n,
  0x26bcefc70e7f31ccc994eb16be6568d0776fcfa7401474bc1dc2b2cf6d5b478en,
  0x232988a742744c6589dc0a32dc480d79617b0bdc39a283edd97649b5ac6bd14dn,
  0x0f8e44679a967e47dfaa6c95c22e0627f77bc8fe1bd28c206cbf5ec46cc37c1cn,
  0x0b3e1923f8e9c0fa144ec17b33aa3db604d6a24e80560cd47ad397062115f22an,
  0x0fe474d9a1837d4b7e73352f6f9e03b23514207c4877e0a2388d56558c64ebaen,
  0x21406ad366d4c1f8a2763b5ab4bee29e6cb9617319575d7345b68085c17f9eb3n,
]

const FIXTURE_PUB: readonly bigint[] = [
  // [0] walletAddrCommit (Poseidon commit, opaque to relayer)
  0x14e9fd289780e5f9f4da1fb2a4759160db00379afa607c737578efbb93d24f98n,
  // [1] creatorCoinAddr — must match calldata `creatorCoin` masked to uint160
  0x00000000000000000000000000000000c0ffeec0ffeec0ffeec0ffeec0ffeec0n,
  // [2] nonceCommit
  0x011f2b850c7c8879a9cc7b87fa6edd0a4b0dd65e4e842f8637494550f572dc01n,
  // [3] epoch — must match calldata `epoch` (here = 1)
  0x0000000000000000000000000000000000000000000000000000000000000001n,
  // [4] allowlistRoot
  0x1aa68d103c8a332b52d205b2b10cda8a22edb028374e0cb7cc5ef5f288e63e17n,
  // [5] pointsBurnedAsUSD = 0x0f4240 = 1_000_000 = $1 in USDC 1e6
  0x00000000000000000000000000000000000000000000000000000000000f4240n,
  // [6] pointsLedgerRoot
  0x16bc6d81db1eaf1680362aaf47f0c676a21281346c77be08036397f01e749839n,
  // [7] pointsBurnNullifier
  0x0ecf6254b04738d669fff669b4ebd525bddbd6989e06b4a94d4e2f8ea1e167bcn,
]

// Address derived from pub[1] masked to uint160 (lower 20 bytes). pub[1] is
// 32 bytes — top 16 are zero, bottom 16 are 0xc0ffee... — so the address is
// 4 zero bytes + the 16 c0ffee bytes = 20 bytes. Must match exactly or the
// builder rejects with `zk_creator_coin_pub_input_mismatch`.
const FIXTURE_CREATOR_COIN_ADDR =
  '0x00000000c0ffeec0ffeec0ffeec0ffeec0ffeec0' as const

// All-lowercase to skip viem's checksum check (the on-chain address is
// equally valid in either case — EIP-55 mixed case is just a typo guard).
const FIXTURE_WALLET = '0xabcdef0123456789abcdef0123456789abcdef01' as const
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
      { name: 'pubInputs', type: 'uint256[8]' },
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

  it('public inputs length is 8 (locked by IAmoePlonkVerifier)', () => {
    expect(AMOE_PLONK_PUB_INPUTS_LEN).toBe(8)
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
    expect(pub.length).toBe(8)
    // Spot-check first/last proof scalars and every pub input.
    expect(proof[0]).toBe(FIXTURE_PROOF[0])
    expect(proof[23]).toBe(FIXTURE_PROOF[23])
    for (let i = 0; i < 8; i++) {
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

  it('rejects pubInputs with wrong length (7 instead of 8)', async () => {
    await expect(
      buildAmoeEntryZKCall({ ...happyInputs(), pubInputs: FIXTURE_PUB.slice(0, 7) }),
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
