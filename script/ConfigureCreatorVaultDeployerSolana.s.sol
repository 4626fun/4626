// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

interface ICreatorVaultDeployerSolanaConfig {
    function protocolTreasury() external view returns (address);
    function lotteryManager() external view returns (address);
    function solanaBridgeAdapter() external view returns (address);
    function solanaDestination() external view returns (bytes32);
    function setSolanaConfig(address _adapter, bytes32 _destination) external;
}

interface ICreatorLotteryManagerAuth {
    function setAuthorizedSwapContract(address swapContract, bool authorized) external;
    function authorizedSwapContracts(address) external view returns (bool);
}

/**
 * @title ConfigureCreatorVaultDeployerSolana
 * @notice Configures Solana routing on CreatorVaultDeployer and (optionally) authorizes the adapter on LotteryManager.
 *
 * Required env:
 * - PRIVATE_KEY
 * - SOLANA_BRIDGE_ADAPTER
 * - SOLANA_DESTINATION (bytes32 Solana pubkey)
 *
 * Optional env:
 * - CREATOR_VAULT_BATCHER (defaults to current Base phased deployer)
 * - LOTTERY_MANAGER (defaults to deployer.lotteryManager())
 * - AUTHORIZE_ADAPTER_ON_LOTTERY=1|0 (default 1)
 */
contract ConfigureCreatorVaultDeployerSolana is Script {
    address constant DEFAULT_CREATOR_VAULT_BATCHER = 0x32e91185B92c6c13dd56D745aBf24F009cdD3019;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        address batcher = vm.envOr("CREATOR_VAULT_BATCHER", DEFAULT_CREATOR_VAULT_BATCHER);
        address adapter = vm.envAddress("SOLANA_BRIDGE_ADAPTER");
        bytes32 destination = vm.envBytes32("SOLANA_DESTINATION");

        ICreatorVaultDeployerSolanaConfig deployer = ICreatorVaultDeployerSolanaConfig(batcher);
        address protocolTreasury = deployer.protocolTreasury();
        require(broadcaster == protocolTreasury, "broadcaster must equal protocolTreasury");

        address lotteryManager = vm.envOr("LOTTERY_MANAGER", deployer.lotteryManager());
        bool authorizeOnLottery = vm.envOr("AUTHORIZE_ADAPTER_ON_LOTTERY", uint256(1)) == 1;

        console2.log("Broadcaster:", broadcaster);
        console2.log("CreatorVaultDeployer:", batcher);
        console2.log("ProtocolTreasury:", protocolTreasury);
        console2.log("SolanaBridgeAdapter:", adapter);
        console2.logBytes32(destination);
        console2.log("LotteryManager:", lotteryManager);
        console2.log("Authorize adapter on lottery:", authorizeOnLottery);

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

        vm.stopBroadcast();

        require(deployer.solanaBridgeAdapter() == adapter, "solana adapter mismatch");
        require(deployer.solanaDestination() == destination, "solana destination mismatch");

        if (authorizeOnLottery) {
            require(
                ICreatorLotteryManagerAuth(lotteryManager).authorizedSwapContracts(adapter),
                "lottery authorization mismatch"
            );
        }
    }
}
