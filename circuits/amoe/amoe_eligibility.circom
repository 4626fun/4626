// SPDX-License-Identifier: MIT
pragma circom 2.1.6;

// AMOE Eligibility Circuit (4626.fun)
// =============================================================================
// Proves, without revealing private inputs, that a wallet is permitted to
// submit a no-purchase lottery entry for a given creator coin in a given epoch.
//
// This is the ZK replacement for the off-chain ECDSA / EIP-1271 attestation
// performed today in `frontend/server/_lib/lottery/lotteryAmoe.ts`. The trust
// assumption moves from "trust the server's signed nonce" to "trust the daily
// allowlist Merkle root that the server publishes on-chain" + "trust that a
// nonce commitment exists for this wallet".
//
// Public inputs (in this exact order — must match Groth16Verifier.IC indices):
//   0  walletAddrCommit   Poseidon(wallet, twitterCreditNullifier)
//   1  creatorCoinAddr    address of the creator coin (uint160)
//   2  nonceCommit        Poseidon(nonce, wallet, creatorCoin)
//   3  epoch              current AMOE epoch id (uint64)
//   4  allowlistRoot      Merkle root of the daily wallet allowlist
//
// Private inputs (witness only):
//   wallet                 EOA / smart-wallet address (uint160)
//   nonce                  server-issued bytes32 nonce
//   twitterCreditNullifier Poseidon(twitterUserId, epoch, secretSalt) — proves
//                          AMOE_DAILY_TWITTER_CREDIT was earned without leaking
//                          the underlying twitter id
//   pathElements[DEPTH]    sibling hashes for the allowlist Merkle proof
//   pathIndices[DEPTH]     left/right bits for the Merkle proof
//
// Notes
// -----
// - Hash function is Poseidon (BN254 native, ~150 constraints per hash) — this
//   keeps the generated Groth16 verifier small. Keccak inside the circuit would
//   blow up R1CS size by ~30x.
// - DEPTH = 20 supports up to 2^20 = ~1M wallets per daily snapshot. Plenty for
//   AMOE volumes; bump only if the snapshot grows past that.
// - The server still publishes `allowlistRoot` on-chain once per epoch via
//   `LotteryAmoeRouter.setAllowlistRoot(epoch, root)` (admin-only). The circuit
//   never sees the raw allowlist.
// =============================================================================

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/mux1.circom";

// -----------------------------------------------------------------------------
// MerkleProof — verifies a Poseidon Merkle inclusion proof of `leaf` against
// `root` along a path of length DEPTH.
// -----------------------------------------------------------------------------
template MerkleProof(DEPTH) {
    signal input leaf;
    signal input root;
    signal input pathElements[DEPTH];
    signal input pathIndices[DEPTH]; // 0 = leaf is left child, 1 = right child

    component leftMux[DEPTH];
    component rightMux[DEPTH];
    component hashers[DEPTH];

    signal cur[DEPTH + 1];
    cur[0] <== leaf;

    for (var i = 0; i < DEPTH; i++) {
        // Constrain pathIndices[i] to be a single bit.
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        // Two independent Mux1 selections so each constraint stays quadratic:
        //   left  = (1 - s)*cur + s*sibling
        //   right = s*cur       + (1 - s)*sibling
        leftMux[i] = Mux1();
        leftMux[i].c[0] <== cur[i];
        leftMux[i].c[1] <== pathElements[i];
        leftMux[i].s    <== pathIndices[i];

        rightMux[i] = Mux1();
        rightMux[i].c[0] <== pathElements[i];
        rightMux[i].c[1] <== cur[i];
        rightMux[i].s    <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== leftMux[i].out;
        hashers[i].inputs[1] <== rightMux[i].out;

        cur[i + 1] <== hashers[i].out;
    }

    cur[DEPTH] === root;
}

// -----------------------------------------------------------------------------
// AmoeEligibility — top-level circuit
// -----------------------------------------------------------------------------
template AmoeEligibility(DEPTH) {
    // ---- Public inputs ----
    signal input walletAddrCommit;
    signal input creatorCoinAddr;
    signal input nonceCommit;
    signal input epoch;
    signal input allowlistRoot;

    // ---- Private inputs ----
    signal input wallet;
    signal input nonce;
    signal input twitterCreditNullifier;
    signal input pathElements[DEPTH];
    signal input pathIndices[DEPTH];

    // -- 1. Bind wallet + twitter credit nullifier into the public commitment.
    component wcHash = Poseidon(2);
    wcHash.inputs[0] <== wallet;
    wcHash.inputs[1] <== twitterCreditNullifier;
    walletAddrCommit === wcHash.out;

    // -- 2. Bind the server-issued nonce to (wallet, creatorCoin). This is the
    //       same coupling that lotteryAmoe.ts enforces today via the EIP-712
    //       message hash, but as a Poseidon commitment posted on-chain by the
    //       server when it issues the nonce.
    component nHash = Poseidon(3);
    nHash.inputs[0] <== nonce;
    nHash.inputs[1] <== wallet;
    nHash.inputs[2] <== creatorCoinAddr;
    nonceCommit === nHash.out;

    // -- 3. Range-check creatorCoinAddr fits in 160 bits. Prevents the prover
    //       from passing a junk field element that collides with a real addr.
    component addrBits = Num2Bits(160);
    addrBits.in <== creatorCoinAddr;

    // -- 4. Range-check epoch fits in 64 bits.
    component epochBits = Num2Bits(64);
    epochBits.in <== epoch;

    // -- 5. Allowlist Merkle inclusion. Leaf binds wallet + epoch so a leaf
    //       from yesterday's snapshot can't be replayed today.
    component leafHash = Poseidon(2);
    leafHash.inputs[0] <== wallet;
    leafHash.inputs[1] <== epoch;

    component merkle = MerkleProof(DEPTH);
    merkle.leaf  <== leafHash.out;
    merkle.root  <== allowlistRoot;
    for (var i = 0; i < DEPTH; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i]  <== pathIndices[i];
    }
}

component main {
    public [walletAddrCommit, creatorCoinAddr, nonceCommit, epoch, allowlistRoot]
} = AmoeEligibility(20);
