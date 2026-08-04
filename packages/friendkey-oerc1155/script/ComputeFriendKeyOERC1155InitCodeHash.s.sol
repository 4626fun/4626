// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {FriendKeyOERC1155} from "@4626/omnichain/FriendKeyOERC1155.sol";

/**
 * @notice Print CREATE2 initCodeHash for FriendKeyOERC1155 vanity grind.
 *
 *   forge script script/ComputeFriendKeyOERC1155InitCodeHash.s.sol -vv
 */
contract ComputeFriendKeyOERC1155InitCodeHash is Script {
    address constant REGISTRY = 0x777968CB7F302f3d02C094b119a67DCA9E0b4626;
    address constant OWNER = 0xB05Cf01231cF2fF99499682E64D3780d57c80FdD;
    address constant FRIEND_KEY = 0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F;
    address constant CREATE2_DEPLOYER = 0x7E3898Eb0Aee0DCAC5C0ccCd88ab94575f48a2D6;

    function run() external view {
        bytes memory creation = type(FriendKeyOERC1155).creationCode;
        bytes memory args = abi.encode(REGISTRY, OWNER, FRIEND_KEY);
        bytes32 codeId = keccak256(creation);
        bytes32 initHash = keccak256(bytes.concat(creation, args));

        console2.log("CREATE2_DEPLOYER", CREATE2_DEPLOYER);
        console2.log("REGISTRY", REGISTRY);
        console2.log("OWNER", OWNER);
        console2.log("UNDERLYING_FRIEND_KEY", FRIEND_KEY);
        console2.log("codeId");
        console2.logBytes32(codeId);
        console2.log("initCodeHash");
        console2.logBytes32(initHash);
        console2.log("grind (optional vanity a1fa...1155):");
        console2.log("cast create2 --starts-with a1fa --ends-with 1155 \\");
        console2.log("  --deployer 0x7E3898Eb0Aee0DCAC5C0ccCd88ab94575f48a2D6 \\");
        console2.log("  --init-code-hash");
        console2.logBytes32(initHash);
    }
}
