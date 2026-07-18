// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

interface ISudoswapFactoryDeploymentView {
    function bondingCurveAllowed(address curve) external view returns (bool);
}

interface IAlfaClubSudoswapAdapterDeploymentView {
    function universalRouter() external view returns (address);
    function owner() external view returns (address);
    function factory() external view returns (address);
    function permit2() external view returns (address);
    function friendKey() external view returns (address);
    function xykCurve() external view returns (address);
}

interface IAlfaClubUniversalRouterDeploymentView {
    function SUDOSWAP_ADAPTER() external view returns (address);
}

/**
 * @title DeployAlfaClubUniversalRouterBaseEntry
 * @notice Production Foundry entry point for the AlfaClub adapter and custom
 *         Universal Router deployment on Base.
 * @dev The router uses a size-specific compiler profile. Importing it into this
 *      script would place the script in that additional compiler profile, which
 *      Forge cannot execute as a script artifact. Instead, this entry point
 *      loads the already-compiled creation bytecode from `out/`, appends the
 *      exact constructor arguments, and broadcasts the same two CREATEs as the
 *      typed deployment core covered by integration tests.
 */
contract DeployAlfaClubUniversalRouterBaseEntry is Script {
    uint256 private constant BASE_CHAIN_ID = 8453;

    address private constant ALFA_CLUB_FRIEND_KEY = 0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F;
    address private constant OFFICIAL_BASE_SUDOSWAP_FACTORY = 0x605145D263482684590f630E9e581B21E4938eb8;
    address private constant OFFICIAL_BASE_SUDOSWAP_XYK_CURVE = 0xd0A2f4ae5E816ec09374c67F6532063B60dE037B;

    address private constant BASE_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address private constant BASE_WETH9 = 0x4200000000000000000000000000000000000006;
    address private constant BASE_V2_FACTORY = 0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6;
    address private constant BASE_V3_FACTORY = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD;
    bytes32 private constant BASE_V2_PAIR_INIT_CODE_HASH =
        0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f;
    bytes32 private constant BASE_V3_POOL_INIT_CODE_HASH =
        0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54;
    address private constant BASE_V4_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address private constant BASE_V3_NFT_POSITION_MANAGER = 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1;
    address private constant BASE_V4_POSITION_MANAGER = 0x7C5f5A4bBd8fD63184577525326123B519429bDc;
    address private constant BASE_SPOKE_POOL = 0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64;

    string private constant ADAPTER_ARTIFACT = "out/AlfaClubSudoswapAdapter.sol/AlfaClubSudoswapAdapter.json";
    string private constant ROUTER_ARTIFACT = "out/AlfaClubUniversalRouter.sol/AlfaClubUniversalRouter.json";
    bytes32 private constant ADAPTER_CREATION_CODEHASH =
        0xd354131131860f88f2d9db41c372fb791beb5ad3908e6bfcc5c08b13ede703aa;
    bytes32 private constant ROUTER_CREATION_CODEHASH =
        0xad1cf7eb67843cee6feddb65bfb3ca6bd3ee2de416cfcffa1cf2783e419ed5f1;

    error RefusingNonBaseDeployment(uint256 chainId);
    error InvalidAddress(string field);
    error InvalidDependency(address dependency);
    error InvalidAdmin(address admin);
    error BondingCurveNotAllowed(address curve);
    error InvalidExpectedNonce(uint256 nonce);
    error UnexpectedDeployerNonce(uint256 actual, uint256 expected);
    error PredictedAddressOccupied(address predicted);
    error EmptyArtifact(string artifact);
    error UnexpectedArtifactHash(string artifact, bytes32 actual, bytes32 expected);
    error DeploymentFailed(string contractName);
    error PostDeployInvariantFailed(string invariant);

    struct RouterParameters {
        address permit2;
        address weth9;
        address v2Factory;
        address v3Factory;
        bytes32 pairInitCodeHash;
        bytes32 poolInitCodeHash;
        address v4PoolManager;
        address permissionsAdapterFactory;
        address v3NFTPositionManager;
        address v4PositionManager;
        address spokePool;
    }

    struct Deployment {
        address adapter;
        address router;
        address predictedAdapter;
        address predictedRouter;
    }

    function run() external returns (Deployment memory deployment) {
        if (block.chainid != BASE_CHAIN_ID) revert RefusingNonBaseDeployment(block.chainid);

        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        uint256 expectedNonceWord = vm.envUint("EXPECTED_DEPLOYER_NONCE");
        address factory = vm.envOr("SUDOSWAP_PAIR_FACTORY", OFFICIAL_BASE_SUDOSWAP_FACTORY);
        address xykCurve = vm.envOr("SUDOSWAP_XYK_CURVE", OFFICIAL_BASE_SUDOSWAP_XYK_CURVE);
        address adapterOwner = vm.envAddress("ALFACLUB_MARKET_ADMIN_SAFE");
        address deployer = vm.addr(privateKey);

        if (deployer == address(0) || deployer.code.length != 0) revert InvalidAddress("deployer EOA");
        if (expectedNonceWord > type(uint64).max - 2) revert InvalidExpectedNonce(expectedNonceWord);
        uint64 currentNonce = vm.getNonce(deployer);
        if (currentNonce != expectedNonceWord) {
            revert UnexpectedDeployerNonce(currentNonce, expectedNonceWord);
        }

        RouterParameters memory parameters = _baseRouterParameters();
        _validateDependencies(factory, xykCurve, adapterOwner, parameters);

        deployment.predictedAdapter = vm.computeCreateAddress(deployer, currentNonce);
        deployment.predictedRouter = vm.computeCreateAddress(deployer, uint256(currentNonce) + 1);
        if (deployment.predictedAdapter.code.length != 0) {
            revert PredictedAddressOccupied(deployment.predictedAdapter);
        }
        if (deployment.predictedRouter.code.length != 0) {
            revert PredictedAddressOccupied(deployment.predictedRouter);
        }

        bytes memory adapterCreationCode = vm.getCode(ADAPTER_ARTIFACT);
        bytes memory routerCreationCode = vm.getCode(ROUTER_ARTIFACT);
        if (adapterCreationCode.length == 0) revert EmptyArtifact(ADAPTER_ARTIFACT);
        if (routerCreationCode.length == 0) revert EmptyArtifact(ROUTER_ARTIFACT);
        _requireArtifactHash(ADAPTER_ARTIFACT, adapterCreationCode, ADAPTER_CREATION_CODEHASH);
        _requireArtifactHash(ROUTER_ARTIFACT, routerCreationCode, ROUTER_CREATION_CODEHASH);

        console2.log("Chain ID", block.chainid);
        console2.log("Deployer", deployer);
        console2.log("Deployer nonce", currentNonce);
        console2.log("Adapter market admin", adapterOwner);
        console2.log("Predicted AlfaClubSudoswapAdapter", deployment.predictedAdapter);
        console2.log("Predicted AlfaClubUniversalRouter", deployment.predictedRouter);

        vm.startBroadcast(privateKey);
        deployment.adapter = _create(
            bytes.concat(
                adapterCreationCode,
                abi.encode(
                    deployment.predictedRouter, adapterOwner, factory, BASE_PERMIT2, ALFA_CLUB_FRIEND_KEY, xykCurve
                )
            ),
            "AlfaClubSudoswapAdapter"
        );
        deployment.router = _create(
            bytes.concat(routerCreationCode, abi.encode(parameters, deployment.adapter)), "AlfaClubUniversalRouter"
        );
        vm.stopBroadcast();

        _validateDeployment(deployment, factory, xykCurve, adapterOwner);

        console2.log("AlfaClubSudoswapAdapter", deployment.adapter);
        console2.log("AlfaClubUniversalRouter", deployment.router);
    }

    function _baseRouterParameters() private pure returns (RouterParameters memory parameters) {
        parameters = RouterParameters({
            permit2: BASE_PERMIT2,
            weth9: BASE_WETH9,
            v2Factory: BASE_V2_FACTORY,
            v3Factory: BASE_V3_FACTORY,
            pairInitCodeHash: BASE_V2_PAIR_INIT_CODE_HASH,
            poolInitCodeHash: BASE_V3_POOL_INIT_CODE_HASH,
            v4PoolManager: BASE_V4_POOL_MANAGER,
            permissionsAdapterFactory: address(0),
            v3NFTPositionManager: BASE_V3_NFT_POSITION_MANAGER,
            v4PositionManager: BASE_V4_POSITION_MANAGER,
            spokePool: BASE_SPOKE_POOL
        });
    }

    function _validateDependencies(
        address factory,
        address xykCurve,
        address adapterOwner,
        RouterParameters memory parameters
    ) private view {
        if (factory == address(0)) revert InvalidAddress("SUDOSWAP_PAIR_FACTORY");
        if (xykCurve == address(0)) revert InvalidAddress("SUDOSWAP_XYK_CURVE");
        if (adapterOwner == address(0)) revert InvalidAddress("ALFACLUB_MARKET_ADMIN_SAFE");

        _requireCode(factory);
        _requireCode(xykCurve);
        _requireCode(ALFA_CLUB_FRIEND_KEY);
        _requireCode(parameters.permit2);
        _requireCode(parameters.weth9);
        _requireCode(parameters.v2Factory);
        _requireCode(parameters.v3Factory);
        _requireCode(parameters.v4PoolManager);
        _requireCode(parameters.v3NFTPositionManager);
        _requireCode(parameters.v4PositionManager);
        _requireCode(parameters.spokePool);

        if (adapterOwner.code.length == 0) revert InvalidAdmin(adapterOwner);
        if (!ISudoswapFactoryDeploymentView(factory).bondingCurveAllowed(xykCurve)) {
            revert BondingCurveNotAllowed(xykCurve);
        }
    }

    function _validateDeployment(Deployment memory deployment, address factory, address xykCurve, address adapterOwner)
        private
        view
    {
        if (deployment.adapter != deployment.predictedAdapter) {
            revert PostDeployInvariantFailed("adapter CREATE address");
        }
        if (deployment.router != deployment.predictedRouter) {
            revert PostDeployInvariantFailed("router CREATE address");
        }

        IAlfaClubSudoswapAdapterDeploymentView adapter = IAlfaClubSudoswapAdapterDeploymentView(deployment.adapter);
        IAlfaClubUniversalRouterDeploymentView router = IAlfaClubUniversalRouterDeploymentView(deployment.router);
        if (adapter.universalRouter() != deployment.router) {
            revert PostDeployInvariantFailed("adapter router immutable");
        }
        if (router.SUDOSWAP_ADAPTER() != deployment.adapter) {
            revert PostDeployInvariantFailed("router adapter immutable");
        }
        if (adapter.owner() != adapterOwner) revert PostDeployInvariantFailed("adapter owner");
        if (adapter.factory() != factory) revert PostDeployInvariantFailed("Sudoswap factory immutable");
        if (adapter.permit2() != BASE_PERMIT2) revert PostDeployInvariantFailed("Permit2 immutable");
        if (adapter.friendKey() != ALFA_CLUB_FRIEND_KEY) revert PostDeployInvariantFailed("FriendKey immutable");
        if (adapter.xykCurve() != xykCurve) revert PostDeployInvariantFailed("XYK curve immutable");
    }

    function _create(bytes memory initCode, string memory contractName) private returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create(0, add(initCode, 0x20), mload(initCode))
        }
        if (deployed == address(0)) revert DeploymentFailed(contractName);
    }

    function _requireArtifactHash(string memory artifact, bytes memory creationCode, bytes32 expected) private pure {
        bytes32 actual = keccak256(creationCode);
        if (actual != expected) revert UnexpectedArtifactHash(artifact, actual, expected);
    }

    function _requireCode(address dependency) private view {
        if (dependency.code.length == 0) revert InvalidDependency(dependency);
    }
}
