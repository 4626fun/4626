// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../interfaces/uniswap/IUniswapV3Factory.sol";
import "../../interfaces/uniswap/IUniswapV3Pool.sol";
import {
    ICreatorCharmStrategyFactory,
    IAjnaERC4626StrategyFactory,
    CreatorCharmStrategyFactory,
    AjnaERC4626StrategyFactory
} from "./StrategyDeploymentFactories.sol";

/**
 * @notice Charm Finance Alpha Vault Factory
 * @dev Base: 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa
 *      Vaults created via this factory appear on alpha.charm.fi UI
 */
interface ICharmFactory {
    struct VaultParams {
        address pool;
        address manager;
        uint24 managerFee;
        address rebalanceDelegate;
        uint256 maxTotalSupply;
        int24 baseThreshold;
        int24 limitThreshold;
        uint24 fullRangeWeight;
        uint32 period;
        int24 minTickMove;
        int24 maxTwapDeviation;
        uint32 twapDuration;
        string name;
        string symbol;
    }

    function createVault(VaultParams calldata params) external returns (address vault);
    function governance() external view returns (address);
}

interface ICharmVaultManager {
    function manager() external view returns (address);
}

/**
 * @title StrategyDeploymentBatcher
 * @author 0xakita.eth
 * @notice Batches deployment and wiring of 4626 strategies.
 * @dev Used by AA deployment flows to create pools, vaults, and adapters.
 */
