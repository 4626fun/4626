# zkMetal — deeper integration (round 2)

PRs #376, #377, #378 wired zkMetal in just enough to make the AMOE Groth16
verifier and the drand `DrandRandomnessSource` work end-to-end. zkMetal
exposes ~211 primitives; we were touching about four of them. This doc
records the second-pass integration that pulls more of the library into
production-relevant code paths.

## Scope

Four additive pieces, all on top of `main`:

1. `amoe/relayer/zkproof/` — Swift target wrapping `zkMetal.Groth16Prover` plus
   `R1CSParser` / `WitnessParser`. Replaces the snarkjs prover invocation
   on the relayer host.
2. `amoe-prover emit-verifier` — uses `zkMetal.generateSolidityVerifier`
   to re-emit `AmoeGroth16Verifier.sol`. This drops the snarkjs-emitted
   GPL-3.0 verifier we were previously shipping.
3. `amoe/relayer/drand/Sources/DrandRelay/DrandPairingPrecheck.swift` — runs
   the BLS12-381 pairing check off-chain via `GPUBLSSignatureEngine`
   before the relayer broadcasts `submitRound`. Catches malformed beacons
   without burning gas.
4. `AmoeAllowlist` — depth-20 Poseidon Merkle tree backed by
   `IncrementalMerkleTree`, replacing the hand-rolled Python tooling we
   used to build the allowlist root.

Nothing here changes any deployed contract semantics. The on-chain
verifier's verification key is unchanged. `CreatorLotteryManager.sol` is
not touched.

## What's still on the floor (intentionally)

zkMetal also offers proof aggregation, KZG, IPA, FRI, Plonk, HyperPlonk,
STARK, Nova/SuperNova, Jolt, and a long tail of folding schemes. None of
them are in the AMOE critical path right now and none would pay back the
integration effort at our current proof volume. If AMOE ever starts
processing thousands of claims per epoch, `ProofAggregationEngine` is the
obvious next stop — one on-chain pairing check for N claims.

## Performance expectations

These are zkMetal's own published numbers extrapolated to the AMOE
circuit's ~5825 constraints. Treat as targets, not measurements:

- snarkjs (Node.js, CPU) cold prove: ~600ms
- snarkjs warm prove: ~300ms
- zkMetal warm prove: 10–20ms range
- on-chain `submitRound` gas: ~135k (unchanged)
- off-chain pairing pre-check: <5ms on M-series

Real numbers will land in CI once we hook up an Apple Silicon runner.

## License posture

Swapping the verifier emitter from snarkjs to zkMetal's
`generateSolidityVerifier` removes the only GPL-3.0 surface in 4626's
on-chain code. The rest of the new code is MIT, matching the repo.

## Operator workflow

Old:

```
snarkjs groth16 fullprove input.json amoe.wasm amoe_final.zkey \
  proof.json public.json
snarkjs zkey export solidityverifier amoe_final.zkey AmoeGroth16Verifier.sol
```

New:

```
amoe-prover prove \
  --zkey   amoe/circuits/build/amoe_final.zkey \
  --r1cs   amoe/circuits/build/amoe_eligibility.r1cs \
  --input  input.json \
  --proof-out proof.json --public-out public.json --profile

amoe/tools/zk/emit_amoe_verifier.sh
```

`amoe/tools/zk/regen_amoe_fixture.sh` still works — it's the Linux fallback for
contributors without Apple Silicon. Both paths produce the same on-chain
verifier shape; only the license header and the prover speed differ.

## Pre-merge checklist

- [ ] Build `amoe/relayer/zkproof` on macOS 14 + M-series.
- [ ] Run `swift test` in `amoe/relayer/zkproof` and `amoe/relayer/drand`.
- [ ] Confirm `amoe/tools/zk/emit_amoe_verifier.sh` produces a contract that
      verifies the existing AMOE fixture proof in
      `amoe/tests/zk/AmoeGroth16Verifier.t.sol`.
- [ ] CI guard `amoe/tools/ci/check_amoe_vk.sh` still passes.
