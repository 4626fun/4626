// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {FriendKeyOERC1155} from "@4626/omnichain/FriendKeyOERC1155.sol";
import {FriendKeyBuyExecutor} from "@4626/across/FriendKeyBuyExecutor.sol";
import {FriendKeySellExecutor} from "@4626/across/FriendKeySellExecutor.sol";
import {FriendKeySellSinkFactory} from "@4626/across/FriendKeySellSinkFactory.sol";
import {UniversalBytecodeStoreV2} from "@4626/shared/UniversalBytecodeStoreV2.sol";
import {UniversalCreate2DeployerFromStore} from "@4626/shared/UniversalCreate2DeployerFromStore.sol";

/**
 * @notice Deploy / wire multi-id FriendKeyOERC1155 via mesh CREATE2 deployer.
 *
 * Env:
 *   PRIVATE_KEY           must match OWNER
 *   OWNER                 default 0xB05C…
 *   WRAP_SALT             mined salt (optional vanity a1fa…1155)
 *   EXPECTED_WRAP         required predicted address
 *   SEED_BYTECODE         "1" to store creation code if missing
 *   SET_HUB               "1" on Base only → setHub + allowlist 1659 + Buy/Sell executors
 *   SPOKE_POOL_BASE       Across SpokePool (hub only)
 *   ALLOW_TOKEN_ID        default 1659
 *   TOKEN_URI / CONTRACT_URI  optional metadata URIs (hub+spoke; set on this chain)
 *   PEER_WRAP / PEER_EID  optional setPeer
 *
 * Constructor binds immutable underlying FriendKey (default 0xAF0B…FA9F) on every chain.
 */
contract DeployFriendKeyOERC1155 is Script {
    address constant DEFAULT_REGISTRY = 0x777968CB7F302f3d02C094b119a67DCA9E0b4626;
    address constant DEFAULT_OWNER = 0xB05Cf01231cF2fF99499682E64D3780d57c80FdD;
    address constant DEFAULT_STORE = 0x75FA60e7e01CACda736952E9AC8D5c30B61F117E;
    address constant DEFAULT_DEPLOYER = 0x7E3898Eb0Aee0DCAC5C0ccCd88ab94575f48a2D6;
    address constant DEFAULT_FRIEND_KEY = 0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F;
    address constant DEFAULT_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant DEFAULT_USDG_RH = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    uint32 constant DEFAULT_RH_EID = 30416;
    uint256 constant DEFAULT_ALLOW_ID = 1659;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("OWNER", DEFAULT_OWNER);
        require(vm.addr(pk) == owner, "PRIVATE_KEY must match OWNER");

        address registry = vm.envOr("FRIENDKEY_REGISTRY", DEFAULT_REGISTRY);
        address friendKey = vm.envOr("FRIEND_KEY", DEFAULT_FRIEND_KEY);
        address storeAddr = vm.envOr("BYTECODE_STORE", DEFAULT_STORE);
        address deployerAddr = vm.envOr("CREATE2_DEPLOYER", DEFAULT_DEPLOYER);
        bytes32 salt = vm.envBytes32("WRAP_SALT");
        address expectedWrap = vm.envAddress("EXPECTED_WRAP");
        bool setHub = vm.envOr("SET_HUB", uint256(0)) == 1;
        bool seedBytecode = vm.envOr("SEED_BYTECODE", uint256(0)) == 1;
        uint256 allowId = vm.envOr("ALLOW_TOKEN_ID", DEFAULT_ALLOW_ID);

        bytes memory creation = vm.getCode("out/FriendKeyOERC1155.sol/FriendKeyOERC1155.json");
        bytes memory args = abi.encode(registry, owner, friendKey);
        bytes32 codeId = keccak256(creation);
        bytes32 initHash = keccak256(bytes.concat(creation, args));

        UniversalBytecodeStoreV2 store = UniversalBytecodeStoreV2(storeAddr);
        UniversalCreate2DeployerFromStore deployer = UniversalCreate2DeployerFromStore(deployerAddr);
        address predicted = deployer.computeAddress(salt, initHash);

        require(predicted == expectedWrap, "wrap address mismatch");

        console2.log("codeId", vm.toString(codeId));
        console2.log("initCodeHash", vm.toString(initHash));
        console2.log("underlying", friendKey);
        console2.log("predicted wrap", predicted);

        vm.startBroadcast(pk);

        if (store.pointers(codeId) == address(0)) {
            require(seedBytecode, "wrap bytecode missing from store; set SEED_BYTECODE=1");
            store.store(creation);
            console2.log("Seeded FriendKeyOERC1155 bytecode");
        }

        FriendKeyOERC1155 wrap;
        if (predicted.code.length == 0) {
            address deployed = deployer.deploy(salt, codeId, args);
            require(deployed == predicted, "deploy mismatch");
            wrap = FriendKeyOERC1155(deployed);
            console2.log("Deployed FriendKeyOERC1155", deployed);
        } else {
            wrap = FriendKeyOERC1155(predicted);
            console2.log("Wrap already live", predicted);
        }

        require(wrap.underlying() == friendKey, "underlying mismatch");

        if (!wrap.tokenAllowed(allowId)) {
            wrap.setTokenAllowed(allowId, true);
            console2.log("allowlisted tokenId", allowId);
        }

        if (vm.envExists("TOKEN_URI")) {
            wrap.setURI(vm.envString("TOKEN_URI"));
            console2.log("token URI set");
        }
        if (vm.envExists("CONTRACT_URI")) {
            wrap.setContractURI(vm.envString("CONTRACT_URI"));
            console2.log("contract URI set");
        }

        if (setHub) {
            if (!wrap.isHub()) {
                wrap.setHub();
                console2.log("hub configured");
            }

            address spokePool = vm.envAddress("SPOKE_POOL_BASE");
            address usdc = vm.envOr("USDC_BASE", DEFAULT_USDC);
            address usdg = vm.envOr("USDG_ROBINHOOD", DEFAULT_USDG_RH);
            uint32 rhEid = uint32(vm.envOr("ROBINHOOD_EID", uint256(DEFAULT_RH_EID)));

            FriendKeyBuyExecutor buyExecutor =
                new FriendKeyBuyExecutor(spokePool, usdc, friendKey, address(wrap), rhEid, owner, bytes(""));
            console2.log("FriendKeyBuyExecutor", address(buyExecutor));

            FriendKeySellExecutor sellExecutor =
                new FriendKeySellExecutor(spokePool, usdc, usdg, friendKey, address(wrap), owner);
            FriendKeySellSinkFactory factory = new FriendKeySellSinkFactory(address(sellExecutor));
            sellExecutor.setSinkFactory(address(factory));
            console2.log("FriendKeySellExecutor", address(sellExecutor));
            console2.log("FriendKeySellSinkFactory", address(factory));
            console2.log("Prefund BuyExecutor with Base ETH for LZ fees");
        }

        if (vm.envExists("PEER_WRAP")) {
            wrap.setPeer(uint32(vm.envUint("PEER_EID")), bytes32(uint256(uint160(vm.envAddress("PEER_WRAP")))));
            console2.log("peer set");
        }

        vm.stopBroadcast();
    }
}
