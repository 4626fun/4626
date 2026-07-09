// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Registry4626} from "@4626/shared/core/Registry4626.sol";
import {LotteryManager4626} from "@4626/shared/lottery/manager/LotteryManager4626.sol";
import {OVaultLPManager} from "@4626/shared/shareoft-mesh/univ4/OVaultLPManager.sol";

// =====================================================================
// M-08 — Registry live rebind blocked by default
// =====================================================================

contract Audit20260708_M08_RegistryRebind is Test {
    Registry4626 internal registry;
    address internal owner = address(this);
    address internal factory = address(0xFAC7);
    address internal token = address(0x1001);
    address internal vaultA = address(0xA001);
    address internal vaultB = address(0xB002);

    function setUp() public {
        registry = new Registry4626(owner);
        registry.setAuthorizedFactory(factory, true);
        // factories may need codehash pin — check setAuthorizedFactory
        vm.prank(factory);
        // If factory needs owner for register, register as owner
        registry.registerToken(token, "T", "T", owner, address(0), 0);
    }

    function test_firstSetVault_ok_rebindBlocked() public {
        registry.setVault(token, vaultA);
        assertEq(registry.vaultToToken(vaultA), token);

        // Idempotent same value is ok.
        registry.setVault(token, vaultA);

        vm.expectRevert(abi.encodeWithSelector(Registry4626.BindingAlreadySet.selector, token, vaultA));
        registry.setVault(token, vaultB);

        // Factory also cannot rebind.
        vm.prank(factory);
        vm.expectRevert(abi.encodeWithSelector(Registry4626.BindingAlreadySet.selector, token, vaultA));
        registry.setVault(token, vaultB);
    }

    function test_ownerCanRebindWhenEnabled() public {
        registry.setVault(token, vaultA);
        registry.setLiveRebindEnabled(true);
        registry.setVault(token, vaultB);
        assertEq(registry.vaultToToken(vaultB), token);
        assertEq(registry.vaultToToken(vaultA), address(0));
    }

    function test_factoryCannotRebindEvenWhenEnabled() public {
        registry.setVault(token, vaultA);
        registry.setLiveRebindEnabled(true);

        vm.prank(factory);
        vm.expectRevert(Registry4626.LiveRebindOwnerOnly.selector);
        registry.setVault(token, vaultB);
    }
}

// =====================================================================
// M-12 — AMOE relayer timelock
// =====================================================================

contract MockOracleM12 {
    function getCreatorPrice(address) external view returns (uint256, uint256, bool) {
        return (1e18, block.timestamp, true);
    }
}

contract MockShareM12 {
    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }

    function eligibleLotteryCoverageOf(address) external pure returns (uint256) {
        return 0;
    }
}

contract MockRegistryM12 {
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

contract MockBoostM12 {
    function getBoostBps(address, address) external pure returns (uint256) {
        return 10_000;
    }
}

contract Audit20260708_M12_AmoeRelayerTimelock is Test {
    LotteryManager4626 internal manager;
    address internal owner = address(this);
    address internal relayerA = address(0xA0A);
    address internal relayerB = address(0xB0B);
    address constant LZ = address(0xDEAD);

    function setUp() public {
        vm.mockCall(LZ, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        MockShareM12 share = new MockShareM12();
        MockOracleM12 oracle = new MockOracleM12();
        MockRegistryM12 registry = new MockRegistryM12(LZ, address(0xC01), address(share), address(oracle));
        registry.setVault(address(0xA11));

        manager = new LotteryManager4626(address(registry), owner);
        manager.setBoostManager(address(new MockBoostM12()));
    }

    function test_amoeRelayer_bootstrap_then_timelock() public {
        manager.setAuthorizedAmoeRelayer(relayerA);
        assertEq(manager.authorizedAmoeRelayer(), relayerA);

        vm.expectRevert(LotteryManager4626.AmoeRelayerAlreadySet.selector);
        manager.setAuthorizedAmoeRelayer(relayerB);

        manager.queueAmoeRelayerChange(relayerB);
        vm.expectRevert(LotteryManager4626.TimelockNotExpired.selector);
        manager.executeAmoeRelayerChange();

        vm.warp(block.timestamp + manager.AMOE_RELAYER_TIMELOCK());
        manager.executeAmoeRelayerChange();
        assertEq(manager.authorizedAmoeRelayer(), relayerB);
    }

    function test_amoeRelayer_cancel() public {
        manager.setAuthorizedAmoeRelayer(relayerA);
        manager.queueAmoeRelayerChange(relayerB);
        manager.cancelAmoeRelayerChange();
        assertEq(manager.pendingAmoeRelayer(), address(0));
        assertEq(manager.authorizedAmoeRelayer(), relayerA);
    }
}

// =====================================================================
// M-10 — LP manager withdraw/burn slippage bps cap
// =====================================================================

contract Audit20260708_M10_LpSlippageCap is Test {
    function test_setMaxRebalanceSlippageBps_capsAndRejectsHigh() public {
        address asset = address(0xA55E7);
        address vault = address(0xBEEF17);
        address hookRegistry = address(0x4004);
        OVaultLPManager mgr = new OVaultLPManager(asset, address(0), vault, address(this), hookRegistry);
        assertEq(mgr.maxRebalanceSlippageBps(), 500);
        assertEq(mgr.MAX_WITHDRAW_SLIPPAGE_BPS(), 2_000);

        mgr.setMaxRebalanceSlippageBps(1_000);
        assertEq(mgr.maxRebalanceSlippageBps(), 1_000);

        vm.expectRevert(abi.encodeWithSelector(OVaultLPManager.SlippageBpsTooHigh.selector, 2_001));
        mgr.setMaxRebalanceSlippageBps(2_001);
    }
}
