// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import {SolanaBridgeAdapter} from "../contracts/utilities/bridge/SolanaBridgeAdapter.sol";

interface ILotteryManagerAdmin {
    function authorizedSwapContracts(address swapContract) external view returns (bool);
    function setAuthorizedSwapContract(address swapContract, bool authorized) external;
}

/**
 * DeploySolanaBridgeAdapter
 *
 * Base mainnet usage:
 *   forge script script/DeploySolanaBridgeAdapter.s.sol:DeploySolanaBridgeAdapter \\
 *     --rpc-url https://mainnet.base.org --broadcast --non-interactive
 *
 * Env:
 * - PRIVATE_KEY (required)
 * - CREATOR_REGISTRY (optional; defaults to Base mainnet registry from deployments/)
 * - SOLANA_BRIDGE_ADAPTER_OWNER (optional; defaults to broadcaster)
 *
 * Optional post-deploy config:
 * - CCA_AUCTION (optional; if set, will be allowlisted via setCcaAuctionAllowed)
 * - LOTTERY_MANAGER / CREATOR_LOTTERY_MANAGER (optional; if set, will be set on the adapter and
 *   the adapter will be authorized on the lottery manager as a swap contract)
 */
contract DeploySolanaBridgeAdapter is Script {
    // Base mainnet CreatorRegistry (see deployments/base/contracts/core/CreatorRegistry.json)
    address constant DEFAULT_CREATOR_REGISTRY = 0x888506B92181c57A2fD06516FFFb6F375b7A4626;

    // Base mainnet CreatorLotteryManager (hub)
    address constant DEFAULT_LOTTERY_MANAGER = 0x77705A2f173dd52F28300447506Dc35086c34626;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        address registry = vm.envOr("CREATOR_REGISTRY", vm.envOr("REGISTRY", DEFAULT_CREATOR_REGISTRY));
        address owner = vm.envOr("SOLANA_BRIDGE_ADAPTER_OWNER", vm.envOr("OWNER", broadcaster));
        address lotteryManager = vm.envOr(
            "CREATOR_LOTTERY_MANAGER", vm.envOr("LOTTERY_MANAGER", DEFAULT_LOTTERY_MANAGER)
        );

        console2.log("Broadcaster:", broadcaster);
        console2.log("CreatorRegistry:", registry);
        console2.log("Adapter owner:", owner);
        console2.log("LotteryManager:", lotteryManager);

        vm.startBroadcast(pk);

        SolanaBridgeAdapter adapter = new SolanaBridgeAdapter(registry, owner);
        console2.log("SolanaBridgeAdapter:", address(adapter));

        address ccaAuction = vm.envOr("CCA_AUCTION", address(0));
        if (ccaAuction != address(0)) {
            adapter.setCcaAuctionAllowed(ccaAuction, true);
            console2.log("Allowlisted CCA auction:", ccaAuction);
        }

        if (lotteryManager != address(0)) {
            adapter.setLotteryManager(lotteryManager);
            console2.log("Adapter setLotteryManager:", lotteryManager);

            ILotteryManagerAdmin lottery = ILotteryManagerAdmin(lotteryManager);
            if (!lottery.authorizedSwapContracts(address(adapter))) {
                lottery.setAuthorizedSwapContract(address(adapter), true);
                console2.log("LotteryManager authorized adapter as swap contract");
            } else {
                console2.log("LotteryManager already authorized adapter");
            }
        }

        vm.stopBroadcast();
    }
}
