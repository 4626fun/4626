// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {
    LotteryManager4626,
    LotteryManager4626AdminModule
} from "@4626/shared/lottery/manager/LotteryManager4626.sol";

/// @notice ODA-426-F3 — owner trust-root timelock cluster.
/// Covers VRF integrator, post-bootstrap swap authorization, and rewardPercentage.

contract MockOracleF3 {
    function getCreatorPrice(address) external view returns (uint256, uint256, bool) {
        return (1e18, block.timestamp, true);
    }
}

contract MockShareF3 {
    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }

    function eligibleLotteryCoverageOf(address) external pure returns (uint256) {
        return 0;
    }
}

contract MockRegistryF3 {
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

contract LotteryManager4626TrustRootTimelockTest is Test {
    LotteryManager4626 internal manager;
    address internal owner = address(this);
    address internal constant LZ = address(0xDEAD);

    address internal integratorA = address(0xA11CE);
    address internal integratorB = address(0xB0B);
    address internal swapA = address(0x511A);
    address internal swapB = address(0x511B);

    function setUp() public {
        vm.mockCall(LZ, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        MockShareF3 share = new MockShareF3();
        MockOracleF3 oracle = new MockOracleF3();
        MockRegistryF3 registry = new MockRegistryF3(LZ, address(0xC01), address(share), address(oracle));
        registry.setVault(address(0xA11));

        manager = new LotteryManager4626(address(registry), owner);
    }

    function _adminCall(bytes memory data) internal {
        manager.adminModuleCall(data);
    }

    function test_setVRFIntegrator_bootstrap_then_requiresTimelock() public {
        manager.setVRFIntegrator(integratorA);
        assertEq(address(manager.vrfIntegrator()), integratorA);
        assertTrue(manager.trustedVrfIntegrators(integratorA));

        vm.expectRevert(LotteryManager4626AdminModule.VRFIntegratorAlreadySet.selector);
        manager.setVRFIntegrator(integratorB);

        _adminCall(abi.encodeWithSelector(
            LotteryManager4626AdminModule.queueVRFIntegratorChange.selector, integratorB
        ));

        vm.expectRevert(LotteryManager4626AdminModule.TimelockNotExpired.selector);
        _adminCall(abi.encodeWithSelector(LotteryManager4626AdminModule.executeVRFIntegratorChange.selector));

        vm.warp(block.timestamp + manager.LOCAL_VRF_CONSUMER_TIMELOCK());
        _adminCall(abi.encodeWithSelector(LotteryManager4626AdminModule.executeVRFIntegratorChange.selector));
        assertEq(address(manager.vrfIntegrator()), integratorB);
        assertTrue(manager.trustedVrfIntegrators(integratorB));
        assertFalse(manager.trustedVrfIntegrators(integratorA));
    }

    function test_cancelVRFIntegratorChange() public {
        manager.setVRFIntegrator(integratorA);
        _adminCall(abi.encodeWithSelector(
            LotteryManager4626AdminModule.queueVRFIntegratorChange.selector, integratorB
        ));
        _adminCall(abi.encodeWithSelector(LotteryManager4626AdminModule.cancelVRFIntegratorChange.selector));
        assertEq(address(manager.vrfIntegrator()), integratorA);

        vm.expectRevert(LotteryManager4626AdminModule.NoPendingVRFIntegrator.selector);
        _adminCall(abi.encodeWithSelector(LotteryManager4626AdminModule.cancelVRFIntegratorChange.selector));
    }

    function test_setAuthorizedSwapContract_bootstrap_then_requiresTimelock() public {
        manager.setAuthorizedSwapContract(swapA, true);
        assertTrue(manager.authorizedSwapContracts(swapA));

        vm.expectRevert(LotteryManager4626AdminModule.SwapAuthMustBeQueued.selector);
        manager.setAuthorizedSwapContract(swapB, true);

        // Emergency deauth stays instant.
        manager.setAuthorizedSwapContract(swapA, false);
        assertFalse(manager.authorizedSwapContracts(swapA));

        _adminCall(abi.encodeWithSelector(
            LotteryManager4626AdminModule.queueSwapContractAuth.selector, swapB, true
        ));

        vm.expectRevert(LotteryManager4626AdminModule.TimelockNotExpired.selector);
        _adminCall(abi.encodeWithSelector(LotteryManager4626AdminModule.executeSwapContractAuth.selector));

        vm.warp(block.timestamp + manager.LOCAL_VRF_CONSUMER_TIMELOCK());
        _adminCall(abi.encodeWithSelector(LotteryManager4626AdminModule.executeSwapContractAuth.selector));
        assertTrue(manager.authorizedSwapContracts(swapB));
    }

    function test_cancelSwapContractAuth() public {
        manager.setAuthorizedSwapContract(swapA, true);
        _adminCall(abi.encodeWithSelector(
            LotteryManager4626AdminModule.queueSwapContractAuth.selector, swapB, true
        ));
        _adminCall(abi.encodeWithSelector(LotteryManager4626AdminModule.cancelSwapContractAuth.selector));
        assertFalse(manager.authorizedSwapContracts(swapB));

        vm.expectRevert(LotteryManager4626AdminModule.NoPendingSwapAuth.selector);
        _adminCall(abi.encodeWithSelector(LotteryManager4626AdminModule.cancelSwapContractAuth.selector));
    }

    function test_setLotteryConfig_queuesRewardPercentageChange() public {
        (uint256 minSwap, uint256 rewardPct, bool active,,,) = manager.lotteryConfig();
        assertEq(rewardPct, 6900);

        // Same reward% — applies other fields, no queue.
        manager.setLotteryConfig(2_000_000, 6900, true, 40, 150_000, 10_000);
        (minSwap, rewardPct, active,,,) = manager.lotteryConfig();
        assertEq(minSwap, 2_000_000);
        assertEq(rewardPct, 6900);

        // Different reward% — queues; live value unchanged until execute.
        manager.setLotteryConfig(2_000_000, 9000, true, 40, 150_000, 10_000);
        (, rewardPct,,,,) = manager.lotteryConfig();
        assertEq(rewardPct, 6900);

        vm.expectRevert(LotteryManager4626AdminModule.TimelockNotExpired.selector);
        _adminCall(abi.encodeWithSelector(LotteryManager4626AdminModule.executeRewardPercentageChange.selector));

        vm.warp(block.timestamp + manager.LOCAL_VRF_CONSUMER_TIMELOCK());
        _adminCall(abi.encodeWithSelector(LotteryManager4626AdminModule.executeRewardPercentageChange.selector));
        (, rewardPct,,,,) = manager.lotteryConfig();
        assertEq(rewardPct, 9000);
    }

    function test_cancelRewardPercentageChange() public {
        manager.setLotteryConfig(1_000_000, 8000, true, 40, 150_000, 10_000);
        (, uint256 rewardPct,,,,) = manager.lotteryConfig();
        assertEq(rewardPct, 6900);

        _adminCall(abi.encodeWithSelector(LotteryManager4626AdminModule.cancelRewardPercentageChange.selector));
        (, rewardPct,,,,) = manager.lotteryConfig();
        assertEq(rewardPct, 6900);

        vm.expectRevert(LotteryManager4626AdminModule.NoPendingRewardPercentage.selector);
        _adminCall(abi.encodeWithSelector(LotteryManager4626AdminModule.cancelRewardPercentageChange.selector));
    }
}
