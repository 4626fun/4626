// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

interface IOraclePeerConfig {
    function setPeer(uint32 _eid, bytes32 _peer) external;
    function peers(uint32 _eid) external view returns (bytes32);
}

/**
 * @title WireCreatorOracleHubSpokePeers
 * @notice Wire Base hub CreatorOracle <-> spoke CreatorOracle OApp peers (one side per run).
 *
 * @dev Hub broadcast uses `_lzSend` to spoke EIDs; spoke `_lzReceive` also requires
 *      `origin.srcEid == BASE_EID` and a configured peer for the hub.
 *
 * Required env (hub side, Base):
 * - PRIVATE_KEY
 * - WIRE_SIDE=hub
 * - HUB_ORACLE
 * - SPOKE_ORACLE
 * - SPOKE_EID
 *
 * Required env (spoke side):
 * - PRIVATE_KEY
 * - WIRE_SIDE=spoke
 * - HUB_ORACLE
 * - SPOKE_ORACLE
 * - HUB_EID (default 30184)
 *
 * Usage:
 *   WIRE_SIDE=hub SPOKE_EID=30110 forge script script/WireCreatorOracleHubSpokePeers.s.sol \
 *     --rpc-url $BASE_RPC_URL --broadcast -vvvv
 *
 *   WIRE_SIDE=spoke forge script script/WireCreatorOracleHubSpokePeers.s.sol \
 *     --rpc-url $ARBITRUM_RPC_URL --broadcast -vvvv
 */
contract WireCreatorOracleHubSpokePeers is Script {
    uint32 internal constant DEFAULT_HUB_EID = 30184;

    function run() external {
        string memory side = vm.envString("WIRE_SIDE");
        address hubOracle = vm.envAddress("HUB_ORACLE");
        address spokeOracle = vm.envAddress("SPOKE_ORACLE");
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        if (_eq(side, "hub")) {
            _wireHub(privateKey, hubOracle, spokeOracle);
            return;
        }
        if (_eq(side, "spoke")) {
            _wireSpoke(privateKey, hubOracle, spokeOracle);
            return;
        }
        revert("WIRE_SIDE must be hub or spoke");
    }

    function _wireHub(uint256 privateKey, address hubOracle, address spokeOracle) internal {
        uint32 spokeEid = uint32(vm.envUint("SPOKE_EID"));

        console.log("Wire oracle hub side on chain:", block.chainid);
        console.log("Hub oracle:  ", hubOracle);
        console.log("Spoke oracle:", spokeOracle);
        console.log("Spoke EID:   ", spokeEid);

        vm.startBroadcast(privateKey);
        IOraclePeerConfig(hubOracle).setPeer(spokeEid, bytes32(uint256(uint160(spokeOracle))));
        vm.stopBroadcast();

        require(
            IOraclePeerConfig(hubOracle).peers(spokeEid) == bytes32(uint256(uint160(spokeOracle))),
            "Hub oracle peer verification failed"
        );
        console.log("Hub oracle peer wired.");
    }

    function _wireSpoke(uint256 privateKey, address hubOracle, address spokeOracle) internal {
        uint32 hubEid = uint32(vm.envOr("HUB_EID", uint256(DEFAULT_HUB_EID)));

        console.log("Wire oracle spoke side on chain:", block.chainid);
        console.log("Spoke oracle:", spokeOracle);
        console.log("Hub oracle:  ", hubOracle);
        console.log("Hub EID:     ", hubEid);

        vm.startBroadcast(privateKey);
        IOraclePeerConfig(spokeOracle).setPeer(hubEid, bytes32(uint256(uint160(hubOracle))));
        vm.stopBroadcast();

        require(
            IOraclePeerConfig(spokeOracle).peers(hubEid) == bytes32(uint256(uint160(hubOracle))),
            "Spoke oracle peer verification failed"
        );
        console.log("Spoke oracle peer wired.");
    }

    function _eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
