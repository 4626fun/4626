// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

interface IVRFCoordinatorSubscriptions {
    function getSubscription(uint256 subId)
        external
        view
        returns (uint256 balance, uint256 nativeBalance, uint256 reqCount, address owner, address[] memory consumers);

    function addConsumer(uint256 subId, address consumer) external;
}

interface ICreatorVRFConsumerAdmin {
    function owner() external view returns (address);

    function authorizedLocalCallers(address caller) external view returns (bool);
    function setLocalCallerAuthorization(address caller, bool authorized) external;

    function subscriptionId() external view returns (uint256);
    function keyHash() external view returns (bytes32);
    function callbackGasLimit() external view returns (uint32);
    function requestConfirmations() external view returns (uint16);

    function setVRFConfig(uint256 _subscriptionId, bytes32 _keyHash, uint32 _callbackGasLimit, uint16 _requestConfirmations)
        external;
}

interface ILotteryManagerAdmin {
    function owner() external view returns (address);
    function useLocalVRF() external view returns (bool);
    function setUseLocalVRF(bool useLocal) external;
    function localVRFConsumer() external view returns (address);
    function setLocalVRFConsumer(address consumer) external;
}

/**
 * @notice Completes the VRF wiring for the v2 vanity infra:
 *         - Add the new VRF hub consumer to the Chainlink subscription
 *         - Set VRF hub config (subId/keyHash/gas/confirms)
 *         - Authorize the new LotteryManager as a local caller on the hub
 *         - Switch the new LotteryManager to use the new VRF hub
 */
contract ConfigureVrfAndLotteryV2 is Script {
    uint256 internal constant BASE_CHAIN_ID = 8453;

    address internal constant DEFAULT_OWNER = 0xB05Cf01231cF2fF99499682E64D3780d57c80FdD;

    // Chainlink VRF Coordinator 2.5 on Base
    address internal constant DEFAULT_VRF_COORDINATOR = 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634;

    // Old, currently-funded subscription details (copied from existing hub config)
    uint256 internal constant DEFAULT_SUBSCRIPTION_ID =
        47863839619354659993460736640231400533612753469382997188258012673937790980789;
    bytes32 internal constant DEFAULT_KEYHASH = 0x00b81b5a830cb0a4009fbd8904de511e28631e62ce5ad231373d3cdad373ccab;
    uint32 internal constant DEFAULT_CALLBACK_GAS = 500_000;
    uint16 internal constant DEFAULT_CONFIRMATIONS = 3;

    // New v2 vanity contracts
    address internal constant DEFAULT_LOTTERY_MANAGER = 0x77705A2f173dd52F28300447506Dc35086c34626;
    address internal constant DEFAULT_VRF_CONSUMER = 0x9F85d8EEe5d2b8dC1E99b598B9c2B084934d0304;

    function _contains(address[] memory arr, address needle) internal pure returns (bool) {
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == needle) return true;
        }
        return false;
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        address owner = vm.envOr("OWNER", DEFAULT_OWNER);
        address coordinatorAddr = vm.envOr("VRF_COORDINATOR", DEFAULT_VRF_COORDINATOR);

        uint256 subId = vm.envOr("VRF_SUBSCRIPTION_ID", DEFAULT_SUBSCRIPTION_ID);
        bytes32 keyHash = vm.envOr("VRF_KEYHASH", DEFAULT_KEYHASH);
        uint32 callbackGas = uint32(vm.envOr("VRF_CALLBACK_GAS", uint256(DEFAULT_CALLBACK_GAS)));
        uint16 confirmations = uint16(vm.envOr("VRF_CONFIRMATIONS", uint256(DEFAULT_CONFIRMATIONS)));

        address vrfConsumerAddr = vm.envOr("VRF_CONSUMER", DEFAULT_VRF_CONSUMER);
        address lotteryAddr = vm.envOr("LOTTERY_MANAGER", DEFAULT_LOTTERY_MANAGER);

        console2.log("ConfigureVrfAndLotteryV2");
        console2.log("Chain ID:", block.chainid);
        console2.log("Broadcaster:", broadcaster);
        console2.log("Owner:", owner);
        console2.log("VRF_COORDINATOR:", coordinatorAddr);
        console2.log("VRF_SUBSCRIPTION_ID:", subId);
        console2.logBytes32(keyHash);
        console2.log("callbackGas:", callbackGas);
        console2.log("confirmations:", confirmations);
        console2.log("VRF_CONSUMER:", vrfConsumerAddr);
        console2.log("LOTTERY_MANAGER:", lotteryAddr);

        require(block.chainid == BASE_CHAIN_ID, "Wrong chain");
        require(broadcaster == owner, "Broadcaster must equal OWNER for subscription admin");

        IVRFCoordinatorSubscriptions coord = IVRFCoordinatorSubscriptions(coordinatorAddr);
        ICreatorVRFConsumerAdmin vrf = ICreatorVRFConsumerAdmin(vrfConsumerAddr);
        ILotteryManagerAdmin lottery = ILotteryManagerAdmin(lotteryAddr);

        require(vrf.owner() == owner, "VRF consumer owner mismatch");
        require(lottery.owner() == owner, "Lottery owner mismatch");

        (,, , address subOwner, address[] memory consumers) = coord.getSubscription(subId);
        require(subOwner == owner, "Subscription owner mismatch");

        vm.startBroadcast(pk);

        if (!_contains(consumers, vrfConsumerAddr)) {
            coord.addConsumer(subId, vrfConsumerAddr);
            console2.log("coord.addConsumer(subId, vrfConsumer)");
        } else {
            console2.log("VRF consumer already in subscription");
        }

        // Configure the VRF consumer (idempotent)
        if (
            vrf.subscriptionId() != subId || vrf.keyHash() != keyHash || vrf.callbackGasLimit() != callbackGas
                || vrf.requestConfirmations() != confirmations
        ) {
            vrf.setVRFConfig(subId, keyHash, callbackGas, confirmations);
            console2.log("vrf.setVRFConfig(...)");
        } else {
            console2.log("VRF config already set");
        }

        if (!vrf.authorizedLocalCallers(lotteryAddr)) {
            vrf.setLocalCallerAuthorization(lotteryAddr, true);
            console2.log("vrf.setLocalCallerAuthorization(lottery, true)");
        } else {
            console2.log("Lottery already authorized as local caller");
        }

        if (lottery.localVRFConsumer() != vrfConsumerAddr) {
            lottery.setLocalVRFConsumer(vrfConsumerAddr);
            console2.log("lottery.setLocalVRFConsumer(newVrf)");
        } else {
            console2.log("Lottery already points at VRF consumer");
        }

        if (!lottery.useLocalVRF()) {
            lottery.setUseLocalVRF(true);
            console2.log("lottery.setUseLocalVRF(true)");
        }

        vm.stopBroadcast();
    }
}

