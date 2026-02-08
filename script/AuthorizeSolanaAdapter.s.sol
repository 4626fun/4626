// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

interface ICreatorLotteryManagerAuth {
    function setAuthorizedSwapContract(address swapContract, bool authorized) external;
    function authorizedSwapContracts(address) external view returns (bool);
}

interface ISolanaBridgeAdapterAuth {
    function setFeeKeeper(bytes32 keeperPubkey, bool allowed) external;
    function setEntryKeeper(bytes32 keeperPubkey, bool allowed) external;
    function setLotteryManager(address _lotteryManager) external;
    function lotteryManager() external view returns (address);
    function authorizedFeeKeepers(bytes32) external view returns (bool);
    function authorizedEntryKeepers(bytes32) external view returns (bool);
}

/**
 * @title AuthorizeSolanaAdapter
 * @author 0xakita.eth
 * @notice Authorize SolanaBridgeAdapter as a swap contract on CreatorLotteryManager
 *         and configure keeper allowlists for Solana spoke relay.
 *
 * @dev Required env vars:
 *      - PRIVATE_KEY: deployer/owner private key
 *      - LOTTERY_MANAGER: CreatorLotteryManager address
 *      - SOLANA_BRIDGE_ADAPTER: SolanaBridgeAdapter address
 *      - SOLANA_KEEPER_PUBKEY: Solana keeper pubkey (bytes32 hex)
 *
 * Usage:
 *   forge script script/AuthorizeSolanaAdapter.s.sol --rpc-url $BASE_RPC_URL --broadcast
 */
contract AuthorizeSolanaAdapter is Script {
    function run() external {
        address lotteryManager = vm.envAddress("LOTTERY_MANAGER");
        address solanaBridgeAdapter = vm.envAddress("SOLANA_BRIDGE_ADAPTER");
        bytes32 solanaKeeperPubkey = vm.envBytes32("SOLANA_KEEPER_PUBKEY");

        vm.startBroadcast();

        // 1. Authorize SolanaBridgeAdapter as a swap contract on LotteryManager.
        //    This allows the adapter to call processSwapLottery().
        ICreatorLotteryManagerAuth(lotteryManager).setAuthorizedSwapContract(
            solanaBridgeAdapter,
            true
        );
        console.log("Authorized SolanaBridgeAdapter as swap contract on LotteryManager");

        // 2. Set LotteryManager on SolanaBridgeAdapter.
        ISolanaBridgeAdapterAuth(solanaBridgeAdapter).setLotteryManager(lotteryManager);
        console.log("Set LotteryManager on SolanaBridgeAdapter");

        // 3. Authorize Solana keeper pubkey for fee relay.
        ISolanaBridgeAdapterAuth(solanaBridgeAdapter).setFeeKeeper(solanaKeeperPubkey, true);
        console.log("Authorized fee keeper");

        // 4. Authorize Solana keeper pubkey for entry relay.
        ISolanaBridgeAdapterAuth(solanaBridgeAdapter).setEntryKeeper(solanaKeeperPubkey, true);
        console.log("Authorized entry keeper");

        vm.stopBroadcast();

        // Verify
        console.log("--- Verification ---");
        console.log(
            "LotteryManager authorized adapter:",
            ICreatorLotteryManagerAuth(lotteryManager).authorizedSwapContracts(solanaBridgeAdapter)
        );
        console.log(
            "Adapter lotteryManager:",
            ISolanaBridgeAdapterAuth(solanaBridgeAdapter).lotteryManager()
        );
        console.log(
            "Fee keeper authorized:",
            ISolanaBridgeAdapterAuth(solanaBridgeAdapter).authorizedFeeKeepers(solanaKeeperPubkey)
        );
        console.log(
            "Entry keeper authorized:",
            ISolanaBridgeAdapterAuth(solanaBridgeAdapter).authorizedEntryKeepers(solanaKeeperPubkey)
        );
    }
}
