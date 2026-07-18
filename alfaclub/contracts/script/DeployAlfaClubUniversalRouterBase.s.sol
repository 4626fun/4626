// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {RouterParameters} from "universal-router/types/RouterParameters.sol";
import {IAllowanceTransfer} from "../../../lib/universal-router/lib/permit2/src/interfaces/IAllowanceTransfer.sol";

import {LSSVMPairFactory} from "sudoswap/LSSVMPairFactory.sol";
import {ICurve} from "sudoswap/bonding-curves/ICurve.sol";
import {IERC1155} from "lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC1155/IERC1155.sol";

import {AlfaClubSudoswapAdapter} from "../../../contracts/other/alfaclub/universal-router/AlfaClubSudoswapAdapter.sol";
import {AlfaClubUniversalRouter} from "../../../contracts/other/alfaclub/universal-router/AlfaClubUniversalRouter.sol";

/**
 * @title DeployAlfaClubUniversalRouterBase
 * @notice Deploys the AlfaClub Sudoswap adapter and custom Universal Router on
 *         Base using two consecutive CREATE transactions from one EOA.
 * @dev The adapter stores the router as an immutable, while the router stores
 *      the adapter as an immutable. The script breaks that constructor cycle by
 *      predicting both addresses from the broadcaster's current EOA nonce.
 *
 *      Universal Router source pin:
 *      Uniswap/universal-router commit cb222d358a2ea780feedee6990ff8a3c185301bf.
 *      `baseRouterParameters()` exactly mirrors that pin's
 *      `script/deployParameters/DeployBase.s.sol`.
 *
 * Required environment variables:
 * - PRIVATE_KEY: deployment EOA private key.
 * - EXPECTED_DEPLOYER_NONCE: current Base nonce of the deployment EOA. The
 *   script rejects drift instead of silently changing either immutable address.
 * - ALFACLUB_MARKET_ADMIN_SAFE: final adapter market administrator.
 *
 * Optional environment variables:
 * - SUDOSWAP_PAIR_FACTORY: defaults to Sudoswap's official Base v2 factory.
 * - SUDOSWAP_XYK_CURVE: defaults to its factory-allowlisted Base XykCurve.
 *
 * Dry run (simulation only):
 * forge script script/DeployAlfaClubUniversalRouterBaseEntry.s.sol --rpc-url "$BASE_RPC_URL"
 *
 * Broadcast only after reviewing the dry run and predicted addresses:
 * forge script script/DeployAlfaClubUniversalRouterBaseEntry.s.sol --rpc-url "$BASE_RPC_URL" --broadcast
 *
 * Sudoswap owns the official Base factory. The adapter therefore supports the
 * pair's direct-call path and does not require a factory router allowlist.
 */
