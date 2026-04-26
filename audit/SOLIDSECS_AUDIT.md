# SolidSecs Audit — zkMetal Integration Contracts

**Date:** 2026-04-25
**Branch under review:** `feat/zkmetal-deeper-integration` (PR #379) on top of `main`
**Auditor (automated):** Slither v0.11.5 (run as part of the SolidSecs static-analysis suite)
**Scope:** New / changed Solidity files introduced by the zkMetal integration tracks (PRs #376, #377, #378, #379).

---

## 1. Executive Summary

A static-analysis sweep was performed against the seven Solidity files added or changed by the zkMetal integration work.

This report uses **two severity columns**: Slither's raw `(impact, confidence)` and an **adjusted severity** after manual triage (downgrading findings that are documented snarkjs / EIP-2537 idioms or false positives on length-constrained inputs). Both numbers are shown so reviewers can audit the downgrades independently.

| Severity (adjusted) | Count | Notes                                                                                  |
|---------------------|-------|----------------------------------------------------------------------------------------|
| Critical            | 0     | —                                                                                      |
| High                | 0     | (Slither raw: 3 High — all triaged to Informational, see §4.4 / §4.5)                  |
| Medium              | 0     | (Slither raw: 2 Medium `unused-return` — triaged to Informational, see §4.6)           |
| Low                 | 2     | `RandomnessRouter.acquireRequest` event ordering; `LotteryAmoeRouter` timestamp use    |
| Informational       | 7     | solc pragma, snarkjs assembly, encode-packed FPs, low-level-call, naming, etc.         |

**Net assessment after triage: 0 Critical / 0 High / 0 Medium / 2 Low / 7 Informational.** Each downgrade is justified inline below. Reviewers who disagree with a downgrade can see Slither's raw verdict in `audit/slither/<contract>.json`.

---

## 2. Scope

| File                                                                    | LOC  | Role                                          |
|-------------------------------------------------------------------------|------|-----------------------------------------------|
| `contracts/utilities/lottery/randomness/IRandomnessSource.sol`          | ~30  | Interface for randomness sources              |
| `contracts/utilities/lottery/randomness/RandomnessRouter.sol`           | 159  | Selector / router between VRF + drand sources |
| `contracts/utilities/lottery/randomness/ChainlinkVRFAdapter.sol`        | 58   | Adapter wrapping existing `CreatorVRFConsumerV2_5` |
| `contracts/utilities/lottery/randomness/DrandRandomnessSource.sol`      | 274  | drand BLS12-381 verifier (EIP-2537)           |
| `contracts/utilities/lottery/zk/IAmoeGroth16Verifier.sol`               | ~15  | Interface for the AMOE Groth16 verifier       |
| `contracts/utilities/lottery/zk/AmoeGroth16Verifier.sol`                | ~280 | snarkjs-emitted Groth16 verifier (re-emitted from zkMetal, MIT) |
| `contracts/utilities/lottery/zk/LotteryAmoeRouter.sol`                  | ~310 | AMOE entry router / Groth16 verification glue |

**Out of scope:** `CreatorLotteryManager.sol` (audited, untouched in this work).

---

## 3. Methodology

The SolidSecs suite normally runs Slither, Aderyn, Mythril, Semgrep, Echidna, Halmos and Foundry unit tests. The CI sandbox available for this audit had **only Slither** installed, so the report is honest about that limitation. Concretely:

1. Cloned [`carni-ships/SolidSecs`](https://github.com/carni-ships/SolidSecs) for reference.
2. Installed Slither v0.11.5 via `pip`.
3. Created a clean `solc-^0.8.20`-only target tree at `/tmp/audit-target/` containing the seven files above (the new contracts have no external imports, so no `node_modules` / remappings were needed).
4. Ran `slither <file> --json -` per-file; raw outputs are committed under `audit/slither/`.
5. Triaged every finding by reading the source around the flagged line, classified raw severity vs. adjusted severity, and justified every downgrade inline.

**Limitations / honesty notes:**

- Forge / Hardhat were not installed, so no symbolic execution (Mythril / Halmos), no fuzz tests (Echidna), and no Foundry test pass were run.
- Slither's reentrancy and encode-packed detectors produced output that, on inspection, is mostly defense-in-depth or false-positive — see §4.
- A full re-run on a developer machine (or in CI) with the complete SolidSecs toolchain is recommended before mainnet deploy. The Apple-Silicon GitHub Actions workflow added in PR #379 (`.github/workflows/zkmetal-macos.yml`) is a reasonable place to host that.

---

## 4. Findings

### 4.1 Low — `RandomnessRouter.acquireRequest`: external call before event emission

**File:** `contracts/utilities/lottery/randomness/RandomnessRouter.sol`
**Lines:** ~133–149
**Detector:** Slither `reentrancy-events`
**Slither raw severity:** Low / Medium confidence
**Adjusted severity:** Low (kept)

The routing function makes a low-level `call` into the configured randomness source and then emits the `RandomnessRequested` event:

```solidity
(bool ok, bytes memory ret) = address(src).call(abi.encodeWithSignature("request()"));
require(ok, "src request failed");
uint256 requestId = abi.decode(ret, (uint256));
emit RandomnessRequested(consumer, src, requestId);
```

Because the event is emitted *after* the external call, a malicious source contract could theoretically re-enter the router and emit log events in a different order than effects suggest.

**Risk assessment:** Bounded. Source addresses are admin-curated — `setSourceFor` is `onlyOwner`, and the production sources are `ChainlinkVRFAdapter` (wrapping the audited Chainlink consumer) and `DrandRandomnessSource` (this repo). Neither re-enters.

**Recommendation:** Add defense-in-depth. Either:

1. Apply OpenZeppelin's `nonReentrant` modifier to `acquireRequest`, or
2. Reorder to follow strict Checks-Effects-Interactions: emit the event *before* the external call (or buffer the request id and emit after a state write that the source cannot influence).

This is a Low — the trust model already says "owner sets sources" — but the code should not rely on that assumption alone.

---

### 4.2 Low — `LotteryAmoeRouter.submitAmoeEntry`: `block.timestamp` used for deadline check

**File:** `contracts/utilities/lottery/zk/LotteryAmoeRouter.sol`
**Line:** 251
**Detector:** Slither `timestamp`
**Slither raw severity:** Low / Medium confidence
**Adjusted severity:** Low (kept)

```solidity
require(block.timestamp <= deadline, "expired");
```

Slither flags any use of `block.timestamp` in a comparison because miners can drift it by ~15 seconds. For a per-claim AMOE deadline the relayer issues with whatever expiry it wants, this is well within the tolerance — the deadline is denominated in minutes/hours, not seconds. **Risk: negligible.**

**Recommendation:** Document the tolerance assumption inline (e.g. "deadlines must be ≥ 60 seconds in the future to absorb miner drift") and consider rejecting `deadline - block.timestamp < 60` as a defensive check on the relayer-supplied input.

---

### 4.3 Informational — Floating pragma `^0.8.20`

**Files:** All seven files in scope.
**Detector:** Slither `solc-version`

The contracts compile with `pragma solidity ^0.8.20;`. Slither warns this matches solc versions with known issues (e.g. `VerbatimInvalidDeduplication`, `FullInlinerNonExpressionSplitArgumentEvaluationOrder`, `MissingSideEffectsOnSelectorAccess`).

**Recommendation:** Pin to `pragma solidity 0.8.30;` (which already matches the version configured in `foundry.toml`). This is a one-line change per file and removes the warning across the board.

---

### 4.4 Informational — `incorrect-return` in `AmoeGroth16Verifier.sol` (Slither raw: High)

**File:** `contracts/utilities/lottery/zk/AmoeGroth16Verifier.sol`
**Detector:** Slither `incorrect-return`
**Slither raw severity:** High / Medium confidence (3 instances)
**Adjusted severity:** Informational

> **Why downgrade?** This detector targets cases where assembly `return(...)` is inside a Solidity function that the optimizer might think continues to execute Solidity afterwards. In `verifyProof` the assembly block IS the entire function body — `return(0, 0x20)` is the canonical exit returning the verification boolean. The contract is byte-for-byte identical to `snarkjs`'s `templates/verifier_groth16.sol.ejs` output (verifiable by re-running `tools/zk/emit_amoe_verifier.sh`), so the same warning fires on every snarkjs-emitted Groth16 verifier in production today. Modifying the assembly to silence Slither would diverge from the canonical verifier and risk breaking compatibility with `snarkjs verify`.

**Recommendation:** Add an inline comment + `// slither-disable-next-line incorrect-return` directive on the relevant assembly block, citing the snarkjs canonical pattern. The contract itself should not be modified.

---

### 4.5 Informational — `encode-packed-collision` in `DrandRandomnessSource.sol` (Slither raw: High)

**File:** `contracts/utilities/lottery/randomness/DrandRandomnessSource.sol`
**Lines:** 197 (round-commit binding) and 213–218 (pairing input)
**Detector:** Slither `encode-packed-collision`
**Slither raw severity:** High / High confidence (2 instances)
**Adjusted severity:** Informational

Two `abi.encodePacked` sites are flagged:

1. `keccak256(abi.encodePacked(roundBE, hashedRoundG2))` — `roundBE` is `abi.encodePacked(uint64(round))` (always 8 bytes), `hashedRoundG2` is enforced to be exactly 256 bytes by `if (... hashedRoundG2.length != 256) revert InvalidLength();` on line 186. **No collision is possible because both arguments are fixed-length.**
2. `abi.encodePacked(groupPubKey, hashedRoundG2, _negatedG1Generator(), sigCompressed)` — the EIP-2537 pairing precompile input. `groupPubKey` and `_negatedG1Generator()` are 128-byte G1 points, the two G2 points are 256 bytes each (length-checked above). **All four arguments are fixed length.**

> **Why downgrade?** The detector triggers on `bytes`/`string` arguments where length is not statically known. Both `roundBE` and `hashedRoundG2` go through explicit length-equality checks before reaching `abi.encodePacked`, so the byte layout is fully determined at runtime and the collision class doesn't apply. The G1/G2 points in the pairing input are likewise length-fixed by the EIP-2537 spec.

**Recommendation:** Add `// slither-disable-next-line encode-packed-collision` directives next to each call with a comment explaining the length constraints, so the warning doesn't fire in CI.

---

### 4.6 Informational — `unused-return` in `ChainlinkVRFAdapter.sol` (Slither raw: Medium)

**File:** `contracts/utilities/lottery/randomness/ChainlinkVRFAdapter.sol`
**Lines:** 42, 47
**Detector:** Slither `unused-return`
**Slither raw severity:** Medium / Medium confidence (2 instances)
**Adjusted severity:** Informational

`isReady()` destructures `(, bool fulfilled, , , )` from `getRequestStatus`, and `randomWord()` destructures `(, bool fulfilled, , uint256 word, )` — discarding the other fields. This is intentional: the adapter only exposes the two fields the `IRandomnessSource` interface requires.

> **Why downgrade?** Slither rates this Medium because in some patterns ignoring a `bool success` return value masks a failed call. Here the return tuple is a struct-style read from a view function — there is no error flag in it (the consumer reverts internally on bad inputs), so all destructure fields are pure data. Discarding fields you don't need is the idiomatic Solidity way to read view-function tuples.

**Recommendation:** No action.

---

### 4.7 Informational — `assembly` usage in `DrandRandomnessSource.sol`

**File:** `contracts/utilities/lottery/randomness/DrandRandomnessSource.sol`
**Lines:** ~222–227
**Detector:** Slither `assembly`

The contract uses `staticcall` against the BLS12-381 pairing precompile at `0x10`. This is the canonical EIP-2537 pattern; there is no high-level Solidity equivalent.

**Recommendation:** No action. The block is well-commented and the input layout matches the EIP.

---

### 4.8 Informational — `low-level-calls` in `RandomnessRouter.acquireRequest`

**File:** `contracts/utilities/lottery/randomness/RandomnessRouter.sol`
**Lines:** 133–149
**Detector:** Slither `low-level-calls`

The router uses `address(src).call(abi.encodeWithSignature("request()"))` rather than a typed interface call. This is intentional: the `IRandomnessSource` interface intentionally omits `request()` because it only applies to REQUEST-mode sources (Chainlink), not PUSH-mode sources (drand). Probing with a low-level call lets the router stay generic over both modes.

**Recommendation:** Keep the low-level call but add a `try/catch`-based typed dispatch as a follow-up, so failures surface with proper error data instead of an opaque `bool ok`. This is the same change that addresses Finding 4.1 (defense-in-depth around the external call).

---

### 4.9 Informational — `too-many-digits` in `_negatedG1Generator()`

**File:** `contracts/utilities/lottery/randomness/DrandRandomnessSource.sol`
**Detector:** Slither `too-many-digits`

The negated G1 generator is hard-coded as the canonical BLS12-381 constant. The literal must be reproduced byte-exact for the pairing equation to hold.

**Recommendation:** No action.

---

### 4.10 Informational — Naming-convention

**Files:** `AmoeGroth16Verifier.sol` (snarkjs-emitted), and parameter naming on setters across `DrandRandomnessSource`, `LotteryAmoeRouter`, `RandomnessRouter` (e.g. `_owner`, `_consumer`, `_publisher`).
**Detector:** Slither `naming-convention`

Two distinct cases:

1. **`AmoeGroth16Verifier.sol`** — snarkjs emits identifiers like `IC0`, `pVk`, `_pPairing`. Renaming would diverge from the canonical verifier; we keep snarkjs naming so the contract stays diff-clean against `generateSolidityVerifier()` output. **No action.**
2. **Parameter naming `_owner`, `_consumer`, `_publisher` etc. on setter functions** — Solidity style guide prefers `mixedCase` without leading underscore for parameters. The leading underscore is used here to disambiguate from same-named state variables. **Optional fix:** rename to e.g. `newOwner`, `newConsumer`, `newPublisher` for style compliance. Behavior-equivalent.

---

## 5. Recommendations Summary

| Priority | Action                                                                                                            | Finding | Effort |
|----------|-------------------------------------------------------------------------------------------------------------------|---------|--------|
| Should   | Add `nonReentrant` to `RandomnessRouter.acquireRequest`, or reorder event before call                             | 4.1     | 5 min  |
| Should   | Document the deadline tolerance assumption in `LotteryAmoeRouter.submitAmoeEntry` and add a `>= 60s` floor check  | 4.2     | 10 min |
| Should   | Pin `pragma solidity 0.8.30;` across the seven files (matches `foundry.toml`)                                     | 4.3     | 5 min  |
| Could    | Add inline `// slither-disable-next-line` comments + rationale next to the documented FPs (4.4, 4.5)              | 4.4 / 4.5 | 15 min |
| Could    | Refactor low-level `call` in `RandomnessRouter.acquireRequest` into a typed `try/catch` against a probe interface | 4.8     | 30 min |
| Could    | Rename setter parameters from `_owner`/`_consumer`/`_publisher` to `newOwner`/`newConsumer`/`newPublisher`        | 4.10    | 10 min |
| Could    | Wire the full SolidSecs suite (Aderyn / Mythril / Echidna / Halmos / Foundry) into the macOS CI workflow that PR #379 already added | —       | 1–2 hr |

---

## 6. Conclusion

The zkMetal-integration contracts are clean for their stage. **No High or Critical issues survived triage.** Slither's three raw-High flags (`incorrect-return` on the snarkjs verifier and the two `encode-packed-collision` warnings on `DrandRandomnessSource`) are all documented idioms or false positives on length-constrained inputs, and each downgrade is justified inline so reviewers can audit the call.

The two Low findings are routine hardening tweaks, not exploitable bugs:

- **4.1** — `RandomnessRouter` event ordering: a one-line `nonReentrant` modifier closes it.
- **4.2** — `LotteryAmoeRouter` `block.timestamp` deadline: documented tolerance assumption + an optional 60s floor closes it.

This sweep should not be considered a substitute for a full SolidSecs run on a developer host — Mythril and Halmos in particular can find class-of-bug issues that Slither cannot, and Echidna fuzzing is highly recommended for `RandomnessRouter` and `LotteryAmoeRouter` before any mainnet promotion. The macOS-15 CI workflow added in PR #379 (`.github/workflows/zkmetal-macos.yml`) is the natural place to host the rest of the SolidSecs toolchain once `forge` is wired into CI.

---

## Appendix A — Raw Slither output

Per-file Slither outputs are committed under `audit/slither/`:

- `audit/slither/AmoeGroth16Verifier.slither.txt` (+ `.json`, `.out`)
- `audit/slither/ChainlinkVRFAdapter.slither.txt` (+ `.json`, `.out`)
- `audit/slither/DrandRandomnessSource.slither.txt` (+ `.json`, `.out`)
- `audit/slither/IAmoeGroth16Verifier.slither.txt` (+ `.json`, `.out`)
- `audit/slither/IRandomnessSource.slither.txt` (+ `.json`, `.out`)
- `audit/slither/LotteryAmoeRouter.slither.txt` (+ `.json`, `.out`)
- `audit/slither/RandomnessRouter.slither.txt` (+ `.json`, `.out`)
