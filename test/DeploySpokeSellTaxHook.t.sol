// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {SimpleSellTaxHook} from "@4626/shared/shareoft-mesh/univ4/SimpleSellTaxHook.sol";

contract DeploySpokeSellTaxHookTest is Test {
    uint160 internal constant FLAGS =
        uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);

    function test_mineAndDeploy_flagsMatchPermissions() public {
        address poolManager = address(0xBEEF);
        address weth = address(0xCAFE);
        vm.etch(poolManager, hex"00");

        bytes memory ctorArgs = abi.encode(IPoolManager(poolManager), weth);
        (address predicted, bytes32 salt) =
            HookMiner.find(address(this), FLAGS, type(SimpleSellTaxHook).creationCode, ctorArgs);

        SimpleSellTaxHook hook = new SimpleSellTaxHook{salt: salt}(IPoolManager(poolManager), weth);
        assertEq(address(hook), predicted);
        assertEq(uint160(address(hook)) & Hooks.ALL_HOOK_MASK, FLAGS);
        assertEq(address(hook.poolManager()), poolManager);
        assertEq(hook.wrappedNative(), weth);
    }
}