contract StrategyDeploymentBatcher is ReentrancyGuard {
    // Base Network Constants
    address public constant V3_FACTORY = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD;
    address public constant UNISWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;

    /// @notice Charm Finance Alpha Vault Factory on Base
    /// @dev Vaults created via this factory appear on alpha.charm.fi UI
    address public constant CHARM_FACTORY = 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa;
    /// @notice Pinned Charm governance allowlist on Base. Strategy deploys fail closed outside this set.
    address public constant CHARM_FACTORY_GOVERNANCE = 0x424cdd9021AF88A86C76b245e24583f9a71e32a1;
    address public constant CHARM_FACTORY_GOVERNANCE_LEGACY = 0x94D85f9E8707fd8955D36173Ee48138E972609c6;
    address public immutable creatorCharmStrategyFactory;
    address public immutable ajnaStrategyFactory;
    address public immutable protocolOwner;
    bytes4 private constant ADD_STRATEGY_SELECTOR = bytes4(keccak256("addStrategy(address,uint256)"));

    error InvalidOwnerAddress();
    error InvalidVaultName();
    error InvalidVaultSymbol();
    error ZeroUnderlying();
    error ZeroQuote();
    error ZeroVault();
    error NotProtocolOwner();
    error CharmFactoryGovernanceMismatch(address expected, address actual);
    error CharmVaultManagerMismatch(address expected, address actual);

    modifier onlyProtocolOwner() {
        if (msg.sender != protocolOwner) revert NotProtocolOwner();
        _;
    }

    constructor() {
        protocolOwner = msg.sender;
        creatorCharmStrategyFactory = address(new CreatorCharmStrategyFactory());
        ajnaStrategyFactory = address(new AjnaERC4626StrategyFactory());
    }

    struct DeploymentResult {
        address charmVault;
        address charmStrategy;
        address creatorCharmStrategy;
        address ajnaVaultAuth;
        address ajnaVault;
        address ajnaStrategy;
        address v3Pool;
    }

    event StrategiesDeployed(address indexed creator, address indexed underlyingToken, DeploymentResult result);

    /**
     * @notice Deploy all strategies for a creator vault (FULLY AUTOMATED)
     * @param underlyingToken The creator token (e.g., CREATOR)
     * @param quoteToken The quote token for LP (e.g., USDC - 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
     * @param creatorVault The vault that will use these strategies
     * @param _ajnaFactory The Ajna ERC20Pool factory address (if using Ajna)
     * @param v3FeeTier The Uniswap V3 fee tier (e.g., 3000 for 0.3%)
     * @param initialSqrtPriceX96 Initial price for V3 pool (e.g., for 99/1 CREATOR/USDC)
     * @param owner The creator coin owner who will own all strategies (typically the creator)
     * @param vaultName Standard name for the Charm vault (e.g., "4626: akita/USDC")
     * @param vaultSymbol Standard symbol for the Charm vault (e.g., "CV-akita-USDC")
     * @return result All deployed contract addresses
     *
     * @dev This function is FULLY AUTOMATED:
     * - Deploys CharmAlphaVault, sets strategy, and transfers ownership atomically
     * - Calls rebalance() automatically after deployment
     * - No manual acceptance needed!
     * - Owner gets immediate control of all contracts
     */
    function batchDeployStrategies(
        address underlyingToken,
        address quoteToken,
        address creatorVault,
        address _ajnaFactory,
        uint24 v3FeeTier,
        uint160 initialSqrtPriceX96,
        address owner,
        string memory vaultName,
        string memory vaultSymbol
    ) external nonReentrant onlyProtocolOwner returns (DeploymentResult memory result) {
        if (owner == address(0)) revert InvalidOwnerAddress();
        if (bytes(vaultName).length == 0) revert InvalidVaultName();
        if (bytes(vaultSymbol).length == 0) revert InvalidVaultSymbol();
        if (underlyingToken == address(0)) revert ZeroUnderlying();
        if (quoteToken == address(0)) revert ZeroQuote();
        if (creatorVault == address(0)) revert ZeroVault();

        // ═══════════════════════════════════════════════════════════
        // STEP 1: Create or Get V3 Pool
        // ═══════════════════════════════════════════════════════════
        IUniswapV3Factory factory = IUniswapV3Factory(V3_FACTORY);
        result.v3Pool = factory.getPool(underlyingToken, quoteToken, v3FeeTier);

        if (result.v3Pool == address(0)) {
            // Create pool if it doesn't exist
            result.v3Pool = factory.createPool(underlyingToken, quoteToken, v3FeeTier);

            // Initialize pool
            IUniswapV3Pool(result.v3Pool).initialize(initialSqrtPriceX96);
        }

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Deploy Charm Alpha Vault via Charm Factory (shows on alpha.charm.fi UI)
        // ═══════════════════════════════════════════════════════════
        _enforceCharmFactoryGovernance();
        // NOTE: Using Charm's official factory ensures vault appears on their UI
        // Parameters: manager=owner can rebalance, baseThreshold=3000 ticks,
        //             limitThreshold=6000 ticks, fullRangeWeight=0 (no full range), period=1800s (30min)
        result.charmVault = ICharmFactory(CHARM_FACTORY).createVault(
            ICharmFactory.VaultParams({
                pool: result.v3Pool,
                manager: owner, // manager (can call rebalance)
                managerFee: 0,
                rebalanceDelegate: address(0),
                maxTotalSupply: type(uint256).max, // maxTotalSupply (unlimited)
                baseThreshold: 3000, // baseThreshold (ticks)
                limitThreshold: 6000, // limitThreshold (ticks)
                fullRangeWeight: 0, // fullRangeWeight (0 = no full range position)
                period: 1800, // period (30 minutes between rebalances)
                minTickMove: int24(0),
                maxTwapDeviation: int24(0),
                twapDuration: 60,
                name: vaultName,
                symbol: vaultSymbol
            })
        );
        _enforceCharmVaultManager(result.charmVault, owner);

        // ═══════════════════════════════════════════════════════════
        // STEP 3: No separate initialization needed - factory handles it
        // ═══════════════════════════════════════════════════════════
        // Charm's factory creates a fully initialized vault with owner as manager
        result.charmStrategy = address(0);

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Deploy Creator Charm Strategy V2 (Vault Integration)
        // ═══════════════════════════════════════════════════════════
        result.creatorCharmStrategy = ICreatorCharmStrategyFactory(creatorCharmStrategyFactory)
            .deployAndInitialize(
                creatorVault, underlyingToken, quoteToken, UNISWAP_ROUTER, result.charmVault, result.v3Pool, owner
            );

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Deploy Ajna Strategy (if factory provided)
        // ═══════════════════════════════════════════════════════════
        if (_ajnaFactory != address(0)) {
            string memory ajnaVaultName = string.concat("Ajna ", vaultName);
            string memory ajnaVaultSymbol = string.concat("A-", vaultSymbol);
            (result.ajnaStrategy, result.ajnaVault, result.ajnaVaultAuth) = IAjnaERC4626StrategyFactory(
                ajnaStrategyFactory
            ).deploy(
                creatorVault,
                underlyingToken,
                _ajnaFactory,
                quoteToken,
                owner,
                ajnaVaultName,
                ajnaVaultSymbol,
                1_000,
                4_156,
                owner
            );
        }

        emit StrategiesDeployed(msg.sender, underlyingToken, result);
    }

    /**
     * @notice Helper to encode vault.addStrategy() calls for AA
     * @dev Returns calldata for batched execution
     */
    function encodeAddStrategyBatch(
        address,
        /* vault */
        DeploymentResult memory result,
        uint256 charmWeightBps, // e.g., 6900 for 69.00%
        uint256 ajnaWeightBps // e.g., 2139 for 21.39%
    ) external pure returns (bytes[] memory calls) {
        uint256 numCalls = result.ajnaStrategy != address(0) ? 2 : 1;
        calls = new bytes[](numCalls);

        // Charm strategy
        calls[0] = abi.encodeWithSelector(ADD_STRATEGY_SELECTOR, result.creatorCharmStrategy, charmWeightBps);

        // Ajna strategy (if exists)
        if (result.ajnaStrategy != address(0)) {
            calls[1] = abi.encodeWithSelector(ADD_STRATEGY_SELECTOR, result.ajnaStrategy, ajnaWeightBps);
        }
    }

    function _enforceCharmFactoryGovernance() internal view {
        try ICharmFactory(CHARM_FACTORY).governance() returns (address governance) {
            if (!_isAllowedCharmFactoryGovernance(governance)) {
                revert CharmFactoryGovernanceMismatch(CHARM_FACTORY_GOVERNANCE, governance);
            }
        } catch {
            revert CharmFactoryGovernanceMismatch(CHARM_FACTORY_GOVERNANCE, address(0));
        }
    }

    function _enforceCharmVaultManager(address charmVault, address expectedManager) internal view {
        try ICharmVaultManager(charmVault).manager() returns (address manager) {
            if (manager != expectedManager) {
                revert CharmVaultManagerMismatch(expectedManager, manager);
            }
        } catch {
            revert CharmVaultManagerMismatch(expectedManager, address(0));
        }
    }

    function _isAllowedCharmFactoryGovernance(address governance) internal pure returns (bool) {
        return governance == CHARM_FACTORY_GOVERNANCE || governance == CHARM_FACTORY_GOVERNANCE_LEGACY;
    }
}
