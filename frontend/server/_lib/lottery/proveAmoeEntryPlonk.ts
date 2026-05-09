// SPDX-License-Identifier: MIT
//
// PR 4 follow-up — AMOE PLONK proof generation, server-side wrapper.
//
// SCOPE OF THIS MODULE (foundational; deliberately narrow)
// ========================================================
// This file is the FIRST slice of the post-PLONK relayer wire-up tracked in
// issue #403 §2. It is intentionally limited to the snarkjs interaction —
// "given a finished witness input, run snarkjs PLONK and emit the
// (proof[24], pubInputs[8]) tuple our on-chain verifier consumes."
//
// What is IN scope (this module):
//   * `parsePlonkSolidityCallData` — pure parser. Takes the string returned
//     by `snarkjs.plonk.exportSolidityCallData(proof, publicSignals)` and
//     splits it into (proofScalars[24], publicScalars[N]). Pure, no I/O.
//   * `proveAmoeEntryPlonk` — thin wrapper around `snarkjs.plonk.fullProve`.
//     Takes a fully-prepared circuit witness (the AMOE eligibility template
//     declares 14 input signals — see banner below), the wasm + zkey paths,
//     and returns the calldata-ready (proof, pubInputs) pair.
//   * Strict shape + field-bounds validation. Any deviation throws
//     `AmoeProofGenerationError` with a stable error code. All thrown errors
//     are safe to surface to the relayer's retry logic.
//
// What is OUT OF SCOPE (deferred to subsequent PRs in #403 §2):
//   * Witness CONSTRUCTION — i.e. computing `walletAddrCommit`,
//     `nonceCommit`, the allowlist Merkle path (`pathElements[20]` /
//     `pathIndices[20]`), and the points-burn Merkle path. Those need a
//     points-ledger source-of-truth (#403 §2 — daily root publisher) which
//     is a separate workstream.
//   * Daily ledger-root publisher (`setPointsLedgerRoot(epoch, root)`).
//   * Server-side `pointsBurnNullifier` replay store.
//   * The `/submit-amoe-zk` HTTP handler swap (still on the legacy ECDSA
//     path today; see `frontend/api/_handlers/v1/lottery/_amoeSubmit.ts`).
//   * `ManagerDeclinedEntry` retry semantics in the relayer.
//
// CIRCUIT INPUT SIGNATURE (locked by circuits/amoe/amoe_eligibility.circom)
// ========================================================================
//   Public (8, in declaration order — matches `AMOE_PLONK_PUB_INPUT_SLOT`):
//     walletAddrCommit, creatorCoinAddr, nonceCommit, epoch,
//     allowlistRoot, pointsBurnedAsUSD, pointsLedgerRoot,
//     pointsBurnNullifier.
//
//   Private (allowlist eligibility):
//     wallet, nonce, twitterCreditNullifier,
//     pathElements[DEPTH], pathIndices[DEPTH].
//
//   Private (points-burn ledger, v2):
//     signupIdHash, spendRefIdHash,
//     pointsLedgerPathElements[DEPTH], pointsLedgerPathIndices[DEPTH].
//
//   DEPTH = 20 (locked in the circuit; supports up to 2^20 leaves per
//   snapshot for both the allowlist and the points-burn ledger trees).
//
// snarkjs ORDERING CONTRACT (the reason this file is small)
// =========================================================
// `snarkjs.plonk.fullProve` returns `{ proof, publicSignals }` where
// `publicSignals` preserves the circuit's *declared* public-input order. The
// circuit declares the eight public signals in EXACTLY the order pinned by
// `AMOE_PLONK_PUB_INPUT_SLOT`, so no re-permutation is required here. If
// you reorder the public-input declarations in the .circom file, this
// module will silently emit the wrong slot order — the patch guard
// (`tools/ci/check_amoe_plonk_patch.sh`) and the on-chain calldata→pubInputs
// binding in `LotteryAmoeRouter.submitAmoeEntryZK` will both catch the
// drift, but at the cost of a guaranteed-revert tx, so keep them in sync.

