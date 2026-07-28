// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {LotteryManager4626, LotteryManager4626AdminModule} from "@4626/shared/lottery/manager/LotteryManager4626.sol";

// =====================================================================
// Audit 2026-07-08 P2 — R-H04 local VRF consumer timelock
// =====================================================================

contract MockOracleP2 {
    function getCreatorPrice(address) external view returns (uint256, uint256, bool) {
        return (1e18, block.timestamp, true);
    }
}

contract MockShareP2 {
    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }

    function eligibleLotteryCoverageOf(address) external pure returns (uint256) {
        return 0;
    }
}

contract MockRegistryP2 {
    address public immutable lz;
    address public immutable coin;
    address public immutable share;
    address public immutable oracle;
    address public vaultAddr;

    constructor(address lz_, address coin_, address share_, address oracle_) {
        lz = lz_;
        coin = coin_;
        share = share_;
        oracle = oracle_;
    }

    function setVault(address v) external {
        vaultAddr = v;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return lz;
    }

    function getCreatorCoin(address) external view returns (address) {
        return coin;
    }

    function getShareOFT(address) external view returns (address) {
        return share;
    }

    function getOracle(address) external view returns (address) {
        return oracle;
    }

    function getVault(address) external view returns (address) {
        return vaultAddr;
    }

    function getGaugeController(address) external pure returns (address) {
        return address(0);
    }

    function isRegistered(address) external pure returns (bool) {
        return true;
    }

    function getAllCreatorCoins() external view returns (address[] memory out) {
        out = new address[](1);
        out[0] = coin;
    }
}

contract MockVrfP2 {
    function requestRandomWords() external pure returns (uint256) {
        return 1;
    }
}

contract MockBoostP2 {
    function getBoostBps(address, address) external pure returns (uint256) {
        return 10_000;
    }
}

contract Audit20260708_RH04_LocalVrfTimelock is Test {
    LotteryManager4626 internal manager;
    MockVrfP2 internal vrfA;
    MockVrfP2 internal vrfB;
    address internal owner = address(this);
    address internal constant LZ = address(0xDEAD);

    function setUp() public {
        vm.mockCall(LZ, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        MockShareP2 share = new MockShareP2();
        MockOracleP2 oracle = new MockOracleP2();
        MockRegistryP2 registry = new MockRegistryP2(LZ, address(0xC01), address(share), address(oracle));
        registry.setVault(address(0xA11));
        vrfA = new MockVrfP2();
        vrfB = new MockVrfP2();

        manager = new LotteryManager4626(address(registry), owner);
        manager.setBoostManager(address(new MockBoostP2()));
    }

    function test_setLocalVRFConsumer_bootstrap_then_requiresTimelock() public {
        // Bootstrap while unset.
        manager.setLocalVRFConsumer(address(vrfA));
        assertEq(address(manager.localVRFConsumer()), address(vrfA));

        // Instant rewire blocked.
        vm.expectRevert(LotteryManager4626.LocalVRFConsumerAlreadySet.selector);
        manager.setLocalVRFConsumer(address(vrfB));

        // Queue + early execute reverts.
        manager.queueLocalVRFConsumerChange(address(vrfB));
        assertEq(manager.pendingLocalVRFConsumer(), address(vrfB));
        assertGt(manager.pendingLocalVRFConsumerEffectiveAt(), block.timestamp);

        vm.expectRevert(LotteryManager4626.TimelockNotExpired.selector);
        manager.executeLocalVRFConsumerChange();

        // After delay, execute applies.
        vm.warp(block.timestamp + manager.LOCAL_VRF_CONSUMER_TIMELOCK());
        manager.executeLocalVRFConsumerChange();
        assertEq(address(manager.localVRFConsumer()), address(vrfB));
        assertEq(manager.pendingLocalVRFConsumer(), address(0));
        assertEq(manager.pendingLocalVRFConsumerEffectiveAt(), 0);
    }

    function test_cancelLocalVRFConsumerChange() public {
        manager.setLocalVRFConsumer(address(vrfA));
        manager.queueLocalVRFConsumerChange(address(vrfB));
        manager.cancelLocalVRFConsumerChange();
        assertEq(manager.pendingLocalVRFConsumer(), address(0));
        assertEq(manager.pendingLocalVRFConsumerEffectiveAt(), 0);
        assertEq(address(manager.localVRFConsumer()), address(vrfA));

        vm.expectRevert(LotteryManager4626.NoPendingLocalVRFConsumer.selector);
        manager.cancelLocalVRFConsumerChange();
    }

    function test_singleVaultJackpotOnly_defaultTrue_andToggle() public {
        // R-H05 / ODA-510-4: launch default single-vault; multi-vault flip is timelocked.
        assertTrue(manager.singleVaultJackpotOnly());
        manager.setSingleVaultJackpotOnly(false);
        assertTrue(manager.singleVaultJackpotOnly(), "queued only");
        bytes memory execSel = abi.encodeWithSelector(
            LotteryManager4626AdminModule.executeSingleVaultJackpotOnlyChange.selector
        );
        vm.expectRevert(LotteryManager4626AdminModule.SingleVaultJackpotOnlyTimelockActive.selector);
        manager.adminModuleCall(execSel);
        vm.warp(block.timestamp + manager.LOCAL_VRF_CONSUMER_TIMELOCK());
        manager.adminModuleCall(execSel);
        assertFalse(manager.singleVaultJackpotOnly());
        manager.setSingleVaultJackpotOnly(true);
        vm.warp(block.timestamp + manager.LOCAL_VRF_CONSUMER_TIMELOCK());
        manager.adminModuleCall(
            abi.encodeWithSelector(LotteryManager4626AdminModule.executeSingleVaultJackpotOnlyChange.selector)
        );
        assertTrue(manager.singleVaultJackpotOnly());
    }
}
