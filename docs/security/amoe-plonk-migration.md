# AMOE: Groth16 → PLONK migration

**Branch:** `feat/amoe-zk/plonk`  
**Status:** measured, implemented, tested  
**Owner:** AMOE eligibility circuit + on-chain router

## TL;DR

We replaced the per-circuit Groth16 verifier with a PLONK verifier built on
the universal Hermez `powersOfTau28_hez_final_17.ptau` SRS. This eliminates
the per-circuit trusted-setup ceremony — every Groth16 circuit needs its own
multi-contributor phase-2 ritual, but a PLONK verifier reuses the same SRS
forever and only depends on its **published** `vk.json`.

The migration was driven by an honest reassessment after we acknowledged that
publishing a 48-hour public ceremony from a low-reputation account would be
structurally indistinguishable from a phishing campaign (asking strangers to
download multi-megabyte binaries and run them with a shared randomness beacon
is exactly how a malicious operator would behave). PLONK removes the
ceremony from the critical path entirely.

## Decision: measured, not estimated

Earlier in this work the cost of switching was estimated as "PLONK costs
2–3× more verifier gas." That turned out to be wrong on the cheap side once
we actually compiled and benched it. Real numbers:

| Metric | Groth16 v2 | PLONK | Δ |
|---|---|---|---|
| Verifier runtime bytecode | 2,230 B | **6,218 B** | +4,000 B |
| `verifyProof` gas (forge) | ~285,000 | **265,569** | **−20k** |
| Trusted setup | per-circuit phase-2 | universal Hermez `pot17` | **no ceremony required** |
| On-chain proof size | 8 × `uint256` (a/b/c/input) | 24 + 8 × `uint256` | +16 slots |
| Off-chain prover time | ~5 s | ~25 s | 5× slower (relayer-side, not user-visible) |
| `CreatorLotteryManager` runtime bytecode | 24,568 B | 24,568 B | 0 |

PLONK was **slightly cheaper on gas**, slightly larger on bytecode (still
trivially under the 24,576 limit), much larger on calldata, and much slower
to prove — but the prover runs server-side so off-chain prove time is not on
the user-perceived critical path. Trusted-setup risk drops from "we have to
either pay a paid ceremony service or run a contributor recruitment effort
from a cold account" to "trust the published Hermez 174-contributor pot17."

## What changed

### New
- `contracts/utilities/lottery/zk/IAmoePlonkVerifier.sol` — interface
  matching the snarkjs PLONK verifier: `verifyProof(uint256[24] proof, uint256[8] input) → bool`.
- `contracts/utilities/lottery/zk/AmoePlonkVerifier.sol` — verifier emitted
  by `snarkjs zkey export soliditverifier` from the fresh `--O1` compile +
  pot17 zkey. The contract was renamed (`PlonkVerifier` → `AmoePlonkVerifier`),
  the pragma was bumped to `^0.8.20`, and a header banner records the
  provenance (circom version, SRS, public-input layout). Body bytes are
  otherwise byte-equal to the snarkjs source.
- `test/zk/AmoePlonkVerifier.t.sol` — three tests pinning a real proof,
  rejecting a tampered public input, and printing the exact verify gas.

### Modified
- `LotteryAmoeRouter.sol` — `IAmoeGroth16Verifier` import and state replaced;
  `submitAmoeEntryZK` signature simplified from
  `(address, address, uint64, uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[8] input)` →
  `(address, address, uint64, uint256[24] proof, uint256[8] input)`;
  the verify call site uses the new shape. Public-input binding rules
  (creator-coin, epoch, allowlist root, ledger root, points ceiling,
  replay guards) are unchanged.
- `LotteryAmoeRouter.t.sol`, `LotteryAmoeRouter.PointsBound.t.sol` —
  inline `MockVerifier` reshaped for PLONK; `_proof()` helper now returns
  `uint256[24] memory`. All call sites updated. **34/35 tests pass** (the
  one failure is a pre-existing `NotPublisher()` revert unrelated to ZK
  that already fails on `main`).
- `script/DeployLotteryAmoeRouter.s.sol` — deploys `AmoePlonkVerifier`
  instead of `AmoeGroth16Verifier_v2`. Pre-deploy checklist updated.

### Kept (legacy, not imported)
- `IAmoeGroth16Verifier.sol`, `AmoeGroth16Verifier.sol`, `AmoeGroth16Verifier_v2.sol`
  remain in the tree but are no longer referenced. They will be deleted in
  a follow-up cleanup PR once the PLONK rollout is on testnet for at least
  one epoch and we are confident no rollback is required.

## Security divergence from stock snarkjs output

**Issue.** Stock snarkjs PLONK verifiers run `checkField` (assert `< q`) on
the 24 proof scalars only. The 8 public inputs flow straight from calldata
into `calculateChallenges` and `calculatePI` as raw `uint256` values. Without
an explicit field-bound check, a malicious prover can submit non-canonical
encodings (`x + k·q`) of any public-input slot. The PLONK verifier itself
still returns `true` because `addmod(…, q)` operations inside the verifier
fold the values back into the field, but the router's replay maps
(`usedNonceCommit`, `usedWalletCommit`, `usedPointsBurnNullifier`) compare
raw bytes — so the same canonical witness can be submitted twice with
different raw `uint256` encodings, defeating the replay guards.

