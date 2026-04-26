# AMOE Trusted Setup — Ceremony Record

This file documents the phase-2 trusted setup for `amoe_eligibility.circom`. It
captures every contribution, the final-beacon parameters, and the verification
output of `snarkjs zkey verify`.

## Verification key fingerprint

The on-chain `AmoeGroth16Verifier.sol` was emitted directly from `amoe_final.zkey`.
Anyone can re-verify by running `tools/zk/verify_amoe_ceremony.sh` — it pulls
the same ptau, runs `snarkjs zkey verify`, and asserts the circuit hash matches:

```
3f619c31 4eb192e7 38622252 12d78b6f
fd7cbc53 3af92c71 796a728c 5990437f
7aec7331 c39bb559 361273bd 9a6cbdef
1dfa019b 22481cc1 3823003f f56017ab
```

## Phase 1 (powers of tau)

Reused the public Hermez ceremony, file `powersOfTau28_hez_final_14.ptau`:

- Source: `https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau`
- Phase-1 contributors: 175+ (Hermez community ceremony, 2022). Toxic waste from
  this phase is shared with every consumer of the file (Tornado Cash, Polygon
  zkEVM, Aztec, Iden3, etc.). This is fine — phase-1 only depends on at least
  one honest contributor among the community.

## Phase 2 (circuit-specific)

Three contributions plus a final beacon, run during this branch's ceremony:

| # | Source                            | Contribution hash (first 32B)           |
|---|-----------------------------------|------------------------------------------|
| 1 | `/dev/urandom` (kernel CSPRNG)    | `d60ce7f1 c8944193 539c9257 6562ec4e`    |
| 2 | kernel state (boot_id, uptime, loadavg) | `119a45d8 7885dd46 20298dd8 29de9b8a` |
| 3 | drand cloudflare beacon + urandom mix | `b2f9bb41 fe327f69 6355f14d a3cb017c` |
| Final | snarkjs beacon, 2^10 iterations, generator `01..20` | `d6de100d 769b3e70 8a4a6032 e982ae91` |

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
