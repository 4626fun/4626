// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

interface ICCALaunchArmOracleConfig {
    function setOracleConfig(address _oracle, address _poolManager, address _taxHook, address _feeRecipient) external;
    function oracle() external view returns (address);
    function poolManager() external view returns (address);
    function taxHook() external view returns (address);
    function feeRecipient() external view returns (address);
    function owner() external view returns (address);
}

/**
 * @title ConfigureSpokeCcaOracle
 * @notice Wire spoke CCALaunchArm → local CreatorOracle + PoolManager (+ taxHook when ready).
 *
 * @dev Spoke-minimal: vault/wrapper stay on Base. Tax hooks are still per-chain TBD —
 *      pass TAX_HOOK=address(0) only for a pre-launch oracle pin; migrate/graduation
 *      requires a real local taxHook.
 *
 * Required env:
 * - PRIVATE_KEY (arm owner / delegate)
 * - CCA_ARM
 * - ORACLE
 * - POOL_MANAGER
 *
 * Optional env:
 * - TAX_HOOK (default 0)
 * - FEE_RECIPIENT (default CCA_ARM)
 * - EXPECTED_CHAIN_ID (when set, must match block.chainid)
 *
 * Usage:
 *   forge script script/ConfigureSpokeCcaOracle.s.sol:ConfigureSpokeCcaOracle \
 *     --rpc-url $ARBITRUM_RPC_URL --broadcast -vvvv
 */
contract ConfigureSpokeCcaOracle is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address arm = vm.envAddress("CCA_ARM");
        address oracle = vm.envAddress("ORACLE");
        address poolManager = vm.envAddress("POOL_MANAGER");
        address taxHook = vm.envOr("TAX_HOOK", address(0));
        address feeRecipient = vm.envOr("FEE_RECIPIENT", arm);
        uint256 expectedChainId = vm.envOr("EXPECTED_CHAIN_ID", uint256(0));

        if (expectedChainId != 0) {
            require(block.chainid == expectedChainId, "Unexpected chain id");
        }
        require(arm != address(0) && oracle != address(0) && poolManager != address(0), "arm/oracle/poolManager required");

        console.log("Chain ID:      ", block.chainid);
        console.log("CCA arm:       ", arm);
        console.log("Oracle:        ", oracle);
        console.log("PoolManager:   ", poolManager);
        console.log("TaxHook:       ", taxHook);
        console.log("FeeRecipient:  ", feeRecipient);
        console.log("Arm owner:     ", ICCALaunchArmOracleConfig(arm).owner());

        vm.startBroadcast(privateKey);
        ICCALaunchArmOracleConfig(arm).setOracleConfig(oracle, poolManager, taxHook, feeRecipient);
        vm.stopBroadcast();

        require(ICCALaunchArmOracleConfig(arm).oracle() == oracle, "oracle mismatch");
        require(address(ICCALaunchArmOracleConfig(arm).poolManager()) == poolManager, "poolManager mismatch");
        console.log("Spoke CCA oracle config applied.");
    }
}
