// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Registry4626} from "@4626/shared/core/Registry4626.sol";

interface IOFTPeerConfig {
    function setPeer(uint32 _eid, bytes32 _peer) external;
    function peers(uint32 _eid) external view returns (bytes32);
}

/**
 * @title WireShareOftRobinhoodPeers
 * @notice Wire Base hub ShareOFT <-> Robinhood remote ShareOFT peers (one side per run).
 *
 * @dev Set WIRE_SIDE to `hub` (run on Base) or `remote` (run on Robinhood).
 *
 * Required env (hub side, Base):
 * - PRIVATE_KEY
 * - WIRE_SIDE=hub
 * - BASE_SHARE_OFT
 * - ROBINHOOD_SHARE_OFT
 * - ROBINHOOD_EID (default 30416)
 * - REGISTRY (optional; when set also calls setRemoteOFTPeer)
 * - CREATOR_TOKEN (required when REGISTRY is set)
 *
 * Required env (remote side, Robinhood):
 * - PRIVATE_KEY
 * - WIRE_SIDE=remote
 * - BASE_SHARE_OFT
 * - ROBINHOOD_SHARE_OFT
 * - HUB_EID (default 30184)
 *
 * @dev Usage:
 *      # Hub (Base)
 *      WIRE_SIDE=hub forge script script/WireShareOftRobinhoodPeers.s.sol:WireShareOftRobinhoodPeers \
 *          --rpc-url base --broadcast -vvvv
 *
 *      # Remote (Robinhood) — usually handled by DeployRemoteShareOft; use if re-wiring peers only
 *      WIRE_SIDE=remote forge script script/WireShareOftRobinhoodPeers.s.sol:WireShareOftRobinhoodPeers \
 *          --rpc-url robinhood --broadcast -vvvv
 */
contract WireShareOftRobinhoodPeers is Script {
    uint32 internal constant DEFAULT_HUB_EID = 30184;
    uint32 internal constant DEFAULT_ROBINHOOD_EID = 30416;

    function run() external {
        string memory side = vm.envString("WIRE_SIDE");
        address baseShareOft = vm.envAddress("BASE_SHARE_OFT");
        address robinhoodShareOft = vm.envAddress("ROBINHOOD_SHARE_OFT");
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        if (_eq(side, "hub")) {
            _wireHub(privateKey, baseShareOft, robinhoodShareOft);
            return;
        }
        if (_eq(side, "remote")) {
            _wireRemote(privateKey, baseShareOft, robinhoodShareOft);
            return;
        }
        revert("WIRE_SIDE must be hub or remote");
    }

    function _wireHub(uint256 privateKey, address baseShareOft, address robinhoodShareOft) internal {
        uint32 robinhoodEid = uint32(vm.envOr("ROBINHOOD_EID", uint256(DEFAULT_ROBINHOOD_EID)));
        address registryAddr = vm.envOr("REGISTRY", address(0));
        address creatorToken = vm.envOr("CREATOR_TOKEN", address(0));

        console.log("Wire hub side on chain:", block.chainid);
        console.log("Base ShareOFT:       ", baseShareOft);
        console.log("Robinhood ShareOFT:", robinhoodShareOft);
        console.log("Robinhood EID:       ", robinhoodEid);

        vm.startBroadcast(privateKey);

        IOFTPeerConfig(baseShareOft).setPeer(robinhoodEid, bytes32(uint256(uint160(robinhoodShareOft))));

        if (registryAddr != address(0)) {
            require(creatorToken != address(0), "CREATOR_TOKEN required when REGISTRY is set");
            Registry4626(registryAddr).setRemoteOFTPeer(creatorToken, robinhoodEid, robinhoodShareOft);
        }

        vm.stopBroadcast();

        require(
            IOFTPeerConfig(baseShareOft).peers(robinhoodEid) == bytes32(uint256(uint160(robinhoodShareOft))),
            "Hub peer verification failed"
        );
        console.log("Hub peer wired.");
    }

    function _wireRemote(uint256 privateKey, address baseShareOft, address robinhoodShareOft) internal {
        uint32 hubEid = uint32(vm.envOr("HUB_EID", uint256(DEFAULT_HUB_EID)));

        console.log("Wire remote side on chain:", block.chainid);
        console.log("Robinhood ShareOFT:", robinhoodShareOft);
        console.log("Base ShareOFT:       ", baseShareOft);
        console.log("Hub EID:             ", hubEid);

        vm.startBroadcast(privateKey);

        IOFTPeerConfig(robinhoodShareOft).setPeer(hubEid, bytes32(uint256(uint160(baseShareOft))));

        vm.stopBroadcast();

        require(
            IOFTPeerConfig(robinhoodShareOft).peers(hubEid) == bytes32(uint256(uint160(baseShareOft))),
            "Remote peer verification failed"
        );
        console.log("Remote peer wired.");
    }

    function _eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
