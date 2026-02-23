// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {ChainlinkVRFIntegratorV2_5} from "../contracts/services/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol";

/**
 * @title DeployVRFIntegratorSpoke
 * @notice Deploy + minimally configure `ChainlinkVRFIntegratorV2_5` on a spoke chain.
 *
 * @dev Required env vars:
 *      - PRIVATE_KEY: deployer/owner
 *      - LZ_ENDPOINT: LayerZero EndpointV2 address on the spoke chain
 *      - HUB_EID: hub chain eid (Base = 30184)
 *      - HUB_VRF_CONSUMER: hub `CreatorVRFConsumerV2_5` address (as EVM address)
 *
 * @dev Optional env vars:
 *      - AUTHORIZED_CALLER: additional contract/EOA allowed to request randomness (besides owner)
 *
 * @dev Usage:
 *      forge script script/DeployVRFIntegratorSpoke.s.sol:DeployVRFIntegratorSpoke \
 *          --rpc-url $RPC_URL \
 *          --broadcast \
 *          -vvvv
 */
contract DeployVRFIntegratorSpoke is Script {
    function run() external returns (ChainlinkVRFIntegratorV2_5 integrator) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(privateKey);

        address endpoint = vm.envAddress("LZ_ENDPOINT");
        uint32 hubEid = uint32(vm.envUint("HUB_EID"));
        address hubVrfConsumer = vm.envAddress("HUB_VRF_CONSUMER");
        address authorizedCaller = vm.envOr("AUTHORIZED_CALLER", address(0));

        console.log("Chain ID:         ", block.chainid);
        console.log("Owner:            ", owner);
        console.log("LZ_ENDPOINT:      ", endpoint);
        console.log("HUB_EID:          ", hubEid);
        console.log("HUB_VRF_CONSUMER: ", hubVrfConsumer);
        console.log("AUTHORIZED_CALLER:", authorizedCaller);

        vm.startBroadcast(privateKey);

        integrator = new ChainlinkVRFIntegratorV2_5(endpoint, owner, hubEid);

        // Hub peer (used for both outbound sends + inbound response auth).
        integrator.setPeer(hubEid, bytes32(uint256(uint160(hubVrfConsumer))));

        // Permissioned by default: only the owner is authorized in the constructor.
        if (authorizedCaller != address(0) && authorizedCaller != owner) {
            integrator.setSponsoredCallerAuthorization(authorizedCaller, true);
        }

        vm.stopBroadcast();

        console.log("Integrator deployed:", address(integrator));
    }
}

