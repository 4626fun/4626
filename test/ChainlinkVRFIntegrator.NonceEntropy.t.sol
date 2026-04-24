// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/utilities/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol";

/// @title ChainlinkVRFIntegratorV2_5 nonce-entropy tests (VRF-04 / 4626-441)
/// @notice Pins the two new entropy sources added on top of the L-06 fix:
///         `block.prevrandao` and `msg.sender`. These strengthen the
///         derivation against deterministic-deploy adversaries (e.g. an
///         attacker that can predict future `block.number` / chain id / this
///         address via CREATE2 salt manipulation).
///
/// Existing `ChainlinkVRFIntegratorV2_5.DeploymentNonce.t.sol` already covers
/// the L-06 core property (high-48-bit band uniqueness across distinct block
/// numbers and same-block different-address deploys). This file adds:
///
///   1. Same block + same `msg.sender` + different `prevrandao` → different nonce.
///   2. Same block + same `prevrandao` + different `msg.sender` → different nonce.
///   3. Combined: two "almost-identical" deploys differ on either axis.
///
/// Sanity assertion `keccak(...)` is non-zero is outside scope; we rely on
/// keccak collision-resistance and assert *distinctness* between
/// differently-seeded deploys.
contract ChainlinkVRFIntegratorNonceEntropyTest is Test {
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    address internal constant OWNER = address(0xA11CE);
    uint32 internal constant HUB_EID = 30184;

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(OWNER));
    }

    function _deployWith(uint256 blockNumber, bytes32 prevrandao, address deployer)
        internal
        returns (ChainlinkVRFIntegratorV2_5)
    {
        vm.roll(blockNumber);
        vm.prevrandao(prevrandao);
        vm.prank(deployer);
        return new ChainlinkVRFIntegratorV2_5(LZ_ENDPOINT, OWNER, HUB_EID);
    }

    // -------------------------------------------------------------------------
    // prevrandao mixing
    // -------------------------------------------------------------------------

    /// Same block number, same deployer, DIFFERENT `block.prevrandao` values →
    /// the derived `deploymentNonce` must differ. This is the property that
    /// makes a same-block adversary (who controls the deploy tx ordering via
    /// an MEV bundle but cannot influence RANDAO) unable to force a known
    /// nonce.
    function testFuzz_PrevrandaoChanges_ChangeNonce(
        uint256 blockNumber,
        bytes32 randaoA,
        bytes32 randaoB
    ) public {
        blockNumber = bound(blockNumber, 1, type(uint128).max);
        vm.assume(randaoA != randaoB);

        ChainlinkVRFIntegratorV2_5 a = _deployWith(blockNumber, randaoA, OWNER);
        ChainlinkVRFIntegratorV2_5 b = _deployWith(blockNumber, randaoB, OWNER);

        // Two CREATEs from the same EOA produce different addresses, which also
        // feeds into the keccak input. To isolate the `prevrandao` effect we
        // would need to etch, but keccak inputs are XOR-independent in practice
        // (collision-resistant under SHA3) — so the weaker claim "at least one
        // of the inputs differing yields a different nonce" is enough for the
        // property we care about. The test below isolates prevrandao more
        // strictly by comparing direct keccak outputs.
        assertTrue(a.deploymentNonce() != b.deploymentNonce(), "prevrandao (+address) must perturb nonce");
    }

    /// Isolated: fix every other keccak input and vary ONLY `prevrandao`.
    /// This is done via direct keccak computation because the constructor
    /// inputs are not controllable from Solidity in isolation (address and
    /// sender are set by the VM). The assertion is a lower-bound guarantee on
    /// the algorithm: if prevrandao is mixed in, changing it changes the
    /// output.
    function testFuzz_Keccak_PrevrandaoIsolated(
        uint256 blockNumber,
        uint256 chainId,
        address self,
        address sender,
        bytes32 randaoA,
        bytes32 randaoB
    ) public pure {
        vm.assume(randaoA != randaoB);
        bytes32 hashA = keccak256(abi.encode(blockNumber, uint256(randaoA), chainId, self, sender));
        bytes32 hashB = keccak256(abi.encode(blockNumber, uint256(randaoB), chainId, self, sender));
        require(hashA != hashB, "prevrandao-only delta must change keccak");
    }

    // -------------------------------------------------------------------------
    // msg.sender mixing
    // -------------------------------------------------------------------------

    /// Same block, same prevrandao, DIFFERENT deployer EOA → different nonce.
    /// Covers: two factories deploying in the same block / same epoch randao,
    /// which the original L-06 scope did not close (address-of-this differed
    /// but a naive attacker might deploy via a deterministic factory).
    function testFuzz_DeployerChanges_ChangeNonce(
        uint256 blockNumber,
        bytes32 randao,
        address deployerA,
        address deployerB
    ) public {
        blockNumber = bound(blockNumber, 1, type(uint128).max);
        vm.assume(deployerA != deployerB);
        vm.assume(deployerA != address(0) && deployerB != address(0));

        ChainlinkVRFIntegratorV2_5 a = _deployWith(blockNumber, randao, deployerA);
        ChainlinkVRFIntegratorV2_5 b = _deployWith(blockNumber, randao, deployerB);

        assertTrue(a.deploymentNonce() != b.deploymentNonce(), "deployer change must perturb nonce");
    }

    /// Isolated: fix every other keccak input and vary ONLY `msg.sender`.
    function testFuzz_Keccak_SenderIsolated(
        uint256 blockNumber,
        bytes32 randao,
        uint256 chainId,
        address self,
        address senderA,
        address senderB
    ) public pure {
        vm.assume(senderA != senderB);
        bytes32 hashA = keccak256(abi.encode(blockNumber, uint256(randao), chainId, self, senderA));
        bytes32 hashB = keccak256(abi.encode(blockNumber, uint256(randao), chainId, self, senderB));
        require(hashA != hashB, "sender-only delta must change keccak");
    }

    // -------------------------------------------------------------------------
    // Combined regression: nonce depends on each added input.
    // -------------------------------------------------------------------------

    /// Sanity: the nonce derived on-chain matches what we compute from the
    /// constructor inputs. This pins the exact derivation so an accidental
    /// input reordering or omission is caught immediately.
    function test_Derivation_MatchesOnchain() public {
        uint256 blockNumber = 1_234_567;
        bytes32 randao = bytes32(uint256(0xCAFEBABE));
        address deployer = address(0xBEEF);

        ChainlinkVRFIntegratorV2_5 integrator = _deployWith(blockNumber, randao, deployer);

        bytes32 expected = keccak256(
            abi.encode(
                blockNumber,
                uint256(randao),
                block.chainid,
                address(integrator),
                deployer
            )
        );
        uint64 expectedNonce = uint64(uint256(expected));

        assertEq(integrator.deploymentNonce(), expectedNonce, "on-chain nonce must equal derived nonce");
    }
}
