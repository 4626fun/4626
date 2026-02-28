// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

interface ICreatorLotteryManagerAuth {
    function setAuthorizedSwapContract(address swapContract, bool authorized) external;
    function authorizedSwapContracts(address) external view returns (bool);
}

interface IDeploymentBatcherSolanaAuth {
    function lotteryManager() external view returns (address);
    function protocolTreasury() external view returns (address);
    function solanaBridgeAdapter() external view returns (address);
    function solanaDestination() external view returns (bytes32);
    function setSolanaConfig(address _adapter, bytes32 _destination) external;
}

/**
 * @title AuthorizeSolanaAdapter
 * @author 0xakita.eth
 * @notice Authorize SolanaBridgeAdapter as a swap contract on CreatorLotteryManager
 *         and configure optional Solana spoke relay wiring.
 *
 * @dev Required env vars:
 *      - PRIVATE_KEY: deployer/owner private key
 *      - SOLANA_BRIDGE_ADAPTER: SolanaBridgeAdapter address
 *
 * @dev Optional env vars:
 *      - LOTTERY_MANAGER: CreatorLotteryManager address
 *      - DEPLOYMENT_BATCHER: derive lottery manager from deployment batcher if LOTTERY_MANAGER is unset
 *      - SET_BATCHER_SOLANA_CONFIG=1 to call batcher.setSolanaConfig(adapter, destination)
 *      - SOLANA_DESTINATION: required when SET_BATCHER_SOLANA_CONFIG=1
 *      - SOLANA_KEEPER_PUBKEY: optional Solana keeper pubkey (bytes32 hex)
 *
 * Usage:
 *   forge script script/AuthorizeSolanaAdapter.s.sol --rpc-url $BASE_RPC_URL --broadcast
 */
contract AuthorizeSolanaAdapter is Script {
    address constant DEFAULT_DEPLOYMENT_BATCHER = 0xB87CBb646dD14F520078F11196f79BF815F18c84;

    function _trySetAdapterLotteryManager(address adapter, address lotteryManager) internal {
        (bool hasLotteryGetter, bytes memory data) = adapter.staticcall(abi.encodeWithSignature("lotteryManager()"));
        if (!hasLotteryGetter || data.length < 32) {
            console.log("Adapter lotteryManager() unavailable; skipping adapter lottery sync");
            return;
        }

        address current = abi.decode(data, (address));
        if (current == lotteryManager) {
            console.log("Adapter lotteryManager already set");
            return;
        }

        (bool ok,) = adapter.call(abi.encodeWithSignature("setLotteryManager(address)", lotteryManager));
        if (!ok) {
            console.log("setLotteryManager failed (owner/adapter-version mismatch); skipping");
            return;
        }
        console.log("Set LotteryManager on SolanaBridgeAdapter");
    }

    function _trySetKeepers(address adapter, bytes32 keeperPubkey) internal {
        if (keeperPubkey == bytes32(0)) {
            console.log("SOLANA_KEEPER_PUBKEY not set; skipping keeper auth");
            return;
        }

        (bool okFee,) = adapter.call(abi.encodeWithSignature("setFeeKeeper(bytes32,bool)", keeperPubkey, true));
        require(okFee, "setFeeKeeper failed");
        console.log("Authorized fee keeper");

        (bool okEntry,) = adapter.call(abi.encodeWithSignature("setEntryKeeper(bytes32,bool)", keeperPubkey, true));
        require(okEntry, "setEntryKeeper failed");
        console.log("Authorized entry keeper");
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);
        address batcher = vm.envOr("DEPLOYMENT_BATCHER", DEFAULT_DEPLOYMENT_BATCHER);
        address lotteryManager = vm.envOr("LOTTERY_MANAGER", address(0));
        address solanaBridgeAdapter = vm.envAddress("SOLANA_BRIDGE_ADAPTER");
        bytes32 solanaKeeperPubkey = vm.envOr("SOLANA_KEEPER_PUBKEY", bytes32(0));
        bytes32 solanaDestination = vm.envOr("SOLANA_DESTINATION", bytes32(0));
        bool setBatcherSolanaConfig = vm.envOr("SET_BATCHER_SOLANA_CONFIG", uint256(0)) == 1;

        if (lotteryManager == address(0)) {
            lotteryManager = IDeploymentBatcherSolanaAuth(batcher).lotteryManager();
        }
        require(lotteryManager != address(0), "LOTTERY_MANAGER required");

        vm.startBroadcast(pk);

        // 1. Authorize SolanaBridgeAdapter as a swap contract on LotteryManager.
        //    This allows the adapter to call processSwapLottery().
        ICreatorLotteryManagerAuth(lotteryManager).setAuthorizedSwapContract(solanaBridgeAdapter, true);
        console.log("Authorized SolanaBridgeAdapter as swap contract on LotteryManager");

        // 2. Optional: set Solana adapter + destination on deployment batcher.
        if (setBatcherSolanaConfig) {
            require(solanaDestination != bytes32(0), "SOLANA_DESTINATION required");
            IDeploymentBatcherSolanaAuth deployer = IDeploymentBatcherSolanaAuth(batcher);
            require(deployer.protocolTreasury() == broadcaster, "sender must be protocolTreasury");
            deployer.setSolanaConfig(solanaBridgeAdapter, solanaDestination);
            console.log("Set Solana config on deployment batcher (DeploymentBatcher)");
        } else {
            console.log("SET_BATCHER_SOLANA_CONFIG=0; skipping batcher Solana config");
        }

        // 3. Best-effort sync of adapter's LotteryManager field (if supported by adapter version).
        _trySetAdapterLotteryManager(solanaBridgeAdapter, lotteryManager);

        // 4. Optional keeper setup.
        _trySetKeepers(solanaBridgeAdapter, solanaKeeperPubkey);

        vm.stopBroadcast();

        // Verify
        console.log("--- Verification ---");
        console.log(
            "LotteryManager authorized adapter:",
            ICreatorLotteryManagerAuth(lotteryManager).authorizedSwapContracts(solanaBridgeAdapter)
        );
        if (setBatcherSolanaConfig) {
            IDeploymentBatcherSolanaAuth deployer = IDeploymentBatcherSolanaAuth(batcher);
            console.log("Batcher solana adapter:", deployer.solanaBridgeAdapter());
            console.logBytes32(deployer.solanaDestination());
            require(deployer.solanaBridgeAdapter() == solanaBridgeAdapter, "batcher adapter mismatch");
            require(deployer.solanaDestination() == solanaDestination, "batcher destination mismatch");
        }
    }
}
