# AMOE Eligibility Circuit (v2)

Circom 2 circuit that powers `LotteryAmoeRouter.submitAmoeEntryZK` in
`contracts/utilities/lottery/zk`. See `amoe_eligibility.circom` for the full
spec; the short version:

| #   | Public input          | Meaning                                                    |
|-----|-----------------------|------------------------------------------------------------|
| 0   | `walletAddrCommit`    | `Poseidon(wallet, twitterCreditNullifier)` — links the entry to a wallet **and** to an unspent Twitter check-in credit, without leaking either |
| 1   | `creatorCoinAddr`     | Creator coin (uint160)                                     |
| 2   | `nonceCommit`         | `Poseidon(nonce, wallet, creatorCoin)` — server-issued     |
| 3   | `epoch`               | AMOE epoch id (uint64)                                     |
| 4   | `allowlistRoot`       | Daily allowlist Merkle root (Poseidon)                     |
| 5   | `pointsBurnedAsUSD`   | uint64 — USDC-1e6 value of the AMOE points burned for this entry. Cryptographically bound; the contract no longer trusts the relayer's claim. |
| 6   | `pointsLedgerRoot`    | Daily Merkle root of the points-burn ledger (Poseidon). Publisher-set, one-shot per epoch. |
| 7   | `pointsBurnNullifier` | `Poseidon4(signupIdHash, spendRefIdHash, pointsBurnedAsUSD, epoch)` — globally replay-guarded; one points-row → one entry, ever. |

v2 vs v1 changes are documented in `CEREMONY.md § Circuit versions`. v2
closes the trust gap that allowed `authorizedAmoeRelayer` to assert an
arbitrary `pointsBurnedAsUSD` for any allowlisted wallet.

Identity inside the circuit is `signupIdHash` — the off-chain stable identity
from `frontend/server/_lib/lottery/lotteryAmoe.ts`, NOT the wallet address.
Wallets collapse to one profile via merge logic; signup_id is the only stable
handle. The points-ledger leaf shape is
`Poseidon5(signupIdHash, spendRefIdHash, pointsBurnedAsUSD, epoch, walletAddrCommit)`,
which binds *which wallet was active at burn time* to the proof so a profile
merge mid-flight produces a leaf the prover cannot reproduce.

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