import {
  AMOE_BN254_SCALAR_FIELD_Q,
  AMOE_PLONK_PROOF_LEN,
  AMOE_PLONK_PUB_INPUTS_LEN,
} from './lotteryAmoe.js'

// ----------------------------------------------------------------------------
// Errors
// ----------------------------------------------------------------------------

/**
 * Stable error codes thrown by this module. Keep this in sync with the
 * documented contract in {@link proveAmoeEntryPlonk} — relayer retry logic
 * branches on these codes, so removing or renaming one is a breaking change.
 */
export type AmoeProofGenerationErrorCode =
  | 'plonk_calldata_parse_failed'
  | 'plonk_calldata_proof_length_mismatch'
  | 'plonk_calldata_pubinputs_length_mismatch'
  | 'plonk_calldata_scalar_not_hex'
  | 'plonk_calldata_scalar_out_of_field'
  | 'plonk_witness_input_missing'
  | 'plonk_witness_input_invalid'
  | 'plonk_snarkjs_failed'

export class AmoeProofGenerationError extends Error {
  readonly code: AmoeProofGenerationErrorCode

  constructor(code: AmoeProofGenerationErrorCode, message?: string) {
    // Keep the message defaulting to the code so logs are searchable even
    // when callers forget to provide context.
    super(message ?? code)
    this.code = code
    this.name = 'AmoeProofGenerationError'
  }
}

// ----------------------------------------------------------------------------
// Pure parser: snarkjs `exportSolidityCallData` → (proof[24], pubInputs[N])
// ----------------------------------------------------------------------------

/**
 * Result of parsing snarkjs's solidity-calldata string for a PLONK proof.
 * Both arrays carry BN254 scalars in `[0, Q)` (the parser enforces this).
 *
 * `proof` is fixed-length 24 (the on-chain verifier signature).
 * `pubInputs` is variable-length here on purpose — callers that target
 * `submitAmoeEntryZK` must additionally check `length === 8`. Decoupling
 * lets us reuse this parser for any future verifier (e.g. a different
 * circuit) without changing the parse code.
 */
export interface ParsedPlonkCallData {
  proof: bigint[]
  pubInputs: bigint[]
}

/**
 * Regex matching one BN254 scalar in the snarkjs solidity-calldata format.
 * snarkjs emits `"0x"` followed by 1–64 lowercase hex digits, wrapped in
 * double quotes. We deliberately accept both lowercase and uppercase here
 * (defensive — the format has been stable but not contractually pinned).
 */
const PLONK_SCALAR_REGEX = /"0x([0-9a-fA-F]+)"/g

/**
 * Parse a snarkjs PLONK solidity-calldata string into typed scalar arrays.
 *
 * INPUT FORMAT (snarkjs ≥ 0.7.x, PLONK):
 *   `["0x..","0x..", ... 24 entries ...]["0x..","0x..", ... N entries ...]`
 *
 *   Two top-level JSON arrays concatenated with no separator. The first is
 *   the 24-element proof; the second is the public-signals array (length =
 *   circuit's `nPublic`, which is 8 for AMOE eligibility v2).
 *
 * What this function VALIDATES:
 *   1. The string contains exactly 24 hex scalars in the proof position
 *      (anything else throws `plonk_calldata_proof_length_mismatch`).
 *   2. Every hex scalar parses as a valid BN254 scalar (i.e. is in
 *      `[0, Q)`). Anything ≥ Q throws `plonk_calldata_scalar_out_of_field`.
 *   3. The string contains at least one trailing public-signal scalar
 *      (caller decides on exact count for their verifier).
 *
 * What this function does NOT do:
 *   * Verify the proof is valid (that's the on-chain verifier's job).
 *   * Constrain `pubInputs.length` to 8 (caller's job — see the
 *     `_assertPubInputsLength` helper used by {@link proveAmoeEntryPlonk}).
 *
 * @throws {AmoeProofGenerationError} on any structural / field-bounds violation
 */
