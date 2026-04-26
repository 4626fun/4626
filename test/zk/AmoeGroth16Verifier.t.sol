// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AmoeGroth16Verifier} from "contracts/utilities/lottery/zk/AmoeGroth16Verifier.sol";

/// @notice End-to-end test: compiles the AMOE circuit (see circuits/amoe), runs
///         the trusted setup, generates a real proof off-chain, and verifies it
///         in this test against the deployed bytecode of `AmoeGroth16Verifier`.
///
///         The fixture below was produced by:
///           cd circuits/amoe && circom amoe_eligibility.circom ...
///           snarkjs groth16 setup ...
///           snarkjs groth16 prove ...
///           snarkjs zkey export soliditycalldata public.json proof.json
///
///         If you change the circuit, regenerate `amoe_final.zkey`, re-emit
///         `AmoeGroth16Verifier.sol`, then regenerate this fixture by running
///         the helper at `tools/zk/regen_amoe_fixture.sh`.
contract AmoeGroth16VerifierTest is Test {
    AmoeGroth16Verifier verifier;

    function setUp() public {
        verifier = new AmoeGroth16Verifier();
    }

    function test_realProofVerifies() public view {
        uint256[2] memory a = [
            uint256(0x08c5cfd3f1ed65cc129b0ec77ab9fea82a44e521b7810d2f8422dcfe6c282f57),
            uint256(0x0220b7391f4896c988044f68723fb7b9280e40b6c861e3a7d9dae31446ca04a7)
        ];
        uint256[2][2] memory b = [
            [
                uint256(0x22981faa7261e79f54690625223186ec092a6178fe6e52804b0f5847a8ffcbe6),
                uint256(0x0bc45d18a4e40a72acd4a4ab4e81023f44b56b4c3783145718281fa04a0067e9)
            ],
            [
                uint256(0x250dd3dd6f850d68932ff20f4868e4566f5defea469dd73802e72d7734d75b7f),
                uint256(0x0a796d5a19989a97c55b85909a10064ad421b8eebc6e70026e29a3d3a1506e33)
            ]
        ];
        uint256[2] memory c = [
            uint256(0x120ea220f90cca4050420a779a4472c6e0cae402c3c640542f2bb2768060a239),
            uint256(0x0dce8632d764a88360db9e9ebcf38b6f12a41242bff4aa4e8f60cbbc7cf38ef0)
        ];
        uint256[5] memory pub = [
            uint256(0x167cef8160ab5cf5a22c488d65deeec1ec79499ba3c2883525c2f849d989bfa1), // walletAddrCommit
            uint256(0x0000000000000000000000000000000000000000000000000000000000c0ffee), // creatorCoinAddr
            uint256(0x1a40159cc78fd32ded10591213a4cf7ea21e9e8590d0d58192c93dca28322776), // nonceCommit
            uint256(0x0000000000000000000000000000000000000000000000000000000000000001), // epoch
            uint256(0x2dc77f12f13df749b7c6254138884b06fa2ea949a89868d5ba3579e3da8ab937)  // allowlistRoot
        ];

        assertTrue(verifier.verifyProof(a, b, c, pub), "valid proof must verify");
    }

    function test_tamperedPublicInputRejected() public view {
        uint256[2] memory a = [
            uint256(0x08c5cfd3f1ed65cc129b0ec77ab9fea82a44e521b7810d2f8422dcfe6c282f57),
            uint256(0x0220b7391f4896c988044f68723fb7b9280e40b6c861e3a7d9dae31446ca04a7)
        ];
        uint256[2][2] memory b = [
            [
                uint256(0x22981faa7261e79f54690625223186ec092a6178fe6e52804b0f5847a8ffcbe6),
                uint256(0x0bc45d18a4e40a72acd4a4ab4e81023f44b56b4c3783145718281fa04a0067e9)
            ],
            [
                uint256(0x250dd3dd6f850d68932ff20f4868e4566f5defea469dd73802e72d7734d75b7f),
                uint256(0x0a796d5a19989a97c55b85909a10064ad421b8eebc6e70026e29a3d3a1506e33)
            ]
        ];
        uint256[2] memory c = [
            uint256(0x120ea220f90cca4050420a779a4472c6e0cae402c3c640542f2bb2768060a239),
            uint256(0x0dce8632d764a88360db9e9ebcf38b6f12a41242bff4aa4e8f60cbbc7cf38ef0)
        ];
        // Flip the epoch from 1 -> 2.
        uint256[5] memory pub = [
            uint256(0x167cef8160ab5cf5a22c488d65deeec1ec79499ba3c2883525c2f849d989bfa1),
            uint256(0x0000000000000000000000000000000000000000000000000000000000c0ffee),
            uint256(0x1a40159cc78fd32ded10591213a4cf7ea21e9e8590d0d58192c93dca28322776),
            uint256(0x0000000000000000000000000000000000000000000000000000000000000002),
            uint256(0x2dc77f12f13df749b7c6254138884b06fa2ea949a89868d5ba3579e3da8ab937)
        ];

        assertFalse(verifier.verifyProof(a, b, c, pub), "tampered input must reject");
    }
}
