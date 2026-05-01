// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {AlfaCreatorKeyLPFactory} from "../../contracts/alfaclub/AlfaCreatorKeyLPFactory.sol";

/**
 * @title DeployAlfaCreatorKeyLPFactory
 * @notice Deploys `AlfaCreatorKeyLPFactory` for the AlfaClub sudoswap-style
 *         ERC1155 key / ERC20 creator-coin secondary-market LP launcher.
 *
 * @dev    Required env vars:
 *         - PRIVATE_KEY:        deployer key (hex, with or without 0x prefix)
 *         - FACTORY_OWNER:      address that should own the factory after
 *                               deployment. Owns allowlist gates
 *                               (`setPoolCreatorAllowed`, `setPairAllowed`).
 *
 * @dev    Optional env vars:
 *         - ALLOW_NON_BASE:     set to "1" to allow deployment on chains
 *                               other than Base mainnet (8453) or Base
 *                               Sepolia (84532). The factory hardcodes the
 *                               Base mainnet AlfaClub FriendKey address; on
 *                               other chains the friendKey reference will
 *                               point at an EOA / nothing and pool creation
 *                               will revert. Default behavior is to revert
 *                               so we don't ship a brick-deploy.
 *
 * @dev    Why this script does not take a friendKey argument: the factory
 *         hardcodes `BASE_ALFA_CLUB_FRIEND_KEY = 0xAF0Bf8...FA9F` as an
 *         immutable constant. Changing the FriendKey target requires a
 *         contract change, not a deploy-time flag.
 *
 * @dev    Base Sepolia caveat: the factory will deploy successfully, but
 *         `createPoolWithInitialLiquidity` will revert until a contract
 *         lives at `BASE_ALFA_CLUB_FRIEND_KEY` on that chain. For testnet
 *         end-to-end flows, deploy a stub FriendKey at the same address
 *         (CREATE2 at the canonical 0xAF0B...FA9F is not feasible) or
 *         change the constant in a forked contract before deploying.
 *
 * @dev    Usage (Base Sepolia, dry run):
 *         FACTORY_OWNER=0xYourOwner \
 *         forge script script/alfaclub/DeployAlfaCreatorKeyLPFactory.s.sol:DeployAlfaCreatorKeyLPFactory \
 *             --rpc-url https://sepolia.base.org \
 *             -vvvv
 *
 * @dev    Usage (Base Sepolia, broadcast):
 *         PRIVATE_KEY=0x... \
 *         FACTORY_OWNER=0xYourOwner \
 *         forge script script/alfaclub/DeployAlfaCreatorKeyLPFactory.s.sol:DeployAlfaCreatorKeyLPFactory \
 *             --rpc-url https://sepolia.base.org \
 *             --broadcast \
 *             --verify \
 *             -vvvv
 *
 * @dev    Post-deploy:
 *         1. Set `VITE_ALFA_CREATOR_KEY_LP_FACTORY=<deployed address>` in
 *            the frontend env (or update `BASE_DEFAULTS.alfaCreatorKeyLpFactory`
 *            in `frontend/src/config/contracts.defaults.ts` for the canonical
 *            mainnet deploy).
 *         2. Have the factory owner allowlist permitted pool creators via
 *            `setPoolCreatorAllowed(account, true)`.
 *         3. Allowlist each (creatorCoin, tokenId) pair via
 *            `setPairAllowed(creatorCoin, tokenId, true)`.
 */
contract DeployAlfaCreatorKeyLPFactory is Script {
    uint256 internal constant CHAIN_ID_BASE = 8453;
    uint256 internal constant CHAIN_ID_BASE_SEPOLIA = 84532;

    function run() external returns (AlfaCreatorKeyLPFactory factory) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        address factoryOwner = vm.envAddress("FACTORY_OWNER");
        require(factoryOwner != address(0), "FACTORY_OWNER not set");

        bool allowNonBase = vm.envOr("ALLOW_NON_BASE", uint256(0)) == 1;
        if (
            block.chainid != CHAIN_ID_BASE
                && block.chainid != CHAIN_ID_BASE_SEPOLIA
                && !allowNonBase
        ) {
            revert(
                "Refusing to deploy off Base mainnet (8453) / Base Sepolia (84532). Set ALLOW_NON_BASE=1 to override."
            );
        }

        console.log("Chain ID:        ", block.chainid);
        console.log("Deployer:        ", deployer);
        console.log("Factory owner:   ", factoryOwner);

        vm.startBroadcast(privateKey);
        factory = new AlfaCreatorKeyLPFactory(factoryOwner);
        vm.stopBroadcast();

        console.log("AlfaCreatorKeyLPFactory:", address(factory));
        console.log("  friendKey (immutable):", factory.friendKey());
        console.log("  TRADING_FEE_BPS:      ", factory.TRADING_FEE_BPS());
        console.log("  SOCIAL_FEE_BPS:       ", factory.SOCIAL_FEE_BPS());

        // Post-broadcast invariants. These are cheap and catch the most
        // common deploy regressions (wrong owner, wrong friendKey wiring).
        require(factory.owner() == factoryOwner, "post-deploy: owner mismatch");
        require(
            factory.friendKey() == factory.BASE_ALFA_CLUB_FRIEND_KEY(),
            "post-deploy: friendKey mismatch"
        );

        if (block.chainid == CHAIN_ID_BASE_SEPOLIA) {
            console.log(
                "NOTE: factory.friendKey() points at the Base mainnet FriendKey address."
            );
            console.log(
                "      `createPoolWithInitialLiquidity` will revert on Sepolia until a"
            );
            console.log(
                "      compatible IAlfaFriendKey contract exists at that address."
            );
        }
    }
}
