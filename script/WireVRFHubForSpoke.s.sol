// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

interface ICreatorVRFConsumerHubWiring {
    function setPeer(uint32 eid, bytes32 peer) external;
    function setSupportedChain(uint32 chainEid, bool supported, uint32 gasLimit) external;
    function setChainRateLimit(uint32 chainEid, uint64 maxRequestsPerWindow) external;
    function setRemotePriceReportingEnabled(bool enabled) external;
}

/**
 * @title WireVRFHubForSpoke
 * @notice Configure hub VRF consumer to accept requests from a spoke integrator.
 *
 * @dev Required env vars:
 *      - PRIVATE_KEY: owner key for the hub VRF consumer
 *      - VRF_CONSUMER: hub `CreatorVRFConsumerV2_5` address
 *      - REMOTE_EID: spoke chain eid
 *      - REMOTE_INTEGRATOR: spoke `ChainlinkVRFIntegratorV2_5` address
 *
 * @dev Optional env vars:
 *      - REMOTE_GAS_LIMIT: gas for spoke lzReceive (default 200_000)
 *      - MAX_REQUESTS_PER_WINDOW: per-window cap for this spoke (default 10)
 *
 * @dev Usage:
 *      forge script script/WireVRFHubForSpoke.s.sol:WireVRFHubForSpoke \
 *          --rpc-url base \
 *          --broadcast \
 *          -vvvv
 */
contract WireVRFHubForSpoke is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address caller = vm.addr(privateKey);

        address vrfConsumer = vm.envAddress("VRF_CONSUMER");
        uint32 remoteEid = uint32(vm.envUint("REMOTE_EID"));
        address remoteIntegrator = vm.envAddress("REMOTE_INTEGRATOR");

        uint32 remoteGasLimit = uint32(vm.envOr("REMOTE_GAS_LIMIT", uint256(200_000)));
        uint64 maxRequestsPerWindow = uint64(vm.envOr("MAX_REQUESTS_PER_WINDOW", uint256(10)));

        console.log("Caller:           ", caller);
        console.log("VRF_CONSUMER:     ", vrfConsumer);
        console.log("REMOTE_EID:       ", remoteEid);
        console.log("REMOTE_INTEGRATOR:", remoteIntegrator);
        console.log("REMOTE_GAS_LIMIT: ", remoteGasLimit);
        console.log("MAX_REQ_PER_WIN:  ", maxRequestsPerWindow);

        vm.startBroadcast(privateKey);

        ICreatorVRFConsumerHubWiring hub = ICreatorVRFConsumerHubWiring(vrfConsumer);

        // Authenticate remote sender (spoke integrator).
        hub.setPeer(remoteEid, bytes32(uint256(uint160(remoteIntegrator))));

        // Enable this spoke and configure its receive gas.
        hub.setSupportedChain(remoteEid, true, remoteGasLimit);

        // Optional: tighten per-spoke throughput even further.
        hub.setChainRateLimit(remoteEid, maxRequestsPerWindow);

        // Safety default.
        hub.setRemotePriceReportingEnabled(false);

        vm.stopBroadcast();
    }
}