export function parsePlonkSolidityCallData(
  raw: string,
): ParsedPlonkCallData {
  // Defensive: if snarkjs ever changes its output format wholesale we want
  // the failure to be the parse error, not a downstream length mismatch.
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new AmoeProofGenerationError(
      'plonk_calldata_parse_failed',
      'snarkjs returned an empty solidity-calldata string',
    )
  }

  // The two arrays are concatenated as `]+[` with no separator. Splitting
  // on the boundary lets us tell proof scalars from public-signal scalars
  // without having to count occurrences. Trim square brackets to get raw
  // comma-delimited payloads.
  //
  // We use a SINGLE split rather than JSON.parse-twice because snarkjs
  // emits unquoted arrays of strings — concatenated they don't parse as
  // valid JSON. Regex extraction is robust to whitespace variations the
  // snarkjs codebase has used historically.
  const boundary = raw.indexOf('][')
  if (boundary === -1) {
    throw new AmoeProofGenerationError(
      'plonk_calldata_parse_failed',
      'snarkjs solidity-calldata string is missing the proof/public boundary',
    )
  }

  const proofChunk = raw.slice(0, boundary + 1) // include trailing `]`
  const pubChunk = raw.slice(boundary + 1) // start at leading `[`

  const proof = _extractScalars(proofChunk)
  const pubInputs = _extractScalars(pubChunk)

  if (proof.length !== AMOE_PLONK_PROOF_LEN) {
    throw new AmoeProofGenerationError(
      'plonk_calldata_proof_length_mismatch',
      `expected ${AMOE_PLONK_PROOF_LEN} proof scalars, got ${proof.length}`,
    )
  }

  // Empty public-signal list is also a parse failure — the AMOE circuit has
  // 8 public inputs so a zero-length pub array means snarkjs emitted a
  // shape we don't understand.
  if (pubInputs.length === 0) {
    throw new AmoeProofGenerationError(
      'plonk_calldata_parse_failed',
      'snarkjs solidity-calldata string has no public-signal scalars',
    )
  }

  return { proof, pubInputs }
}

/**
 * Extract every quoted hex scalar from one snarkjs array chunk and validate
 * each is a BN254 field element.
 */
function _extractScalars(chunk: string): bigint[] {
  const out: bigint[] = []
  // Reset lastIndex so repeated calls don't share regex state — JS RegExp
  // global-flag state is a frequent footgun.
  PLONK_SCALAR_REGEX.lastIndex = 0
  for (const m of chunk.matchAll(PLONK_SCALAR_REGEX)) {
    const hex = m[1]
    // 0–64 hex chars = 0..uint256. snarkjs emits MSB-trimmed values so
    // shorter hex is normal (e.g. "0x1" for the literal 1).
    if (hex === undefined || hex.length === 0 || hex.length > 64) {
      throw new AmoeProofGenerationError(
        'plonk_calldata_scalar_not_hex',
        `invalid hex scalar in snarkjs calldata: "${m[0]}"`,
      )
    }
    let value: bigint
    try {
      value = BigInt(`0x${hex}`)
    } catch {
      throw new AmoeProofGenerationError(
        'plonk_calldata_scalar_not_hex',
        `BigInt parse failed for "${m[0]}"`,
      )
    }
    // Field bound. The on-chain verifier's `checkField` rejects anything
    // ≥ Q with `InvalidProof`; we mirror it here so the relayer fails
    // fast and surfaces a typed error instead of paying gas.
    if (value >= AMOE_BN254_SCALAR_FIELD_Q) {
      throw new AmoeProofGenerationError(
        'plonk_calldata_scalar_out_of_field',
        `scalar ${value} is >= BN254 scalar field modulus`,
      )
    }
    out.push(value)
  }
  return out
}

