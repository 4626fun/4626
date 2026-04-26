# AMOE Eligibility Circuit

Circom 2 circuit that powers `LotteryAmoeRouter.submitAmoeEntryZK` in
`contracts/utilities/lottery/zk`. See `amoe_eligibility.circom` for the full
spec; the short version:

| Public input        | Meaning                                                    |
|---------------------|------------------------------------------------------------|
| `walletAddrCommit`  | `Poseidon(wallet, twitterCreditNullifier)` — links the entry to a wallet **and** to an unspent Twitter check-in credit, without leaking either |
| `creatorCoinAddr`   | Creator coin (uint160)                                     |
| `nonceCommit`       | `Poseidon(nonce, wallet, creatorCoin)` — server-issued     |
| `epoch`             | AMOE epoch id (uint64)                                     |
| `allowlistRoot`     | Daily allowlist Merkle root (Poseidon)                     |

## Build

We use Circom 2 + snarkjs Groth16 on BN254 — same curve and verifier shape that
zkMetal's `generateSolidityVerifier` emits, so the prover can move from snarkjs
(CPU) to zkMetal's `Groth16Prover` (Apple Silicon GPU) later without changing
the verification key.

```bash
# 1. Compile circuit
circom amoe_eligibility.circom --r1cs --wasm --sym -o build/

# 2. Powers of Tau (use the official ptau file, do NOT generate your own for
#    production; this tree fits in 2^17)
curl -L -o build/pot17_final.ptau \
  https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_17.ptau

# 3. Phase 2 — circuit-specific
snarkjs groth16 setup build/amoe_eligibility.r1cs build/pot17_final.ptau \
  build/amoe_0000.zkey
snarkjs zkey contribute build/amoe_0000.zkey build/amoe_final.zkey \
  --name="4626.fun AMOE phase2" -v
snarkjs zkey export verificationkey build/amoe_final.zkey build/verification_key.json

# 4. Emit the Solidity verifier — two options:
#    (a) snarkjs (default during dev)
snarkjs zkey export solidityverifier build/amoe_final.zkey \
  ../../contracts/utilities/lottery/zk/AmoeGroth16Verifier.sol

#    (b) zkMetal (production — same VK, GPU-accelerated proving)
swift run zkmsm-cli emit-solidity \
  --vk build/verification_key.json \
  --out ../../contracts/utilities/lottery/zk/AmoeGroth16Verifier.sol \
  --name AmoeGroth16Verifier
```

## Trusted setup hand-off

The `amoe_final.zkey` produced above is the only artifact that must travel
to production. It pins the verification key embedded in `AmoeGroth16Verifier.sol`.
Re-emit the Solidity contract whenever the circuit changes; the on-chain VK
must always match the zkey used by provers.

## Migrating the prover from snarkjs to zkMetal

zkMetal accepts the snarkjs `*.r1cs`, `*.wtns` (witness), and `*.zkey` formats
verbatim. To switch:

```swift
import zkMetal

let prover = try Groth16Prover.load(zkeyURL: zkeyURL)
let proof  = try prover.prove(witnessURL: wtnsURL)
let json   = try proof.exportJSON(format: .snarkjs) // drop-in replacement
```

Verification key is unchanged, so the deployed `AmoeGroth16Verifier.sol`
keeps verifying without any contract redeploy.
