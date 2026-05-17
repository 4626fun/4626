# zkMetal integration plan

This branch (`feat/zkmetal-integration`) is the first cut of two upgrades to
the lottery stack, both backed by [carni-ships/zkMetal](https://github.com/carni-ships/zkMetal).

## 1. AMOE eligibility goes ZK

**Why.** Today, AMOE eligibility is enforced inside
`frontend/server/_lib/lottery/lotteryAmoe.ts`: the server checks ECDSA /
EIP-1271 signatures and a Postgres nonce table, then writes the entry. The
on-chain audit surface is zero. A compromised server can mint AMOE entries
freely.

**After.** A new `LotteryAmoeRouter` settles AMOE entries on-chain. The ZK path
(`submitAmoeEntryZK`) accepts a Groth16 proof produced from
`amoe/circuits/amoe_eligibility.circom`, which proves:

- the wallet is in the daily allowlist Merkle root the server already publishes
- the nonce was bound to (wallet, creator coin) by the server
- a Twitter check-in credit is unspent for this epoch

Public inputs deliberately stay at 5 to keep gas low (~5 ecMul + 1 ecPairing).
The verifier is BN254 / EVM-precompile-only — emitted by either snarkjs or
zkMetal's `generateSolidityVerifier`. Switching the prover from snarkjs (CPU)
to zkMetal (GPU) is a binary swap; the verification key is identical.

## 2. Drand as a second randomness source

**Why.** Chainlink VRF v2.5 (`CreatorVRFConsumerV2_5`) is fine, but it's a
single source of entropy and a single trust anchor. drand provides a free,
low-latency (3s on quicknet), independent BLS12-381 beacon. Pectra shipped the
EIP-2537 BLS pairing precompile at `0x10`, which makes drand verification
~161k gas per round.

**After.** A new `DrandRandomnessSource` verifies drand **quicknet** rounds via
a single pairing call. quicknet uses scheme `bls-unchained-g1-rfc9380` —
signatures are on G1 (48 byte compressed → 128 byte EIP-2537), public key on G2
(96 byte compressed → 256 byte EIP-2537). Hash-to-curve to G1 is computed
off-chain by the relayer (see `amoe/relayer/drand`, which uses zkMetal's
`BLS12381Engine.hashToCurveG1` with DST
`BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_`) and bound to the round number
via a keccak commitment so the relayer can't substitute an attacker-chosen G1
point.

This is wired as a *secondary* source — Chainlink VRF stays primary.
`CreatorLotteryManager` is unchanged in this PR; the next PR introduces an
`IRandomnessSource` selector per creator coin.

## What's intentionally left out

- `MultiRelayerDrandSource.sol` (N-of-M relayer agreement) is queued for the
  follow-up PR.
- The `AmoeGroth16Verifier.sol` in this branch is a placeholder; CI must run
  the circuit and emit the real one before the contract leaves staging.
- Production-grade SRS for the AMOE circuit needs a real ceremony if AMOE
  becomes a major reward path. For the hackathon the Hermez ptau is fine.

## File map

```
amoe/circuits/                          Circom 2 sources + build scripts
contracts/utilities/lottery/zk/         AmoeGroth16Verifier + Router
contracts/utilities/lottery/randomness/ IRandomnessSource + DrandRandomnessSource
amoe/relayer/drand/                          Swift package: zkMetal-backed relayer
amoe/tests/zk/                                Foundry tests for the router
docs/_internal/zk/                      This doc
```
