# amoe-prover

GPU-accelerated, MIT-licensed AMOE prover and verifier emitter built on
[zkMetal](https://github.com/carni-ships/zkMetal). Replaces the snarkjs
toolchain on the relayer host.

## What it replaces

| Old (snarkjs / Node.js)                         | New (zkMetal / Swift)               |
|--|--|
| `snarkjs groth16 fullprove input.json amoe.wasm amoe_final.zkey proof.json public.json` | `amoe-prover prove --zkey … --r1cs … --input input.json --proof-out proof.json --public-out public.json` |
| `snarkjs zkey export solidityverifier amoe_final.zkey AmoeGroth16Verifier.sol` (GPL-3.0) | `amoe-prover emit-verifier --vk verification_key.json --out AmoeGroth16Verifier.sol` (MIT) |
| Hand-rolled Python Poseidon Merkle root builder | `amoe-prover build-root --leaves leaves.json --root-out root.txt` |

## Why

- **Speed.** zkMetal's `Groth16Prover` runs MSM and NTT on the Apple Silicon
  GPU. For our 5825-constraint circuit the practical effect is ~10–20ms warm
  prove time vs. ~300ms warm with snarkjs.
- **License.** snarkjs's emitted Solidity verifier is GPL-3.0. zkMetal's
  `generateSolidityVerifier` emits MIT-licensed code with the same
  precompile usage (`ecAdd 0x06`, `ecMul 0x07`, `ecPairing 0x08`), so the
  on-chain contract is functionally identical but free of the GPL flag.
- **Surface area.** Drops Node.js + WASM from the relayer host's prod
  dependencies. Only the Swift binary ships.
- **Hashing parity.** zkMetal's Poseidon2-BN254 matches the in-circuit
  Poseidon byte-for-byte, so the off-chain Merkle root and the in-circuit
  Merkle root agree by construction. No second Poseidon implementation to
  babysit.

## Build

Apple Silicon, macOS 14+:

```
cd amoe/relayer/zkproof
swift build -c release
```

Binary lands at `.build/release/amoe-prover`.

## Subcommands

### `prove`
Generate a snarkjs-compatible proof for AMOE eligibility.

```
amoe-prover prove \
  --zkey      amoe/circuits/build/amoe_final.zkey \
  --r1cs      amoe/circuits/build/amoe_eligibility.r1cs \
  --input     /tmp/amoe-input.json \
  --proof-out /tmp/proof.json \
  --public-out /tmp/public.json \
  --profile
```

`input.json` schema — field names match the circom `signal input`
declarations in `amoe/circuits/amoe_eligibility.circom` exactly, so any
fixture you would have fed to `snarkjs groth16 fullprove` works unchanged:

```json
{
  // Public signals (5)
  "walletAddrCommit":       "decimal Fr",
  "creatorCoinAddr":        "decimal Fr",
  "nonceCommit":            "decimal Fr",
  "epoch":                  "decimal Fr",
  "allowlistRoot":          "decimal Fr",

  // Private signals
  "wallet":                 "decimal Fr",
  "nonce":                  "decimal Fr",
  "twitterCreditNullifier": "decimal Fr",
  "pathElements":           ["...20 entries..."],
  "pathIndices":            ["0", "1", "..."]
}
```

The output `proof.json` and `public.json` are byte-equivalent in shape to
snarkjs's, so the existing `AmoeGroth16Verifier` consumes them unchanged.

### `emit-verifier`
Re-emit the Solidity verifier from the AMOE verification key.

```
amoe-prover emit-verifier \
  --vk   amoe/circuits/build/verification_key.json \
  --out  contracts/utilities/lottery/zk/AmoeGroth16Verifier.sol \
  --name AmoeGroth16Verifier
```

The output replaces the snarkjs-emitted contract. The verification key is
unchanged, so any previously generated proof verifies under the new contract.

### `build-root`
Build a depth-20 Poseidon Merkle root over an allowlist of decimal-Fr leaves.
Uses zkMetal's `IncrementalMerkleTree`.

```
amoe-prover build-root \
  --leaves   /tmp/allowlist.json \
  --root-out /tmp/root.txt
```

## Tests

```
swift test
```

The full prove-then-verify integration test requires the real
`amoe_final.zkey` artifact and is skipped when absent. Local builders can
generate it with `amoe/tools/zk/regen_amoe_fixture.sh`.

## Status

Apple Silicon-only. Linux is not a target — zkMetal is Metal-bound. If we
ever need Linux proving the path is zkMetal's Rust bindings
(`bindings/rust/zkmetal-sys`).