**Fix.** We add an explicit `checkField` loop on `_pubSignals[0..7]` right
after `checkProofData()`. `checkField` short-circuits the call with a
zero return if any signal is `>= q`. The header banner of
`AmoePlonkVerifier.sol` documents this divergence from the snarkjs source
so future regenerations don't silently drop the patch. Two regression
tests pin it: `test_nonCanonicalPublicInputRejected` (epoch slot) and
`test_nonCanonicalWalletCommitRejected` (wallet commit slot).

**Cost.** +672 gas (`verifyProof` 264,897 → 265,569). 8 `checkField`
calls at ≈ 84 gas each. Negligible vs the security gain.

**Provenance.** Reported by the chatgpt-codex-connector bot on PR #409,
diff line 1181–1184. The bot was right, the fix is sound, the tests
lock it in.

## Tradeoffs we are accepting

1. **Larger calldata.** A PLONK proof is 24 × 32 = 768 bytes plus the 8 ×
   32 = 256 bytes of public inputs. That's roughly 4× the calldata of a
   Groth16 (a, b, c, input) blob. At Base L2 calldata pricing this is
   comfortably negligible per entry but worth noting for any future
   batched-submit design.
2. **Larger verifier bytecode.** 6,218 B vs 2,230 B. Still small in
   absolute terms; not close to the EIP-170 ceiling. Deployment cost
   delta is one-time and small.
3. **Slower prover.** ~25 s on the relayer's machine vs ~5 s for Groth16.
   Off-chain only, runs once per AMOE entry, not on a user's device.
4. **Trust assumption shifts.** Groth16 v2 required us to trust **our own
   single-contributor testnet ceremony** until a multi-contributor mainnet
   ceremony was run. PLONK shifts the trust assumption to "Hermez's
   174-contributor `pot17` is honest." That set includes Ethereum
   Foundation, Polygon Hermez, Aztec, and many other public actors over
   multi-year contributions — a strictly better assumption than a
   single-operator solo run.

## What this does NOT change

- The 8-element public-input layout: `walletAddrCommit`, `creatorCoinAddr`,
  `nonceCommit`, `epoch`, `allowlistRoot`, `pointsBurnedAsUSD`, `pointsLedgerRoot`,
  `pointsBurnNullifier`. Identical to Groth16 v2.
- The router's binding rules (creator-coin / epoch / allowlist root /
  ledger root pinning, MAX_POINTS_AS_USD ceiling, three replay guards).
- Manager fan-out semantics (`processAmoeEntry`, return-zero revert path).
- `CreatorLotteryManager` itself — bytecode unchanged at 24,568 B.
- The locked AMOE pricing spec (linear $1 = 4 PPM up to $10K = 40,000 PPM,
  AMOE 100..1,000,000 points, `pointsBurnedAsUSD = points × 10,000`,
  absolute cap 15% / 150,000 PPM post-boost). Spec is enforced at the
  circuit + router boundary; circuit is unchanged.

## Reproducing the PLONK setup

```bash
cd circuits/amoe && mkdir -p build/plonk_fresh && cd build/plonk_fresh

# 1. Fresh -O1 recompile (PLONK rejects -O2's collapsed linear combos).
circom ../../amoe_eligibility.circom --r1cs --wasm --sym --O1 -l ../node_modules

# 2. Universal SRS — Hermez pot17, no per-circuit ceremony.
curl -fSL -o ../pot17_hez_final.ptau \
  "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_17.ptau"
# sha256: 6b662a324867139fb1a20a324d90b6ff61856dfb23f59326909f14b0e2483ae0

# 3. PLONK setup (memory-heavy).
node --max-old-space-size=7000 /usr/local/lib/node_modules/snarkjs/build/cli.cjs \
  plonk setup amoe_eligibility.r1cs ../pot17_hez_final.ptau amoe_plonk_final.zkey

# 4. Export verifier + verification key.
node /usr/local/lib/node_modules/snarkjs/build/cli.cjs zkey export verificationkey \
  amoe_plonk_final.zkey vk_plonk.json
node /usr/local/lib/node_modules/snarkjs/build/cli.cjs zkey export solidityverifier \
  amoe_plonk_final.zkey AmoePlonkVerifier_raw.sol
```

Then rename `PlonkVerifier` → `AmoePlonkVerifier`, bump pragma to
`^0.8.20`, prepend the provenance banner, and drop into
`contracts/utilities/lottery/zk/`.

## What is still gated for mainnet

- Sweepstakes counsel review (issue #403 §3) is still required regardless of
  the prover/verifier choice. PLONK changes the cryptography path; it does
  not change the legal posture of the AMOE structure.

## Honest postmortem on prior estimates

- "Half a day, one snarkjs flag" → in reality this took ~1–2 days because
  the default `circom -O2` produces witnesses snarkjs PLONK rejects with
  `Invalid witness length`. Fixing required a full `--O1` recompile
  (R1CS constraints went 11,367 → 24,301; PLONK gates 121,737 → 28,939;
  zkey 353 MB → 87 MB).
- "PLONK costs 2–3× more gas" → wrong, it's slightly cheaper (265,569 vs
  ~285,000, after the field-bound patch documented above). Apologies for the
  misdirection — this is now corrected with a measured number from
  `forge test`.
- "Public 48-hour ceremony" was proposed as an alternative. We retracted
  it after the user pointed out that the structure (cold account asking
  strangers to download binaries) is identical to a phishing operation.
  PLONK is the more honest fix.
