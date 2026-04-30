// PR 3 — `amoeSubmitZk` orchestration tests.
//
// Coverage:
//   1. `computeAmoeEpoch` — deterministic epoch arithmetic. Pinned
//      genesis is 2026-04-30 00:00 UTC; tests verify (a) pre-genesis
//      returns 0n (handler should reject), (b) genesis itself returns 0n
//      (open-interval), (c) one-second-after returns 0n still (since the
//      first day's "current" epoch is 0), (d) genesis + 1 day returns 1n.
//   2. `assertOrchestrationInputsShape` — defense-in-depth validators.
//   3. `readLotteryAmoeRouterAddress` — env-driven, lowercased, returns
//      null on missing/malformed.
//   4. `isAmoeZkSubmitEnabled` — feature flag gate.
//   5. `defaultAmoeZkAssetPaths` — env override + repo-relative fallback.
//   6. End-to-end `orchestrateAmoeSubmitZk` — with mocked snarkjs +
//      stub-allowlisted env, the orchestrator threads:
//        - identifier derivation
//        - epoch computation
//        - witness assembly
//        - PLONK prove (mocked)
//        - calldata build
//      and detects pubInputs drift between the proven value and the
//      committed `pointsBurnedAsUSD`.

import { describe, expect, it, vi, afterEach } from 'vitest'

import {
  AMOE_EPOCH_GENESIS_UNIX_SEC,
  AMOE_EPOCH_SECONDS,
  assertOrchestrationInputsShape,
  computeAmoeEpoch,
  defaultAmoeZkAssetPaths,
  isAmoeZkSubmitEnabled,
  orchestrateAmoeSubmitZk,
  readLotteryAmoeRouterAddress,
  type AmoeSubmitZkOrchestrationInputs,
} from '../lottery/amoeSubmitZk.js'
import {
  AMOE_PLONK_PROOF_LEN,
  AMOE_PLONK_PUB_INPUTS_LEN,
  AMOE_PLONK_PUB_INPUT_SLOT,
  pointsToUsd1e6,
} from '../lottery/lotteryAmoe.js'
import {
  AmoeBadRequestError,
  AmoeServerError,
} from '../lottery/lotteryAmoeErrors.js'
import {
  AmoeProofGenerationError,
  type SnarkjsLike,
} from '../lottery/proveAmoeEntryPlonk.js'

// ----------------------------------------------------------------------------
// Env helpers
// ----------------------------------------------------------------------------