// ----------------------------------------------------------------------------
// snarkjs wrapper: witness input → (proof[24], pubInputs[8])
// ----------------------------------------------------------------------------

/**
 * AMOE eligibility circuit witness input. Maps 1:1 onto the 14 declared
 * input signals in `circuits/amoe/amoe_eligibility.circom::AmoeEligibility`.
 *
 * VALUES MUST BE BN254-FIELD-VALID. snarkjs accepts BigInts, decimal-string
 * BigInts, and base-10 numbers; we normalize to decimal strings before
 * handing them to snarkjs because (a) snarkjs documentation uses that form
 * and (b) it sidesteps a known v0.6.x bug where numeric input occasionally
 * round-trips through Number() and loses precision above 2^53.
 *
 * DEPTH is 20 — `pathElements` and `pathIndices` MUST be exactly that
 * length or snarkjs will emit an opaque "Assert Failed" message at witness
 * generation time.
 */
export interface AmoeEligibilityWitness {
  // ---- Public inputs (will appear in publicSignals after fullProve) ----
  walletAddrCommit: string | bigint
  creatorCoinAddr: string | bigint
  nonceCommit: string | bigint
  epoch: string | bigint
  allowlistRoot: string | bigint
  pointsBurnedAsUSD: string | bigint
  pointsLedgerRoot: string | bigint
  pointsBurnNullifier: string | bigint

  // ---- Private inputs (allowlist eligibility) ----
  wallet: string | bigint
  nonce: string | bigint
  twitterCreditNullifier: string | bigint
  pathElements: ReadonlyArray<string | bigint>
  pathIndices: ReadonlyArray<string | bigint>

  // ---- Private inputs (points-burn ledger, v2) ----
  signupIdHash: string | bigint
  spendRefIdHash: string | bigint
  pointsLedgerPathElements: ReadonlyArray<string | bigint>
  pointsLedgerPathIndices: ReadonlyArray<string | bigint>
}

/**
 * Locked Merkle-tree depth of both the allowlist and the points-burn
 * ledger. Mirrors `DEPTH` in the .circom file. Bumping this without
 * regenerating the circuit will cause snarkjs to emit an "Assert Failed"
 * error when it walks the path arrays.
 */
export const AMOE_MERKLE_DEPTH = 20 as const

export interface AmoeProveResult {
  /** 24-element PLONK proof, scalars in `[0, Q)`. Suitable as input to
   *  `buildAmoeEntryZKCall`. */
  proof: bigint[]
  /** 8-element public-input array, in the slot order pinned by
   *  `AMOE_PLONK_PUB_INPUT_SLOT`. */
  pubInputs: bigint[]
}

export interface ProveAmoeEntryPlonkOptions {
  /**
   * Filesystem path to the circuit's compiled `amoe_eligibility.wasm`. In
   * production this is fetched/cached from object storage on cold start
   * (see #403 §2 — zkey hosting workstream). In tests we point at the
   * checked-in fixture wasm.
   */
  wasmPath: string

  /**
   * Filesystem path to the PLONK final zkey (`amoe_plonk_final.zkey`). Same
   * sourcing as `wasmPath` — production fetches from blob storage; tests
   * use the small checked-in fixture zkey.
   */
  zkeyPath: string

  /**
   * Optional snarkjs override — primarily for tests that want to inject a
   * deterministic mock. Production callers leave this unset.
   */
  snarkjs?: SnarkjsLike
}

/**
 * Minimal snarkjs surface this module depends on. Defining it as a named
 * interface (a) lets us tree-shake the rest of the snarkjs API and (b)
 * makes mocking in tests trivial without `vi.mock(...)` ESM gymnastics.
 */