contract DeployAlfaClubUniversalRouterBase is Script {
    uint256 public constant BASE_CHAIN_ID = 8453;

    string public constant UNIVERSAL_ROUTER_SOURCE_COMMIT = "cb222d358a2ea780feedee6990ff8a3c185301bf";

    address public constant ALFA_CLUB_FRIEND_KEY = 0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F;
    address public constant OFFICIAL_BASE_SUDOSWAP_FACTORY = 0x605145D263482684590f630E9e581B21E4938eb8;
    address public constant OFFICIAL_BASE_SUDOSWAP_XYK_CURVE = 0xd0A2f4ae5E816ec09374c67F6532063B60dE037B;

    address public constant BASE_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address public constant BASE_WETH9 = 0x4200000000000000000000000000000000000006;
    address public constant BASE_V2_FACTORY = 0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6;
    address public constant BASE_V3_FACTORY = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD;
    bytes32 public constant BASE_V2_PAIR_INIT_CODE_HASH =
        0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f;
    bytes32 public constant BASE_V3_POOL_INIT_CODE_HASH =
        0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54;
    address public constant BASE_V4_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address public constant BASE_V3_NFT_POSITION_MANAGER = 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1;
    address public constant BASE_V4_POSITION_MANAGER = 0x7C5f5A4bBd8fD63184577525326123B519429bDc;
    address public constant BASE_SPOKE_POOL = 0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64;

    error RefusingNonBaseDeployment(uint256 chainId);
    error InvalidAddress(string field);
    error InvalidDependency(address dependency);
    error InvalidAdmin(address admin);
    error BondingCurveNotAllowed(address curve);
    error InvalidExpectedNonce(uint256 nonce);
    error UnexpectedDeployerNonce(uint256 actual, uint256 expected);
    error PredictedAddressOccupied(address predicted);
    error PostDeployInvariantFailed(string invariant);

    struct Deployment {
        AlfaClubSudoswapAdapter adapter;
        AlfaClubUniversalRouter router;
        address predictedAdapter;
        address predictedRouter;
    }

    struct DeployConfig {
        uint256 privateKey;
        uint256 expectedDeployerNonce;
        LSSVMPairFactory factory;
        ICurve xykCurve;
        address adapterOwner;
    }

    function run() external returns (Deployment memory deployment) {
        DeployConfig memory config = DeployConfig({
            privateKey: vm.envUint("PRIVATE_KEY"),
            expectedDeployerNonce: vm.envUint("EXPECTED_DEPLOYER_NONCE"),
            factory: LSSVMPairFactory(payable(vm.envOr("SUDOSWAP_PAIR_FACTORY", OFFICIAL_BASE_SUDOSWAP_FACTORY))),
            xykCurve: ICurve(vm.envOr("SUDOSWAP_XYK_CURVE", OFFICIAL_BASE_SUDOSWAP_XYK_CURVE)),
            adapterOwner: vm.envAddress("ALFACLUB_MARKET_ADMIN_SAFE")
        });
        deployment = _run(config);
    }

    /// @dev Typed deployment core shared with the deterministic lifecycle
    /// rehearsal. Production continues to enter through the env-backed `run()`.
    function _run(DeployConfig memory config) internal returns (Deployment memory deployment) {
        if (block.chainid != BASE_CHAIN_ID) revert RefusingNonBaseDeployment(block.chainid);

        address deployer = vm.addr(config.privateKey);
        if (deployer == address(0) || deployer.code.length != 0) revert InvalidAddress("deployer EOA");

        uint256 expectedNonceWord = config.expectedDeployerNonce;
        // Two transactions must increment the EOA nonce without crossing the
        // EIP-2681 uint64 account-nonce ceiling.
        if (expectedNonceWord > type(uint64).max - 2) revert InvalidExpectedNonce(expectedNonceWord);
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 expectedNonce = uint64(expectedNonceWord);
        uint64 currentNonce = vm.getNonce(deployer);
        if (currentNonce != expectedNonce) revert UnexpectedDeployerNonce(currentNonce, expectedNonce);

        RouterParameters memory parameters = baseRouterParameters();
        _validateDependencies(config.factory, config.xykCurve, config.adapterOwner, parameters);

        deployment.predictedAdapter = vm.computeCreateAddress(deployer, currentNonce);
        deployment.predictedRouter = vm.computeCreateAddress(deployer, uint256(currentNonce) + 1);
        if (deployment.predictedAdapter.code.length != 0) {
            revert PredictedAddressOccupied(deployment.predictedAdapter);
        }
        if (deployment.predictedRouter.code.length != 0) {
            revert PredictedAddressOccupied(deployment.predictedRouter);
        }

        console2.log("Chain ID", block.chainid);
        console2.log("Deployer", deployer);
        console2.log("Deployer nonce", currentNonce);
        console2.log("Adapter market admin", config.adapterOwner);
        console2.log("Predicted AlfaClubSudoswapAdapter", deployment.predictedAdapter);
        console2.log("Predicted AlfaClubUniversalRouter", deployment.predictedRouter);

        vm.startBroadcast(config.privateKey);

        deployment.adapter = new AlfaClubSudoswapAdapter(
            deployment.predictedRouter,
            config.adapterOwner,
            config.factory,
            IAllowanceTransfer(parameters.permit2),
            IERC1155(ALFA_CLUB_FRIEND_KEY),
            config.xykCurve
        );
        deployment.router = new AlfaClubUniversalRouter(parameters, address(deployment.adapter));

        vm.stopBroadcast();

        _validateDeployment(deployment, config.factory, config.xykCurve, config.adapterOwner);

        console2.log("AlfaClubSudoswapAdapter", address(deployment.adapter));
        console2.log("AlfaClubUniversalRouter", address(deployment.router));
    }

    /// @notice Pinned Base values from the vendored upstream deployment file.
    function baseRouterParameters() public pure returns (RouterParameters memory parameters) {
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
        LSSVMPairFactory factory,
        ICurve xykCurve,
        address adapterOwner,
        RouterParameters memory parameters
    ) internal view {
        if (address(factory) == address(0)) revert InvalidAddress("SUDOSWAP_PAIR_FACTORY");
        if (address(xykCurve) == address(0)) revert InvalidAddress("SUDOSWAP_XYK_CURVE");
        if (adapterOwner == address(0)) revert InvalidAddress("ALFACLUB_MARKET_ADMIN_SAFE");

        _requireCode(address(factory));
        _requireCode(address(xykCurve));
        _requireCode(ALFA_CLUB_FRIEND_KEY);
        _requireCode(parameters.permit2);
        _requireCode(parameters.weth9);
        _requireCode(parameters.v2Factory);
        _requireCode(parameters.v3Factory);
        _requireCode(parameters.v4PoolManager);
        _requireCode(parameters.v3NFTPositionManager);
        _requireCode(parameters.v4PositionManager);
        _requireCode(parameters.spokePool);

        // AlfaClub market administration is intentionally Safe-owned. Requiring
        // contract code prevents accidentally assigning the adapter to an EOA.
        if (adapterOwner.code.length == 0) revert InvalidAdmin(adapterOwner);
        if (!factory.bondingCurveAllowed(xykCurve)) revert BondingCurveNotAllowed(address(xykCurve));
    }

    function _validateDeployment(
        Deployment memory deployment,
        LSSVMPairFactory factory,
        ICurve xykCurve,
        address adapterOwner
    ) internal view {
        if (address(deployment.adapter) != deployment.predictedAdapter) {
            revert PostDeployInvariantFailed("adapter CREATE address");
        }
        if (address(deployment.router) != deployment.predictedRouter) {
            revert PostDeployInvariantFailed("router CREATE address");
        }
        if (deployment.adapter.universalRouter() != address(deployment.router)) {
            revert PostDeployInvariantFailed("adapter router immutable");
        }
        if (address(deployment.router.SUDOSWAP_ADAPTER()) != address(deployment.adapter)) {
            revert PostDeployInvariantFailed("router adapter immutable");
        }
        if (deployment.adapter.owner() != adapterOwner) {
            revert PostDeployInvariantFailed("adapter owner");
        }
        if (address(deployment.adapter.factory()) != address(factory)) {
            revert PostDeployInvariantFailed("Sudoswap factory immutable");
        }
        if (address(deployment.adapter.permit2()) != BASE_PERMIT2) {
            revert PostDeployInvariantFailed("Permit2 immutable");
        }
        if (address(deployment.adapter.friendKey()) != ALFA_CLUB_FRIEND_KEY) {
            revert PostDeployInvariantFailed("FriendKey immutable");
        }
        if (address(deployment.adapter.xykCurve()) != address(xykCurve)) {
            revert PostDeployInvariantFailed("XYK curve immutable");
        }
    }

    function _requireCode(address dependency) private view {
        if (dependency.code.length == 0) revert InvalidDependency(dependency);
    }
}
