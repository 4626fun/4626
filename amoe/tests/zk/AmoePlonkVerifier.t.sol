// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {AmoePlonkVerifier} from "@4626/shared/lottery/zk/AmoePlonkVerifier.sol";

/// @notice End-to-end PLONK fixture test (circuit v3 — 9 public inputs).
///
///         Regenerate via `amoe/tools/zk/regen_amoe_plonk_fixture.mjs` after
///         `regen_amoe_plonk_verifier.sh`.
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
        (uint256[24] memory proof, uint256[9] memory pub) = _fixture();
        bool ok = verifier.verifyProof(proof, pub);
        assertTrue(ok, "valid PLONK proof must verify");
    }

    /// @dev Tamper one public input — must reject.
    function test_tamperedPublicInputRejected() public view {
        (uint256[24] memory proof, uint256[9] memory pub) = _fixture();
        pub[3] = 2;
        bool ok = verifier.verifyProof(proof, pub);
        assertFalse(ok, "tampered input must reject");
    }

    /// @dev SECURITY REGRESSION: non-canonical (x + k*q) public input rejected.
    function test_nonCanonicalPublicInputRejected() public view {
        (uint256[24] memory proof, uint256[9] memory pub) = _fixture();
        pub[3] = pub[3] + Q;
        bool ok = verifier.verifyProof(proof, pub);
        assertFalse(ok, "non-canonical (x + q) public input must reject");
    }

    /// @dev Same regression for wallet commit slot.
    function test_nonCanonicalWalletCommitRejected() public view {
        (uint256[24] memory proof, uint256[9] memory pub) = _fixture();
        pub[0] = pub[0] + Q;
        bool ok = verifier.verifyProof(proof, pub);
        assertFalse(ok, "non-canonical wallet commit must reject");
    }

    /// @dev Measure verify gas.
    function test_gasMeasurement() public view {
        (uint256[24] memory proof, uint256[9] memory pub) = _fixture();
        uint256 g0 = gasleft();
        bool ok = verifier.verifyProof(proof, pub);
        uint256 used = g0 - gasleft();
        assertTrue(ok);
        console2.log("PLONK verifyProof gas:", used);
    }

    function _fixture() internal pure returns (uint256[24] memory proof, uint256[9] memory pub) {
        proof[ 0] = 0x077365fd924edfb354fd3a70d282bc7e5f4be33537de731c588a7f7b6375eb66;
        proof[ 1] = 0x0441a1d6f9941c62f4f6ea10d9234f0b9992a83b43a6727f185e38af51365df7;
        proof[ 2] = 0x0ee746d0b5ef4ed52f83d6de4c7ea6aeb3da8403ce200b044a2b571190173d56;
        proof[ 3] = 0x07c4f1bc311d72588d85fd5e1356be42635041ed78c5b078a720866a9a49d462;
        proof[ 4] = 0x223257acd633d8b2ccf2721ec9da1c0f77890933aefb813ca8d650fd3b42c004;
        proof[ 5] = 0x264e9c493c440e561e9eba19d13684dab3d377aff1a93b49c66808d778bd6ba3;
        proof[ 6] = 0x2de876f96cb69c56f4ac211aa537ea88a74b9b7fd4ab301e1db14fdd885a7675;
        proof[ 7] = 0x171238423feed0ffdcaa7a79e8479018fafb6257cb054957ecbbe6002ee889d9;
        proof[ 8] = 0x23f35b5fae8a02c11d142e8d583b8e3e7941fd8bd10f4c292bd9ddebed7c6c76;
        proof[ 9] = 0x2125e414eb157bcea87b62db020daf2477b2eb72873b3bb8b15e29e995286041;
        proof[10] = 0x100b38c3e151e04100af2ee877f90e807a91f3b51625f664c1ea314edd041968;
        proof[11] = 0x00b4ff58ab08e758c1a845bc66e4d269dee0eb8d8be8b204cd9c8a96a8044e4a;
        proof[12] = 0x12acb07ea778925c5e564ae1f079ae6d8485956f29ebf08b6a94eaaf9f897f7d;
        proof[13] = 0x2098aa14747f0b9d9697cdde80018b73b5fe54b1fa8d3dcad4e05637a247f9ff;
        proof[14] = 0x27260337731bad1ee0e67cd7c6addad2c22f8fe5f902c1d653c647b79ebfe1d1;
        proof[15] = 0x2faafe67c859a42ebf57df1215d1cd253e80696fd5f65e3574c849029cfb6c92;
        proof[16] = 0x0a705f7d4b9f24eb9bfe737abc13620061107f985532ef00c8320dd403463491;
        proof[17] = 0x2c8b8a6fea788f70aa1cb894ff5a5dacc4baa379d96c49349ce24ad4bfea7357;
        proof[18] = 0x2912fb95297185cdee795eff5bbf2aa64370bb31c1bed95a00296f4787b97002;
        proof[19] = 0x164ffe084fefb242e77cd0e024c1637fbf2ca66d761e404412c8ff74ddad9110;
        proof[20] = 0x0993c4420f2218699532470219ed80e749e1c0dd5e600c28e44f4d10ba603fca;
        proof[21] = 0x1f759b1de8e991fb6b9c771c4872d8a038ecc2b64378684195e81b74a5821664;
        proof[22] = 0x205c1850889edb934b2f06f1ddba62270e3f92d36612aa9b71efb2662de2c2fb;
        proof[23] = 0x0972cd862397da0e3066698dffe8827a8e6e591344fafb927c73b3293627c3b7;

        pub[0] = 0x1b0da32af1fa5bc42951815270fbd3734fe68142d13dfafcfc1aec791e5a86f5;
        pub[1] = 0x00000000000000000000000000000000c0ffeec0ffeec0ffeec0ffeec0ffeec0;
        pub[2] = 0x0c014ba73b6d0af33b368fd01f70e8b2321ad44ff9e588ad5a230be9593a5094;
        pub[3] = 0x0000000000000000000000000000000000000000000000000000000000000001;
        pub[4] = 0x1aa68d103c8a332b52d205b2b10cda8a22edb028374e0cb7cc5ef5f288e63e17;
        pub[5] = 0x00000000000000000000000000000000000000000000000000000000000f4240;
        pub[6] = 0x096a8048c9ea298aca27441d476d1af34ddffdd1385893a2060d47e3558ee307;
        pub[7] = 0x078458e4372171bebd5f55788e9a6ad4a040b0486746b6b9da50c9224b7a24c3;
        pub[8] = 0x0000000000000000000000001234567890abcdef1234567890abcdef12345678;
    }
}
