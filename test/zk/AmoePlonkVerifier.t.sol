// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {AmoePlonkVerifier} from "contracts/utilities/lottery/zk/AmoePlonkVerifier.sol";

/// @notice End-to-end PLONK fixture test.
///
///         The proof + public inputs below are the real output of:
///           snarkjs plonk fullprove (against amoe_plonk_final.zkey)
///         where amoe_plonk_final.zkey was produced from:
///           * R1CS:  amoe_eligibility.circom (-O1)
///           * SRS:   Hermez powersOfTau28_hez_final_17.ptau
///           * Setup: snarkjs plonk setup (no per-circuit phase 2 needed)
///
///         Witness was generated from circuits/amoe/build/input_v2.json.
///         Regenerate via tools/zk/regen_amoe_plonk_fixture.sh (TODO).
contract AmoePlonkVerifierTest is Test {
    /// @dev BN254 scalar field modulus (matches the `q` constant in the
    ///      verifier's inline assembly).
    uint256 internal constant Q =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    AmoePlonkVerifier verifier;

    function setUp() public {
        verifier = new AmoePlonkVerifier();
    }

    /// @dev Real PLONK proof. Asserts the verifier returns true.
    function test_realProofVerifies() public view {
        (uint256[24] memory proof, uint256[8] memory pub) = _fixture();
        bool ok = verifier.verifyProof(proof, pub);
        assertTrue(ok, "valid PLONK proof must verify");
    }

    /// @dev Tamper one public input — must reject.
    function test_tamperedPublicInputRejected() public view {
        (uint256[24] memory proof, uint256[8] memory pub) = _fixture();
        // Flip the epoch from 1 -> 2.
        pub[3] = 2;
        bool ok = verifier.verifyProof(proof, pub);
        assertFalse(ok, "tampered input must reject");
    }

    /// @dev SECURITY REGRESSION: a non-canonical encoding of any public input
    ///      (`x + k*q`) MUST be rejected before it reaches the transcript.
    ///      Without the explicit `checkField` loop on `_pubSignals` that the
    ///      AmoePlonkVerifier adds on top of the stock snarkjs output, a
    ///      prover could supply x or x+q and produce two distinct raw-bytes
    ///      values that are field-equivalent — defeating the router's
    ///      raw-bytes replay maps (usedNonceCommit, usedWalletCommit,
    ///      usedPointsBurnNullifier).
    ///
    ///      Stock snarkjs PLONK verifiers DO check field bounds on the 24
    ///      proof scalars but NOT on the public inputs. We add that check;
    ///      this test pins it.
    ///
    ///      Reverts because `checkField` does an unconditional `return(0,0x20)`
    ///      with `mstore(0, 0)` — that aborts the call returning a single
    ///      0x20-byte zero word. Solidity decodes this as `false`, NOT as
    ///      a successful `true` return. We assert `false`.
    function test_nonCanonicalPublicInputRejected() public view {
        (uint256[24] memory proof, uint256[8] memory pub) = _fixture();
        // Add q to the epoch slot. Field-equivalent to original (1) but a
        // distinct raw uint256. With the patch in place, verifyProof must
        // short-circuit to false.
        pub[3] = pub[3] + Q;
        bool ok = verifier.verifyProof(proof, pub);
        assertFalse(ok, "non-canonical (x + q) public input must reject");
    }

    /// @dev Same regression, but for the wallet commit slot — the highest-
    ///      value target for replay confusion.
    function test_nonCanonicalWalletCommitRejected() public view {
        (uint256[24] memory proof, uint256[8] memory pub) = _fixture();
        pub[0] = pub[0] + Q;
        bool ok = verifier.verifyProof(proof, pub);
        assertFalse(ok, "non-canonical wallet commit must reject");
    }

    /// @dev Measure verify gas. Logged for the migration tradeoff doc.
    function test_gasMeasurement() public view {
        (uint256[24] memory proof, uint256[8] memory pub) = _fixture();
        uint256 g0 = gasleft();
        bool ok = verifier.verifyProof(proof, pub);
        uint256 used = g0 - gasleft();
        assertTrue(ok);
        console2.log("PLONK verifyProof gas:", used);
    }

    function _fixture() internal pure returns (uint256[24] memory proof, uint256[8] memory pub) {
        proof[ 0] = 0x1a44fca81e6bbdf6a3cde5b7933a8d50323744c332d72c3c4453819f75ff50e5;
        proof[ 1] = 0x2becebd5241a74f96de452019edbec80270827d51c2de3bf893a739458fa097b;
        proof[ 2] = 0x02afc668d0cef97d04291c1e73dc257102d3eeda38a45e5b41ea833b4d26c016;
        proof[ 3] = 0x2c7e0f4ea786b191ffbd2db7bb312c4b21a628f9882f8fcd5ea54ac93dd8efa5;
        proof[ 4] = 0x1ec02acfa1db877238b908741c253528b8ba57dd15cd18823499d9c46fb4d09a;
        proof[ 5] = 0x066a759d52f589a3dcbd03452fd4b3b8b85c863f2b894d4363f74af18312322c;
        proof[ 6] = 0x039a44f0dfb802e9506ded3543829ff80dc306f6bd7b404cf8f656f280cd2806;
        proof[ 7] = 0x2d72c9f10ec402bbd81185b37ac7b831a2d08f0471e0960dd89927a7ba1877cc;
        proof[ 8] = 0x0d0e814571023ff2b983723d38b9da36d9afb9de34a803fcc7f9fb5561459da9;
        proof[ 9] = 0x00a85b3c39e759845895053e9cf2881e6f9d928712a8f9725bdfa25f2bc242c8;
        proof[10] = 0x27f0b0340edd6a95c9cca7fd3dd8efb41af964add75be6e1ac2b95da59caa46e;
        proof[11] = 0x0781f9ad765b5d7d4e2c86a7b16070f10e5c73c3a0c6461e0b9960e7448c3146;
        proof[12] = 0x052b68286cd53177c8852d66100a4819511a955f341c00d159e910e369c675b7;
        proof[13] = 0x27dfe0cc923706fe200d2d3672694545624c4d87753f211e9023f21dbb78d2bc;
        proof[14] = 0x25520a560afd12bfbd4208870708b08e2716b7e59095e45db9041365d18fca37;
        proof[15] = 0x09c642db3edcf25f8ecd350ee80e3e8fb24c4227cada7a4c4907cacebc621cda;
        proof[16] = 0x1a779119ced970ec3ea0038f1ea7a7addf6dcd0e482d8142cb05838c08389f25;
        proof[17] = 0x1252458f38e92b09883396f035948d9385480d2661040b752ed4085b792bbe56;
        proof[18] = 0x26bcefc70e7f31ccc994eb16be6568d0776fcfa7401474bc1dc2b2cf6d5b478e;
        proof[19] = 0x232988a742744c6589dc0a32dc480d79617b0bdc39a283edd97649b5ac6bd14d;
        proof[20] = 0x0f8e44679a967e47dfaa6c95c22e0627f77bc8fe1bd28c206cbf5ec46cc37c1c;
        proof[21] = 0x0b3e1923f8e9c0fa144ec17b33aa3db604d6a24e80560cd47ad397062115f22a;
        proof[22] = 0x0fe474d9a1837d4b7e73352f6f9e03b23514207c4877e0a2388d56558c64ebae;
        proof[23] = 0x21406ad366d4c1f8a2763b5ab4bee29e6cb9617319575d7345b68085c17f9eb3;

        pub[0] = 0x14e9fd289780e5f9f4da1fb2a4759160db00379afa607c737578efbb93d24f98;
        pub[1] = 0x00000000000000000000000000000000c0ffeec0ffeec0ffeec0ffeec0ffeec0;
        pub[2] = 0x011f2b850c7c8879a9cc7b87fa6edd0a4b0dd65e4e842f8637494550f572dc01;
        pub[3] = 0x0000000000000000000000000000000000000000000000000000000000000001;
        pub[4] = 0x1aa68d103c8a332b52d205b2b10cda8a22edb028374e0cb7cc5ef5f288e63e17;
        pub[5] = 0x00000000000000000000000000000000000000000000000000000000000f4240;
        pub[6] = 0x16bc6d81db1eaf1680362aaf47f0c676a21281346c77be08036397f01e749839;
        pub[7] = 0x0ecf6254b04738d669fff669b4ebd525bddbd6989e06b4a94d4e2f8ea1e167bc;
    }
}
