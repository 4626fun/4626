# AMOE v2 Phase-2 Trusted Setup — Manifest

> This is a **public commitment** posted before the ceremony begins.
> Anyone — contributors, auditors, sweepstakes counsel, end users — can use
> this file to verify that the ceremony was run exactly as advertised.

This manifest pins the circuit, the contributor list, and the final-beacon
selection rule for the AMOE v2 phase-2 ceremony. Once the ceremony begins,
any change to this file is invalid: contributors are agreeing to contribute
against this exact text.

---

## 1. Circuit being signed

| Field | Value |
|-------|-------|
| Source file | `circuits/amoe/amoe_eligibility.circom` |
| Commit | _PIN at ceremony start: `git rev-parse HEAD`_ |
| Constraints | 11,367 |
| Public inputs | 8 |
| Private inputs | 85 |
| R1CS circuit hash | `b93497b0 68d1b96b fec84a90 be154a55` <br>`717dce80 19cb5e7e d90b751d a6d3238a` <br>`6d7a046d f08be06e 6e08fca0 24606b85` <br>`bfbd1da2 afe82434 13d5b610 c5ab8505` |

Re-derive the hash:

```bash
cd circuits/amoe/build
snarkjs groth16 setup amoe_eligibility.r1cs pot14_final.ptau /tmp/probe.zkey 2>&1 | grep -A4 "Circuit hash"
```

If the hash above does not match the output, **stop** — the circuit has
drifted since this manifest was signed and contributors should not proceed.

## 2. Phase-1 powers of tau

| Field | Value |
|-------|-------|
| File | `pot14_final.ptau` |
| Source | `https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau` |
| Power | 14 (max 16,384 constraints; 11,367 fits) |
| Phase-1 ceremony | Hermez community ceremony, 2022, 175+ contributors |
| File SHA-256 | _PIN at ceremony start: `sha256sum pot14_final.ptau`_ |

This file's toxic waste is shared with every project that built on top of
the Hermez phase-1 ceremony (Tornado, Polygon zkEVM, Aztec, Iden3, etc.).
The phase-1 trust assumption is "at least one of the 175+ Hermez
contributors was honest" — well-established and not specific to this
project.

## 3. Phase-2 contributor list

The phase-2 trust assumption is "**at least one of the contributors below
was honest and destroyed their entropy**." Listing more independent
contributors strictly improves security.

| # | Operator (handle) | Date committed | Hardware class | Contact / signing key |
|---|-------------------|----------------|----------------|----------------------|
| 1 | _tbd_ | | | |
| 2 | _tbd_ | | | |
| 3 | _tbd_ | | | |

> **⚠️ Honesty note for this ceremony:** if any of the rows above name the
> same person or are run on machines under the same admin account, the
> security guarantee collapses to that single person's honesty + opsec.
> See `CEREMONY.md` §"Mandatory ceremony rules for v2" for why this matters.
> Recruit at least one independent contributor before signing this
> manifest into a tagged commit.

## 4. Contribution order

Contributions are run **strictly sequentially** in the order above.
Contributor `n` receives `amoe_v2_<n-1>.zkey` from the coordinator,
produces `amoe_v2_<n>.zkey`, returns it to the coordinator, and **destroys
the entropy used** (reboot the machine; if paranoid, use a one-shot
live-USB and discard).

The coordinator publishes each contribution hash publicly within 24 hours
of receipt (see `INSTRUCTIONS.md` §6).

## 5. Final beacon

The final beacon mixes a public, unpredictable-at-ceremony-start value
into the last contribution, preventing the final contributor from biasing
the output.

| Field | Value |
|-------|-------|
| Source | Bitcoin mainnet block hash |
| Block height | _tbd — pin AT LEAST 1 WEEK in the future at signing time_ |
| Iterations | `2^10` = 1024 (snarkjs default for production) |
| Command | `snarkjs zkey beacon <last>.zkey amoe_v2_final.zkey <hash> 10` |

Block height is committed to in this manifest before the ceremony begins.
The hash is unknown to all parties at commitment time. Once the chosen
block is mined, anyone can run the beacon step deterministically.

## 6. Output artifacts

The ceremony produces:

| Artifact | Path | Purpose |
|----------|------|---------|
| `amoe_v2_final.zkey` | `circuits/amoe/build/` | The proving key. Embeds the full ceremony chain. |
| `verification_key_v2.json` | `circuits/amoe/build/` | The verifying key (38 field elements). |
| `AmoeGroth16Verifier_v2.sol` | `circuits/amoe/build/` | The Solidity verifier contract. |
| `ceremony_transcript_v2.txt` | `circuits/amoe/ceremony/v2/` | Per-contribution log + hashes. |

## 7. Verification (anyone, after the ceremony)

```bash
# Walks the contribution chain back to phase-1 and re-derives every hash.
# Nothing in this manifest needs to be trusted — amoe_v2_final.zkey itself
# embeds the full history.
cd circuits/amoe/build
snarkjs zkey verify amoe_eligibility.r1cs pot14_final.ptau amoe_v2_final.zkey
# expect: "ZKey Ok!"
```

## 8. What changes vs. the v1 ceremony

| Property | v1 (testnet) | v2 (this) |
|----------|-------------|-----------|
| Contributors | 1 person, 3 sources, 1 machine | ≥3 independent operators |
| Hardware | One shell session | Independent machines |
| Final beacon | drand cloudflare snapshot | Future Bitcoin block hash |
| Audit grade | Not for production | Production-ready (under §3 caveat) |

## 9. Contact

Coordinator: _tbd_
Audit / counsel: _tbd_
Bug bounty / disclosure: _tbd_

---

_Signed by the coordinator at ceremony start by tagging this commit:_
```
git tag -s amoe-v2-ceremony-start -m "AMOE v2 ceremony manifest pinned"
git push origin amoe-v2-ceremony-start
```
