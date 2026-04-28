# `tools/zk/` — AMOE zero-knowledge tooling

Reproducible builds and CI guards for the AMOE eligibility circuit.

## Files in this directory

| File | Purpose |
|---|---|
| `regen_amoe_plonk_verifier.sh` | Regenerate `AmoePlonkVerifier.sol` from source. Compiles the circuit with `circom --O1`, runs `snarkjs plonk setup` against the universal Hermez `pot17` SRS, exports the verifier, and applies our local divergences. |
| `_patch_amoe_plonk_verifier.py` | Single source of truth for the divergences from stock snarkjs output: rename, pragma bump, banner, and the `checkField` loop on `_pubSignals[0..7]`. Called by the regen script. |
| `regen_amoe_fixture.sh` | Regenerate the test fixture for the legacy Groth16 path (kept for back-compat while we phase out v1). |
| `emit_amoe_verifier.sh` | Emit the legacy Groth16 verifier via the in-house `amoe-prover` (MIT-licensed alternative to GPL-3.0 snarkjs output). |
| `verify_amoe_ceremony.sh` | Sanity-check a Groth16 phase-2 ceremony zkey against the Hermez ptau. Not used by the PLONK pipeline (PLONK uses pot17 directly, no per-circuit ceremony). |
| `encode_drand_pk.py` | Encode the drand randomness beacon's public key for on-chain use. |

## The PLONK divergences and why they matter

Stock snarkjs PLONK verifiers `checkField`-validate only the **24 proof scalars**.
The **8 public inputs** flow straight from calldata into the transcript as raw
`uint256` values. Without an explicit field-bound check, a malicious prover
can submit non-canonical encodings (`x + k·q`) of any public-input slot. The
verifier still returns `true` because internal `addmod(…, q)` ops fold the
values back into the field — but the on-chain router's three replay maps
(`usedNonceCommit`, `usedWalletCommit`, `usedPointsBurnNullifier`) compare
**raw bytes**, so the same canonical witness can be submitted twice with
different raw `uint256` encodings, defeating each replay guard.

Reported on PR #409 by the `chatgpt-codex-connector` bot. Fix: an explicit
`checkField` loop over `_pubSignals[0..7]` between `checkProofData()` and
`calculateChallenges()`. See:

- `contracts/utilities/lottery/zk/AmoePlonkVerifier.sol` (header banner +
  patched body)
- `test/zk/AmoePlonkVerifier.t.sol` (`test_nonCanonicalPublicInputRejected`,
  `test_nonCanonicalWalletCommitRejected`)
- `docs/security/amoe-plonk-migration.md` ("Security divergence from stock
  snarkjs output")

## Regenerating the verifier

If snarkjs ever needs to be re-run (e.g. circuit change, security advisory in
snarkjs itself, switching to a different SRS), use:

```bash
tools/zk/regen_amoe_plonk_verifier.sh
```

This runs the full pipeline end-to-end and rewrites
`contracts/utilities/lottery/zk/AmoePlonkVerifier.sol`. Inspect the diff
before committing — the patch script enforces the divergences but a
circom/snarkjs version bump may produce other changes you want to review.

The script bails on:

- `circom` not in `PATH`
- snarkjs CLI not at `/usr/local/lib/node_modules/snarkjs/build/cli.cjs`
  (override with `SNARKJS_CLI=...`)
- `pot17_hez_final.ptau` SHA mismatch (corrupted SRS)

## CI guard

`tools/ci/check_amoe_plonk_patch.sh` runs on every PR/push touching the
AMOE PLONK contracts. It enforces:

1. Contract is named `AmoePlonkVerifier` (not `PlonkVerifier`)
2. Pragma is `^0.8.20` (not snarkjs default `>=0.7.0 <0.9.0`)
3. Header banner contains the "DIVERGENCE FROM STOCK SNARKJS" block
4. All 8 `checkField(calldataload(add(_pubSignals, N*32)))` calls present
5. The 8 calls appear between `checkProofData()` and `calculateChallenges`
6. (Local only) The committed contract byte-matches the regen output

The workflow that runs this is `.github/workflows/zk-pipeline-guards.yml`.
It also re-runs the `AmoePlonkVerifier` and `LotteryAmoe` test suites, so a
logic regression in the verifier or router is caught before merge.

## What to do if the CI guard fails

Read the failure message — it tells you which check tripped. Common causes:

| Symptom | Likely cause | Fix |
|---|---|---|
| "still contains 'contract PlonkVerifier'" | Someone re-exported the verifier with stock snarkjs | Run `tools/zk/regen_amoe_plonk_verifier.sh` |
| "missing public-input field guard for offset N" | The `checkField` loop was deleted or auto-formatted apart | Restore the 8 calls between `checkProofData()` and `calculateChallenges` (see the patch script for the canonical block) |
| "must come AFTER checkProofData()" | Loop ended up in the wrong place | Move it back to immediately after `checkProofData()` and before `calculateChallenges` |
| "drifted from the regen output" | Hand-edits diverged from the regenerator | Either regenerate with the script, or update `tools/zk/_patch_amoe_plonk_verifier.py` to reflect the new canonical form |