export interface SnarkjsLike {
  plonk: {
    fullProve: (
      input: Record<string, unknown>,
      wasmPath: string,
      zkeyPath: string,
    ) => Promise<{ proof: unknown; publicSignals: unknown }>
    exportSolidityCallData: (
      proof: unknown,
      publicSignals: unknown,
    ) => Promise<string>
  }
}

/**
 * Generate a PLONK proof for the AMOE eligibility circuit and return it in
 * the (proof[24], pubInputs[8]) shape the on-chain `submitAmoeEntryZK`
 * verifier consumes.
 *
 * This function is a *thin* wrapper. It does not:
 *   * Build the witness — caller is responsible for computing every input
 *     signal listed on {@link AmoeEligibilityWitness}. Witness construction
 *     (Poseidon hashes, Merkle paths) is the next workstream in #403 §2.
 *   * Submit the proof on-chain — caller hands the result to
 *     {@link buildAmoeEntryZKCall} and broadcasts the resulting calldata.
 *
 * It DOES:
 *   * Normalize witness values to snarkjs-friendly decimal strings.
 *   * Length-check the Merkle-path arrays (DEPTH=20).
 *   * Run snarkjs PLONK fullProve.
 *   * Parse `exportSolidityCallData` back into typed scalar arrays.
 *   * Verify both arrays come back in the expected lengths and field bounds.
 *
 * Errors are typed via {@link AmoeProofGenerationError} with stable codes —
 * relayer retry logic should branch on `error.code`, not `error.message`.
 */
export async function proveAmoeEntryPlonk(
  witness: AmoeEligibilityWitness,
  opts: ProveAmoeEntryPlonkOptions,
): Promise<AmoeProveResult> {
  const snarkjs = opts.snarkjs ?? (await _loadSnarkjs())

  const input = _normalizeWitness(witness)

  let proof: unknown
  let publicSignals: unknown
  try {
    const out = await snarkjs.plonk.fullProve(input, opts.wasmPath, opts.zkeyPath)
    proof = out.proof
    publicSignals = out.publicSignals
  } catch (cause) {
    // snarkjs throws a mix of strings and Error objects depending on which
    // sub-step blew up (witness gen vs. proof gen). Always wrap so the
    // caller sees a consistent error type with a stable code.
    const reason = cause instanceof Error ? cause.message : String(cause)
    throw new AmoeProofGenerationError(
      'plonk_snarkjs_failed',
      `snarkjs.plonk.fullProve failed: ${reason}`,
    )
  }

  let calldataString: string
  try {
    calldataString = await snarkjs.plonk.exportSolidityCallData(proof, publicSignals)
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    throw new AmoeProofGenerationError(
      'plonk_snarkjs_failed',
      `snarkjs.plonk.exportSolidityCallData failed: ${reason}`,
    )
  }

  const parsed = parsePlonkSolidityCallData(calldataString)

  if (parsed.pubInputs.length !== AMOE_PLONK_PUB_INPUTS_LEN) {
    throw new AmoeProofGenerationError(
      'plonk_calldata_pubinputs_length_mismatch',
      `expected ${AMOE_PLONK_PUB_INPUTS_LEN} public inputs, got ${parsed.pubInputs.length}`,
    )
  }

  return { proof: parsed.proof, pubInputs: parsed.pubInputs }
}

// ----------------------------------------------------------------------------
// Internals
// ----------------------------------------------------------------------------

/**
 * Lazy import of snarkjs. snarkjs is a heavy package (~2 MB minified, pulls
 * ffjavascript) and we don't want it loaded by every module that imports
 * `lotteryAmoe.ts`. Deferring keeps cold-start cost off the hot path for
 * any handler that doesn't actually generate proofs (most of them).
 */
async function _loadSnarkjs(): Promise<SnarkjsLike> {
  const snarkjsModuleName = 'snarkjs'
  const mod = (await import(
    /* @vite-ignore */ snarkjsModuleName
  )) as unknown as SnarkjsLike
  if (!mod?.plonk?.fullProve || !mod?.plonk?.exportSolidityCallData) {
    throw new AmoeProofGenerationError(
      'plonk_snarkjs_failed',
      'snarkjs is missing the expected plonk.fullProve / exportSolidityCallData exports',
    )
  }
  return mod
}

