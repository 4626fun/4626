// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {LotteryManager4626} from "@4626/shared/lottery/manager/LotteryManager4626.sol";
import {VRFConsumer4626} from "@4626/shared/lottery/manager/VRFConsumer4626.sol";
import {ChainlinkVRFIntegratorV2_5} from "@4626/shared/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol";
import {
    LotteryAmoeRouter,
    ILotteryAmoeConsumer,
    IAmoeManager
} from "@4626/shared/lottery/zk/LotteryAmoeRouter.sol";
import {IAmoePlonkVerifier} from "@4626/shared/lottery/zk/IAmoePlonkVerifier.sol";

contract Oda461MockOracle {
    int256 internal immutable price;

    constructor(int256 price_) {
        price = price_;
    }

    function getAssetPrice() external view returns (int256, uint256) {
        return (price, block.timestamp);
    }
}

contract Oda461MockRegistry {
    address public immutable endpoint;
    uint32 public eid = 30184;

    constructor(address endpoint_) {
        endpoint = endpoint_;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function getEidForChainId(uint256) external view returns (uint32) {
        return eid;
    }

    function getVaultForToken(address) external pure returns (address) {
        return address(0);
    }

    function getShareOFTForToken(address) external pure returns (address) {
        return address(0);
    }

    function getTokenForShareOFT(address) external pure returns (address) {
        return address(0);
    }

    function getOracleForToken(address) external pure returns (address) {
        return address(0);
    }

    function getGaugeControllerForToken(address) external pure returns (address) {
        return address(0);
    }

    function isTokenActive(address) external pure returns (bool) {
        return false;
    }

    function getAllTokens() external pure returns (address[] memory tokens) {
        tokens = new address[](0);
    }
}

contract Oda461MockVerifier is IAmoePlonkVerifier {
    bool public ok = true;

    function setOk(bool v) external {
        ok = v;
    }

    function verifyProof(uint256[24] calldata, uint256[9] calldata) external view returns (bool) {
        return ok;
    }
}

contract Oda461MockManager is IAmoeManager {
    function processAmoeEntry(address, address, uint256) external pure returns (uint256) {
        return 1;
    }
}

contract Oda461MockConsumer is ILotteryAmoeConsumer {
    function recordAmoeEntry(address, address, uint64, uint256) external {}
}

contract Oda461RevertingConsumer is ILotteryAmoeConsumer {
    function recordAmoeEntry(address, address, uint64, uint256) external pure {
        revert("legacy consumer unavailable");
    }
}

contract ODA461LowInfoRemediationsTest is Test {
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    address internal owner = address(0xA11CE);
    address internal nextOwner = address(0xB0B);
    address internal buyer = address(0x1234567890AbcdEF1234567890aBcdef12345678);
    address internal coin = address(0xC0FFEE);

    LotteryManager4626 internal manager;
    VRFConsumer4626 internal vrfConsumer;
    ChainlinkVRFIntegratorV2_5 internal integrator;
    LotteryAmoeRouter internal router;

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        Oda461MockRegistry registry = new Oda461MockRegistry(LZ_ENDPOINT);

        vm.prank(owner);
        manager = new LotteryManager4626(address(registry), owner);

        vm.prank(owner);
        vrfConsumer = new VRFConsumer4626(address(registry), owner);

        vm.prank(owner);
        integrator = new ChainlinkVRFIntegratorV2_5(LZ_ENDPOINT, owner, 30184);

        Oda461MockVerifier verifier = new Oda461MockVerifier();
        Oda461MockManager mgr = new Oda461MockManager();
        router = new LotteryAmoeRouter(owner, address(0xBB), address(verifier));
        vm.prank(owner);
        router.setManager(address(mgr));
    }

    /// @notice ODA-461-6: setOracleMaxStaleness(0) must revert.
    function test_L6_setOracleMaxStaleness_rejectsZero() public {
        vm.prank(owner);
        vm.expectRevert(LotteryManager4626.InvalidAmount.selector);
        manager.setOracleMaxStaleness(0);
    }

    /// @notice ODA-461-6: positive staleness still configures.
    function test_L6_setOracleMaxStaleness_acceptsPositive() public {
        vm.prank(owner);
        manager.setOracleMaxStaleness(90);
        assertEq(manager.oracleMaxStaleness(), 90);
    }

    /// @notice ODA-461-8: twapPeriod default/minimum is 1800s.
    function test_L8_twapPeriod_minEnforced() public {
        assertEq(vrfConsumer.twapPeriod(), 1800);
        vm.prank(owner);
        vm.expectRevert(bytes("TWAP period too short"));
        vrfConsumer.setTwapPeriod(1799);

        vm.prank(owner);
        vrfConsumer.setTwapPeriod(1800);
        assertEq(vrfConsumer.twapPeriod(), 1800);
    }

    /// @notice ODA-461-7: a pathological local reading must be capped without overflowing.
    function test_L7_extremeLocalPrice_isCappedBeforeRelativeBound() public {
        Oda461MockOracle oracle = new Oda461MockOracle(type(int256).max);
        vm.prank(owner);
        vrfConsumer.setPriceOracle(address(oracle));

        vrfConsumer.updateLocalPrice();
        (int256 aggregatedPrice, uint256 numChains) = vrfConsumer.getAggregatedAssetPrice();

        assertEq(aggregatedPrice, vrfConsumer.maxAcceptablePrice());
        assertEq(numChains, 1);
    }

    /// @notice ODA-461-12: ownership is two-step.
    function test_L12_amoeOwner_twoStep() public {
        vm.prank(owner);
        router.setOwner(nextOwner);
        assertEq(router.owner(), owner);
        assertEq(router.pendingOwner(), nextOwner);

        vm.prank(owner);
        vm.expectRevert(LotteryAmoeRouter.NotPendingOwner.selector);
        router.acceptOwnership();

        vm.prank(nextOwner);
        router.acceptOwnership();
        assertEq(router.owner(), nextOwner);
        assertEq(router.pendingOwner(), address(0));
    }

    /// @notice ODA-461-13: consumer rewire is timelocked after bootstrap.
    function test_L13_setConsumer_timelocked() public {
        Oda461MockConsumer first = new Oda461MockConsumer();
        Oda461MockConsumer second = new Oda461MockConsumer();

        vm.prank(owner);
        router.setConsumer(address(first));
        assertEq(address(router.consumer()), address(first));

        vm.prank(owner);
        router.setConsumer(address(second));
        assertEq(address(router.consumer()), address(first));
        assertEq(router.pendingConsumer(), address(second));

        uint256 executeAfter = router.pendingConsumerAt();
        vm.expectRevert(abi.encodeWithSelector(LotteryAmoeRouter.UpdateTimelockActive.selector, executeAfter));
        vm.prank(owner);
        router.executeConsumerUpdate();

        vm.warp(block.timestamp + router.CONFIG_UPDATE_TIMELOCK());
        vm.prank(owner);
        router.executeConsumerUpdate();
        assertEq(address(router.consumer()), address(second));
    }

    /// @notice The optional legacy consumer must not roll back required manager settlement.
    function test_Amoe_revertingOptionalConsumer_doesNotBlockSettlement() public {
        bytes32 allowRoot = bytes32(uint256(0x1111));
        bytes32 ledgerRoot = bytes32(uint256(0x2222));
        bytes32 nullifier = keccak256("consumer-failure-nullifier");
        uint64 epoch = 8;

        vm.startPrank(owner);
        router.setPointsLedgerPublisher(address(0xCC));
        router.setConsumer(address(new Oda461RevertingConsumer()));
        vm.stopPrank();

        vm.prank(address(0xBB));
        router.setAllowlistRoot(epoch, allowRoot);
        vm.prank(address(0xCC));
        router.setPointsLedgerRoot(epoch, ledgerRoot);
        vm.warp(block.timestamp + router.ROOT_PUBLICATION_TIMELOCK());

        uint256[24] memory proof;
        uint256[9] memory inp;
        inp[0] = uint256(keccak256("wallet"));
        inp[1] = uint256(uint160(coin));
        inp[2] = uint256(keccak256("nonce"));
        inp[3] = uint256(epoch);
        inp[4] = uint256(allowRoot);
        inp[5] = 1_000_000;
        inp[6] = uint256(ledgerRoot);
        inp[7] = uint256(nullifier);
        inp[8] = uint256(uint160(buyer));

        uint256 entryId = router.submitAmoeEntryZK(buyer, coin, epoch, proof, inp);

        assertEq(entryId, 1);
        assertTrue(router.usedPointsBurnNullifier(nullifier));
    }

    /// @notice ODA-461-14: renounceOwnership is disabled on hub + spoke VRF OApps.
    function test_L14_renounceOwnership_disabled() public {
        vm.expectRevert(VRFConsumer4626.Unauthorized.selector);
        vrfConsumer.renounceOwnership();

        vm.expectRevert(ChainlinkVRFIntegratorV2_5.RenounceDisabled.selector);
        integrator.renounceOwnership();
    }

    /// @notice ODA-461-23: buyer public input compared at full width.
    function test_I23_buyerBinding_rejectsHighBits() public {
        vm.prank(owner);
        router.setPointsLedgerPublisher(address(0xCC));

        uint64 epoch = 7;
        bytes32 allowRoot = bytes32(uint256(0x1111));
        bytes32 ledgerRoot = bytes32(uint256(0x2222));

        vm.prank(address(0xBB));
        router.setAllowlistRoot(epoch, allowRoot);
        vm.prank(address(0xCC));
        router.setPointsLedgerRoot(epoch, ledgerRoot);
        vm.warp(block.timestamp + router.ROOT_PUBLICATION_TIMELOCK());

        uint256[24] memory proof;
        uint256[9] memory inp;
        inp[0] = uint256(keccak256("wallet"));
        inp[1] = uint256(uint160(coin));
        inp[2] = uint256(keccak256("nonce"));
        inp[3] = uint256(epoch);
        inp[4] = uint256(allowRoot);
        inp[5] = 1_000_000;
        inp[6] = uint256(ledgerRoot);
        inp[7] = uint256(keccak256("nullifier"));
        // Low 160 bits match buyer, but high bits are set → must reject.
        inp[8] = uint256(uint160(buyer)) | (uint256(1) << 160);

        vm.expectRevert(LotteryAmoeRouter.InvalidProof.selector);
        router.submitAmoeEntryZK(buyer, coin, epoch, proof, inp);
    }
}
