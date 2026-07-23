// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
    LotteryManager4626,
    LotteryManager4626AdminModule
} from "@4626/shared/lottery/manager/LotteryManager4626.sol";

contract MockOracleAdminAuth {
    function getCreatorPrice(address) external view returns (uint256, uint256, bool) {
        return (1e18, block.timestamp, true);
    }
}

contract MockShareAdminAuth {
    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }

    function eligibleLotteryCoverageOf(address) external pure returns (uint256) {
        return 0;
    }
}

contract MockRegistryAdminAuth {
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

/// @notice Codex 2026-07-22 critical: public adminModuleCall must not expose payoutLocalJackpot.
contract LotteryManager4626AdminModuleCallAuthTest is Test {
    LotteryManager4626 internal manager;
    address internal owner = address(this);
    address internal attacker = address(0xBAD);
    address internal constant LZ = address(0xDEAD);

    function setUp() public {
        vm.mockCall(LZ, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        MockShareAdminAuth share = new MockShareAdminAuth();
        MockOracleAdminAuth oracle = new MockOracleAdminAuth();
        MockRegistryAdminAuth registry = new MockRegistryAdminAuth(LZ, address(0xC01), address(share), address(oracle));
        registry.setVault(address(0xA11));

        manager = new LotteryManager4626(address(registry), owner);
    }

    function test_nonOwner_adminModuleCall_payoutLocalJackpot_reverts() public {
        bytes memory data = abi.encodeWithSelector(
            LotteryManager4626AdminModule.payoutLocalJackpot.selector,
            address(0xC01),
            attacker,
            uint16(1000)
        );

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        manager.adminModuleCall(data);
    }

    function test_owner_adminModuleCall_queueStillWorks() public {
        address integratorA = address(0xA11CE);
        address integratorB = address(0xB0B);

        manager.setVRFIntegrator(integratorA);

        manager.adminModuleCall(
            abi.encodeWithSelector(LotteryManager4626AdminModule.queueVRFIntegratorChange.selector, integratorB)
        );

        vm.expectRevert(LotteryManager4626AdminModule.TimelockNotExpired.selector);
        manager.adminModuleCall(
            abi.encodeWithSelector(LotteryManager4626AdminModule.executeVRFIntegratorChange.selector)
        );
    }
}
