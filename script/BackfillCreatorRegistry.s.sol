// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ICreatorRegistry} from "../contracts/interfaces/core/ICreatorRegistry.sol";

interface IERC20MetadataLike {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
}

/**
 * @notice Backfills a creator deployment into CreatorRegistry and reverse mappings.
 * @dev Idempotent: only writes when current registry value differs.
 *
 * Run (dry):
 *   forge script script/BackfillCreatorRegistry.s.sol:BackfillCreatorRegistry --rpc-url "$BASE_RPC_URL"
 *
 * Run (broadcast):
 *   forge script script/BackfillCreatorRegistry.s.sol:BackfillCreatorRegistry --rpc-url "$BASE_RPC_URL" --broadcast
 */
contract BackfillCreatorRegistry is Script {
    // Current Base defaults (can be overridden with env vars).
    address internal constant DEFAULT_REGISTRY = 0x888482d648D1fCa1A735268A9e579b44Bf644626;
    address internal constant DEFAULT_CREATOR_TOKEN = 0x5b674196812451B7cEC024FE9d22D2c0b172fa75;
    address internal constant DEFAULT_CREATOR_CANONICAL_WALLET = 0xAb6d5C10b03300326CD7fAb7267Ae192842967b5;
    address internal constant DEFAULT_VAULT = 0xD0785a6DF70F7f2486F3962869003c4C68F90532;
    address internal constant DEFAULT_WRAPPER = 0xe6A66eAF54986172DB9b0b5B9c11ebF1713b658d;
    address internal constant DEFAULT_SHARE_OFT = 0x26d2F164F17aAB0Acf47df9bEeeCc87729a74626;
    address internal constant DEFAULT_ORACLE = 0xbe4F31742Ec42cFC6e49E1043d2e452024f33962;
    address internal constant DEFAULT_GAUGE = 0x248B34121fB956eb52657348Ab62ae177F58BA84;

    function run() external {
        revert("BackfillCreatorRegistry retired: no legacy registry backfill path");

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        address registryAddr = vm.envOr("REGISTRY", DEFAULT_REGISTRY);
        address creatorToken = vm.envOr("CREATOR_TOKEN", DEFAULT_CREATOR_TOKEN);
        address creatorWallet = vm.envOr("CREATOR_WALLET", DEFAULT_CREATOR_CANONICAL_WALLET);
        address vault = vm.envOr("CREATOR_VAULT", DEFAULT_VAULT);
        address wrapper = vm.envOr("CREATOR_WRAPPER", DEFAULT_WRAPPER);
        address shareOFT = vm.envOr("CREATOR_SHARE_OFT", DEFAULT_SHARE_OFT);
        address oracle = vm.envOr("CREATOR_ORACLE", DEFAULT_ORACLE);
        address gauge = vm.envOr("CREATOR_GAUGE", DEFAULT_GAUGE);
        address pool = vm.envOr("CREATOR_POOL", address(0));
        uint24 poolFee = uint24(vm.envOr("CREATOR_POOL_FEE", uint256(0)));

        ICreatorRegistry registry = ICreatorRegistry(registryAddr);
        string memory tokenName = IERC20MetadataLike(creatorToken).name();
        string memory tokenSymbol = IERC20MetadataLike(creatorToken).symbol();

        console2.log("Registry:", registryAddr);
        console2.log("Broadcaster:", broadcaster);
        console2.log("Creator token:", creatorToken);
        console2.log("Creator wallet:", creatorWallet);
        console2.log("Vault:", vault);
        console2.log("Wrapper:", wrapper);
        console2.log("ShareOFT:", shareOFT);
        console2.log("Oracle:", oracle);
        console2.log("Gauge:", gauge);
        console2.log("Token name:", tokenName);
        console2.log("Token symbol:", tokenSymbol);

        vm.startBroadcast(pk);

        bool isRegistered = registry.isCreatorCoinRegistered(creatorToken);
        if (!isRegistered) {
            registry.registerCreatorCoin(creatorToken, tokenName, tokenSymbol, creatorWallet, pool, poolFee);
            console2.log("registerCreatorCoin: wrote");
        } else {
            console2.log("registerCreatorCoin: already registered");
        }

        ICreatorRegistry.CreatorCoinInfo memory info = registry.getCreatorCoin(creatorToken);

        if (info.vault != vault) {
            registry.setVault(creatorToken, vault);
            console2.log("setVault: wrote");
        } else {
            console2.log("setVault: already set");
        }

        if (info.wrapper != wrapper) {
            registry.setCreatorWrapper(creatorToken, wrapper);
            console2.log("setCreatorWrapper: wrote");
        } else {
            console2.log("setCreatorWrapper: already set");
        }

        if (info.shareOFT != shareOFT) {
            registry.setCreatorShareOFT(creatorToken, shareOFT);
            console2.log("setCreatorShareOFT: wrote");
        } else {
            console2.log("setCreatorShareOFT: already set");
        }

        if (info.oracle != oracle) {
            registry.setCreatorOracle(creatorToken, oracle);
            console2.log("setCreatorOracle: wrote");
        } else {
            console2.log("setCreatorOracle: already set");
        }

        if (info.gaugeController != gauge) {
            registry.setCreatorGaugeController(creatorToken, gauge);
            console2.log("setCreatorGaugeController: wrote");
        } else {
            console2.log("setCreatorGaugeController: already set");
        }

        if (info.canonicalWallet != creatorWallet) {
            registry.setCanonicalWallet(creatorToken, creatorWallet);
            console2.log("setCanonicalWallet: wrote");
        } else {
            console2.log("setCanonicalWallet: already set");
        }

        if (!info.isActive) {
            registry.setCreatorCoinStatus(creatorToken, true);
            console2.log("setCreatorCoinStatus(true): wrote");
        } else {
            console2.log("setCreatorCoinStatus(true): already active");
        }

        vm.stopBroadcast();
    }
}
