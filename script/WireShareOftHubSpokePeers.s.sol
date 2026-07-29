// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Registry4626} from "@4626/shared/core/Registry4626.sol";

interface IOFTPeerConfig {
    function setPeer(uint32 _eid, bytes32 _peer) external;
    function peers(uint32 _eid) external view returns (bytes32);
}

/**
 * @title WireShareOftHubSpokePeers
 * @notice Wire Base hub ShareOFT <-> any EVM spoke ShareOFT peers (one side per run).
 *
 * @dev Generalizes WireShareOftRobinhoodPeers for Ethereum / Arbitrum / Unichain / Robinhood.
 *
 * Required env (hub, Base):
 * - PRIVATE_KEY, WIRE_SIDE=hub, HUB_SHARE_OFT, SPOKE_SHARE_OFT, SPOKE_EID
 * - REGISTRY + CREATOR_TOKEN optional (also calls setRemoteOFTPeer)
 *
 * Required env (spoke):
 * - PRIVATE_KEY, WIRE_SIDE=spoke, HUB_SHARE_OFT, SPOKE_SHARE_OFT
 * - HUB_EID (default 30184)
 */
contract WireShareOftHubSpokePeers is Script {
    uint32 internal constant DEFAULT_HUB_EID = 30184;

    function run() external {
        string memory side = vm.envString("WIRE_SIDE");
        address hubShareOft = vm.envAddress("HUB_SHARE_OFT");
        address spokeShareOft = vm.envAddress("SPOKE_SHARE_OFT");
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        if (_eq(side, "hub")) {
            _wireHub(privateKey, hubShareOft, spokeShareOft);
            return;
        }
        if (_eq(side, "spoke") || _eq(side, "remote")) {
            _wireSpoke(privateKey, hubShareOft, spokeShareOft);
            return;
        }
        revert("WIRE_SIDE must be hub or spoke");
    }

    function _wireHub(uint256 privateKey, address hubShareOft, address spokeShareOft) internal {
        uint32 spokeEid = uint32(vm.envUint("SPOKE_EID"));
        address registryAddr = vm.envOr("REGISTRY", address(0));
        address creatorToken = vm.envOr("CREATOR_TOKEN", address(0));

        console.log("Wire ShareOFT hub side on chain:", block.chainid);
        console.log("Hub ShareOFT:  ", hubShareOft);
        console.log("Spoke ShareOFT:", spokeShareOft);
        console.log("Spoke EID:     ", spokeEid);

        vm.startBroadcast(privateKey);
        IOFTPeerConfig(hubShareOft).setPeer(spokeEid, bytes32(uint256(uint160(spokeShareOft))));
        if (registryAddr != address(0)) {
            require(creatorToken != address(0), "CREATOR_TOKEN required when REGISTRY is set");
            Registry4626(registryAddr).setRemoteOFTPeer(creatorToken, spokeEid, spokeShareOft);
        }
        vm.stopBroadcast();

        require(
            IOFTPeerConfig(hubShareOft).peers(spokeEid) == bytes32(uint256(uint160(spokeShareOft))),
            "Hub ShareOFT peer verification failed"
        );
        console.log("Hub ShareOFT peer wired.");
    }

    function _wireSpoke(uint256 privateKey, address hubShareOft, address spokeShareOft) internal {
        uint32 hubEid = uint32(vm.envOr("HUB_EID", uint256(DEFAULT_HUB_EID)));

        console.log("Wire ShareOFT spoke side on chain:", block.chainid);
        console.log("Spoke ShareOFT:", spokeShareOft);
        console.log("Hub ShareOFT:  ", hubShareOft);
        console.log("Hub EID:       ", hubEid);

        vm.startBroadcast(privateKey);
        IOFTPeerConfig(spokeShareOft).setPeer(hubEid, bytes32(uint256(uint160(hubShareOft))));
        vm.stopBroadcast();

        require(
            IOFTPeerConfig(spokeShareOft).peers(hubEid) == bytes32(uint256(uint160(hubShareOft))),
            "Spoke ShareOFT peer verification failed"
        );
        console.log("Spoke ShareOFT peer wired.");
    }

    function _eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
