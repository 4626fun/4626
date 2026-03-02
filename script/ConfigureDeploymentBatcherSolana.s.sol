// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

interface IDeploymentBatcherSolanaConfig {
    function protocolTreasury() external view returns (address);
    function lotteryManager() external view returns (address);
    function solanaBridgeAdapter() external view returns (address);
    function solanaDestination() external view returns (bytes32);
    function setSolanaConfig(address _adapter, bytes32 _destination) external;
    function setOVaultRuntimeConfig(address _hubComposer, uint32 _solanaEid, bool _enabled) external;
    function getOVaultRuntimeConfig() external view returns (address hubComposer, uint32 solanaEid, bool enabled);
}

interface ICreatorLotteryManagerAuth {
    function setAuthorizedSwapContract(address swapContract, bool authorized) external;
    function authorizedSwapContracts(address) external view returns (bool);
}

/**
 * @title ConfigureDeploymentBatcherSolana
 * @notice Configures Solana routing on the deployment batcher (`DeploymentBatcher`) and optionally authorizes the adapter on LotteryManager.
 *
 * Required env:
 * - PRIVATE_KEY
 * - SOLANA_BRIDGE_ADAPTER
 * - SOLANA_DESTINATION (bytes32 Solana pubkey)
 *
 * Optional env:
 * - DEPLOYMENT_BATCHER (defaults to current Base phased deployer)
 * - LOTTERY_MANAGER (defaults to deployer.lotteryManager())
 * - AUTHORIZE_ADAPTER_ON_LOTTERY=1|0 (default 1)
 * - CONFIGURE_OVAULT_RUNTIME=1|0 (default 0)
 * - OVAULT_HUB_COMPOSER (required when CONFIGURE_OVAULT_RUNTIME=1)
 * - OVAULT_SOLANA_EID (required when CONFIGURE_OVAULT_RUNTIME=1)
 */
contract ConfigureDeploymentBatcherSolana is Script {
    address constant DEFAULT_DEPLOYMENT_BATCHER = 0x6F3662298a96b372Df4134Fd6f89df36Ec014480;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        address batcher = vm.envOr("DEPLOYMENT_BATCHER", DEFAULT_DEPLOYMENT_BATCHER);
        address adapter = vm.envAddress("SOLANA_BRIDGE_ADAPTER");
        bytes32 destination = vm.envBytes32("SOLANA_DESTINATION");

        IDeploymentBatcherSolanaConfig deployer = IDeploymentBatcherSolanaConfig(batcher);
        address protocolTreasury = deployer.protocolTreasury();
        require(broadcaster == protocolTreasury, "broadcaster must equal protocolTreasury");

        address lotteryManager = vm.envOr("LOTTERY_MANAGER", deployer.lotteryManager());
        bool authorizeOnLottery = vm.envOr("AUTHORIZE_ADAPTER_ON_LOTTERY", uint256(1)) == 1;
        bool configureOvaultRuntime = vm.envOr("CONFIGURE_OVAULT_RUNTIME", uint256(0)) == 1;
        address ovaultHubComposer = vm.envOr("OVAULT_HUB_COMPOSER", address(0));
        uint32 ovaultSolanaEid = uint32(vm.envOr("OVAULT_SOLANA_EID", uint256(0)));

        console2.log("Broadcaster:", broadcaster);
        console2.log("Deployment batcher (DeploymentBatcher):", batcher);
        console2.log("ProtocolTreasury:", protocolTreasury);
        console2.log("SolanaBridgeAdapter:", adapter);
        console2.logBytes32(destination);
        console2.log("LotteryManager:", lotteryManager);
        console2.log("Authorize adapter on lottery:", authorizeOnLottery);
        console2.log("Configure OVault runtime:", configureOvaultRuntime);
        if (configureOvaultRuntime) {
            console2.log("OVault hub composer:", ovaultHubComposer);
            console2.log("OVault Solana EID:", ovaultSolanaEid);
        }

        vm.startBroadcast(pk);

        if (deployer.solanaBridgeAdapter() != adapter || deployer.solanaDestination() != destination) {
            deployer.setSolanaConfig(adapter, destination);
            console2.log("setSolanaConfig: updated");
        } else {
            console2.log("setSolanaConfig: already correct");
        }

        if (authorizeOnLottery) {
            ICreatorLotteryManagerAuth lottery = ICreatorLotteryManagerAuth(lotteryManager);
            if (!lottery.authorizedSwapContracts(adapter)) {
                lottery.setAuthorizedSwapContract(adapter, true);
                console2.log("LotteryManager authorization: updated");
            } else {
                console2.log("LotteryManager authorization: already true");
            }
        }

        if (configureOvaultRuntime) {
            require(ovaultHubComposer != address(0), "OVAULT_HUB_COMPOSER required");
            require(ovaultSolanaEid != 0, "OVAULT_SOLANA_EID required");
            (address currentHubComposer, uint32 currentSolanaEid, bool currentEnabled) = deployer.getOVaultRuntimeConfig();
            if (currentHubComposer != ovaultHubComposer || currentSolanaEid != ovaultSolanaEid || !currentEnabled) {
                deployer.setOVaultRuntimeConfig(ovaultHubComposer, ovaultSolanaEid, true);
                console2.log("setOVaultRuntimeConfig: updated");
            } else {
                console2.log("setOVaultRuntimeConfig: already correct");
            }
        }

        vm.stopBroadcast();

        require(deployer.solanaBridgeAdapter() == adapter, "solana adapter mismatch");
        require(deployer.solanaDestination() == destination, "solana destination mismatch");

        if (configureOvaultRuntime) {
            (address finalHubComposer, uint32 finalSolanaEid, bool finalEnabled) = deployer.getOVaultRuntimeConfig();
            require(finalHubComposer == ovaultHubComposer, "ovault hub composer mismatch");
            require(finalSolanaEid == ovaultSolanaEid, "ovault solana eid mismatch");
            require(finalEnabled, "ovault runtime not enabled");
        }

        if (authorizeOnLottery) {
            require(
                ICreatorLotteryManagerAuth(lotteryManager).authorizedSwapContracts(adapter),
                "lottery authorization mismatch"
            );
        }
    }
}
