// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";

import {LotteryRelayTestReceiver4626} from "@4626/shared/lottery/test/LotteryRelayTestReceiver4626.sol";

interface IBaseSepoliaLzEndpoint4626 {
    function eid() external view returns (uint32);
}

/// @notice Explicitly approved deployment only for the isolated B2 rehearsal receiver.
/// @dev Refuses every network except Base Sepolia. It deploys no Solana program,
///      creates no Solana account, configures no peer, and authorizes no Store.
contract DeployLotteryRelayTestReceiver4626 is Script {
    uint256 internal constant BASE_SEPOLIA_CHAIN_ID = 84_532;
    uint32 internal constant BASE_SEPOLIA_EID = 40_245;
    address internal constant BASE_SEPOLIA_ENDPOINT = 0x6EDCE65403992e310A62460808c4b910D972f10f;

    error UnexpectedChain(uint256 actual);
    error EndpointUnavailable();
    error EndpointEidMismatch(uint32 actual);
    error InvalidOwner();

    /// @dev Required environment variables:
    ///      - BASE_SEPOLIA_TEST_RECEIVER_DEPLOYER_PRIVATE_KEY
    ///      - LOTTERY_RELAY_TEST_RECEIVER_OWNER
    ///
    /// Run only after the source-default and metadata preflights pass, and
    /// only with `--broadcast` after a separate explicit approval.
    function run() external returns (LotteryRelayTestReceiver4626 receiver) {
        if (block.chainid != BASE_SEPOLIA_CHAIN_ID) revert UnexpectedChain(block.chainid);
        if (BASE_SEPOLIA_ENDPOINT.code.length == 0) revert EndpointUnavailable();
        uint32 endpointEid = IBaseSepoliaLzEndpoint4626(BASE_SEPOLIA_ENDPOINT).eid();
        if (endpointEid != BASE_SEPOLIA_EID) revert EndpointEidMismatch(endpointEid);

        uint256 deployerKey = vm.envUint("BASE_SEPOLIA_TEST_RECEIVER_DEPLOYER_PRIVATE_KEY");
        address owner = vm.envAddress("LOTTERY_RELAY_TEST_RECEIVER_OWNER");
        if (owner == address(0)) revert InvalidOwner();

        console2.log("Base Sepolia endpoint:", BASE_SEPOLIA_ENDPOINT);
        console2.log("Test receiver owner:", owner);
        console2.log("Creation-code hash:");
        console2.logBytes32(keccak256(type(LotteryRelayTestReceiver4626).creationCode));

        vm.startBroadcast(deployerKey);
        receiver = new LotteryRelayTestReceiver4626(BASE_SEPOLIA_ENDPOINT, owner);
        vm.stopBroadcast();

        console2.log("LotteryRelayTestReceiver4626:", address(receiver));
    }
}
