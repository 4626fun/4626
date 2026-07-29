// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {SimpleSellTaxHook} from "@4626/shared/shareoft-mesh/univ4/SimpleSellTaxHook.sol";

/**
 * @title DeploySpokeSellTaxHook
 * @notice Mine + CREATE2-deploy SimpleSellTaxHook for a spoke PoolManager/WETH.
 *
 * @dev Source is Sourcify exact_match of Base `0xca975B9dAF772C71161f3648437c3616E5Be0088`.
 *      Same source/compiler settings; per-chain ctor args => different address (not Base copy).
 *      Flags: BEFORE_SWAP | BEFORE_SWAP_RETURNS_DELTA (address & 0x3fff == 0x88).
 *
 * Required env:
 * - EXPECTED_CHAIN_ID
 * - POOL_MANAGER
 * - WRAPPED_NATIVE (WETH)
 *
 * Optional:
 * - PRIVATE_KEY (required for --broadcast)
 * - MINE_ONLY=1 (skip deploy; print salt/address)
 *
 * Usage:
 *   EXPECTED_CHAIN_ID=42161 \
 *     POOL_MANAGER=0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32 \
 *     WRAPPED_NATIVE=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 \
 *     forge script script/DeploySpokeSellTaxHook.s.sol:DeploySpokeSellTaxHook \
 *       --rpc-url $ARBITRUM_RPC_URL -vvvv
 *
 *   # broadcast:
 *   PRIVATE_KEY=0x... forge script ... --rpc-url $ARBITRUM_RPC_URL --broadcast -vvvv
 */
contract DeploySpokeSellTaxHook is Script {
    /// @dev Deterministic CREATE2 Deployer Proxy (HookMiner forge-script convention).
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    uint160 internal constant FLAGS =
        uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);

    function run() external returns (address hookAddr, bytes32 salt) {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        address poolManager = vm.envAddress("POOL_MANAGER");
        address wrappedNative = vm.envAddress("WRAPPED_NATIVE");
        bool mineOnly = vm.envOr("MINE_ONLY", uint256(0)) != 0;

        require(block.chainid == expectedChainId, "Unexpected chain id");
        require(poolManager != address(0) && wrappedNative != address(0), "addrs");
        require(poolManager.code.length > 0, "POOL_MANAGER has no code");
        require(CREATE2_DEPLOYER.code.length > 0, "CREATE2_DEPLOYER missing on chain");

        bytes memory ctorArgs = abi.encode(IPoolManager(poolManager), wrappedNative);
        bytes memory creationCode = type(SimpleSellTaxHook).creationCode;
        (hookAddr, salt) = HookMiner.find(CREATE2_DEPLOYER, FLAGS, creationCode, ctorArgs);

        console.log("Chain ID:       ", block.chainid);
        console.log("PoolManager:    ", poolManager);
        console.log("WrappedNative:  ", wrappedNative);
        console.log("CREATE2 deployer", CREATE2_DEPLOYER);
        console.log("Flags:          ", uint256(FLAGS));
        console.log("Salt:           ", uint256(salt));
        console.log("Predicted hook: ", hookAddr);
        console.logBytes32(salt);

        if (hookAddr.code.length > 0) {
            console.log("Already deployed - skipping create");
            return (hookAddr, salt);
        }
        if (mineOnly) {
            console.log("MINE_ONLY=1 - not deploying");
            return (hookAddr, salt);
        }

        uint256 pk = vm.envUint("PRIVATE_KEY");
        bytes memory initCode = abi.encodePacked(creationCode, ctorArgs);

        vm.startBroadcast(pk);
        (bool ok,) = CREATE2_DEPLOYER.call(abi.encodePacked(salt, initCode));
        require(ok, "CREATE2 deploy failed");
        vm.stopBroadcast();

        require(hookAddr.code.length > 0, "hook missing after deploy");
        require(SimpleSellTaxHook(hookAddr).poolManager() == IPoolManager(poolManager), "pm mismatch");
        require(SimpleSellTaxHook(hookAddr).wrappedNative() == wrappedNative, "weth mismatch");
        console.log("Deployed SimpleSellTaxHook:", hookAddr);
        console.log("Next: set TAX_HOOK=<hook> on DeploySpokeCcaLaunchArm / ConfigureSpokeCcaOracle");
    }
}
