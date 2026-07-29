// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {CCALaunchArm} from "@4626/shared/shareoft-mesh/cca/CCALaunchArm.sol";

/**
 * @title DeploySpokeCcaLaunchArm
 * @notice Deploy + configure a spoke-minimal CCALaunchArm (no vault stack).
 *
 * @dev Applies v2.1.0 factory, schedule from env (mirror ccaLaunchChains.ts),
 *      recipients=arm, oracle config, and migration config (PositionManager).
 *
 * Required env:
 * - PRIVATE_KEY
 * - SHARE_OFT (remote ShareOFT on this chain)
 * - EXPECTED_CHAIN_ID
 * - POOL_MANAGER
 * - POSITION_MANAGER
 * - ORACLE (spoke CreatorOracle; may be address(0) then ConfigureSpokeCcaOracle later)
 *
 * Optional env:
 * - OWNER (default broadcaster)
 * - CCA_FACTORY (default v2.1.0 vanity 0x0000…63F8)
 * - TAX_HOOK (default 0)
 * - FEE_RECIPIENT (default arm)
 * - POSITION_RECIPIENT / OPERATOR (default OWNER)
 * - DEFAULT_DURATION_BLOCKS
 * - CLAIM_DELAY_BLOCKS
 * - SWEEP_DELAY_BLOCKS
 * - MIGRATION_DELAY_BLOCKS (default 1)
 * - LAUNCH_BLOCKS_PER_SECOND (0 = use LAUNCH_BLOCK_TIME_SECONDS)
 * - LAUNCH_BLOCK_TIME_SECONDS
 *
 * Usage:
 *   EXPECTED_CHAIN_ID=42161 SHARE_OFT=… ORACLE=… POOL_MANAGER=… POSITION_MANAGER=… \
 *     DEFAULT_DURATION_BLOCKS=2419200 LAUNCH_BLOCKS_PER_SECOND=4 \
 *     CLAIM_DELAY_BLOCKS=28800 SWEEP_DELAY_BLOCKS=115200 \
 *     forge script script/DeploySpokeCcaLaunchArm.s.sol:DeploySpokeCcaLaunchArm \
 *       --rpc-url $ARBITRUM_RPC_URL --broadcast -vvvv
 */
contract DeploySpokeCcaLaunchArm is Script {
    address internal constant DEFAULT_CCA_FACTORY_V210 = 0x000000001F26a0044BaA66024e7b6599c61963F8;

    function run() external returns (address armAddr) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("OWNER", vm.addr(pk));
        address shareOft = vm.envAddress("SHARE_OFT");
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        address poolManager = vm.envAddress("POOL_MANAGER");
        address positionManager = vm.envAddress("POSITION_MANAGER");
        address oracle = vm.envOr("ORACLE", address(0));
        address taxHook = vm.envOr("TAX_HOOK", address(0));
        address ccaFactory = vm.envOr("CCA_FACTORY", DEFAULT_CCA_FACTORY_V210);

        uint64 duration = uint64(vm.envUint("DEFAULT_DURATION_BLOCKS"));
        uint64 claimDelay = uint64(vm.envUint("CLAIM_DELAY_BLOCKS"));
        uint64 sweepDelay = uint64(vm.envUint("SWEEP_DELAY_BLOCKS"));
        uint64 migrationDelay = uint64(vm.envOr("MIGRATION_DELAY_BLOCKS", uint256(1)));
        uint64 blocksPerSecond = uint64(vm.envOr("LAUNCH_BLOCKS_PER_SECOND", uint256(0)));
        uint64 blockTimeSeconds = uint64(vm.envOr("LAUNCH_BLOCK_TIME_SECONDS", uint256(0)));

        require(block.chainid == expectedChainId, "Unexpected chain id");
        require(shareOft != address(0) && poolManager != address(0) && positionManager != address(0), "addrs");
        require(duration > 0 && claimDelay > 0 && sweepDelay > 0 && migrationDelay > 0, "schedule");
        require(blocksPerSecond > 0 || blockTimeSeconds > 0, "Need LAUNCH_BLOCKS_PER_SECOND or LAUNCH_BLOCK_TIME_SECONDS");
        require(positionManager.code.length > 0, "POSITION_MANAGER has no code");
        require(ccaFactory.code.length > 0, "CCA_FACTORY has no code");

        console.log("Chain ID:        ", block.chainid);
        console.log("ShareOFT:        ", shareOft);
        console.log("Owner:           ", owner);
        console.log("PoolManager:     ", poolManager);
        console.log("PositionManager: ", positionManager);
        console.log("Oracle:          ", oracle);
        console.log("CCA factory:     ", ccaFactory);

        vm.startBroadcast(pk);

        // Ctor recipients are placeholders; immediately retarget to the arm for v2 sweeps.
        CCALaunchArm arm = new CCALaunchArm(shareOft, address(0), owner, owner, owner);
        armAddr = address(arm);
        address feeRecipient = vm.envOr("FEE_RECIPIENT", armAddr);
        address positionRecipient = vm.envOr("POSITION_RECIPIENT", owner);
        address operator = vm.envOr("OPERATOR", owner);

        arm.setRecipients(armAddr, armAddr);
        arm.setCcaFactoryV2(ccaFactory);

        if (blocksPerSecond > 0) {
            arm.setLaunchBlocksPerSecond(blocksPerSecond);
        } else {
            arm.setLaunchBlockTimeSeconds(blockTimeSeconds);
        }
        arm.setDefaultDuration(duration);
        arm.setDefaultClaimDelay(claimDelay);
        arm.setDefaultSweepDelayBlocks(sweepDelay);
        arm.setMigrationDelayBlocks(migrationDelay);

        arm.setOracleConfig(oracle, poolManager, taxHook, feeRecipient);
        arm.setMigrationConfig(positionManager, positionRecipient, operator, migrationDelay, sweepDelay);

        vm.stopBroadcast();

        console.log("CCALaunchArm:    ", armAddr);
        console.log("Next: pin VITE_AKITA_CCA_STRATEGY_<CHAIN> and broadcast oracle price if needed");
    }
}
