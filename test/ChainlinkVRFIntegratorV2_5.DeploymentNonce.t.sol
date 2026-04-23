// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/utilities/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol";

/// @title ChainlinkVRFIntegratorV2_5 deployment-nonce fuzz tests
/// @notice Property tests for L-06 (Linear 4626-354) and its review follow-up.
///
/// Background
/// ----------
/// `ChainlinkVRFIntegratorV2_5` seeds `requestCounter` from a 64-bit
/// `deploymentNonce` derived from `keccak256(block.number, chainid, address(this))`.
/// The seeding must keep the high 48 bits of entropy so that two redeploys on
/// the same chain at different block numbers land in different "deploy bands",
/// preventing cross-deployment VRF sequence collisions on the hub-side
/// `sequenceToRequestId[srcEid][sequence]` map.
///
/// The initial L-06 fix shipped with `requestCounter = uint64(deploymentNonce) << 48`,
/// which silently collapsed the deploy band back to 16 bits. The review
/// follow-up replaced the shift with a mask:
///
///     requestCounter = deploymentNonce & uint64(0xFFFFFFFFFFFF0000);
///
/// These tests pin that property.
contract ChainlinkVRFIntegratorV2_5DeploymentNonceTest is Test {
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    address internal owner = address(0xA11CE);
    uint32 internal constant HUB_EID = 30184;

    /// Low-16-bit mask used by `ChainlinkVRFIntegratorV2_5` to carve out the
    /// per-deploy sequence window. High 48 bits = deploy band.
    uint64 internal constant DEPLOY_BAND_MASK = uint64(0xFFFFFFFFFFFF0000);
    uint64 internal constant SEQUENCE_WINDOW_MASK = uint64(0x000000000000FFFF);

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));
    }

    /// Deploy a fresh integrator at a specific block number. Returns the
    /// instance so tests can read `requestCounter` / `deploymentNonce`.
    function _deployAt(uint256 blockNumber) internal returns (ChainlinkVRFIntegratorV2_5) {
        vm.roll(blockNumber);
        vm.prank(owner);
        return new ChainlinkVRFIntegratorV2_5(LZ_ENDPOINT, owner, HUB_EID);
    }

    // -----------------------------------------------------------------------
    // Invariant shape
    // -----------------------------------------------------------------------

    /// The seeded `requestCounter` must have its low 16 bits zeroed so the
    /// first real request (`requestCounter + 1`) is comfortably inside the
    /// per-deploy window and does not straddle a band boundary.
    function testFuzz_RequestCounter_LowSixteenBitsAreZero(uint256 blockNumber) public {
        // Avoid block.number == 0 (vm.roll rejects it on some forge versions).
        blockNumber = bound(blockNumber, 1, type(uint128).max);
        ChainlinkVRFIntegratorV2_5 integrator = _deployAt(blockNumber);

        uint64 counter = integrator.requestCounter();
        assertEq(counter & SEQUENCE_WINDOW_MASK, 0, "low 16 bits must be zero at deploy time");
    }

    /// The seeded `requestCounter` must match the high 48 bits of the
    /// deployment nonce exactly. This is the direct property the review fix
    /// establishes: `requestCounter = deploymentNonce & 0xFFFFFFFFFFFF0000`.
    function testFuzz_RequestCounter_MatchesHighBitsOfNonce(uint256 blockNumber) public {
        blockNumber = bound(blockNumber, 1, type(uint128).max);
        ChainlinkVRFIntegratorV2_5 integrator = _deployAt(blockNumber);

        uint64 nonce = integrator.deploymentNonce();
        uint64 counter = integrator.requestCounter();
        assertEq(counter, nonce & DEPLOY_BAND_MASK, "requestCounter must equal high 48 bits of nonce");
    }

    // -----------------------------------------------------------------------
    // Uniqueness across redeploys (the core L-06 property)
    // -----------------------------------------------------------------------

    /// Two redeploys on the same chain at DIFFERENT block numbers must land
    /// in different deploy bands (high 48 bits). This is the exact property
    /// the review follow-up restored.
    ///
    /// We generate two distinct block numbers via fuzzing, deploy an
    /// integrator at each, and assert their `requestCounter` values (which
    /// are pure high-48-bit bands after the mask) differ.
    function testFuzz_HighBitsUnique_AcrossRedeploys(uint256 blockA, uint256 blockB) public {
        blockA = bound(blockA, 1, type(uint128).max);
        blockB = bound(blockB, 1, type(uint128).max);
        // Require distinct block numbers; if the fuzzer picks the same one,
        // reseed B by xor'ing the low bits so the inputs differ.
        vm.assume(blockA != blockB);

        ChainlinkVRFIntegratorV2_5 a = _deployAt(blockA);
        // `_deployAt` uses CREATE from the same EOA, so each call deploys a
        // new contract at a different address; together with the distinct
        // `block.number` this makes the 64-bit keccak inputs unique, which
        // is what the L-06 fix relies on for high-48-bit uniqueness.
        ChainlinkVRFIntegratorV2_5 b = _deployAt(blockB);

        uint64 bandA = a.requestCounter();
        uint64 bandB = b.requestCounter();

        assertTrue(bandA != bandB, "deploy bands must differ across redeploys at distinct blocks");
        // Sanity: both bands have zero low 16 bits.
        assertEq(bandA & SEQUENCE_WINDOW_MASK, 0);
        assertEq(bandB & SEQUENCE_WINDOW_MASK, 0);
    }

    /// Even when two deploys happen at the SAME block number, the contract
    /// address is mixed into the keccak input, so the deploy bands must
    /// still differ. This covers the "two deploys in the same block via
    /// different factory calls" scenario the L-06 16-bit collision risk
    /// originally flagged.
    function testFuzz_HighBitsUnique_SameBlockDifferentAddress(uint256 blockNumber) public {
        blockNumber = bound(blockNumber, 1, type(uint128).max);

        ChainlinkVRFIntegratorV2_5 a = _deployAt(blockNumber);
        ChainlinkVRFIntegratorV2_5 b = _deployAt(blockNumber);

        assertTrue(address(a) != address(b), "two CREATEs from the same EOA must yield distinct addresses");

        uint64 bandA = a.requestCounter();
        uint64 bandB = b.requestCounter();

        assertTrue(
            bandA != bandB,
            "deploy bands must differ across same-block redeploys (address is mixed into nonce)"
        );
    }

    // -----------------------------------------------------------------------
    // Regression guard — catches accidental reintroduction of the `<< 48` bug
    // -----------------------------------------------------------------------

    /// Had the original bug (`requestCounter = uint64(nonce) << 48`) shipped,
    /// the effective nonce entropy would be 16 bits and `requestCounter`'s
    /// high 32 bits would always be zero (because `uint64 << 48` keeps only
    /// the low 16 bits of the input, placed at positions 48..63 — so bits
    /// 16..47 of the result are zero on every deploy). A single deploy
    /// whose high-48-bit band contains ANY non-zero bit in positions 16..47
    /// is therefore proof the `<< 48` bug is not back.
    ///
    /// We fuzz across many block numbers and require that at least one
    /// deployment out of the batch has a non-zero middle band. With 64-bit
    /// keccak output this property holds with probability
    /// ~1 - (1/2^32)^N per run, which is effectively 1.0 for N >= 2.
    function testFuzz_RegressionGuard_BugWouldHaveKeptMiddleBitsZero(
        uint256 blockA,
        uint256 blockB
    ) public {
        blockA = bound(blockA, 1, type(uint128).max);
        blockB = bound(blockB, 1, type(uint128).max);
        vm.assume(blockA != blockB);

        ChainlinkVRFIntegratorV2_5 a = _deployAt(blockA);
        ChainlinkVRFIntegratorV2_5 b = _deployAt(blockB);

        // Bits 16..47 of requestCounter. Under the buggy `<< 48` seeding
        // these are ALWAYS zero. Under the fixed mask they are free bits
        // of the keccak output, so at least one deploy out of two will
        // exhibit a non-zero value with overwhelming probability.
        uint64 middleMaskA = (a.requestCounter() >> 16) & uint64(0x00000000FFFFFFFF);
        uint64 middleMaskB = (b.requestCounter() >> 16) & uint64(0x00000000FFFFFFFF);

        assertTrue(
            middleMaskA != 0 || middleMaskB != 0,
            "middle 32 bits zero on two deploys would indicate the << 48 bug is back"
        );
    }
}
