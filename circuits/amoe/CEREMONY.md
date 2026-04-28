# AMOE Trusted Setup — Ceremony Record

This file documents the phase-2 trusted setup for `amoe_eligibility.circom`. It
captures every contribution, the final-beacon parameters, and the verification
output of `snarkjs zkey verify`.

## Circuit versions

| Version | Status     | Public inputs | Constraint count | Circuit hash (first 32B)             |
|---------|------------|----------------|-------------------|---------------------------------------|
| v1      | superseded | 5              | 5,825             | `3f619c31 4eb192e7 38622252 12d78b6f` |
| v2      | current    | 8              | 11,367            | `b93497b0 68d1b96b fec84a90 be154a55` |

**v1 → v2 changes** (audit-relevant):
- Adds 3 new public inputs: `pointsBurnedAsUSD`, `pointsLedgerRoot`, `pointsBurnNullifier`.
- Adds points-burn ledger Merkle inclusion at depth 20, leaf shape
  `Poseidon5(signupIdHash, spendRefIdHash, pointsBurnedAsUSD, epoch, walletAddrCommit)`.
- Adds nullifier binding `Poseidon4(signupIdHash, spendRefIdHash, pointsBurnedAsUSD, epoch)`.
- Adds uint64 range check on `pointsBurnedAsUSD`.
- All v1 constraints retained verbatim (allowlist Merkle, walletAddrCommit hash,
  nonceCommit hash, creatorCoin / epoch range checks).

v2 closes the trust gap that allowed `authorizedAmoeRelayer` to assert an
arbitrary `pointsBurnedAsUSD` for any allowlisted wallet; the value is now
cryptographically bound into the proof and replay-guarded by a global on-chain
nullifier mapping. See `docs/security/amoe-pr4-handoff.md` (forthcoming) for the
full threat model.

v2 still fits inside `pot14_final.ptau` (11,367 < 2^14 = 16,384), so the same
phase-1 trust assumption (Hermez community ceremony) holds without re-pulling a
larger ptau file.

## Verification key fingerprint (v1 — superseded)

The on-chain `AmoeGroth16Verifier.sol` for v1 was emitted directly from
`amoe_final.zkey`. Anyone can re-verify by running
`tools/zk/verify_amoe_ceremony.sh` — it pulls the same ptau, runs
`snarkjs zkey verify`, and asserts the circuit hash matches:

```
3f619c31 4eb192e7 38622252 12d78b6f
fd7cbc53 3af92c71 796a728c 5990437f
7aec7331 c39bb559 361273bd 9a6cbdef
1dfa019b 22481cc1 3823003f f56017ab
```

The v2 fingerprint (computed by `circom --r1cs` against the current circuit at
11,367 constraints):

```
b93497b0 68d1b96b fec84a90 be154a55
717dce80 19cb5e7e d90b751d a6d3238a
6d7a046d f08be06e 6e08fca0 24606b85
bfbd1da2 afe82434 13d5b610 c5ab8505
```

## Phase 1 (powers of tau)

Reused the public Hermez ceremony, file `powersOfTau28_hez_final_14.ptau`:

- Source: `https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau`
- Phase-1 contributors: 175+ (Hermez community ceremony, 2022). Toxic waste from
  this phase is shared with every consumer of the file (Tornado Cash, Polygon
  zkEVM, Aztec, Iden3, etc.). This is fine — phase-1 only depends on at least
  one honest contributor among the community.

## Phase 2 (circuit-specific) — v1 ceremony (superseded)

Three contributions plus a final beacon, run during the v1 branch's ceremony:

| # | Source                            | Contribution hash (first 32B)           |
|---|-----------------------------------|------------------------------------------|
| 1 | `/dev/urandom` (kernel CSPRNG)    | `d60ce7f1 c8944193 539c9257 6562ec4e`    |
| 2 | kernel state (boot_id, uptime, loadavg) | `119a45d8 7885dd46 20298dd8 29de9b8a` |
| 3 | drand cloudflare beacon + urandom mix | `b2f9bb41 fe327f69 6355f14d a3cb017c` |
| Final | snarkjs beacon, 2^10 iterations, generator `01..20` | `d6de100d 769b3e70 8a4a6032 e982ae91` |

## Phase 2 — v2 ceremony (planned)

The v2 circuit requires its own phase-2 ceremony. Because v2 introduces new
constraints (Poseidon-5 leaf hash, Poseidon-4 nullifier hash, second 20-deep
Merkle path, uint64 range check), the existing `amoe_final.zkey` cannot be
reused; `groth16 setup` must be re-run against the new R1CS, which produces a
fresh `amoe_v2_0000.zkey` requiring fresh contributions.

Mandatory ceremony rules for v2:

1. **Independent contributors, independent hardware.** v1 ran all three
   contributions on the same machine in one shell session, which is
   acceptable for testnet but not for production. v2 must have at least 3
   contributions from physically separate operators, with a final beacon.
2. **Source ptau:** `pot14_final.ptau` from the existing `build/` directory
   (Hermez phase-1, unchanged from v1).
3. **Final beacon:** snarkjs beacon, 2^10 iterations, generator derived from a
   public future Bitcoin block hash chosen at ceremony start. Operator commits
   to the block height before the ceremony begins; the beacon uses the hash
   of that block once mined.
4. **Output artifact:** `amoe_v2_final.zkey` replaces `amoe_final.zkey`.
   `AmoeGroth16Verifier.sol` is regenerated via
   `snarkjs zkey export solidityverifier amoe_v2_final.zkey …`.
5. **Audit handoff:** the new VK constants in the regenerated
   `AmoeGroth16Verifier.sol` (38 field elements vs. 26 in v1) must be
   re-verified against `verification_key.json` before merging the contract
   integration PR (PR 4).

This ceremony is performed in a *separate operational workstream* from this
circuit-source PR. The circuit changes here are reviewable in isolation
because they only modify `amoe_eligibility.circom`; the on-tree
`verification_key.json` is left at the v1 value until the v2 ceremony
produces its replacement and the contract integration PR (PR 4) lands.

### v2 contributor table (to be filled in during ceremony)

| # | Operator | Date | Hardware | Contribution hash (first 32B) |
|---|----------|------|----------|-------------------------------|
| 1 | _tbd_    |      |          |                               |
| 2 | _tbd_    |      |          |                               |
| 3 | _tbd_    |      |          |                               |
| Final | snarkjs beacon | | block height: _tbd_ |     |

> ⚠️ **Honesty caveat.** The three contributions above were all run from the
> same machine inside one shell session. The cryptographic guarantee of "at
> least one contributor was honest" only holds when contributors are
> *independent entities*. Before mainnet, run additional contributions with
> independent operators on independent hardware via:
>
> ```bash
> snarkjs zkey contribute amoe_final.zkey amoe_final_v2.zkey \
>     --name="<contributor handle> <date>"
> ```
>
> and chain new contributions onto `amoe_final_v2.zkey`. Each new contributor
> only needs to receive the previous zkey, contribute, and ship the new zkey
> back. Then re-emit `AmoeGroth16Verifier.sol` from the new file.

## Reproducing the verification

```bash
cd circuits/amoe/build
snarkjs zkey verify amoe_eligibility.r1cs pot14_final.ptau amoe_final.zkey
# expect: "ZKey Ok!"
```

Or from anywhere in the repo:

```bash
./tools/zk/verify_amoe_ceremony.sh
```

The verify command walks the contribution chain back to phase 1 and re-derives
each contributor's hash, so nothing in this file needs to be trusted —
`amoe_final.zkey` itself contains the full ceremony history.
