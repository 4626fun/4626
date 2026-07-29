// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {SimpleSellTaxHook} from "@4626/shared/shareoft-mesh/univ4/SimpleSellTaxHook.sol";

/**
 * @dev Offline salt mine for Arachnid CREATE2 deployer (no live code.length gate).
 *      Run: forge test --match-contract MineSpokeSellTaxHookSalts -vv
 */
contract MineSpokeSellTaxHookSalts is Test {
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    uint160 internal constant FLAGS =
        uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);

    function test_mineSpokeSalts() public view {
        _mine("ethereum", 0x000000000004444c5dc75cB358380D2e3dE08A90, 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
        _mine("arbitrum", 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32, 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1);
        _mine("unichain", 0x1F98400000000000000000000000000000000004, 0x4200000000000000000000000000000000000006);
        _mine("robinhood", 0x8366a39CC670B4001A1121B8F6A443A643e40951, 0x4200000000000000000000000000000000000006);
    }

    function _mine(string memory label, address poolManager, address weth) internal view {
        bytes memory ctorArgs = abi.encode(IPoolManager(poolManager), weth);
        bytes memory creationCodeWithArgs =
            abi.encodePacked(type(SimpleSellTaxHook).creationCode, ctorArgs);

        address hookAddress;
        uint256 salt;
        bool found;
        for (salt = 0; salt < HookMiner.MAX_LOOP; salt++) {
            hookAddress = HookMiner.computeAddress(CREATE2_DEPLOYER, salt, creationCodeWithArgs);
            if (uint160(hookAddress) & Hooks.ALL_HOOK_MASK == FLAGS) {
                found = true;
                break;
            }
        }
        require(found, "no salt");
        console.log("---");
        console.log(label);
        console.log("poolManager", poolManager);
        console.log("weth", weth);
        console.log("salt", salt);
        console.log("hook", hookAddress);
    }
}