function setEnv(values: Record<string, string | undefined>): () => void {
  const prior: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(values)) {
    prior[k] = process.env[k]
    if (v === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = v
    }
  }
  return () => {
    for (const [k, v] of Object.entries(prior)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

const FIXTURE_SALT_HEX = 'ab'.repeat(32)
const FIXTURE_WALLET = '0x1111111111111111111111111111111111111111' as const
const FIXTURE_CREATOR = '0x00000000c0ffeec0ffeec0ffeec0ffeec0ffeec0' as const
const FIXTURE_ROUTER = '0x000000000000000000000000000000000000abcd' as const
const FIXTURE_NONCE = `0x${'cd'.repeat(32)}` as `0x${string}`

// ----------------------------------------------------------------------------
// computeAmoeEpoch
// ----------------------------------------------------------------------------

describe('computeAmoeEpoch', () => {
  it('returns 0n for pre-genesis times', () => {
    expect(computeAmoeEpoch(0n)).toBe(0n)
    expect(computeAmoeEpoch(AMOE_EPOCH_GENESIS_UNIX_SEC - 1n)).toBe(0n)
  })

  it('returns 0n for genesis itself (epoch counter is open-interval)', () => {
    expect(computeAmoeEpoch(AMOE_EPOCH_GENESIS_UNIX_SEC)).toBe(0n)
  })

  it('returns 0n for any time in epoch 0 day (genesis + 0..86399 sec)', () => {
    expect(computeAmoeEpoch(AMOE_EPOCH_GENESIS_UNIX_SEC + 1n)).toBe(0n)
    expect(
      computeAmoeEpoch(AMOE_EPOCH_GENESIS_UNIX_SEC + AMOE_EPOCH_SECONDS - 1n),
    ).toBe(0n)
  })

  it('returns 1n at genesis + exactly one day', () => {
    expect(
      computeAmoeEpoch(AMOE_EPOCH_GENESIS_UNIX_SEC + AMOE_EPOCH_SECONDS),
    ).toBe(1n)
  })

  it('returns N for genesis + N days', () => {
    expect(
      computeAmoeEpoch(
        AMOE_EPOCH_GENESIS_UNIX_SEC + AMOE_EPOCH_SECONDS * 365n,
      ),
    ).toBe(365n)
  })

  it('genesis constant is 2026-04-30T00:00:00Z', () => {
    expect(AMOE_EPOCH_GENESIS_UNIX_SEC).toBe(1777507200n)
    expect(Number(AMOE_EPOCH_GENESIS_UNIX_SEC)).toBe(
      Date.UTC(2026, 3, 30) / 1000,
    )
  })

  it('day length is exactly 86400 seconds', () => {
    expect(AMOE_EPOCH_SECONDS).toBe(86400n)
  })

  // ---- Regression: witness ↔ submitZk constant unification ---------------
  //
  // Before the PR 5a hotfix, `amoeWitness.AMOE_EPOCH_GENESIS_SECONDS` was
  // mistakenly set to `1_777_939_200` (= 2026-05-05T00:00:00Z) while
  // `amoeSubmitZk.AMOE_EPOCH_GENESIS_UNIX_SEC` (correct) was
  // `1_777_507_200` (= 2026-04-30T00:00:00Z). Both names now read from
  // the same `amoeWitness` constant; this test pins that wiring so any
  // future contributor who re-introduces a duplicate constant will see
  // a red CI immediately rather than discovering the desync at
  // production cron-time.
  it('AMOE_EPOCH_GENESIS_UNIX_SEC === AMOE_EPOCH_GENESIS_SECONDS (single SoT)', async () => {
    const witness = await import('../lottery/amoeWitness.js')
    expect(AMOE_EPOCH_GENESIS_UNIX_SEC).toBe(witness.AMOE_EPOCH_GENESIS_SECONDS)
    // Sanity: both equal the verified UTC midnight constant.
    expect(witness.AMOE_EPOCH_GENESIS_SECONDS).toBe(1_777_507_200n)
  })

  it('AMOE_EPOCH_SECONDS === AMOE_EPOCH_LENGTH_SECONDS (single SoT)', async () => {
    const witness = await import('../lottery/amoeWitness.js')
    expect(AMOE_EPOCH_SECONDS).toBe(witness.AMOE_EPOCH_LENGTH_SECONDS)
    expect(witness.AMOE_EPOCH_LENGTH_SECONDS).toBe(86_400n)
  })
})

// ----------------------------------------------------------------------------
// assertOrchestrationInputsShape
// ----------------------------------------------------------------------------

function makeInputs(
  overrides: Partial<AmoeSubmitZkOrchestrationInputs> = {},
): AmoeSubmitZkOrchestrationInputs {
  return {
    wallet: FIXTURE_WALLET,
    creatorCoin: FIXTURE_CREATOR,
    pointsBurned: 100,
    nonce: FIXTURE_NONCE,
    twitterHandle: 'wenakita',
    spendRefId: 'idem-2026-04-29-aaaa',
    profileId: 42n,
    lotteryAmoeRouter: FIXTURE_ROUTER,
    ...overrides,
  }
}

describe('assertOrchestrationInputsShape', () => {
  it('accepts a fully-valid input', () => {
    expect(() => assertOrchestrationInputsShape(makeInputs())).not.toThrow()
  })

  it('rejects a bad wallet address', () => {
    expect(() =>
      assertOrchestrationInputsShape(
        makeInputs({ wallet: '0xZ' as `0x${string}` }),
      ),
    ).toThrowError(AmoeBadRequestError)
  })

  it('rejects a bad creator-coin address', () => {
    expect(() =>
      assertOrchestrationInputsShape(
        makeInputs({ creatorCoin: '0x123' as `0x${string}` }),
      ),
    ).toThrowError(AmoeBadRequestError)
  })

  it('rejects a bad router address', () => {
    expect(() =>
      assertOrchestrationInputsShape(
        makeInputs({ lotteryAmoeRouter: '0x' as `0x${string}` }),
      ),
    ).toThrowError(AmoeBadRequestError)
  })

  it('rejects a non-bytes32 nonce', () => {
    expect(() =>
      assertOrchestrationInputsShape(
        makeInputs({ nonce: '0xdeadbeef' as `0x${string}` }),
      ),
    ).toThrowError(AmoeBadRequestError)
  })

  it('rejects empty twitter handle', () => {
    expect(() =>
      assertOrchestrationInputsShape(makeInputs({ twitterHandle: '' })),
    ).toThrowError(AmoeBadRequestError)
    expect(() =>
      assertOrchestrationInputsShape(makeInputs({ twitterHandle: '   ' })),
    ).toThrowError(AmoeBadRequestError)
  })

  it('rejects empty spend-ref id', () => {
    expect(() =>
      assertOrchestrationInputsShape(makeInputs({ spendRefId: '' })),
    ).toThrowError(AmoeBadRequestError)
  })

  it('rejects profileId === 0 (sentinel for unresolved)', () => {
    expect(() =>
      assertOrchestrationInputsShape(makeInputs({ profileId: 0n })),
    ).toThrowError(AmoeBadRequestError)
    expect(() =>
      assertOrchestrationInputsShape(makeInputs({ profileId: 0 })),
    ).toThrowError(AmoeBadRequestError)
  })

  it('rejects negative profileId', () => {
    expect(() =>
      assertOrchestrationInputsShape(makeInputs({ profileId: -1n })),
    ).toThrowError(AmoeBadRequestError)
  })
})

// ----------------------------------------------------------------------------
// readLotteryAmoeRouterAddress
// ----------------------------------------------------------------------------

describe('readLotteryAmoeRouterAddress', () => {
  afterEach(() => {
    delete process.env.LOTTERY_AMOE_ROUTER
  })

  it('returns null when env is unset', () => {
    delete process.env.LOTTERY_AMOE_ROUTER
    expect(readLotteryAmoeRouterAddress()).toBeNull()
  })

  it('returns null on malformed address', () => {
    process.env.LOTTERY_AMOE_ROUTER = '0xnotanaddress'
    expect(readLotteryAmoeRouterAddress()).toBeNull()
  })

  it('lowercases mixed-case addresses', () => {
    process.env.LOTTERY_AMOE_ROUTER = '0xAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaa'
    expect(readLotteryAmoeRouterAddress()).toBe(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    )
  })

  it('rejects an address with wrong length', () => {
    process.env.LOTTERY_AMOE_ROUTER = '0xabcd'
    expect(readLotteryAmoeRouterAddress()).toBeNull()
  })
})

// ----------------------------------------------------------------------------
// isAmoeZkSubmitEnabled
// ----------------------------------------------------------------------------

describe('isAmoeZkSubmitEnabled', () => {
  afterEach(() => {
    delete process.env.AMOE_ZK_SUBMIT_ENABLED
  })

  it('defaults to false when unset', () => {
    delete process.env.AMOE_ZK_SUBMIT_ENABLED
    expect(isAmoeZkSubmitEnabled()).toBe(false)
  })

  it('returns true only for the literal string "1"', () => {
    process.env.AMOE_ZK_SUBMIT_ENABLED = '1'
    expect(isAmoeZkSubmitEnabled()).toBe(true)
  })

  it('does NOT accept "true" / "yes" / other truthy values', () => {
    process.env.AMOE_ZK_SUBMIT_ENABLED = 'true'
    expect(isAmoeZkSubmitEnabled()).toBe(false)
    process.env.AMOE_ZK_SUBMIT_ENABLED = 'yes'
    expect(isAmoeZkSubmitEnabled()).toBe(false)
    process.env.AMOE_ZK_SUBMIT_ENABLED = '0'
    expect(isAmoeZkSubmitEnabled()).toBe(false)
  })
})

// ----------------------------------------------------------------------------
// defaultAmoeZkAssetPaths
// ----------------------------------------------------------------------------

describe('defaultAmoeZkAssetPaths', () => {
  afterEach(() => {
    delete process.env.AMOE_ZK_WASM_PATH
    delete process.env.AMOE_ZK_ZKEY_PATH
  })

  it('uses env values when set', () => {
    process.env.AMOE_ZK_WASM_PATH = '/tmp/custom/foo.wasm'
    process.env.AMOE_ZK_ZKEY_PATH = '/tmp/custom/foo.zkey'
    const got = defaultAmoeZkAssetPaths()
    expect(got.wasmPath).toBe('/tmp/custom/foo.wasm')
    expect(got.zkeyPath).toBe('/tmp/custom/foo.zkey')
  })

  it('falls back to repo-relative paths when env unset', () => {
    delete process.env.AMOE_ZK_WASM_PATH
    delete process.env.AMOE_ZK_ZKEY_PATH
    const got = defaultAmoeZkAssetPaths()
    expect(got.wasmPath).toMatch(/circuits\/amoe\/build\/amoe_eligibility_js\/amoe_eligibility\.wasm$/)
    expect(got.zkeyPath).toMatch(/circuits\/amoe\/build\/amoe_plonk_final\.zkey$/)
  })

  it('falls back per-path independently when only one env is set', () => {
    process.env.AMOE_ZK_WASM_PATH = '/abs/x.wasm'
    delete process.env.AMOE_ZK_ZKEY_PATH
    const got = defaultAmoeZkAssetPaths()
    expect(got.wasmPath).toBe('/abs/x.wasm')
    expect(got.zkeyPath).toMatch(/amoe_plonk_final\.zkey$/)
  })

  it('treats whitespace-only env value as unset', () => {
    process.env.AMOE_ZK_WASM_PATH = '   '
    const got = defaultAmoeZkAssetPaths()
    expect(got.wasmPath).toMatch(/amoe_eligibility\.wasm$/)
  })
})

// ----------------------------------------------------------------------------
// orchestrateAmoeSubmitZk — end-to-end with mocked snarkjs
// ----------------------------------------------------------------------------

/**
 * Build a snarkjs mock that:
 *   * Echoes the witness's public signals back as `publicSignals`. This
 *     lets the calldata-builder cross-checks (creatorCoinAddr / epoch /
 *     wallet) all pass.
 *   * Renders a syntactically-valid solidity calldata string.
 *
 * The mock is the test seam for the real prover — we never run the
 * 86 MB zkey in this test.
 */
function makeEchoSnarkjs(): SnarkjsLike {
  return {
    plonk: {
      fullProve: vi.fn(async (witness: Record<string, unknown>) => {
        // Echo the eight public signals from the witness, in declared order.
        const publicSignals = [
          String(witness.walletAddrCommit),
          String(witness.creatorCoinAddr),
          String(witness.nonceCommit),
          String(witness.epoch),
          String(witness.allowlistRoot),
          String(witness.pointsBurnedAsUSD),
          String(witness.pointsLedgerRoot),
          String(witness.pointsBurnNullifier),
        ]
        // Build a 24-element fake proof. Each scalar is a small in-field value.
        const fakeProof: Record<string, unknown> = {}
        // The shape doesn't matter — exportSolidityCallData is mocked too.
        for (let i = 0; i < AMOE_PLONK_PROOF_LEN; i += 1) fakeProof[`s${i}`] = String(i + 1)
        return { proof: fakeProof, publicSignals }
      }),
      exportSolidityCallData: vi.fn(async (_proof: unknown, publicSignals: unknown) => {
        // 24 in-field proof scalars.
        const proofScalars = Array.from({ length: AMOE_PLONK_PROOF_LEN }, (_v, i) => `"0x${(i + 1).toString(16)}"`)
        // Public signals as hex strings.
        const pubScalars = (publicSignals as string[]).map((s) => {
          const hex = BigInt(s).toString(16)
          return `"0x${hex}"`
        })
        return `[${proofScalars.join(',')}][${pubScalars.join(',')}]`
      }),
    },
  }
}

/**
 * Build a snarkjs mock that returns a stale `pointsBurnedAsUSD` —
 * intentionally NOT what the witness committed. This exercises the
 * defense-in-depth `amoe_zk_prover_pub_inputs_drift` check.
 */
function makeDriftingSnarkjs(): SnarkjsLike {
  return {
    plonk: {
      fullProve: vi.fn(async (witness: Record<string, unknown>) => {
        const publicSignals = [
          String(witness.walletAddrCommit),
          String(witness.creatorCoinAddr),
          String(witness.nonceCommit),
          String(witness.epoch),
          String(witness.allowlistRoot),
          // DRIFT: report a different pointsBurnedAsUSD than the witness committed.
          '999999',
          String(witness.pointsLedgerRoot),
          String(witness.pointsBurnNullifier),
        ]
        const fakeProof: Record<string, unknown> = {}
        for (let i = 0; i < AMOE_PLONK_PROOF_LEN; i += 1) fakeProof[`s${i}`] = String(i + 1)
        return { proof: fakeProof, publicSignals }
      }),
      // Mirror echo snarkjs export so the parser succeeds and we reach
      // the drift check.
      exportSolidityCallData: vi.fn(async (_proof: unknown, publicSignals: unknown) => {
        const proofScalars = Array.from({ length: AMOE_PLONK_PROOF_LEN }, (_v, i) => `"0x${(i + 1).toString(16)}"`)
        const pubScalars = (publicSignals as string[]).map((s) => `"0x${BigInt(s).toString(16)}"`)
        return `[${proofScalars.join(',')}][${pubScalars.join(',')}]`
      }),
    },
  }
}

describe('orchestrateAmoeSubmitZk — end-to-end', () => {
  it('throws AmoeServerError(amoe_signup_salt_misconfigured) when salt is unset', async () => {
    const restore = setEnv({
      AMOE_SIGNUP_SALT: undefined,
      AMOE_ZK_SNAPSHOT_STUB_ALLOW: '1',
    })
    try {
      const inputs = makeInputs()
      let err: unknown = null
      try {
        await orchestrateAmoeSubmitZk(inputs, {
          wasmPath: 'mock-wasm',
          zkeyPath: 'mock-zkey',
          snarkjs: makeEchoSnarkjs(),
          // Pin a known epoch so we don't trip the pre-genesis check.
          nowSec: AMOE_EPOCH_GENESIS_UNIX_SEC + AMOE_EPOCH_SECONDS,
        })
      } catch (e) {
        err = e
      }
      expect(err).toBeInstanceOf(AmoeServerError)
      expect((err as Error).message).toBe('amoe_signup_salt_misconfigured')
    } finally {
      restore()
    }
  })

  it('throws AmoeServerError(amoe_ledger_snapshot_stub_not_allowed) when stub flag unset', async () => {
    const restore = setEnv({
      AMOE_SIGNUP_SALT: FIXTURE_SALT_HEX,
      AMOE_ZK_SNAPSHOT_STUB_ALLOW: undefined,
    })
    try {
      const inputs = makeInputs()
      let err: unknown = null
      try {
        await orchestrateAmoeSubmitZk(inputs, {
          wasmPath: 'mock-wasm',
          zkeyPath: 'mock-zkey',
          snarkjs: makeEchoSnarkjs(),
          nowSec: AMOE_EPOCH_GENESIS_UNIX_SEC + AMOE_EPOCH_SECONDS,
        })
      } catch (e) {
        err = e
      }
      expect(err).toBeInstanceOf(AmoeServerError)
      expect((err as Error).message).toBe('amoe_ledger_snapshot_stub_not_allowed')
    } finally {
      restore()
    }
  })

  it('throws AmoeServerError(amoe_epoch_pre_genesis) when nowSec < genesis', async () => {
    const restore = setEnv({
      AMOE_SIGNUP_SALT: FIXTURE_SALT_HEX,
      AMOE_ZK_SNAPSHOT_STUB_ALLOW: '1',
    })
    try {
      const inputs = makeInputs()
      let err: unknown = null
      try {
        await orchestrateAmoeSubmitZk(inputs, {
          wasmPath: 'mock-wasm',
          zkeyPath: 'mock-zkey',
          snarkjs: makeEchoSnarkjs(),
          nowSec: 1n,
        })
      } catch (e) {
        err = e
      }
      expect(err).toBeInstanceOf(AmoeServerError)
      expect((err as Error).message).toBe('amoe_epoch_pre_genesis')
    } finally {
      restore()
    }
  })

  it('produces a complete result on the happy path', async () => {
    const restore = setEnv({
      AMOE_SIGNUP_SALT: FIXTURE_SALT_HEX,
      AMOE_ZK_SNAPSHOT_STUB_ALLOW: '1',
    })
    try {
      const inputs = makeInputs({ pointsBurned: 250 })
      const snarkjs = makeEchoSnarkjs()
      const result = await orchestrateAmoeSubmitZk(inputs, {
        wasmPath: 'mock-wasm',
        zkeyPath: 'mock-zkey',
        snarkjs,
        // Pin epoch 7 — well past genesis.
        nowSec: AMOE_EPOCH_GENESIS_UNIX_SEC + AMOE_EPOCH_SECONDS * 7n + 1n,
      })

      // Epoch reflects the pinned nowSec.
      expect(result.epoch).toBe(7n)
      // pointsBurnedAsUSD is exactly the converted points value.
      expect(result.pointsBurnedAsUSD).toBe(pointsToUsd1e6(250))
      // Proof shape.
      expect(result.proof.proof.length).toBe(AMOE_PLONK_PROOF_LEN)
      expect(result.proof.pubInputs.length).toBe(AMOE_PLONK_PUB_INPUTS_LEN)
      // pubInputs[5] (pointsBurnedAsUSD) round-trips to the committed value.
      expect(
        result.proof.pubInputs[AMOE_PLONK_PUB_INPUT_SLOT.pointsBurnedAsUSD],
      ).toBe(pointsToUsd1e6(250))
      // Calldata is non-empty bytes hex.
      expect(result.call.callData).toMatch(/^0x[0-9a-fA-F]+$/)
      // The router argument is the call target.
      expect(result.call.to).toBe(FIXTURE_ROUTER)

      // snarkjs was called exactly once for fullProve and once for export.
      expect(snarkjs.plonk.fullProve).toHaveBeenCalledTimes(1)
      expect(snarkjs.plonk.exportSolidityCallData).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it('throws AmoeServerError(amoe_zk_prover_pub_inputs_drift) when prover returns mismatched USD', async () => {
    const restore = setEnv({
      AMOE_SIGNUP_SALT: FIXTURE_SALT_HEX,
      AMOE_ZK_SNAPSHOT_STUB_ALLOW: '1',
    })
    try {
      const inputs = makeInputs({ pointsBurned: 250 })
      let err: unknown = null
      try {
        await orchestrateAmoeSubmitZk(inputs, {
          wasmPath: 'mock-wasm',
          zkeyPath: 'mock-zkey',
          snarkjs: makeDriftingSnarkjs(),
          nowSec: AMOE_EPOCH_GENESIS_UNIX_SEC + AMOE_EPOCH_SECONDS * 2n,
        })
      } catch (e) {
        err = e
      }
      expect(err).toBeInstanceOf(AmoeServerError)
      expect((err as Error).message).toBe('amoe_zk_prover_pub_inputs_drift')
    } finally {
      restore()
    }
  })

  it('orchestration is deterministic for the same inputs + nowSec', async () => {
    const restore = setEnv({
      AMOE_SIGNUP_SALT: FIXTURE_SALT_HEX,
      AMOE_ZK_SNAPSHOT_STUB_ALLOW: '1',
    })
    try {
      const inputs = makeInputs({ pointsBurned: 100 })
      const nowSec = AMOE_EPOCH_GENESIS_UNIX_SEC + AMOE_EPOCH_SECONDS * 3n
      const r1 = await orchestrateAmoeSubmitZk(inputs, {
        wasmPath: 'mock-wasm',
        zkeyPath: 'mock-zkey',
        snarkjs: makeEchoSnarkjs(),
        nowSec,
      })
      const r2 = await orchestrateAmoeSubmitZk(inputs, {
        wasmPath: 'mock-wasm',
        zkeyPath: 'mock-zkey',
        snarkjs: makeEchoSnarkjs(),
        nowSec,
      })
      expect(r1.epoch).toBe(r2.epoch)
      expect(r1.pointsBurnedAsUSD).toBe(r2.pointsBurnedAsUSD)
      // Public-input commitments are reproducible.
      for (let i = 0; i < AMOE_PLONK_PUB_INPUTS_LEN; i += 1) {
        expect(r1.proof.pubInputs[i]).toBe(r2.proof.pubInputs[i])
      }
    } finally {
      restore()
    }
  })

  it('different twitter handles yield different walletAddrCommit + nullifiers (binding test)', async () => {
    const restore = setEnv({
      AMOE_SIGNUP_SALT: FIXTURE_SALT_HEX,
      AMOE_ZK_SNAPSHOT_STUB_ALLOW: '1',
    })
    try {
      const nowSec = AMOE_EPOCH_GENESIS_UNIX_SEC + AMOE_EPOCH_SECONDS * 5n
      const r1 = await orchestrateAmoeSubmitZk(
        makeInputs({ twitterHandle: 'alice' }),
        {
          wasmPath: 'mock',
          zkeyPath: 'mock',
          snarkjs: makeEchoSnarkjs(),
          nowSec,
        },
      )
      const r2 = await orchestrateAmoeSubmitZk(
        makeInputs({ twitterHandle: 'bob' }),
        {
          wasmPath: 'mock',
          zkeyPath: 'mock',
          snarkjs: makeEchoSnarkjs(),
          nowSec,
        },
      )
      // walletAddrCommit binds (wallet, twitterCreditNullifier) so different
      // handles must produce different commits even with same wallet.
      expect(
        r1.proof.pubInputs[AMOE_PLONK_PUB_INPUT_SLOT.walletAddrCommit],
      ).not.toBe(
        r2.proof.pubInputs[AMOE_PLONK_PUB_INPUT_SLOT.walletAddrCommit],
      )
    } finally {
      restore()
    }
  })

  it('different profileIds yield different pointsBurnNullifier (signupIdHash binding)', async () => {
    const restore = setEnv({
      AMOE_SIGNUP_SALT: FIXTURE_SALT_HEX,
      AMOE_ZK_SNAPSHOT_STUB_ALLOW: '1',
    })
    try {
      const nowSec = AMOE_EPOCH_GENESIS_UNIX_SEC + AMOE_EPOCH_SECONDS * 5n
      const r1 = await orchestrateAmoeSubmitZk(
        makeInputs({ profileId: 1n }),
        { wasmPath: 'm', zkeyPath: 'm', snarkjs: makeEchoSnarkjs(), nowSec },
      )
      const r2 = await orchestrateAmoeSubmitZk(
        makeInputs({ profileId: 2n }),
        { wasmPath: 'm', zkeyPath: 'm', snarkjs: makeEchoSnarkjs(), nowSec },
      )
      // pointsBurnNullifier binds (signupIdHash, ...) — different
      // profileIds must change it.
      expect(
        r1.proof.pubInputs[AMOE_PLONK_PUB_INPUT_SLOT.pointsBurnNullifier],
      ).not.toBe(
        r2.proof.pubInputs[AMOE_PLONK_PUB_INPUT_SLOT.pointsBurnNullifier],
      )
    } finally {
      restore()
    }
  })

  it('wraps a snarkjs failure as AmoeProofGenerationError', async () => {
    const restore = setEnv({
      AMOE_SIGNUP_SALT: FIXTURE_SALT_HEX,
      AMOE_ZK_SNAPSHOT_STUB_ALLOW: '1',
    })
    try {
      const failingSnarkjs: SnarkjsLike = {
        plonk: {
          fullProve: vi.fn(async () => {
            throw new Error('zkey corrupted')
          }),
          exportSolidityCallData: vi.fn(),
        },
      }
      let err: unknown = null
      try {
        await orchestrateAmoeSubmitZk(makeInputs(), {
          wasmPath: 'm',
          zkeyPath: 'm',
          snarkjs: failingSnarkjs,
          nowSec: AMOE_EPOCH_GENESIS_UNIX_SEC + AMOE_EPOCH_SECONDS,
        })
      } catch (e) {
        err = e
      }
      // proveAmoeEntryPlonk wraps snarkjs errors as AmoeProofGenerationError
      // with code `plonk_snarkjs_failed`.
      expect(err).toBeInstanceOf(AmoeProofGenerationError)
    } finally {
      restore()
    }
  })
})
