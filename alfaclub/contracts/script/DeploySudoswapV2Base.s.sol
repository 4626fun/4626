// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {LSSVMPairFactory} from "sudoswap/LSSVMPairFactory.sol";
import {ILSSVMPairFactoryLike} from "sudoswap/ILSSVMPairFactoryLike.sol";
import {LSSVMRouter} from "sudoswap/LSSVMRouter.sol";
import {RoyaltyEngine} from "sudoswap/RoyaltyEngine.sol";
import {VeryFastRouter} from "sudoswap/VeryFastRouter.sol";
import {XykCurve} from "sudoswap/bonding-curves/XykCurve.sol";
import {LSSVMPairERC1155ERC20} from "sudoswap/erc1155/LSSVMPairERC1155ERC20.sol";
import {LSSVMPairERC1155ETH} from "sudoswap/erc1155/LSSVMPairERC1155ETH.sol";
import {LSSVMPairERC721ERC20} from "sudoswap/erc721/LSSVMPairERC721ERC20.sol";
import {LSSVMPairERC721ETH} from "sudoswap/erc721/LSSVMPairERC721ETH.sol";

/**
 * @title DeploySudoswapV2Base
 * @notice Deploys an unmodified Sudoswap v2 stack only for isolated rehearsals.
 * @dev Source pin: sudoswap/lssvm2@1b18945b6c8f3e74052ffae0385bd2640d167e81.
 *      Sudoswap already operates v2 on Base. Production must reuse the official
 *      factory and curves below; this script refuses to deploy a duplicate when
 *      the official factory is present. It remains as a local lifecycle harness.
 *
 * Required environment variables:
 * - PRIVATE_KEY: deployer private key.
 * - FACTORY_OWNER: final owner of the official LSSVMPairFactory.
 *
 * Optional environment variables:
 * - PROTOCOL_FEE_RECIPIENT: defaults to FACTORY_OWNER.
 * - PROTOCOL_FEE_MULTIPLIER: 18-decimal percentage; defaults to zero.
 * - ALLOW_NON_BASE: set to 1 only for local deployment-script testing.
 */
