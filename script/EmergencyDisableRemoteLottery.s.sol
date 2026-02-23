// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

interface ICreatorShareOFTEmergency {
    function isHub() external view returns (bool);
    function lotteryEnabled() external view returns (bool);
    function setLotteryEnabled(bool _enabled) external;
}

/**
 * @title EmergencyDisableRemoteLottery
 * @notice Emergency kill-switch for remote ShareOFT lottery auto processing.
 *
 * @dev Required env vars:
 *      - PRIVATE_KEY: owner key for the target ShareOFT
 *      - SHARE_OFT: remote CreatorShareOFT address to pause
 *
 * @dev Usage (repeat once per affected remote ShareOFT):
 *      forge script script/EmergencyDisableRemoteLottery.s.sol:EmergencyDisableRemoteLottery \
 *          --rpc-url $RPC_URL \
 *          --broadcast \
 *          -vvvv
 */
contract EmergencyDisableRemoteLottery is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address shareOFT = vm.envAddress("SHARE_OFT");
        address caller = vm.addr(privateKey);

        ICreatorShareOFTEmergency token = ICreatorShareOFTEmergency(shareOFT);

        bool hub = token.isHub();
        bool enabledBefore = token.lotteryEnabled();

        console.log("Caller:", caller);
        console.log("ShareOFT:", shareOFT);
        console.log("isHub:", hub);
        console.log("lotteryEnabled (before):", enabledBefore);

        // Emergency script is only for remote contracts.
        require(!hub, "target is hub deployment");

        if (!enabledBefore) {
            console.log("Lottery already disabled. No tx sent.");
            return;
        }

        vm.startBroadcast(privateKey);
        token.setLotteryEnabled(false);
        vm.stopBroadcast();

        bool enabledAfter = token.lotteryEnabled();
        console.log("lotteryEnabled (after):", enabledAfter);
        require(!enabledAfter, "disable failed");
    }
}
