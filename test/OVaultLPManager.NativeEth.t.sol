// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {OVaultLPManager} from "@4626/shared/shareoft-mesh/univ4/OVaultLPManager.sol";
import {ApprovedV4HooksRegistry} from "@4626/shared/shareoft-mesh/univ4/ApprovedV4HooksRegistry.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockShareOftForNativeEthTest is ERC20 {
    constructor() ERC20("Share", "SHR") {}
}

contract MockPermit2ForLpmNativeEth {
    function approve(address, address, uint160, uint48) external {}
}

contract MockPoolManagerExtsloadForLpmNativeEth {
    mapping(bytes32 => bytes32) internal slots;

    bytes32 internal constant POOLS_SLOT = bytes32(uint256(6));

    function extsload(bytes32 slot) external view returns (bytes32 value) {
        return slots[slot];
    }

    function setSlot0Tick(PoolId poolId, int24 tick) external {
        bytes32 stateSlot = keccak256(abi.encodePacked(PoolId.unwrap(poolId), POOLS_SLOT));
        uint256 sqrtPriceX96 = 1;
        uint256 tickBits = uint256(uint24(tick));
        slots[stateSlot] = bytes32(sqrtPriceX96 | (tickBits << 160));
    }
}

contract MockV4HookForLpmNativeEth {}

contract OVaultLPManagerNativeEthTest is Test {
    OVaultLPManager internal manager;
    ApprovedV4HooksRegistry internal hookRegistry;
    MockShareOftForNativeEthTest internal shareOft;
    MockV4HookForLpmNativeEth internal poolHook;

    function setUp() public {
        shareOft = new MockShareOftForNativeEthTest();
        poolHook = new MockV4HookForLpmNativeEth();
        hookRegistry = new ApprovedV4HooksRegistry(address(this));
        hookRegistry.setHookApproval(address(poolHook), true);
        manager = new OVaultLPManager(address(shareOft), address(0), makeAddr("vault"), address(this), address(hookRegistry));
    }

    function _configureNativePool() internal {
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(shareOft)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(poolHook))
        });
        MockPoolManagerExtsloadForLpmNativeEth poolManagerMock = new MockPoolManagerExtsloadForLpmNativeEth();
        manager.configurePool(
            address(poolManagerMock),
            makeAddr("positionManager"),
            address(new MockPermit2ForLpmNativeEth()),
            key
        );
        poolManagerMock.setSlot0Tick(manager.poolId(), 0);
    }

    function test_constructor_marksNativePairedSide() public view {
        assertTrue(manager.pairedIsNative());
        assertEq(manager.pairedToken(), address(0));
    }

    function test_getTwap_revertsWhenTwapOracleUnset() public {
        // Product invariant: getTwap never falls back to spot (spot-tick bypass closed).
        manager.setParameters(400000, 500, 100, 1 hours, 10, 0, 900);
        vm.expectRevert(OVaultLPManager.TwapOracleNotSet.selector);
        manager.getTwap();
    }

    function test_rebalance_revertsWhenTwapOracleUnset() public {
        _configureNativePool();
        manager.setParameters(400000, 120, 60, 1 hours, 10, 100, 900);
        vm.warp(block.timestamp + 1 hours + 1);
        vm.expectRevert(OVaultLPManager.TwapOracleNotSet.selector);
        manager.rebalance();
    }

    function test_seedRebalance_revertsForNonManager() public {
        _configureNativePool();
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(OVaultLPManager.NotManager.selector);
        manager.seedRebalance();
    }

    function test_seedRebalance_revertsWhenPoolNotConfigured() public {
        manager.setManager(address(this), true);
        vm.expectRevert(OVaultLPManager.PoolNotConfigured.selector);
        manager.seedRebalance();
    }
}