/**
 * Coerce every witness signal to the decimal-string form snarkjs expects.
 * Throws `plonk_witness_input_*` on any malformed value so the caller gets
 * a typed error instead of an opaque snarkjs assertion later.
 *
 * NOTE on field bounds: we intentionally do NOT enforce `< Q` here. The
 * circuit's range-checks (`Num2Bits`, `LessThan`, etc.) catch out-of-range
 * private inputs at witness-gen time, and the on-chain verifier rejects
 * out-of-range public inputs. Imposing a duplicate check here would have
 * to also handle "but the circuit allows up to 2^254 for some signals,"
 * which is more error-prone than letting the existing layers do their job.
 */
function _normalizeWitness(
  witness: AmoeEligibilityWitness,
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}

  // Scalar inputs.
  const scalarKeys = [
    'walletAddrCommit',
    'creatorCoinAddr',
    'nonceCommit',
    'epoch',
    'allowlistRoot',
    'pointsBurnedAsUSD',
    'pointsLedgerRoot',
    'pointsBurnNullifier',
    'wallet',
    'nonce',
    'twitterCreditNullifier',
    'signupIdHash',
    'spendRefIdHash',
  ] as const

  for (const key of scalarKeys) {
    const v = witness[key]
    if (v === undefined || v === null) {
      throw new AmoeProofGenerationError(
        'plonk_witness_input_missing',
        `witness signal "${key}" is missing`,
      )
    }
    out[key] = _toDecimalString(v, key)
  }

  // Path arrays — both the allowlist tree and the points-burn ledger tree
  // run at the locked DEPTH=20.
  out.pathElements = _normalizePathArray(witness.pathElements, 'pathElements')
  out.pathIndices = _normalizePathArray(witness.pathIndices, 'pathIndices')
  out.pointsLedgerPathElements = _normalizePathArray(
    witness.pointsLedgerPathElements,
    'pointsLedgerPathElements',
  )
  out.pointsLedgerPathIndices = _normalizePathArray(
    witness.pointsLedgerPathIndices,
    'pointsLedgerPathIndices',
  )

  return out
}

function _toDecimalString(value: string | bigint, key: string): string {
  if (typeof value === 'bigint') {
    if (value < 0n) {
      throw new AmoeProofGenerationError(
        'plonk_witness_input_invalid',
        `witness signal "${key}" is negative`,
      )
    }
    return value.toString(10)
  }
  if (typeof value === 'string') {
    // Accept decimal or 0x-hex. Anything else is a programming error.
    let big: bigint
    try {
      big = value.startsWith('0x') || value.startsWith('0X')
        ? BigInt(value)
        : BigInt(value)
    } catch {
      throw new AmoeProofGenerationError(
        'plonk_witness_input_invalid',
        `witness signal "${key}" is not a valid integer string`,
      )
    }
    if (big < 0n) {
      throw new AmoeProofGenerationError(
        'plonk_witness_input_invalid',
        `witness signal "${key}" is negative`,
      )
    }
    return big.toString(10)
  }
  throw new AmoeProofGenerationError(
    'plonk_witness_input_invalid',
    `witness signal "${key}" must be string | bigint`,
  )
}

function _normalizePathArray(
  arr: ReadonlyArray<string | bigint> | undefined,
  key: string,
): string[] {
  if (!Array.isArray(arr)) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_missing',
      `witness signal "${key}" must be an array`,
    )
  }
  if (arr.length !== AMOE_MERKLE_DEPTH) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `witness signal "${key}" must have length ${AMOE_MERKLE_DEPTH}, got ${arr.length}`,
    )
  }
  return arr.map((v, i) => _toDecimalString(v, `${key}[${i}]`))
}
