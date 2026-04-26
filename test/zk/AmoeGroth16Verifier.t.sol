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
            uint256(0x2c81ce38c10d09035f2210e1dfd77a7ead0b768e3c7be86ab2112485f59602c5),
            uint256(0x2226118f805e934f09fae967eeaaaa89de46f04421f7df3b6b3f0782a5d6f31d)
        ];
        uint256[2][2] memory b = [
            [
                uint256(0x2e38f9be05d42254420026cc20cbaf77c8826cbfd2681c68b602ed16bb6a0ff2),
                uint256(0x1aa36063e34e5efe48cbd94532bf21344b38404986f44ec84b7af8ab441d4c2d)
            ],
            [
                uint256(0x01f0b99ec3da76d6dd39a880ed922b70ec2885fdcaa71e619e96f213c8c95657),
                uint256(0x2692fb61d1aff4e13553f1578b40113dbabd1c83d6e04e9f335432866b7bf138)
            ]
        ];
        uint256[2] memory c = [
            uint256(0x146e01552ea7e630e32e5f6a76d4ccf5475c6433dea2800446628629d9887f3e),
            uint256(0x13692999ac2d546a750836353d3fbdf1a98c8a16f0afb6c3c83f66ca7648cc04)
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
            uint256(0x2c81ce38c10d09035f2210e1dfd77a7ead0b768e3c7be86ab2112485f59602c5),
            uint256(0x2226118f805e934f09fae967eeaaaa89de46f04421f7df3b6b3f0782a5d6f31d)
        ];
        uint256[2][2] memory b = [
            [
                uint256(0x2e38f9be05d42254420026cc20cbaf77c8826cbfd2681c68b602ed16bb6a0ff2),
                uint256(0x1aa36063e34e5efe48cbd94532bf21344b38404986f44ec84b7af8ab441d4c2d)
            ],
            [
                uint256(0x01f0b99ec3da76d6dd39a880ed922b70ec2885fdcaa71e619e96f213c8c95657),
                uint256(0x2692fb61d1aff4e13553f1578b40113dbabd1c83d6e04e9f335432866b7bf138)
            ]
        ];
        uint256[2] memory c = [
            uint256(0x146e01552ea7e630e32e5f6a76d4ccf5475c6433dea2800446628629d9887f3e),
            uint256(0x13692999ac2d546a750836353d3fbdf1a98c8a16f0afb6c3c83f66ca7648cc04)
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
