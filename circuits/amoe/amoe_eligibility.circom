// SPDX-License-Identifier: MIT
pragma circom 2.1.6;

// AMOE Eligibility Circuit v2 (4626.fun)
// =============================================================================
// Proves, without revealing private inputs, that a wallet is permitted to
// submit a no-purchase lottery entry for a given creator coin in a given epoch
// AND that the entry is backed by a specific, non-replayable points-burn row
// in the off-chain ledger snapshotted into `pointsLedgerRoot`.
//
// v2 closes the trust gap that allowed `authorizedAmoeRelayer` to assert an
// arbitrary `pointsBurnedAsUSD` for any allowlisted wallet. v1 only proved
// eligibility (allowlist + nonce); v2 also proves the value the lottery
// manager will use to compute win-chance.
//
// Public inputs (in this exact order — must match Groth16Verifier.IC indices):
//   0  walletAddrCommit       Poseidon(wallet, twitterCreditNullifier)
//   1  creatorCoinAddr        address of the creator coin (uint160)
//   2  nonceCommit            Poseidon(nonce, wallet, creatorCoin)
//   3  epoch                  current AMOE epoch id (uint64)
//   4  allowlistRoot          Merkle root of the daily wallet allowlist
//   5  pointsBurnedAsUSD      uint64 — value bound into the proof (NEW in v2)
//   6  pointsLedgerRoot       Merkle root of the points-burn ledger (NEW in v2)
//   7  pointsBurnNullifier    Poseidon(signupIdHash, spendRefIdHash,
//                                      pointsBurnedAsUSD, epoch) (NEW in v2)
//
// Private inputs (witness only):
//   wallet                    EOA / smart-wallet address (uint160)
//   nonce                     server-issued bytes32 nonce
//   twitterCreditNullifier    Poseidon(twitterUserId, epoch, secretSalt)
//   pathElements[DEPTH]       allowlist Merkle siblings
//   pathIndices[DEPTH]        allowlist Merkle left/right bits
//   signupIdHash              Poseidon(signup_id_uuid_bytes) — stable identity
//   spendRefIdHash            Poseidon(source_id_uuid_bytes) — unique points-row id
//   pointsLedgerPathElements[DEPTH]
//   pointsLedgerPathIndices[DEPTH]
//
// Notes
// -----
// - Identity is `signupIdHash` (NOT wallet). Wallets collapse to one profile
//   via the off-chain merge logic; signup_id is the only stable handle for a
//   user. The points-burn nullifier is therefore keyed off (signupIdHash,
//   spendRefIdHash, pointsBurnedAsUSD, epoch). One spend row → one nullifier.
// - The ledger leaf BINDS walletAddrCommit (already a public input) so a proof
//   minted from a different wallet than the one active at burn time fails
//   verification. This prevents profile-merge race conditions from being
//   exploitable on-chain; the off-chain pipeline additionally enforces a
//   ~24h `profile_merge_frozen_until` window during proof submission.
// - Replay guard for `pointsBurnNullifier` is GLOBAL on-chain
//   (`mapping(bytes32 => bool) usedPointsBurnNullifier`). Once a spend row is
//   consumed by an AMOE entry, it can never back another entry, in any epoch.
// - DEPTH = 20 supports up to 2^20 = ~1M entries per snapshot for both the
//   allowlist and points-burn ledger trees. Adequate for AMOE volumes.
// - Constraint cost: roughly 2× v1 (one extra Poseidon-5 leaf hash, one extra
//   20-deep Poseidon-2 Merkle path, one Poseidon-4 nullifier hash, one
//   uint64 range check). Stays well under 2^14 = 16,384 constraints, so the
//   existing `pot14_final.ptau` covers v2 without a larger ptau download.
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
// AmoeEligibility v2 — top-level circuit
// -----------------------------------------------------------------------------
template AmoeEligibility(DEPTH) {
    // ---- Public inputs ----
    signal input walletAddrCommit;
    signal input creatorCoinAddr;
    signal input nonceCommit;
    signal input epoch;
    signal input allowlistRoot;
    signal input pointsBurnedAsUSD;        // v2
    signal input pointsLedgerRoot;         // v2
    signal input pointsBurnNullifier;      // v2

    // ---- Private inputs (allowlist eligibility) ----
    signal input wallet;
    signal input nonce;
    signal input twitterCreditNullifier;
    signal input pathElements[DEPTH];
    signal input pathIndices[DEPTH];

    // ---- Private inputs (points-burn ledger, v2) ----
    signal input signupIdHash;
    signal input spendRefIdHash;
    signal input pointsLedgerPathElements[DEPTH];
    signal input pointsLedgerPathIndices[DEPTH];

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

    // -- 3. Range-check creatorCoinAddr fits in 160 bits.
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

    // =========================================================================
    // v2 — points-burn binding
    // =========================================================================

    // -- 6. Range-check pointsBurnedAsUSD fits in 64 bits. AMOE caps the
    //       value at 1M points × 10_000 = 10^10 1e6 units = $10K, which is
    //       comfortably inside uint64 (~1.8e19). On-chain, the router
    //       additionally asserts pointsBurnedAsUSD <= MAX_POINTS_AS_USD as
    //       defense in depth, but enforcing a clean uint64 here prevents the
    //       prover from passing field-element junk that aliases small values.
    component pointsBits = Num2Bits(64);
    pointsBits.in <== pointsBurnedAsUSD;

    // -- 7. Bind the points-burn nullifier to (signupIdHash, spendRefIdHash,
    //       pointsBurnedAsUSD, epoch). The nullifier is keyed off the stable
    //       signup_id (NOT wallet) and the unique points-row source_id, both
    //       of which the off-chain pipeline already maintains.
    component nullHash = Poseidon(4);
    nullHash.inputs[0] <== signupIdHash;
    nullHash.inputs[1] <== spendRefIdHash;
    nullHash.inputs[2] <== pointsBurnedAsUSD;
    nullHash.inputs[3] <== epoch;
    pointsBurnNullifier === nullHash.out;

    // -- 8. Points-burn ledger Merkle inclusion. Leaf shape:
    //       Poseidon5(signupIdHash, spendRefIdHash, pointsBurnedAsUSD, epoch,
    //                 walletAddrCommit)
    //       Including walletAddrCommit binds *which wallet was active at burn
    //       time* to the proof. A profile merge that re-keys wallets to a
    //       different signup_id mid-flight produces a leaf the prover cannot
    //       reproduce — the proof fails closed.
    component ledgerLeaf = Poseidon(5);
    ledgerLeaf.inputs[0] <== signupIdHash;
    ledgerLeaf.inputs[1] <== spendRefIdHash;
    ledgerLeaf.inputs[2] <== pointsBurnedAsUSD;
    ledgerLeaf.inputs[3] <== epoch;
    ledgerLeaf.inputs[4] <== walletAddrCommit;

    component pointsMerkle = MerkleProof(DEPTH);
    pointsMerkle.leaf <== ledgerLeaf.out;
    pointsMerkle.root <== pointsLedgerRoot;
    for (var i = 0; i < DEPTH; i++) {
        pointsMerkle.pathElements[i] <== pointsLedgerPathElements[i];
        pointsMerkle.pathIndices[i]  <== pointsLedgerPathIndices[i];
    }
}

component main {
    public [
        walletAddrCommit,
        creatorCoinAddr,
        nonceCommit,
        epoch,
        allowlistRoot,
        pointsBurnedAsUSD,
        pointsLedgerRoot,
        pointsBurnNullifier
    ]
} = AmoeEligibility(20);