contract DeploySudoswapV2Base is Script {
    uint256 internal constant BASE_CHAIN_ID = 8453;

    address public constant OFFICIAL_BASE_FACTORY = 0x605145D263482684590f630E9e581B21E4938eb8;
    address public constant OFFICIAL_BASE_XYK_CURVE = 0xd0A2f4ae5E816ec09374c67F6532063B60dE037B;
    address public constant OFFICIAL_BASE_VERY_FAST_ROUTER = 0xa07eBD56b361Fe79AF706A2bF6d8097091225548;

    // Manifold Royalty Registry proxy on Base mainnet.
    address public constant BASE_MANIFOLD_ROYALTY_REGISTRY = 0x3D1151dc590ebF5C04501a7d4E1f8921546774eA;

    error InvalidAddress(string field);
    error RefusingNonBaseDeployment(uint256 chainId);
    error OfficialBaseDeploymentAlreadyExists(address factory);
    error PostDeployInvariantFailed(string invariant);

    struct DeployConfig {
        uint256 privateKey;
        address factoryOwner;
        address payable protocolFeeRecipient;
        uint256 protocolFeeMultiplier;
        bool allowNonBase;
    }

    function run()
        external
        returns (
            RoyaltyEngine royaltyEngine,
            LSSVMPairFactory factory,
            XykCurve xykCurve,
            VeryFastRouter veryFastRouter
        )
    {
        address factoryOwner = vm.envAddress("FACTORY_OWNER");
        DeployConfig memory config = DeployConfig({
            privateKey: vm.envUint("PRIVATE_KEY"),
            factoryOwner: factoryOwner,
            protocolFeeRecipient: payable(vm.envOr("PROTOCOL_FEE_RECIPIENT", factoryOwner)),
            protocolFeeMultiplier: vm.envOr("PROTOCOL_FEE_MULTIPLIER", uint256(0)),
            allowNonBase: vm.envOr("ALLOW_NON_BASE", uint256(0)) == 1
        });
        if (block.chainid == BASE_CHAIN_ID && OFFICIAL_BASE_FACTORY.code.length != 0) {
            revert OfficialBaseDeploymentAlreadyExists(OFFICIAL_BASE_FACTORY);
        }
        return _run(config);
    }

    /// @dev Typed deployment core shared with the deterministic lifecycle
    /// rehearsal. Production continues to enter through the env-backed `run()`.
    function _run(DeployConfig memory config)
        internal
        returns (
            RoyaltyEngine royaltyEngine,
            LSSVMPairFactory factory,
            XykCurve xykCurve,
            VeryFastRouter veryFastRouter
        )
    {
        address deployer = vm.addr(config.privateKey);

        if (config.factoryOwner == address(0)) revert InvalidAddress("FACTORY_OWNER");
        if (config.protocolFeeRecipient == address(0)) revert InvalidAddress("PROTOCOL_FEE_RECIPIENT");
        if (block.chainid != BASE_CHAIN_ID && !config.allowNonBase) {
            revert RefusingNonBaseDeployment(block.chainid);
        }
        if (deployer.code.length != 0) revert InvalidAddress("deployer EOA");
        // Production factory administration must start on a contract wallet,
        // not an EOA that would have to be migrated after deployment.
        if (config.factoryOwner.code.length == 0) revert InvalidAddress("FACTORY_OWNER code");
        if (block.chainid == BASE_CHAIN_ID && BASE_MANIFOLD_ROYALTY_REGISTRY.code.length == 0) {
            revert InvalidAddress("Base Manifold Royalty Registry code");
        }

        console2.log("Chain ID", block.chainid);
        console2.log("Deployer", deployer);
        console2.log("Factory owner", config.factoryOwner);
        console2.log("Protocol fee recipient", config.protocolFeeRecipient);
        console2.log("Protocol fee multiplier", config.protocolFeeMultiplier);

        vm.startBroadcast(config.privateKey);

        royaltyEngine = new RoyaltyEngine(BASE_MANIFOLD_ROYALTY_REGISTRY);

        LSSVMPairERC721ETH erc721ETHTemplate = new LSSVMPairERC721ETH(royaltyEngine);
        LSSVMPairERC721ERC20 erc721ERC20Template = new LSSVMPairERC721ERC20(royaltyEngine);
        LSSVMPairERC1155ETH erc1155ETHTemplate = new LSSVMPairERC1155ETH(royaltyEngine);
        LSSVMPairERC1155ERC20 erc1155ERC20Template = new LSSVMPairERC1155ERC20(royaltyEngine);

        factory = new LSSVMPairFactory(
            erc721ETHTemplate,
            erc721ERC20Template,
            erc1155ETHTemplate,
            erc1155ERC20Template,
            config.protocolFeeRecipient,
            config.protocolFeeMultiplier,
            deployer
        );

        xykCurve = new XykCurve();
        veryFastRouter = new VeryFastRouter(factory);

        factory.setBondingCurveAllowed(xykCurve, true);
        factory.setRouterAllowed(LSSVMRouter(payable(address(veryFastRouter))), true);
        factory.transferOwnership(config.factoryOwner);

        vm.stopBroadcast();

        _validateDeployment(
            royaltyEngine,
            factory,
            xykCurve,
            veryFastRouter,
            config.factoryOwner,
            config.protocolFeeRecipient,
            config.protocolFeeMultiplier
        );

        console2.log("RoyaltyEngine", address(royaltyEngine));
        console2.log("LSSVMPairERC721ETH template", address(erc721ETHTemplate));
        console2.log("LSSVMPairERC721ERC20 template", address(erc721ERC20Template));
        console2.log("LSSVMPairERC1155ETH template", address(erc1155ETHTemplate));
        console2.log("LSSVMPairERC1155ERC20 template", address(erc1155ERC20Template));
        console2.log("LSSVMPairFactory", address(factory));
        console2.log("XykCurve", address(xykCurve));
        console2.log("VeryFastRouter", address(veryFastRouter));
    }

    function _validateDeployment(
        RoyaltyEngine royaltyEngine,
        LSSVMPairFactory factory,
        XykCurve xykCurve,
        VeryFastRouter veryFastRouter,
        address expectedOwner,
        address expectedFeeRecipient,
        uint256 expectedFeeMultiplier
    ) internal view {
        if (royaltyEngine.ROYALTY_REGISTRY() != BASE_MANIFOLD_ROYALTY_REGISTRY) {
            revert PostDeployInvariantFailed("royalty registry");
        }
        if (
            address(factory.erc721ETHTemplate()).code.length == 0
                || address(factory.erc721ERC20Template()).code.length == 0
                || address(factory.erc1155ETHTemplate()).code.length == 0
                || address(factory.erc1155ERC20Template()).code.length == 0
        ) {
            revert PostDeployInvariantFailed("pair template code");
        }
        if (
            factory.erc721ETHTemplate().pairVariant() != ILSSVMPairFactoryLike.PairVariant.ERC721_ETH
                || factory.erc721ERC20Template().pairVariant() != ILSSVMPairFactoryLike.PairVariant.ERC721_ERC20
                || factory.erc1155ETHTemplate().pairVariant() != ILSSVMPairFactoryLike.PairVariant.ERC1155_ETH
                || factory.erc1155ERC20Template().pairVariant() != ILSSVMPairFactoryLike.PairVariant.ERC1155_ERC20
        ) {
            revert PostDeployInvariantFailed("pair template variants");
        }
        if (
            address(factory.erc721ETHTemplate().ROYALTY_ENGINE()) != address(royaltyEngine)
                || address(factory.erc721ERC20Template().ROYALTY_ENGINE()) != address(royaltyEngine)
                || address(factory.erc1155ETHTemplate().ROYALTY_ENGINE()) != address(royaltyEngine)
                || address(factory.erc1155ERC20Template().ROYALTY_ENGINE()) != address(royaltyEngine)
        ) {
            revert PostDeployInvariantFailed("pair template royalty engine");
        }
        if (factory.owner() != expectedOwner) revert PostDeployInvariantFailed("factory owner");
        if (factory.protocolFeeRecipient() != expectedFeeRecipient) {
            revert PostDeployInvariantFailed("protocol fee recipient");
        }
        if (factory.protocolFeeMultiplier() != expectedFeeMultiplier) {
            revert PostDeployInvariantFailed("protocol fee multiplier");
        }
        if (!factory.bondingCurveAllowed(xykCurve)) {
            revert PostDeployInvariantFailed("XYK curve allowlist");
        }
        (bool routerAllowed, bool routerWasEverTouched) =
            factory.routerStatus(LSSVMRouter(payable(address(veryFastRouter))));
        if (!routerAllowed || !routerWasEverTouched) {
            revert PostDeployInvariantFailed("VeryFastRouter allowlist");
        }
        if (address(veryFastRouter.factory()) != address(factory)) {
            revert PostDeployInvariantFailed("VeryFastRouter factory");
        }
    }
}
