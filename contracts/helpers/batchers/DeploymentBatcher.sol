// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

import {ICreatorRegistry} from "../../interfaces/core/ICreatorRegistry.sol";
import {ICreatorGaugeController} from "../../interfaces/core/ICreatorGaugeController.sol";
import {ICreatorOVault} from "../../interfaces/core/ICreatorOVault.sol";
import {IAjnaPoolFactory} from "../../interfaces/IAjnaPool.sol";
import {IBaseSolanaBridge} from "../../interfaces/IBaseSolanaBridge.sol";
import {CreatorLinearVesting} from "../../utilities/vesting/CreatorLinearVesting.sol";
import {IOFT, SendParam, MessagingFee, OFTReceipt} from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

interface IUniversalCreate2DeployerFromStore {
    function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr);
    function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address);
}

interface IApprovedV4HooksRegistryAdmin {
    function setHookApproval(address hook, bool approved) external;
    function transferOwnership(address newOwner) external;
}

interface IUniV4ConfigurableStrategy {
    function configurePool(address _poolManager, address _positionManager, address _permit2, PoolKey calldata _poolKey)
        external;
    function transferOwnership(address newOwner) external;
}

contract DeploymentBatcherPhase3Helper {
    uint24 internal constant V3_FEE_TIER = 3000;
    // Charm managerFee uses 1e6 precision (100% = 1_000_000).
    uint24 internal constant CHARM_MANAGER_FEE_PIPS = 160_000; // 16%
    uint24 internal constant CHARM_DEFAULT_PROTOCOL_FEE_PIPS = 10_000; // 1%
    int24 internal constant CHARM_MIN_TICK_MOVE = 10;
    int24 internal constant CHARM_MAX_TWAP_DEVIATION = 500;
    uint32 internal constant CHARM_TWAP_DURATION = 300;
    // 125% min collateral ratio for Charm→Ajna borrow backstop (matches integration tests).
    uint256 internal constant CHARM_AJNA_MIN_COLLATERAL_RATIO_BPS = 12_500;

    address internal constant CHARM_FACTORY = 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa;
    address internal constant CHARM_FACTORY_GOVERNANCE = 0x424cdd9021AF88A86C76b245e24583f9a71e32a1;
    address internal constant CHARM_FACTORY_GOVERNANCE_LEGACY = 0x94D85f9E8707fd8955D36173Ee48138E972609c6;

    error NotBatcher();
    error NotOwner();
    error InvalidCodeId();
    error Phase3ManagementMismatch(address expected, address actual);
    error MissingInitialSqrtPriceX96();
    error V3PoolMissing();
    error CharmFactoryGovernanceMismatch(address expected, address actual);
    error CharmFactoryProtocolFeeMismatch(uint256 expected, uint256 actual);
    error CharmVaultManagerMismatch(address expected, address actual);
    error Phase3HelperLostAdmin();
    error MissingCreatorOracleForSynergy();
    error ZeroAddress();
    error InvalidWeight();

    IUniversalCreate2DeployerFromStore public immutable create2Deployer;
    address public immutable protocolTreasury;
    address public immutable protocolAutomation;
    address public immutable usdc;
    address public immutable uniswapV3Factory;
    address public immutable uniswapRouter;
    address public immutable ajnaFactory;
    address public immutable batcher;

    constructor(
        address _create2Deployer,
        address _protocolTreasury,
        address _protocolAutomation,
        address _usdc,
        address _uniswapV3Factory,
        address _uniswapRouter,
        address _ajnaFactory,
        address _batcher
    ) {
        // FIX: L-02 (4626-350) — CHARM_FACTORY / CHARM_FACTORY_GOVERNANCE
        // addresses above are hardcoded Base-mainnet values; deploying this
        // helper on any other chain would silently call into a non-existent
        // contract (or, worse, an attacker-controlled address if the same
        // slot happens to be occupied). Refuse to deploy anywhere except
        // Base mainnet (chainid 8453) so the invariant is enforced at
        // construction time rather than at first use.
        require(block.chainid == 8453, "Phase3Helper: Base only");
        create2Deployer = IUniversalCreate2DeployerFromStore(_create2Deployer);
        protocolTreasury = _protocolTreasury;
        if (_protocolAutomation == address(0)) revert ZeroAddress();
        protocolAutomation = _protocolAutomation;
        usdc = _usdc;
        uniswapV3Factory = _uniswapV3Factory;
        uniswapRouter = _uniswapRouter;
        ajnaFactory = _ajnaFactory;
        if (_batcher == address(0)) revert ZeroAddress();
        batcher = _batcher;
    }

    function deployPhase3Strategies(
        DeploymentBatcher.Phase3Params calldata params,
        DeploymentBatcher.StrategyCodeIds calldata codeIds,
        bytes32 baseSalt
    ) external returns (DeploymentBatcher.Phase3Result memory out) {
        if (msg.sender != batcher) revert NotBatcher();
        if (params.creatorToken == address(0) || params.owner == address(0) || params.vault == address(0)) {
            revert ZeroAddress();
        }
        if (IOwnableView(params.vault).owner() != params.owner) revert NotOwner();
        if (ICreatorOVaultManagementView(params.vault).management() != batcher) {
            revert Phase3ManagementMismatch(batcher, ICreatorOVaultManagementView(params.vault).management());
        }
        if (params.solanaWeightBps != 0) revert InvalidWeight();
        if (params.charmWeightBps > 10_000 || params.ajnaWeightBps > 10_000) revert InvalidWeight();
        uint256 totalProductiveWeight = params.charmWeightBps + params.ajnaWeightBps;
        if (totalProductiveWeight == 0 || totalProductiveWeight > 10_000) revert InvalidWeight();
        if (params.charmWeightBps != 0) {
            if (codeIds.charmAlphaVaultDeploy == bytes32(0) || codeIds.creatorCharmStrategy == bytes32(0)) {
                revert InvalidCodeId();
            }
        }
        if (params.ajnaWeightBps != 0) {
            if (
                codeIds.ajnaVaultAuth == bytes32(0) || codeIds.ajnaVault == bytes32(0)
                    || codeIds.erc4626StrategyAdapter == bytes32(0)
            ) {
                revert InvalidCodeId();
            }
        }

        address v3Pool = IUniswapV3Factory(uniswapV3Factory).getPool(params.creatorToken, usdc, V3_FEE_TIER);
        if (v3Pool == address(0)) {
            if (params.initialSqrtPriceX96 == 0) revert MissingInitialSqrtPriceX96();
            v3Pool = IUniswapV3Factory(uniswapV3Factory).createPool(params.creatorToken, usdc, V3_FEE_TIER);
            if (v3Pool == address(0)) revert V3PoolMissing();
            IUniswapV3Pool(v3Pool).initialize(params.initialSqrtPriceX96);
        }
        out.v3Pool = v3Pool;

        bool wireCharmAjnaSynergy = params.charmWeightBps != 0 && params.ajnaWeightBps != 0;
        address ajnaPool = address(0);
        if (wireCharmAjnaSynergy || params.ajnaWeightBps != 0) {
            ajnaPool = _resolveAjnaPool(params.creatorToken);
        }

        // Charm active LP is an OPT-IN strategy gated behind the
        // `charm_active_lp` creator-feature activation ($100 USDC, enforced
        // off-chain by the deploy session). If the creator did not pay,
        // the outer batcher passes `charmWeightBps == 0` and we skip the
        // entire Charm pipeline (no factory call, no strategy deploy, no
        // addStrategy on the vault). Return zero addresses so downstream
        // callers can detect the skip. See docs/operations/creator-strategy-features.md.
        if (params.charmWeightBps != 0) {
            (out.charmVault, out.charmStrategy) =
                _deployCharmPipeline(params, codeIds, baseSalt, v3Pool, wireCharmAjnaSynergy);
        }

        // Ajna lending sleeve is an OPT-IN strategy gated behind the
        // `ajna_sleeve` creator-feature activation. Same skip pattern
        // as Charm above.
        if (params.ajnaWeightBps != 0) {
            bytes32 ajnaAuthSalt = _saltFor(baseSalt, "ajnaVaultAuth");
            out.ajnaVaultAuth =
                create2Deployer.deploy(ajnaAuthSalt, codeIds.ajnaVaultAuth, abi.encode(address(this)));

            if (params.ajnaBufferRatioBps != 0) {
                IAjnaVaultAuthConfigurator(out.ajnaVaultAuth).setBufferRatio(params.ajnaBufferRatioBps);
            }
            if (params.ajnaMinBucketIndex != 0) {
                IAjnaVaultAuthConfigurator(out.ajnaVaultAuth).setMinBucketIndex(params.ajnaMinBucketIndex);
            }
            if (params.ajnaKeeper != address(0)) {
                IAjnaVaultAuthConfigurator(out.ajnaVaultAuth).setKeeper(params.ajnaKeeper, true);
            }

            bytes32 ajnaVaultSalt = _saltFor(baseSalt, "ajnaVault");
            bytes memory ajnaVaultArgs = abi.encode(
                ajnaPool, params.creatorToken, params.ajnaVaultName, params.ajnaVaultSymbol, out.ajnaVaultAuth
            );
            out.ajnaVault = create2Deployer.deploy(ajnaVaultSalt, codeIds.ajnaVault, ajnaVaultArgs);

            bytes32 ajnaSalt = _saltFor(baseSalt, "ajnaStrategyAdapter");
            bytes memory ajnaArgs = abi.encode(params.vault, out.ajnaVault, address(this));
            out.ajnaStrategy = create2Deployer.deploy(ajnaSalt, codeIds.erc4626StrategyAdapter, ajnaArgs);
            IERC4626StrategyAdapterAdmin(out.ajnaStrategy).setIdleBufferBps(0);
            IAjnaVaultAuthConfigurator(out.ajnaVaultAuth).setSwapper(out.ajnaStrategy);
            IOwnableTransfer(out.ajnaStrategy).transferOwnership(protocolTreasury);
            // FIX: F-21 — verify this helper is still admin before transferring, to fail explicitly
            // instead of silently leaving auth locked to this helper address
            if (!IAjnaVaultAuthConfigurator(out.ajnaVaultAuth).isAdmin(address(this))) revert Phase3HelperLostAdmin();
            // Protocol automation Safe operates Ajna (setMinBucketIndex); treasury keeps adapter ownership only.
            IAjnaVaultAuthConfigurator(out.ajnaVaultAuth).transferAdmin(protocolAutomation);
        }

        if (wireCharmAjnaSynergy) {
            address oracle = _resolveCreatorOracle(params.creatorToken);
            if (oracle == address(0)) revert MissingCreatorOracleForSynergy();
            _wireCharmAjnaSynergy(out.charmStrategy, ajnaPool, oracle);
            IOwnableTransfer(out.charmStrategy).transferOwnership(protocolTreasury);
        }

        // SolanaBridgeStrategy Phase-3 lane removed for greenfield deploys.
        // Solana share liquidity is seeded via the 30% ShareOFT auto-bridge at
        // finalizePhase2 instead of a Phase-3 SolanaBridgeStrategy allocation.
        if (params.solanaWeightBps != 0) revert InvalidWeight();
    }

    function _resolveAjnaPool(address creatorToken) internal returns (address ajnaPool) {
        bytes32 subsetHash = IAjnaPoolFactory(ajnaFactory).ERC20_NON_SUBSET_HASH();
        ajnaPool = IAjnaPoolFactory(ajnaFactory).deployedPools(subsetHash, usdc, creatorToken);
        if (ajnaPool == address(0)) {
            uint256 ajnaInterestRate = 5e16;
            uint256 minRate = IAjnaPoolFactory(ajnaFactory).MIN_RATE();
            uint256 maxRate = IAjnaPoolFactory(ajnaFactory).MAX_RATE();
            if (ajnaInterestRate < minRate) ajnaInterestRate = minRate;
            if (ajnaInterestRate > maxRate) ajnaInterestRate = maxRate;
            ajnaPool = IAjnaPoolFactory(ajnaFactory).deployPool(usdc, creatorToken, ajnaInterestRate);
        }
    }

    function _resolveCreatorOracle(address creatorToken) internal view returns (address oracle) {
        address reg = IDeploymentBatcherRegistryAccess(batcher).registry();
        oracle = ICreatorRegistry(reg).getCreatorCoin(creatorToken).oracle;
    }

    function _wireCharmAjnaSynergy(address charmStrategy, address ajnaPool, address oracle) internal {
        ICreatorCharmStrategy(charmStrategy).setCreatorOracle(oracle);
        ICreatorCharmStrategy(charmStrategy).setAjnaPool(ajnaPool);
        ICreatorCharmStrategy(charmStrategy).setAjnaBorrowConfig(
            true, type(uint256).max, type(uint256).max, CHARM_AJNA_MIN_COLLATERAL_RATIO_BPS, 0, 0
        );
    }

    function _deployCharmPipeline(
        DeploymentBatcher.Phase3Params calldata params,
        DeploymentBatcher.StrategyCodeIds calldata codeIds,
        bytes32 baseSalt,
        address v3Pool,
        bool deferOwnershipTransfer
    ) internal returns (address charmVault, address charmStrategy) {
        _enforceCharmFactoryGovernance(params.expectedCharmProtocolFeePips);
        charmVault = ICharmFactory(CHARM_FACTORY)
            .createVault(
                ICharmFactory.VaultParams({
                    pool: v3Pool,
                    manager: protocolAutomation,
                    managerFee: CHARM_MANAGER_FEE_PIPS,
                    rebalanceDelegate: params.owner,
                    maxTotalSupply: type(uint256).max,
                    baseThreshold: 3000,
                    limitThreshold: 6000,
                    fullRangeWeight: 0,
                    period: 1800,
                    minTickMove: CHARM_MIN_TICK_MOVE,
                    maxTwapDeviation: CHARM_MAX_TWAP_DEVIATION,
                    twapDuration: CHARM_TWAP_DURATION,
                    name: params.charmVaultName,
                    symbol: params.charmVaultSymbol
                })
            );
        _enforceCharmVaultManager(charmVault, protocolAutomation);

        bytes32 charmStratSalt = _saltFor(baseSalt, "charmStrategyV3");
        bytes memory charmStratArgs =
            abi.encode(params.vault, params.creatorToken, usdc, uniswapRouter, charmVault, v3Pool, address(this));
        charmStrategy = create2Deployer.deploy(charmStratSalt, codeIds.creatorCharmStrategy, charmStratArgs);
        ICreatorCharmStrategy(charmStrategy).initializeApprovals();
        if (!deferOwnershipTransfer) {
            IOwnableTransfer(charmStrategy).transferOwnership(protocolTreasury);
        }
    }

    function _saltFor(bytes32 baseSalt, string memory label) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(baseSalt, label));
    }

    function _enforceCharmFactoryGovernance(uint24 expectedProtocolFeePipsConfig) internal view {
        try ICharmFactory(CHARM_FACTORY).governance() returns (address governance) {
            if (!_isAllowedCharmFactoryGovernance(governance)) {
                revert CharmFactoryGovernanceMismatch(CHARM_FACTORY_GOVERNANCE, governance);
            }
        } catch {
            revert CharmFactoryGovernanceMismatch(CHARM_FACTORY_GOVERNANCE, address(0));
        }

        uint24 expectedProtocolFeePips =
            expectedProtocolFeePipsConfig == 0 ? CHARM_DEFAULT_PROTOCOL_FEE_PIPS : expectedProtocolFeePipsConfig;
        try ICharmFactory(CHARM_FACTORY).protocolFee() returns (uint24 protocolFeePips) {
            if (protocolFeePips != expectedProtocolFeePips) {
                revert CharmFactoryProtocolFeeMismatch(expectedProtocolFeePips, protocolFeePips);
            }
        } catch {
            revert CharmFactoryProtocolFeeMismatch(expectedProtocolFeePips, type(uint256).max);
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

contract DeploymentBatcherUniV4Helper {
    error NotBatcher();
    error NotOwner();
    error InvalidCodeId();
    error ZeroAddress();
    error InvalidTickSpacing();
    error InvalidPoolCurrencies();

    IUniversalCreate2DeployerFromStore public immutable create2Deployer;
    address public immutable poolManager;
    address public immutable permit2;
    address public immutable batcher;

    constructor(address _create2Deployer, address _poolManager, address _permit2, address _batcher) {
        create2Deployer = IUniversalCreate2DeployerFromStore(_create2Deployer);
        poolManager = _poolManager;
        permit2 = _permit2;
        if (_batcher == address(0)) revert ZeroAddress();
        batcher = _batcher;
    }

    function deployUniV4Strategies(
        DeploymentBatcher.UniV4DeployParams calldata params,
        DeploymentBatcher.UniV4CodeIds calldata codeIds,
        bytes32 baseSalt
    ) external returns (DeploymentBatcher.UniV4DeploymentResult memory out) {
        if (msg.sender != batcher) revert NotBatcher();
        if (
            params.creatorToken == address(0) || params.pairedToken == address(0) || params.vault == address(0)
                || params.owner == address(0) || params.positionManager == address(0) || params.poolHook == address(0)
                || params.registryOwner == address(0)
        ) {
            revert ZeroAddress();
        }
        if (params.tickSpacing == 0) revert InvalidTickSpacing();
        if (params.creatorToken == params.pairedToken) revert InvalidPoolCurrencies();
        if (IOwnableView(params.vault).owner() != params.owner) revert NotOwner();
        if (
            codeIds.approvedV4HooksRegistry == bytes32(0) || codeIds.fullRangeStrategy == bytes32(0)
                || codeIds.concentratedStrategy == bytes32(0) || codeIds.limitOrderStrategy == bytes32(0)
                || codeIds.creatorLPManager == bytes32(0)
        ) {
            revert InvalidCodeId();
        }

        bytes32 registrySalt = _saltFor(baseSalt, "univ4HookRegistry");
        out.hookRegistry = create2Deployer.deploy(
            registrySalt, codeIds.approvedV4HooksRegistry, abi.encode(address(this))
        );

        uint256 hooksLength = params.hooksToApprove.length;
        for (uint256 i = 0; i < hooksLength; i++) {
            IApprovedV4HooksRegistryAdmin(out.hookRegistry).setHookApproval(params.hooksToApprove[i], true);
        }
        IApprovedV4HooksRegistryAdmin(out.hookRegistry).setHookApproval(params.poolHook, true);

        bytes32 managerSalt = _saltFor(baseSalt, "univ4CreatorLPManager");
        out.creatorLPManager = create2Deployer.deploy(
            managerSalt,
            codeIds.creatorLPManager,
            abi.encode(
                params.creatorToken,
                params.pairedToken,
                params.vault,
                address(this),
                out.hookRegistry
            )
        );

        bytes32 fullRangeSalt = _saltFor(baseSalt, "univ4FullRangeStrategy");
        out.fullRangeStrategy = create2Deployer.deploy(
            fullRangeSalt,
            codeIds.fullRangeStrategy,
            abi.encode(
                params.creatorToken,
                params.pairedToken,
                out.creatorLPManager,
                address(this),
                out.hookRegistry
            )
        );

        bytes32 concentratedSalt = _saltFor(baseSalt, "univ4ConcentratedStrategy");
        out.concentratedStrategy = create2Deployer.deploy(
            concentratedSalt,
            codeIds.concentratedStrategy,
            abi.encode(
                params.creatorToken,
                params.pairedToken,
                out.creatorLPManager,
                address(this),
                out.hookRegistry
            )
        );

        bytes32 limitOrderSalt = _saltFor(baseSalt, "univ4LimitOrderStrategy");
        out.limitOrderStrategy = create2Deployer.deploy(
            limitOrderSalt,
            codeIds.limitOrderStrategy,
            abi.encode(
                params.creatorToken,
                params.pairedToken,
                out.creatorLPManager,
                address(this),
                out.hookRegistry
            )
        );

        PoolKey memory poolKey = PoolKey({
            currency0: params.creatorIsCurrency0 ? Currency.wrap(params.creatorToken) : Currency.wrap(params.pairedToken),
            currency1: params.creatorIsCurrency0 ? Currency.wrap(params.pairedToken) : Currency.wrap(params.creatorToken),
            fee: params.fee,
            tickSpacing: params.tickSpacing,
            hooks: IHooks(params.poolHook)
        });

        IUniV4ConfigurableStrategy(out.fullRangeStrategy).configurePool(
            poolManager, params.positionManager, permit2, poolKey
        );
        IUniV4ConfigurableStrategy(out.concentratedStrategy).configurePool(
            poolManager, params.positionManager, permit2, poolKey
        );
        IUniV4ConfigurableStrategy(out.limitOrderStrategy).configurePool(
            poolManager, params.positionManager, permit2, poolKey
        );
        IUniV4ConfigurableStrategy(out.creatorLPManager).configurePool(
            poolManager, params.positionManager, permit2, poolKey
        );

        IUniV4ConfigurableStrategy(out.fullRangeStrategy).transferOwnership(params.owner);
        IUniV4ConfigurableStrategy(out.concentratedStrategy).transferOwnership(params.owner);
        IUniV4ConfigurableStrategy(out.limitOrderStrategy).transferOwnership(params.owner);
        IUniV4ConfigurableStrategy(out.creatorLPManager).transferOwnership(params.owner);
        IApprovedV4HooksRegistryAdmin(out.hookRegistry).transferOwnership(params.registryOwner);
    }

    function _saltFor(bytes32 baseSalt, string memory label) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(baseSalt, label));
    }
}

contract DeploymentBatcherUtilsHelper {
    function toLower(string calldata input) external pure returns (string memory) {
        bytes memory b = bytes(input);
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 65 && c <= 90) {
                b[i] = bytes1(c + 32);
            }
        }
        return string(b);
    }

    function toUpper(string calldata input) external pure returns (string memory) {
        bytes memory b = bytes(input);
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 97 && c <= 122) {
                b[i] = bytes1(c - 32);
            }
        }
        return string(b);
    }

    function deriveBaseSalt(address creatorToken, address owner, uint256 chainId, string calldata version)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(creatorToken, owner, chainId, "4626:deploy:", version));
    }

    function saltFor(bytes32 baseSalt, string calldata label) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(baseSalt, label));
    }

    function deriveShareOftSalt(address owner, string calldata shareSymbolLower, string calldata version)
        external
        pure
        returns (bytes32)
    {
        bytes32 base = keccak256(abi.encodePacked(owner, shareSymbolLower));
        return keccak256(abi.encodePacked(base, "CreatorShareOFT:", version));
    }

    function phase1ParamsHash(
        address creatorToken,
        address owner,
        string calldata vaultName,
        string calldata vaultSymbol,
        string calldata shareName,
        string calldata shareSymbol,
        string calldata version
    ) external pure returns (bytes32) {
        return keccak256(
            abi.encode(creatorToken, owner, vaultName, vaultSymbol, shareName, shareSymbol, version)
        );
    }

    function phase1CodeIdsHash(bytes32 vault, bytes32 wrapper, bytes32 shareOFT, bytes32 oftBootstrap)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(vault, wrapper, shareOFT, oftBootstrap));
    }
}

interface IUniversalBytecodeStore {
    function get(bytes32 codeId) external view returns (bytes memory);
}

interface ICreatorOVaultWrapper {
    function setShareOFT(address _shareOFT) external;
    function deposit(uint256 amount) external returns (uint256 shareTokens);
    function wrap(uint256 amount) external returns (uint256 shareTokens);
    function transferOwnership(address newOwner) external;
}

interface ICreatorShareOFT {
    function setRegistry(address _registry) external;
    function setVault(address _vault) external;
    function setMinter(address minter, bool status) external;
    function setGaugeController(address _controller) external;
    function setHubConfig(bool _isHub, uint32 _hubEid, address _hubGaugeReceiver) external;
    function transferOwnership(address newOwner) external;
}

interface ICCALaunchStrategy {
    function setApprovedLauncher(address launcher, bool approved) external;
    function setOracleConfig(address _oracle, address _poolManager, address _taxHook, address _feeRecipient) external;
    function setLaunchDiscountBps(uint16 _discountBps) external;
    function setLaunchTickSpacingBps(uint16 _tickSpacingBps) external;
    function setLaunchBlockTimeSeconds(uint64 _secondsPerBlock) external;
    function setRecipients(address _fundsRecipient, address _tokensRecipient) external;
    function setBackingVault(address _backingVault) external;
    function setMigrationConfig(
        address _positionManager,
        address _positionRecipient,
        address _operator,
        uint64 _migrationDelayBlocks,
        uint64 _sweepDelayBlocks
    ) external;
    function launchAuction(uint256 amount, uint256 floorPrice, uint128 requiredRaise, bytes calldata auctionSteps)
        external
        returns (address auction);
    function launchAuctionWithReserve(
        uint256 amount,
        uint256 lpReserveAmount,
        uint256 floorPrice,
        uint128 requiredRaise,
        bytes calldata auctionSteps
    ) external returns (address auction);
    function transferOwnership(address newOwner) external;
}

interface IOwnableTransfer {
    function transferOwnership(address newOwner) external;
}

interface IOwnableView {
    function owner() external view returns (address);
}

interface IOFTBootstrapRegistry {
    function getLayerZeroEndpoint(uint256 chainId) external pure returns (address);
}

interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool);
}

interface IUniswapV3Pool {
    function initialize(uint160 sqrtPriceX96) external;
}

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
    function protocolFee() external view returns (uint24);
}

interface ICharmVaultManager {
    function manager() external view returns (address);
}

interface IDeploymentBatcherRegistryAccess {
    function registry() external view returns (address);
}

interface ICreatorCharmStrategy {
    function initializeApprovals() external;
    function setCreatorOracle(address _creatorOracle) external;
    function setAjnaPool(address _ajnaPool) external;
    function setAjnaBorrowConfig(
        bool _enabled,
        uint256 _maxDebt,
        uint256 _maxBorrowPerWithdraw,
        uint256 _minCollateralRatioBps,
        uint256 _borrowLimitIndex,
        uint256 _repayLimitIndex
    ) external;
}

interface ICreatorOVaultStrategyManager {
    function addStrategy(address strategy, uint256 weight) external;
    function setAutoAllocate(bool autoAllocate) external;
}

interface ICreatorOVaultManagementView {
    function management() external view returns (address);
}

interface IAjnaVaultAuthConfigurator {
    function setBufferRatio(uint256 bufferRatioBps) external;
    function setMinBucketIndex(uint256 minBucketIndex) external;
    function setSwapper(address swapper) external;
    function setKeeper(address keeper, bool isKeeper) external;
    // FIX: F-04/F-21 — updated to two-step admin transfer pattern
    function transferAdmin(address admin) external;
    function isAdmin(address account) external view returns (bool);
}

interface IERC4626StrategyAdapterAdmin {
    function setIdleBufferBps(uint256 newBps) external;
}

interface IVaultRolePolicyManager {
    function validateRoleAssignments(
        uint256 policyId,
        address owner,
        address management,
        address keeper,
        address emergencyAdmin
    ) external view;
}

interface IDeploymentBatcherSolanaConfig {
    struct OVaultRuntimeConfig {
        address hubComposer;
        uint32 solanaEid;
        bool enabled;
    }

    function getOVaultRuntimeConfig() external view returns (OVaultRuntimeConfig memory);

    function solanaDestination() external view returns (bytes32);

    function solanaShareOftPeer() external view returns (bytes32);
}

interface IERC20MetadataLite {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
}

interface IOFTPeerConfig {
    function peers(uint32 eid) external view returns (bytes32 peer);
    function setPeer(uint32 _eid, bytes32 _peer) external;
}

/// @dev Phase-1 CREATE2 orchestration lives in a delegatecall module to keep batcher initcode under EIP-3860.
contract DeploymentBatcherPhase1Module {
    error NotBatcherContext();
    error ZeroAddress();
    error InvalidCodeId();
    error SymbolTooLong();
    error Phase1StateMismatch();
    error Phase1CoreMissing();
    error Phase1ShareOFTMissing();
    error Phase1Missing();

    IUniversalCreate2DeployerFromStore public immutable create2Deployer;
    IUniversalBytecodeStore public immutable bytecodeStore;
    address public immutable registry;
    address public immutable vaultCoreModule;
    address public immutable vaultStrategiesModule;
    address public immutable vaultAdminModule;
    address public immutable vaultActivationBatcher;
    DeploymentBatcherUtilsHelper public immutable utilsHelper;
    address public immutable batcher;

    constructor(
        address _create2Deployer,
        address _bytecodeStore,
        address _registry,
        address _vaultCoreModule,
        address _vaultStrategiesModule,
        address _vaultAdminModule,
        address _vaultActivationBatcher,
        address _utilsHelper,
        address _batcher
    ) {
        require(block.chainid == 8453, "Phase1Module: Base only");
        if (_create2Deployer == address(0)) revert ZeroAddress();
        create2Deployer = IUniversalCreate2DeployerFromStore(_create2Deployer);
        if (_bytecodeStore == address(0)) revert ZeroAddress();
        bytecodeStore = IUniversalBytecodeStore(_bytecodeStore);
        if (_registry == address(0)) revert ZeroAddress();
        registry = _registry;
        if (_vaultCoreModule == address(0)) revert ZeroAddress();
        vaultCoreModule = _vaultCoreModule;
        if (_vaultStrategiesModule == address(0)) revert ZeroAddress();
        vaultStrategiesModule = _vaultStrategiesModule;
        if (_vaultAdminModule == address(0)) revert ZeroAddress();
        vaultAdminModule = _vaultAdminModule;
        vaultActivationBatcher = _vaultActivationBatcher;
        if (_utilsHelper == address(0) || _batcher == address(0)) revert ZeroAddress();
        utilsHelper = DeploymentBatcherUtilsHelper(_utilsHelper);
        batcher = _batcher;
    }

    function deployPhase1Core(
        DeploymentBatcher.Phase1Params calldata params,
        DeploymentBatcher.CodeIds calldata codeIds,
        DeploymentBatcher.Phase1SplitState calldata existing,
        bytes32 shareOftSaltOverride
    ) external returns (DeploymentBatcher.Phase1Result memory out, DeploymentBatcher.Phase1SplitState memory state) {
        if (address(this) != batcher) revert NotBatcherContext();
        if (params.creatorToken == address(0) || params.owner == address(0)) revert ZeroAddress();
        _requirePhase1CodeIds(codeIds);
        if (bytes(params.shareSymbol).length > 32) revert SymbolTooLong();

        (bytes32 shareOftSalt, bytes32 paramsHash, bytes32 codeIdsHash,) =
            _phase1Identity(params, codeIds, shareOftSaltOverride);

        state = existing;
        if (state.coreDone) {
            if (
                state.paramsHash != paramsHash || state.codeIdsHash != codeIdsHash || state.shareOftSalt != shareOftSalt
            ) {
                revert Phase1StateMismatch();
            }
            out.oftBootstrapRegistry = state.oftBootstrapRegistry;
            out.vault = state.vault;
            out.wrapper = state.wrapper;
            out.shareOFT = state.shareOFT;
            return (out, state);
        }

        bytes32 baseSalt = utilsHelper.deriveBaseSalt(params.creatorToken, params.owner, block.chainid, params.version);
        address tempOwner = address(this);
        bytes32 vaultSalt = utilsHelper.saltFor(baseSalt, "vault");
        bytes32 wrapperSalt = utilsHelper.saltFor(baseSalt, "wrapper");

        bytes32 oftBootstrapSalt = keccak256("4626:OFTBootstrapRegistry:v1");
        out.oftBootstrapRegistry = create2Deployer.computeAddress(oftBootstrapSalt, codeIds.oftBootstrap);
        if (out.oftBootstrapRegistry.code.length == 0) {
            create2Deployer.deploy(oftBootstrapSalt, codeIds.oftBootstrap, bytes(""));
        }

        bytes memory vaultArgs = abi.encode(params.creatorToken, tempOwner, params.vaultName, params.vaultSymbol);
        out.vault = create2Deployer.deploy(vaultSalt, codeIds.vault, vaultArgs);
        ICreatorOVault(out.vault).setModulesOnce(vaultCoreModule, vaultStrategiesModule, vaultAdminModule);

        bytes memory wrapperArgs = abi.encode(params.creatorToken, out.vault, tempOwner);
        out.wrapper = create2Deployer.deploy(wrapperSalt, codeIds.wrapper, wrapperArgs);

        out.shareOFT = address(0);

        state.oftBootstrapRegistry = out.oftBootstrapRegistry;
        state.vault = out.vault;
        state.wrapper = out.wrapper;
        state.shareOFT = address(0);
        state.shareOftSalt = shareOftSalt;
        state.paramsHash = paramsHash;
        state.codeIdsHash = codeIdsHash;
        state.coreDone = true;
        state.finalized = false;
    }

    function finalizePhase1Split(
        DeploymentBatcher.Phase1Params calldata params,
        DeploymentBatcher.CodeIds calldata codeIds,
        DeploymentBatcher.Phase1SplitState calldata existing,
        bytes32 shareOftSaltOverride
    ) external returns (DeploymentBatcher.Phase1Result memory out, DeploymentBatcher.Phase1SplitState memory state) {
        if (address(this) != batcher) revert NotBatcherContext();
        if (params.creatorToken == address(0) || params.owner == address(0)) revert ZeroAddress();
        _requirePhase1CodeIds(codeIds);
        if (bytes(params.shareSymbol).length > 32) revert SymbolTooLong();

        (bytes32 expectedShareOftSalt, bytes32 paramsHash, bytes32 codeIdsHash,) =
            _phase1Identity(params, codeIds, shareOftSaltOverride);
        string memory shareSymbolUpper = utilsHelper.toUpper(params.shareSymbol);

        state = existing;
        if (!state.coreDone) revert Phase1CoreMissing();
        if (
            state.paramsHash != paramsHash || state.codeIdsHash != codeIdsHash
                || state.shareOftSalt != expectedShareOftSalt
        ) {
            revert Phase1StateMismatch();
        }

        out.oftBootstrapRegistry = state.oftBootstrapRegistry;
        out.vault = state.vault;
        out.wrapper = state.wrapper;
        if (out.vault.code.length == 0 || out.wrapper.code.length == 0) revert Phase1CoreMissing();

        if (state.finalized) {
            if (state.shareOFT == address(0) || state.shareOFT.code.length == 0) revert Phase1Missing();
            out.shareOFT = state.shareOFT;
            return (out, state);
        }

        bytes memory shareOftArgs =
            abi.encode(params.shareName, shareSymbolUpper, out.oftBootstrapRegistry, address(this));
        bytes32 shareOftInitCodeHash = _deriveInitCodeHash(codeIds.shareOFT, shareOftArgs);
        try create2Deployer.deploy(state.shareOftSalt, codeIds.shareOFT, shareOftArgs) returns (
            address deployedShareOFT
        ) {
            out.shareOFT = deployedShareOFT;
        } catch {
            address expectedAddr = create2Deployer.computeAddress(state.shareOftSalt, shareOftInitCodeHash);
            if (expectedAddr.code.length == 0) revert Phase1ShareOFTMissing();
            bytes32 verifyHash = keccak256(bytes.concat(bytecodeStore.get(codeIds.shareOFT), shareOftArgs));
            if (verifyHash != shareOftInitCodeHash) revert Phase1StateMismatch();
            out.shareOFT = expectedAddr;
        }

        ICreatorOVaultWrapper(out.wrapper).setShareOFT(out.shareOFT);
        ICreatorShareOFT(out.shareOFT).setRegistry(address(registry));
        ICreatorShareOFT(out.shareOFT).setVault(out.vault);
        ICreatorShareOFT(out.shareOFT).setMinter(out.wrapper, true);
        ICreatorShareOFT(out.shareOFT).setHubConfig(true, 0, address(0));

        ICreatorOVault(out.vault).setWhitelist(out.wrapper, true);
        ICreatorOVault(out.vault).setWhitelist(address(this), true);
        if (vaultActivationBatcher != address(0)) {
            ICreatorOVault(out.vault).setWhitelist(vaultActivationBatcher, true);
        }

        state.shareOFT = out.shareOFT;
        state.finalized = true;
    }

    function _phase1Identity(
        DeploymentBatcher.Phase1Params calldata params,
        DeploymentBatcher.CodeIds calldata codeIds,
        bytes32 shareOftSaltOverride
    )
        internal
        returns (bytes32 shareOftSalt, bytes32 paramsHash, bytes32 codeIdsHash, bytes32 baseSalt)
    {
        string memory shareSymbolLower = utilsHelper.toLower(params.shareSymbol);
        baseSalt = utilsHelper.deriveBaseSalt(params.creatorToken, params.owner, block.chainid, params.version);
        shareOftSalt = shareOftSaltOverride == bytes32(0)
            ? utilsHelper.deriveShareOftSalt(params.owner, shareSymbolLower, params.version)
            : shareOftSaltOverride;
        paramsHash = utilsHelper.phase1ParamsHash(
            params.creatorToken,
            params.owner,
            params.vaultName,
            params.vaultSymbol,
            params.shareName,
            params.shareSymbol,
            params.version
        );
        codeIdsHash =
            utilsHelper.phase1CodeIdsHash(codeIds.vault, codeIds.wrapper, codeIds.shareOFT, codeIds.oftBootstrap);
    }

    function _requirePhase1CodeIds(DeploymentBatcher.CodeIds calldata codeIds) internal pure {
        if (
            codeIds.vault == bytes32(0) || codeIds.wrapper == bytes32(0) || codeIds.shareOFT == bytes32(0)
                || codeIds.oftBootstrap == bytes32(0)
        ) {
            revert InvalidCodeId();
        }
    }

    function _deriveInitCodeHash(bytes32 codeId, bytes memory constructorArgs) internal view returns (bytes32) {
        bytes memory creationCode = bytecodeStore.get(codeId);
        return keccak256(bytes.concat(creationCode, constructorArgs));
    }
}

contract DeploymentBatcherPhase2Module {
    using SafeERC20 for IERC20;

    uint8 internal constant AUCTION_PERCENT = 30;
    uint8 internal constant VESTING_PERCENT = 30;
    uint8 internal constant SOLANA_ALLOC_PERCENT = 30;
    uint8 internal constant LP_RESERVE_PERCENT = 10;
    /// @notice Allowed first-deposit range (creator-token principal, 18 decimals).
    /// @dev Must stay >= CreatorOVault.MINIMUM_FIRST_DEPOSIT (50M). The upper bound
    ///      keeps the four-way share split (auction/vesting/Solana/LP) within sizes
    ///      the CCA + LZ bridge lanes have been validated for.
    uint256 internal constant MIN_FIRST_DEPOSIT = 50_000_000e18;
    uint256 internal constant MAX_FIRST_DEPOSIT = 100_000_000e18;
    uint16 internal constant DEFAULT_LAUNCH_DISCOUNT_BPS = 8_000;
    uint16 internal constant DEFAULT_LAUNCH_TICK_SPACING_BPS = 100;
    uint128 internal constant DEFAULT_SHARE_BRIDGE_GAS_LIMIT = 200_000;

    error NotBatcherContext();
    error ZeroAddress();
    error SolanaShareBridgeNotConfigured();
    error SolanaShareOftPeerNotConfigured();
    error InsufficientSolanaBridgeFee(uint256 required, uint256 provided);
    error SolanaBridgeRefundFailed();
    error AuctionAmountMismatch();
    error InvalidDepositAmount();
    error DeprecatedFinalizeSolanaParams();
    error Phase1Missing();
    error Phase2Missing();
    error Phase1StateMismatch();
    error InvalidCreatorTreasury(address provided);
    // Canonical terminology note (AGENTS.md): this error guards the
    // creatorCoinPayoutRecipient (external earnings) lane. The field name
    // `payoutRecipient` is retained for on-chain ABI compatibility; all new
    // code and docs must use the five mandated lane names.
    error InvalidCreatorCoinPayoutRecipient();
    error InvalidCodeId();

    struct FinalizeExecutionResult {
        uint256 auctionAmount;
        uint256 lpReserveAmount;
        uint256 solanaAmount;
        uint256 vestingAmount;
        address vestingAddress;
        uint64 vestingStartTimestamp;
        uint64 vestingDurationSeconds;
    }

    IUniversalCreate2DeployerFromStore public immutable create2Deployer;
    address public immutable registry;
    address public immutable chainlinkEthUsd;
    address public immutable poolManager;
    address public immutable taxHook;
    address public immutable protocolTreasury;
    address public immutable lotteryManager;
    address public immutable vaultActivationBatcher;
    address public immutable batcher;

    constructor(
        address _create2Deployer,
        address _registry,
        address _chainlinkEthUsd,
        address _poolManager,
        address _taxHook,
        address _protocolTreasury,
        address _lotteryManager,
        address _vaultActivationBatcher,
        address _batcher
    ) {
        create2Deployer = IUniversalCreate2DeployerFromStore(_create2Deployer);
        registry = _registry;
        chainlinkEthUsd = _chainlinkEthUsd;
        poolManager = _poolManager;
        taxHook = _taxHook;
        protocolTreasury = _protocolTreasury;
        lotteryManager = _lotteryManager;
        vaultActivationBatcher = _vaultActivationBatcher;
        if (_batcher == address(0)) revert NotBatcherContext();
        batcher = _batcher;
    }

    function deployPhase2Core(
        DeploymentBatcher.Phase2CoreParams calldata params,
        DeploymentBatcher.CodeIds calldata codeIds,
        bytes32 baseSalt,
        string calldata shareSymbolLower
    ) external returns (DeploymentBatcher.Phase2Result memory out) {
        if (address(this) != batcher) revert NotBatcherContext();
        return _deployPhase2CoreBody(params, codeIds, baseSalt, shareSymbolLower);
    }

    function deployPhase2CoreOrchestrator(
        DeploymentBatcher.Phase2CoreParams calldata params,
        DeploymentBatcher.CodeIds calldata codeIds,
        bytes32 baseSalt,
        string calldata shareSymbolLower,
        DeploymentBatcher.Phase1SplitState calldata p1state,
        address rolePolicyManager,
        uint256 rolePolicyId
    ) external returns (DeploymentBatcher.Phase2Result memory out) {
        if (address(this) != batcher) revert NotBatcherContext();
        if (params.creatorToken == address(0) || params.owner == address(0)) revert ZeroAddress();
        if (params.vault == address(0) || params.wrapper == address(0) || params.shareOFT == address(0)) {
            revert ZeroAddress();
        }
        if (rolePolicyManager != address(0)) {
            IVaultRolePolicyManager(rolePolicyManager).validateRoleAssignments(
                rolePolicyId, params.owner, params.owner, params.owner, params.owner
            );
        }
        if (codeIds.gauge == bytes32(0) || codeIds.cca == bytes32(0) || codeIds.oracle == bytes32(0)) {
            revert InvalidCodeId();
        }
        if (params.vault.code.length == 0 || params.wrapper.code.length == 0 || params.shareOFT.code.length == 0) {
            revert Phase1Missing();
        }
        if (!p1state.finalized) revert Phase1Missing();
        if (p1state.vault != params.vault || p1state.wrapper != params.wrapper || p1state.shareOFT != params.shareOFT) {
            revert Phase1StateMismatch();
        }
        if (params.creatorTreasury != address(0) && params.creatorTreasury != protocolTreasury) {
            revert InvalidCreatorTreasury(params.creatorTreasury);
        }
        if (params.payoutRecipient != address(0)) revert InvalidCreatorCoinPayoutRecipient();
        return _deployPhase2CoreBody(params, codeIds, baseSalt, shareSymbolLower);
    }

    function _deployPhase2CoreBody(
        DeploymentBatcher.Phase2CoreParams calldata params,
        DeploymentBatcher.CodeIds calldata codeIds,
        bytes32 baseSalt,
        string calldata shareSymbolLower
    ) internal returns (DeploymentBatcher.Phase2Result memory out) {
        address treasury = protocolTreasury;
        address tempOwner = address(this);

        bytes32 gaugeSalt = _saltFor(baseSalt, "gauge");
        bytes32 ccaSalt = _saltFor(baseSalt, "cca");
        bytes32 oracleSalt = _saltFor(baseSalt, "oracle");

        bytes memory gaugeArgs = abi.encode(params.shareOFT, treasury, protocolTreasury, tempOwner);
        out.gaugeController = create2Deployer.deploy(gaugeSalt, codeIds.gauge, gaugeArgs);

        bytes memory ccaArgs = abi.encode(params.shareOFT, address(0), params.vault, params.vault, tempOwner);
        out.ccaStrategy = create2Deployer.deploy(ccaSalt, codeIds.cca, ccaArgs);

        bytes memory oracleArgs = abi.encode(registry, chainlinkEthUsd, shareSymbolLower, tempOwner);
        out.oracle = create2Deployer.deploy(oracleSalt, codeIds.oracle, oracleArgs);

        ICreatorShareOFT(params.shareOFT).setGaugeController(out.gaugeController);

        ICreatorGaugeController(out.gaugeController).setVault(params.vault);
        ICreatorGaugeController(out.gaugeController).setWrapper(params.wrapper);
        ICreatorGaugeController(out.gaugeController).setCreatorCoin(params.creatorToken);
        if (lotteryManager != address(0)) {
            ICreatorGaugeController(out.gaugeController).setLotteryManager(lotteryManager);
        }
        ICreatorGaugeController(out.gaugeController).setOracle(out.oracle);

        ICreatorOVault(params.vault).setGaugeController(out.gaugeController);

        ICCALaunchStrategy(out.ccaStrategy).setApprovedLauncher(address(this), true);
        if (vaultActivationBatcher != address(0)) {
            ICCALaunchStrategy(out.ccaStrategy).setApprovedLauncher(vaultActivationBatcher, true);
        }
        ICCALaunchStrategy(out.ccaStrategy).setRecipients(out.ccaStrategy, out.ccaStrategy);
        ICCALaunchStrategy(out.ccaStrategy).setBackingVault(params.vault);
        ICCALaunchStrategy(out.ccaStrategy)
            .setMigrationConfig(address(0), protocolTreasury, protocolTreasury, 1, 14_400);
        ICCALaunchStrategy(out.ccaStrategy).setOracleConfig(out.oracle, poolManager, taxHook, out.gaugeController);
        ICCALaunchStrategy(out.ccaStrategy).setLaunchDiscountBps(DEFAULT_LAUNCH_DISCOUNT_BPS);
        ICCALaunchStrategy(out.ccaStrategy).setLaunchTickSpacingBps(DEFAULT_LAUNCH_TICK_SPACING_BPS);
    }

    function finalizePhase2Execution(DeploymentBatcher.Phase2FinalizeParams calldata params, bytes32 baseSalt)
        public
        returns (FinalizeExecutionResult memory result)
    {
        if (address(this) != batcher) revert NotBatcherContext();

        IERC20(params.creatorToken).forceApprove(params.wrapper, params.depositAmount);
        uint256 shareTokens = ICreatorOVaultWrapper(params.wrapper).deposit(params.depositAmount);

        result.auctionAmount = (shareTokens * AUCTION_PERCENT) / 100;
        result.vestingAmount = (shareTokens * VESTING_PERCENT) / 100;
        result.solanaAmount = (shareTokens * SOLANA_ALLOC_PERCENT) / 100;
        result.lpReserveAmount =
            shareTokens - result.auctionAmount - result.vestingAmount - result.solanaAmount;

        if (result.lpReserveAmount > 0) {
            IERC20(params.shareOFT).safeTransfer(params.ccaStrategy, result.lpReserveAmount);
        }

        if (result.solanaAmount > 0) {
            IDeploymentBatcherSolanaConfig config = IDeploymentBatcherSolanaConfig(batcher);
            IDeploymentBatcherSolanaConfig.OVaultRuntimeConfig memory runtime = config.getOVaultRuntimeConfig();
            _ensureRegistryAndShareOftPeerWired(params, runtime.solanaEid);
            _bridgeShareAllocationToSolana(params.shareOFT, params.owner, result.solanaAmount);
        }

        if (result.vestingAmount > 0) {
            result.vestingStartTimestamp = uint64(block.timestamp);
            result.vestingDurationSeconds = uint64(365 days);
            bytes32 vestingSalt = keccak256(abi.encodePacked(baseSalt, "vesting"));
            CreatorLinearVesting vesting = new CreatorLinearVesting{salt: vestingSalt}(
                params.shareOFT, params.owner, result.vestingStartTimestamp, result.vestingDurationSeconds
            );
            result.vestingAddress = address(vesting);
            IERC20(params.shareOFT).safeTransfer(result.vestingAddress, result.vestingAmount);
        }

        ICreatorOVault(params.vault).setProtocolRescue(protocolTreasury);
        ICreatorOVault(params.vault).transferOwnership(params.owner);
        ICreatorOVaultWrapper(params.wrapper).transferOwnership(protocolTreasury);
        ICreatorShareOFT(params.shareOFT).transferOwnership(protocolTreasury);
        ICreatorGaugeController(params.gaugeController).transferOwnership(protocolTreasury);
        ICCALaunchStrategy(params.ccaStrategy).transferOwnership(protocolTreasury);
        IOwnableTransfer(params.oracle).transferOwnership(protocolTreasury);
    }

    function _readTokenMetadata(address token) internal view returns (string memory name, string memory symbol) {
        try IERC20MetadataLite(token).name() returns (string memory tokenName) {
            name = tokenName;
        } catch {
            name = "Unknown";
        }
        try IERC20MetadataLite(token).symbol() returns (string memory tokenSymbol) {
            symbol = tokenSymbol;
        } catch {
            symbol = "UNK";
        }
    }

    function _ensureRegistryAndShareOftPeerWired(
        DeploymentBatcher.Phase2FinalizeParams calldata params,
        uint32 solanaEid
    ) internal {
        if (solanaEid == 0) revert SolanaShareBridgeNotConfigured();

        ICreatorRegistry reg = ICreatorRegistry(registry);
        ICreatorRegistry.CreatorCoinInfo memory info = reg.getCreatorCoin(params.creatorToken);
        if (info.token == address(0)) {
            (string memory name, string memory symbol) = _readTokenMetadata(params.creatorToken);
            reg.registerCreatorCoin(params.creatorToken, name, symbol, params.owner, address(0), 0);
            info = reg.getCreatorCoin(params.creatorToken);
        }
        if (info.vault == address(0)) {
            reg.setVault(params.creatorToken, params.vault);
        }
        if (info.wrapper == address(0)) {
            reg.setCreatorWrapper(params.creatorToken, params.wrapper);
        }
        if (info.shareOFT == address(0)) {
            reg.setCreatorShareOFT(params.creatorToken, params.shareOFT);
        }
        if (info.gaugeController == address(0)) {
            reg.setCreatorGaugeController(params.creatorToken, params.gaugeController);
        }
        if (info.oracle == address(0)) {
            reg.setCreatorOracle(params.creatorToken, params.oracle);
        }

        bytes32 peer = reg.getRemoteOFTPeerBytes32(params.creatorToken, solanaEid);
        if (peer == bytes32(0)) {
            peer = IDeploymentBatcherSolanaConfig(batcher).solanaShareOftPeer();
            if (peer != bytes32(0)) {
                reg.setRemoteOFTPeerBytes32(params.creatorToken, solanaEid, peer);
            }
        }
        if (peer == bytes32(0)) revert SolanaShareOftPeerNotConfigured();

        bytes32 currentPeer = IOFTPeerConfig(params.shareOFT).peers(solanaEid);
        if (currentPeer != peer) {
            IOFTPeerConfig(params.shareOFT).setPeer(solanaEid, peer);
        }
    }

    function _bridgeShareAllocationToSolana(address shareOFT, address refundAddress, uint256 amount) internal {
        IDeploymentBatcherSolanaConfig config = IDeploymentBatcherSolanaConfig(batcher);
        IDeploymentBatcherSolanaConfig.OVaultRuntimeConfig memory runtime = config.getOVaultRuntimeConfig();
        if (!runtime.enabled || runtime.solanaEid == 0) revert SolanaShareBridgeNotConfigured();
        bytes32 destination = config.solanaDestination();
        if (destination == bytes32(0)) revert SolanaShareBridgeNotConfigured();

        SendParam memory sendParam = SendParam({
            dstEid: runtime.solanaEid,
            to: destination,
            amountLD: amount,
            minAmountLD: 0,
            extraOptions: OptionsBuilder.addExecutorLzReceiveOption(
                OptionsBuilder.newOptions(), DEFAULT_SHARE_BRIDGE_GAS_LIMIT, 0
            ),
            composeMsg: "",
            oftCmd: ""
        });
        (, , OFTReceipt memory oftReceipt) = IOFT(shareOFT).quoteOFT(sendParam);
        sendParam.minAmountLD = oftReceipt.amountReceivedLD;
        MessagingFee memory fee = IOFT(shareOFT).quoteSend(sendParam, false);
        if (msg.value < fee.nativeFee) revert InsufficientSolanaBridgeFee(fee.nativeFee, msg.value);

        IOFT(shareOFT).send{value: fee.nativeFee}(sendParam, fee, refundAddress);

        uint256 surplus = msg.value - fee.nativeFee;
        if (surplus > 0) {
            (bool ok,) = payable(refundAddress).call{value: surplus}("");
            if (!ok) revert SolanaBridgeRefundFailed();
        }
    }

    function _saltFor(bytes32 baseSalt, string memory label) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(baseSalt, label));
    }

    function launchDeferredAuctionExecution(
        address shareOFT,
        address ccaStrategy,
        uint256 amount,
        uint256 lpReserveAmount,
        uint256 floorPriceQ96,
        uint128 requiredRaise,
        bytes calldata auctionSteps
    ) external returns (address auction) {
        if (address(this) != batcher) revert NotBatcherContext();
        if (IERC20(shareOFT).balanceOf(address(this)) < amount) revert AuctionAmountMismatch();
        IERC20(shareOFT).forceApprove(ccaStrategy, amount);
        auction = ICCALaunchStrategy(ccaStrategy)
            .launchAuctionWithReserve(
                amount, lpReserveAmount, floorPriceQ96, requiredRaise, auctionSteps
            );
    }

    function _validateFinalizePhase2(
        DeploymentBatcher.Phase2FinalizeParams calldata params,
        DeploymentBatcher.Phase1SplitState calldata p1state
    ) internal view {
        if (params.creatorToken == address(0) || params.owner == address(0)) revert ZeroAddress();
        if (params.vault == address(0) || params.wrapper == address(0) || params.shareOFT == address(0)) {
            revert ZeroAddress();
        }
        if (params.gaugeController == address(0) || params.ccaStrategy == address(0) || params.oracle == address(0)) {
            revert ZeroAddress();
        }
        if (params.depositAmount < MIN_FIRST_DEPOSIT || params.depositAmount > MAX_FIRST_DEPOSIT) {
            revert InvalidDepositAmount();
        }
        if (params.meteoraAlphaVault != bytes32(0) || params.solanaIxs.length != 0) {
            revert DeprecatedFinalizeSolanaParams();
        }
        if (params.vault.code.length == 0 || params.wrapper.code.length == 0 || params.shareOFT.code.length == 0) {
            revert Phase1Missing();
        }
        if (
            params.gaugeController.code.length == 0 || params.ccaStrategy.code.length == 0
                || params.oracle.code.length == 0
        ) {
            revert Phase2Missing();
        }
        if (!p1state.finalized) revert Phase1Missing();
        if (p1state.vault != params.vault || p1state.wrapper != params.wrapper || p1state.shareOFT != params.shareOFT) {
            revert Phase1StateMismatch();
        }
    }

    function finalizePhase2Orchestrator(
        DeploymentBatcher.Phase2FinalizeParams calldata params,
        DeploymentBatcher.Phase1SplitState calldata p1state,
        bytes32 baseSalt
    ) public returns (DeploymentBatcher.Phase2Result memory out, FinalizeExecutionResult memory execution) {
        if (address(this) != batcher) revert NotBatcherContext();
        _validateFinalizePhase2(params, p1state);
        out.gaugeController = params.gaugeController;
        out.ccaStrategy = params.ccaStrategy;
        out.oracle = params.oracle;
        execution = finalizePhase2Execution(params, baseSalt);
    }

    struct FinalizeEntryResult {
        DeploymentBatcher.Phase2Result phase2;
        FinalizeExecutionResult execution;
    }

    error PermitTokenMismatch();
    error PermitAmountTooLow();

    function finalizePhase2Entry(
        DeploymentBatcher.Phase2FinalizeParams calldata params,
        DeploymentBatcher.Phase1SplitState calldata p1state,
        bytes32 baseSalt
    ) external payable returns (FinalizeEntryResult memory result) {
        if (address(this) != batcher) revert NotBatcherContext();
        IERC20(params.creatorToken).safeTransferFrom(msg.sender, address(this), params.depositAmount);
        (result.phase2, result.execution) = finalizePhase2Orchestrator(params, p1state, baseSalt);
    }

    function finalizePhase2EntryWithPermit2(
        DeploymentBatcher.Phase2FinalizeParams calldata params,
        DeploymentBatcher.Phase1SplitState calldata p1state,
        bytes32 baseSalt,
        address permit2,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external payable returns (FinalizeEntryResult memory result) {
        if (address(this) != batcher) revert NotBatcherContext();
        if (permit.permitted.token != params.creatorToken) revert PermitTokenMismatch();
        if (permit.permitted.amount < params.depositAmount) revert PermitAmountTooLow();
        ISignatureTransfer.SignatureTransferDetails memory details =
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: params.depositAmount});
        ISignatureTransfer(permit2).permitTransferFrom(permit, details, msg.sender, signature);
        (result.phase2, result.execution) = finalizePhase2Orchestrator(params, p1state, baseSalt);
    }
}

/**
 * @title DeploymentBatcher
 * @author 0xakita.eth
 * @notice Multi-transaction 4626 deployment orchestrator (Phases 1–3).
 * @dev We can no longer deploy the full stack in one transaction on Base due to code-deposit gas limits.
 *      This contract splits deployment into multiple calls:
 *      - Phase 1: deploy vault + wrapper + shareOFT + minimal wiring (no token pulls / no auction)
 *      - Phase 2a: deploy gauge + CCA + oracle + wiring (no token pulls)
 *      - Phase 2b: deposit + vesting + ownership transfers (plus optional deferred auction)
 */
contract DeploymentBatcher is ReentrancyGuard {
    modifier onlyProtocolTreasury() {
        if (msg.sender != protocolTreasury) revert NotProtocolTreasury();
        _;
    }

    /// @notice Charm Finance Alpha Vault Factory on Base.
    address public constant CHARM_FACTORY = 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa;

    // ── Fixed Four-Way Share Split Constants ─────────────────────────
    /// @notice Minimum deposit amount (50M tokens, 18 decimals)
    uint256 public constant MIN_DEPOSIT = 50_000_000e18;
    /// @notice Maximum deposit amount (100M tokens, 18 decimals)
    /// @dev Enforcement lives in DeploymentBatcherPhase2Module._validateFinalizePhase2
    ///      (hot-swappable). The live shell at 0xa99058… predates the 100M widening and
    ///      still reports 50M here; these getters are informational only.
    uint256 public constant MAX_DEPOSIT = 100_000_000e18;
    /// @notice Percentage of ■TOKENs allocated to CCA auction
    uint8 public constant AUCTION_PERCENT = 30;
    /// @notice Percentage of ■TOKENs vested to the creator
    uint8 public constant VESTING_PERCENT = 30;
    /// @notice Percentage of ■TOKENs auto-bridged to Solana share mesh at finalize
    uint8 public constant SOLANA_ALLOC_PERCENT = 30;
    /// @notice Percentage of ■TOKENs reserved on strategy for LP migration
    uint8 public constant LP_RESERVE_PERCENT = 10;
    /// @notice Default launch discount (80% of oracle-derived reference price).
    uint16 public constant DEFAULT_LAUNCH_DISCOUNT_BPS = 8_000;
    /// @notice Default launch tick spacing (1% of derived floor price).
    uint16 public constant DEFAULT_LAUNCH_TICK_SPACING_BPS = 100;

    struct CodeIds {
        bytes32 vault;
        bytes32 wrapper;
        bytes32 shareOFT;
        bytes32 gauge;
        bytes32 cca;
        bytes32 oracle;
        bytes32 oftBootstrap;
    }

    struct Phase1Params {
        address creatorToken;
        address owner;
        string vaultName;
        string vaultSymbol;
        string shareName;
        string shareSymbol;
        string version;
    }

    // === Canonical Value Lane Terminology (AGENTS.md) ===
    // The five mandated lane names are: tradeFeeCollector, creatorCoinPayoutRecipient,
    // creatorTreasury, jackpotCustodian, jackpotPayoutAuthority.
    // The struct field below retains the legacy name `payoutRecipient` only for
    // on-chain ABI / calldata compatibility with existing callers. All comments,
    // errors, and new code must use the canonical `creatorCoinPayoutRecipient`
    // framing for the external earnings lane (the one that feeds PayoutRouter
    // → VaultShareBurnStream for PPS accretion).
    struct Phase2Params {
        address creatorToken;
        address owner;
        address creatorTreasury;
        address payoutRecipient; // creatorCoinPayoutRecipient (external earnings lane per AGENTS.md canonical terminology)
        address vault;
        address wrapper;
        address shareOFT;
        string shareSymbol;
        string version;
        uint256 depositAmount;
        uint128 requiredRaise;
        uint256 floorPriceQ96; // Ignored by strategy; launch floor is derived onchain.
        bytes auctionSteps;
    }

    struct Phase2CoreParams {
        address creatorToken;
        address owner;
        address creatorTreasury;
        address payoutRecipient; // creatorCoinPayoutRecipient (external earnings lane per AGENTS.md canonical terminology)
        address vault;
        address wrapper;
        address shareOFT;
        string shareSymbol;
        string version;
        uint256 floorPriceQ96; // Ignored by strategy; launch floor is derived onchain.
    }

    struct Phase2FinalizeParams {
        address creatorToken;
        address owner;
        address vault;
        address wrapper;
        address shareOFT;
        address gaugeController;
        address ccaStrategy;
        address oracle;
        string version;
        uint256 depositAmount;
        uint128 requiredRaise;
        uint256 floorPriceQ96; // Ignored by strategy; launch floor is derived onchain.
        bytes auctionSteps;
        bytes32 meteoraAlphaVault;
        IBaseSolanaBridge.Ix[] solanaIxs;
    }

    struct Phase1Result {
        address oftBootstrapRegistry;
        address vault;
        address wrapper;
        address shareOFT;
    }

    struct Phase1SplitState {
        address oftBootstrapRegistry;
        address vault;
        address wrapper;
        address shareOFT;
        bytes32 shareOftSalt;
        bytes32 paramsHash;
        bytes32 codeIdsHash;
        bool coreDone;
        bool finalized;
    }

    struct Phase2Result {
        address gaugeController;
        address ccaStrategy;
        address oracle;
        address auction;
    }

    struct PendingAuction {
        address shareOFT;
        address ccaStrategy;
        uint256 amount;
        uint256 lpReserveAmount;
    }

    struct DeferredAuctionParams {
        address creatorToken;
        address owner;
        address shareOFT;
        string version;
        uint256 floorPriceQ96; // Ignored by strategy; launch floor is derived onchain.
        uint128 requiredRaise;
        bytes auctionSteps;
    }

    struct StrategyCodeIds {
        bytes32 charmAlphaVaultDeploy;
        bytes32 creatorCharmStrategy;
        bytes32 ajnaVaultAuth;
        bytes32 ajnaVault;
        bytes32 erc4626StrategyAdapter;
        bytes32 solanaStrategy;
    }

    struct Phase3Params {
        address creatorToken;
        address owner;
        address vault;
        string version;
        // If the CREATOR/USDC V3 pool does not exist yet, we can create it with this initial price.
        // If the pool already exists, you can pass 0 and we'll skip initialization.
        uint160 initialSqrtPriceX96;
        string charmVaultName;
        string charmVaultSymbol;
        string ajnaVaultName;
        string ajnaVaultSymbol;
        uint256 charmWeightBps;
        uint256 ajnaWeightBps;
        uint256 solanaWeightBps;
        uint256 ajnaBufferRatioBps;
        uint256 ajnaMinBucketIndex;
        address ajnaKeeper;
        address solanaKeeper;
        uint64 solanaMaxNavAge;
        uint16 solanaMaxNavDeltaBpsPerUpdate;
        uint16 solanaMinBaseLiquidityBps;
        address solanaBridgeAddress;
        bool enableAutoAllocate;
        // Optional override: expected Charm factory protocol fee in 1e6 precision.
        // Set to 0 to use CHARM_DEFAULT_PROTOCOL_FEE_PIPS.
        uint24 expectedCharmProtocolFeePips;
    }

    struct Phase3Result {
        address v3Pool;
        address charmVault;
        address charmStrategy;
        address ajnaVaultAuth;
        address ajnaVault;
        address ajnaStrategy;
        address solanaStrategy;
    }

    struct UniV4CodeIds {
        bytes32 approvedV4HooksRegistry;
        bytes32 fullRangeStrategy;
        bytes32 concentratedStrategy;
        bytes32 limitOrderStrategy;
        bytes32 creatorLPManager;
    }

    struct UniV4DeployParams {
        address creatorToken;
        address pairedToken;
        address vault;
        address owner;
        string version;
        address positionManager;
        uint24 fee;
        int24 tickSpacing;
        bool creatorIsCurrency0;
        address poolHook;
        address registryOwner;
        address[] hooksToApprove;
    }

    struct UniV4DeploymentResult {
        address hookRegistry;
        address fullRangeStrategy;
        address concentratedStrategy;
        address limitOrderStrategy;
        address creatorLPManager;
    }

    struct OVaultRuntimeConfig {
        address hubComposer;
        uint32 solanaEid;
        bool enabled;
    }

    error ZeroAddress();
    error InvalidDepositAmount();
    error InvalidCodeId();
    error NotOwner();
    error Phase1Missing();
    error Phase1CoreMissing();
    error Phase1StateMismatch();
    error InvalidWeight();
    error V3PoolMissing();
    error MissingInitialSqrtPriceX96();
    error AuctionAlreadyPending();
    // FIX: F-02 — per-token guard prevents version-replay bricking
    error AuctionAlreadyPendingForToken(address creatorToken, address owner);
    error NoPendingAuction();
    error AuctionShareOFTMismatch();
    error AuctionAmountMismatch();
    error Phase2Missing();
    error InvalidSolanaEid();
    error InvalidSolanaBridgeConfig();
    error Phase1ShareOFTMissing();
    // FIX: F-06 — cap symbol length to prevent gas griefing
    error SymbolTooLong();
    // FIX: F-15 — dedicated error for protocol treasury auth
    error NotProtocolTreasury();
    // FIX: F-26 — admin function to clear stuck Phase 1 state
    error Phase1StateNotStuck();
    error InvalidCreatorTreasury(address provided);
    // Canonical terminology note (AGENTS.md): this error guards the
    // creatorCoinPayoutRecipient (external earnings) lane. The field name
    // `payoutRecipient` is retained for on-chain ABI compatibility; all new
    // code and docs must use the five mandated lane names.
    error InvalidCreatorCoinPayoutRecipient();
    error DeprecatedFinalizeSolanaParams();
    error Phase3ManagementMismatch(address expected, address actual);
    error CharmFactoryGovernanceMismatch(address expected, address actual);
    error CharmFactoryProtocolFeeMismatch(uint256 expected, uint256 actual);
    error CharmVaultManagerMismatch(address expected, address actual);
    error InvalidTickSpacing();
    error InvalidPoolCurrencies();
    error InvalidRolePolicyManager();
    error InvalidPhase2Module();
    error InvalidPhase1Module();
    error Phase1ModuleMissing();

    ICreatorRegistry public immutable registry;
    IUniversalBytecodeStore public immutable bytecodeStore;
    IUniversalCreate2DeployerFromStore public immutable create2Deployer;

    address public immutable protocolTreasury;
    address public immutable poolManager;
    address public immutable taxHook;
    address public immutable chainlinkEthUsd;
    address public immutable vaultActivationBatcher;
    address public immutable lotteryManager;
    address public immutable permit2;
    address public immutable usdc;
    address public immutable uniswapV3Factory;
    address public immutable uniswapRouter;
    address public immutable ajnaFactory;
    address public vaultRolePolicyManager;
    uint256 public vaultRolePolicyId;

    // CreatorOVault delegatecall modules (shared logic contracts).
    address public immutable vaultCoreModule;
    address public immutable vaultStrategiesModule;
    address public vaultAdminModule;

    /// @notice Pending auction allocations keyed by creator/owner/version salt.
    mapping(bytes32 => PendingAuction) public pendingAuctions;
    // FIX: F-02 — per-token+owner pending auction guard (version-independent)
    mapping(bytes32 => bool) public hasActivePendingAuction;
    /// @notice Split phase-1 state keyed by creator/owner/version salt.
    mapping(bytes32 => Phase1SplitState) public phase1SplitStates;

    /// @notice SolanaBridgeAdapter address for bridging the Solana allocation.
    address public solanaBridgeAdapter;
    /// @notice Solana deployer/multisig wallet address (bytes32 pubkey) to receive bridged tokens.
    bytes32 public solanaDestination;
    /// @notice Default LayerZero remote ShareOFT peer (bytes32) for greenfield finalize wiring.
    bytes32 public solanaShareOftPeer;
    /// @notice OVault runtime wiring used for Solana compose orchestration.
    OVaultRuntimeConfig private ovaultRuntimeConfig;
    /// @notice Dedicated phase-3 execution helper to keep this contract under EIP-170 runtime limits.
    DeploymentBatcherPhase3Helper public phase3Helper;
    /// @notice Dedicated phase-2 execution helper (delegatecall) to keep this contract under EIP-170 runtime limits.
    DeploymentBatcherPhase2Module public phase2Module;
    /// @notice Dedicated phase-1 execution helper (delegatecall) to keep initcode under EIP-3860 limits.
    DeploymentBatcherPhase1Module public phase1Module;
    /// @notice Dedicated UniV4 execution helper to keep this contract under EIP-170 runtime limits.
    DeploymentBatcherUniV4Helper public uniV4Helper;
    /// @notice String/salt/hash helper contract to keep this contract under EIP-170 runtime limits.
    DeploymentBatcherUtilsHelper public utilsHelper;

    event Phase1Deployed(
        address indexed creatorToken,
        address indexed owner,
        address oftBootstrapRegistry,
        address vault,
        address wrapper,
        address shareOFT
    );

    event Phase1CoreDeployed(
        address indexed creatorToken,
        address indexed owner,
        address oftBootstrapRegistry,
        address vault,
        address wrapper,
        bytes32 shareOftSalt
    );

    event Phase2DeployedAndLaunched(
        address indexed creatorToken,
        address indexed owner,
        address gaugeController,
        address ccaStrategy,
        address oracle,
        address auction
    );

    event Phase2CoreDeployed(
        address indexed creatorToken,
        address indexed owner,
        address gaugeController,
        address ccaStrategy,
        address oracle
    );

    event AuctionDeferred(
        address indexed creatorToken,
        address indexed owner,
        address indexed shareOFT,
        address ccaStrategy,
        uint256 amount,
        uint256 lpReserveAmount
    );

    event AuctionLaunchedDeferred(
        address indexed creatorToken,
        address indexed owner,
        address indexed shareOFT,
        address ccaStrategy,
        uint256 amount,
        address auction
    );

    event Phase3StrategiesDeployed(
        address indexed creatorToken,
        address indexed owner,
        address indexed vault,
        address v3Pool,
        address charmVault,
        address charmStrategy,
        address ajnaVaultAuth,
        address ajnaVault,
        address ajnaStrategy,
        address solanaStrategy,
        uint256 charmWeightBps,
        uint256 ajnaWeightBps,
        uint256 solanaWeightBps
    );

    event UniV4StrategiesDeployed(
        address indexed creatorToken,
        address indexed owner,
        address indexed vault,
        address hookRegistry,
        address fullRangeStrategy,
        address concentratedStrategy,
        address limitOrderStrategy,
        address creatorLPManager,
        address poolHook,
        address registryOwner
    );

    event CreatorShareVestingDeployed(
        address indexed shareOFT,
        address indexed beneficiary,
        address vesting,
        uint256 amount,
        uint64 startTimestamp,
        uint64 durationSeconds
    );

    event ShareAllocationBridgedToSolana(
        address indexed creatorToken,
        address indexed owner,
        address indexed shareOFT,
        uint256 amount,
        bytes32 solanaDestination
    );

    event SolanaConfigSet(address indexed adapter, bytes32 solanaDestination);
    event OVaultRuntimeConfigSet(address indexed hubComposer, uint32 indexed solanaEid, bool enabled);
    event VaultRolePolicyConfigSet(address indexed manager, uint256 indexed policyId);

    constructor(
        address _registry,
        address _bytecodeStore,
        address _create2Deployer,
        address _protocolTreasury,
        address _protocolAutomation,
        address _poolManager,
        address _taxHook,
        address _chainlinkEthUsd,
        address _vaultActivationBatcher,
        address _lotteryManager,
        address _permit2,
        address _usdc,
        address _uniswapV3Factory,
        address _uniswapRouter,
        address _ajnaFactory,
        address _vaultCoreModule,
        address _vaultStrategiesModule,
        address _vaultAdminModule,
        address _phase2Module,
        address _phase3Helper,
        address _uniV4Helper,
        address _utilsHelper
    ) {
        // Stack-depth fix (fixup5f): interleave each param's zero-check immediately
        // before its assignment so the Yul optimizer lazy-loads each calldataload
        // value just before its first use rather than holding all 18 simultaneously
        // live at the first grouped check. Multi-use params are read from their state
        // vars in the helper deployments below (calldataload values freed above).
        if (_registry == address(0)) revert ZeroAddress();
        registry = ICreatorRegistry(_registry);

        if (_bytecodeStore == address(0)) revert ZeroAddress();
        bytecodeStore = IUniversalBytecodeStore(_bytecodeStore);

        if (_create2Deployer == address(0)) revert ZeroAddress();
        create2Deployer = IUniversalCreate2DeployerFromStore(_create2Deployer);

        if (_protocolTreasury == address(0)) revert ZeroAddress();
        protocolTreasury = _protocolTreasury;

        if (_protocolAutomation == address(0)) revert ZeroAddress();

        if (_poolManager == address(0)) revert ZeroAddress();
        poolManager = _poolManager;

        if (_taxHook == address(0)) revert ZeroAddress();
        taxHook = _taxHook;

        if (_chainlinkEthUsd == address(0)) revert ZeroAddress();
        chainlinkEthUsd = _chainlinkEthUsd;

        vaultActivationBatcher = _vaultActivationBatcher;
        lotteryManager = _lotteryManager;
        permit2 = _permit2;

        if (_usdc == address(0)) revert ZeroAddress();
        usdc = _usdc;

        if (_uniswapV3Factory == address(0)) revert ZeroAddress();
        uniswapV3Factory = _uniswapV3Factory;

        if (_uniswapRouter == address(0)) revert ZeroAddress();
        uniswapRouter = _uniswapRouter;

        if (_ajnaFactory == address(0)) revert ZeroAddress();
        ajnaFactory = _ajnaFactory;

        if (_vaultCoreModule == address(0)) revert ZeroAddress();
        vaultCoreModule = _vaultCoreModule;

        if (_vaultStrategiesModule == address(0)) revert ZeroAddress();
        vaultStrategiesModule = _vaultStrategiesModule;

        if (_vaultAdminModule == address(0)) revert ZeroAddress();
        vaultAdminModule = _vaultAdminModule;

        // CREATE2 shell path: pass zero for all helper slots and wire post-deploy via
        // wireDeploymentHelpers + setPhase1Module (Safe). Non-shell paths must pass
        // pre-deployed helper addresses (no inline `new` — keeps initcode under EIP-3860).
        bool shellMode = _phase2Module == address(0) && _phase3Helper == address(0) && _uniV4Helper == address(0)
            && _utilsHelper == address(0);

        if (!shellMode) {
            if (
                _phase2Module == address(0) || _phase3Helper == address(0) || _uniV4Helper == address(0)
                    || _utilsHelper == address(0)
            ) {
                revert ZeroAddress();
            }
            phase2Module = DeploymentBatcherPhase2Module(_phase2Module);
            phase3Helper = DeploymentBatcherPhase3Helper(_phase3Helper);
            uniV4Helper = DeploymentBatcherUniV4Helper(_uniV4Helper);
            utilsHelper = DeploymentBatcherUtilsHelper(_utilsHelper);
        }

        require(block.chainid == 8453, "DeploymentBatcher: Base only");
    }

    // ================================
    // PHASE 1
    // ================================

    function deployPhase1CoreWithSalt(
        Phase1Params calldata params,
        CodeIds calldata codeIds,
        bytes32 shareOftSaltOverride
    ) external nonReentrant returns (Phase1Result memory out) {
        return _deployPhase1CoreInternal(params, codeIds, shareOftSaltOverride);
    }

    function finalizePhase1WithSalt(
        Phase1Params calldata params,
        CodeIds calldata codeIds,
        bytes32 shareOftSaltOverride
    ) external nonReentrant returns (Phase1Result memory out) {
        return _finalizePhase1InternalSplit(params, codeIds, shareOftSaltOverride);
    }

    function _deployPhase1CoreInternal(
        Phase1Params calldata params,
        CodeIds calldata codeIds,
        bytes32 shareOftSaltOverride
    )
        internal
        returns (Phase1Result memory out)
    {
        _requireOwner(params.owner);
        if (address(phase1Module) == address(0)) revert Phase1ModuleMissing();

        bytes32 baseSalt = utilsHelper.deriveBaseSalt(params.creatorToken, params.owner, block.chainid, params.version);
        Phase1SplitState memory existing = phase1SplitStates[baseSalt];
        bool wasCoreDone = existing.coreDone;
        bytes memory moduleOut = _delegatePhase1(
            abi.encodeWithSelector(
                DeploymentBatcherPhase1Module.deployPhase1Core.selector, params, codeIds, existing, shareOftSaltOverride
            )
        );
        Phase1SplitState memory newState;
        (out, newState) = abi.decode(moduleOut, (Phase1Result, Phase1SplitState));
        phase1SplitStates[baseSalt] = newState;

        if (!wasCoreDone && newState.coreDone) {
            emit Phase1CoreDeployed(
                params.creatorToken,
                params.owner,
                out.oftBootstrapRegistry,
                out.vault,
                out.wrapper,
                newState.shareOftSalt
            );
        }
    }

    function _finalizePhase1InternalSplit(
        Phase1Params calldata params,
        CodeIds calldata codeIds,
        bytes32 shareOftSaltOverride
    )
        internal
        returns (Phase1Result memory out)
    {
        _requireOwner(params.owner);
        if (address(phase1Module) == address(0)) revert Phase1ModuleMissing();

        bytes32 baseSalt = utilsHelper.deriveBaseSalt(params.creatorToken, params.owner, block.chainid, params.version);
        Phase1SplitState memory existing = phase1SplitStates[baseSalt];
        bool wasFinalized = existing.finalized;
        bytes memory moduleOut = _delegatePhase1(
            abi.encodeWithSelector(
                DeploymentBatcherPhase1Module.finalizePhase1Split.selector,
                params,
                codeIds,
                existing,
                shareOftSaltOverride
            )
        );
        Phase1SplitState memory newState;
        (out, newState) = abi.decode(moduleOut, (Phase1Result, Phase1SplitState));
        phase1SplitStates[baseSalt] = newState;

        if (!wasFinalized && newState.finalized) {
            emit Phase1Deployed(
                params.creatorToken, params.owner, out.oftBootstrapRegistry, out.vault, out.wrapper, out.shareOFT
            );
        }
    }

    // ================================
    // PHASE 2
    // ================================

    function deployPhase2Core(Phase2CoreParams calldata params, CodeIds calldata codeIds)
        external
        nonReentrant
        returns (Phase2Result memory out)
    {
        out = _deployPhase2CoreInternal(params, codeIds, vaultRolePolicyId);
        emit Phase2CoreDeployed(params.creatorToken, params.owner, out.gaugeController, out.ccaStrategy, out.oracle);
    }

    /**
     * @notice Optional policy-aware variant for deploy-session guarded flows.
     * @dev Existing `deployPhase2Core` behavior remains unchanged and uses the
     *      globally configured `vaultRolePolicyId`.
     */
    function deployPhase2CoreWithRolePolicy(
        Phase2CoreParams calldata params,
        CodeIds calldata codeIds,
        uint256 rolePolicyId
    ) external nonReentrant returns (Phase2Result memory out) {
        out = _deployPhase2CoreInternal(params, codeIds, rolePolicyId);
        emit Phase2CoreDeployed(params.creatorToken, params.owner, out.gaugeController, out.ccaStrategy, out.oracle);
    }

    function _deployPhase2CoreInternal(
        Phase2CoreParams calldata params,
        CodeIds calldata codeIds,
        uint256 rolePolicyId
    ) internal returns (Phase2Result memory out) {
        _requireOwner(params.owner);
        bytes32 baseSalt = utilsHelper.deriveBaseSalt(params.creatorToken, params.owner, block.chainid, params.version);
        Phase1SplitState memory p1state = phase1SplitStates[baseSalt];
        string memory shareSymbolLower = utilsHelper.toLower(params.shareSymbol);
        bytes memory outData = _delegatePhase2(
            abi.encodeWithSelector(
                DeploymentBatcherPhase2Module.deployPhase2CoreOrchestrator.selector,
                params,
                codeIds,
                baseSalt,
                shareSymbolLower,
                p1state,
                vaultRolePolicyManager,
                rolePolicyId
            )
        );
        out = abi.decode(outData, (Phase2Result));
    }

    function finalizePhase2(Phase2FinalizeParams calldata params)
        external
        payable
        nonReentrant
        returns (Phase2Result memory out)
    {
        _requireOwner(params.owner);
        bytes32 baseSalt = utilsHelper.deriveBaseSalt(params.creatorToken, params.owner, block.chainid, params.version);
        Phase1SplitState memory p1state = phase1SplitStates[baseSalt];
        bytes memory moduleOut = _delegatePhase2(
            abi.encodeWithSelector(
                DeploymentBatcherPhase2Module.finalizePhase2Entry.selector, params, p1state, baseSalt
            )
        );
        DeploymentBatcherPhase2Module.FinalizeEntryResult memory result =
            abi.decode(moduleOut, (DeploymentBatcherPhase2Module.FinalizeEntryResult));
        _recordFinalizePhase2Effects(params, baseSalt, result.phase2, result.execution);
        return result.phase2;
    }

    function finalizePhase2WithPermit2(
        Phase2FinalizeParams calldata params,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external payable nonReentrant returns (Phase2Result memory out) {
        _requireOwner(params.owner);
        bytes32 baseSalt = utilsHelper.deriveBaseSalt(params.creatorToken, params.owner, block.chainid, params.version);
        Phase1SplitState memory p1state = phase1SplitStates[baseSalt];
        bytes memory moduleOut = _delegatePhase2(
            abi.encodeWithSelector(
                DeploymentBatcherPhase2Module.finalizePhase2EntryWithPermit2.selector,
                params,
                p1state,
                baseSalt,
                permit2,
                permit,
                signature
            )
        );
        DeploymentBatcherPhase2Module.FinalizeEntryResult memory result =
            abi.decode(moduleOut, (DeploymentBatcherPhase2Module.FinalizeEntryResult));
        _recordFinalizePhase2Effects(params, baseSalt, result.phase2, result.execution);
        return result.phase2;
    }

    function _recordFinalizePhase2Effects(
        Phase2FinalizeParams calldata params,
        bytes32 baseSalt,
        Phase2Result memory out,
        DeploymentBatcherPhase2Module.FinalizeExecutionResult memory execution
    ) internal {
        if (execution.auctionAmount > 0) {
            PendingAuction storage pending = pendingAuctions[baseSalt];
            if (pending.amount != 0) revert AuctionAlreadyPending();
            bytes32 tokenOwnerKey = keccak256(abi.encodePacked(params.creatorToken, params.owner));
            if (hasActivePendingAuction[tokenOwnerKey]) {
                revert AuctionAlreadyPendingForToken(params.creatorToken, params.owner);
            }
            hasActivePendingAuction[tokenOwnerKey] = true;
            pendingAuctions[baseSalt] = PendingAuction({
                shareOFT: params.shareOFT,
                ccaStrategy: params.ccaStrategy,
                amount: execution.auctionAmount,
                lpReserveAmount: execution.lpReserveAmount
            });
            emit AuctionDeferred(
                params.creatorToken,
                params.owner,
                params.shareOFT,
                params.ccaStrategy,
                execution.auctionAmount,
                execution.lpReserveAmount
            );
        }

        if (execution.vestingAmount > 0) {
            emit CreatorShareVestingDeployed(
                params.shareOFT,
                params.owner,
                execution.vestingAddress,
                execution.vestingAmount,
                execution.vestingStartTimestamp,
                execution.vestingDurationSeconds
            );
        }

        if (execution.solanaAmount > 0) {
            emit ShareAllocationBridgedToSolana(
                params.creatorToken, params.owner, params.shareOFT, execution.solanaAmount, solanaDestination
            );
        }

        emit Phase2DeployedAndLaunched(
            params.creatorToken, params.owner, params.gaugeController, params.ccaStrategy, params.oracle, out.auction
        );
    }

    function launchDeferredAuction(DeferredAuctionParams calldata params)
        external
        nonReentrant
        returns (address auction)
    {
        _requireOwner(params.owner);
        if (params.creatorToken == address(0) || params.owner == address(0) || params.shareOFT == address(0)) {
            revert ZeroAddress();
        }

        bytes32 baseSalt = utilsHelper.deriveBaseSalt(params.creatorToken, params.owner, block.chainid, params.version);
        PendingAuction memory pending = pendingAuctions[baseSalt];
        if (pending.amount == 0) revert NoPendingAuction();
        if (pending.shareOFT != params.shareOFT) revert AuctionShareOFTMismatch();

        bytes memory moduleOut = _delegatePhase2(
            abi.encodeWithSelector(
                DeploymentBatcherPhase2Module.launchDeferredAuctionExecution.selector,
                params.shareOFT,
                pending.ccaStrategy,
                pending.amount,
                pending.lpReserveAmount,
                params.floorPriceQ96,
                params.requiredRaise,
                params.auctionSteps
            )
        );
        auction = abi.decode(moduleOut, (address));

        delete pendingAuctions[baseSalt];
        bytes32 tokenOwnerKey = keccak256(abi.encodePacked(params.creatorToken, params.owner));
        hasActivePendingAuction[tokenOwnerKey] = false;

        emit AuctionLaunchedDeferred(
            params.creatorToken, params.owner, params.shareOFT, pending.ccaStrategy, pending.amount, auction
        );
    }

    // ================================
    // PHASE 3 (STRATEGIES)
    // ================================

    /**
     * @notice Deploy + register initial yield strategies (Charm + Ajna).
     * @dev Solana share liquidity is seeded at finalizePhase2 via ShareOFT auto-bridge.
     */
    function deployPhase3Strategies(Phase3Params calldata params, StrategyCodeIds calldata codeIds)
        external
        nonReentrant
        returns (Phase3Result memory out)
    {
        _requireOwner(params.owner);
        bytes32 baseSalt = utilsHelper.deriveBaseSalt(params.creatorToken, params.owner, block.chainid, params.version);
        out = phase3Helper.deployPhase3Strategies(params, codeIds, baseSalt);

        // Vault management stays on the batcher shell after finalizePhase2 ownership
        // transfer; Phase 3 helper is an external module so it must not call addStrategy.
        if (params.charmWeightBps != 0) {
            ICreatorOVaultStrategyManager(params.vault).addStrategy(out.charmStrategy, params.charmWeightBps);
        }
        if (params.ajnaWeightBps != 0) {
            ICreatorOVaultStrategyManager(params.vault).addStrategy(out.ajnaStrategy, params.ajnaWeightBps);
        }
        if (params.enableAutoAllocate) {
            ICreatorOVaultStrategyManager(params.vault).setAutoAllocate(true);
        }

        emit Phase3StrategiesDeployed(
            params.creatorToken,
            params.owner,
            params.vault,
            out.v3Pool,
            out.charmVault,
            out.charmStrategy,
            out.ajnaVaultAuth,
            out.ajnaVault,
            out.ajnaStrategy,
            out.solanaStrategy,
            params.charmWeightBps,
            params.ajnaWeightBps,
            params.solanaWeightBps
        );
    }

    /**
     * @notice Deploy + configure UniV4 strategy set with approved-hook enforcement.
     * @dev Deploys a hook registry + FullRange + Concentrated + LimitOrder + CreatorLPManager,
     *      configures all pools using the same hook, then transfers ownerships.
     */
    function deployUniV4Strategies(UniV4DeployParams calldata params, UniV4CodeIds calldata codeIds)
        external
        nonReentrant
        returns (UniV4DeploymentResult memory out)
    {
        _requireOwner(params.owner);
        bytes32 baseSalt = utilsHelper.deriveBaseSalt(params.creatorToken, params.owner, block.chainid, params.version);
        out = uniV4Helper.deployUniV4Strategies(params, codeIds, baseSalt);

        emit UniV4StrategiesDeployed(
            params.creatorToken,
            params.owner,
            params.vault,
            out.hookRegistry,
            out.fullRangeStrategy,
            out.concentratedStrategy,
            out.limitOrderStrategy,
            out.creatorLPManager,
            params.poolHook,
            params.registryOwner
        );
    }

    // ================================
    // SOLANA CONFIG (ADMIN)
    // ================================

    /**
     * @notice Set Solana bridge adapter + destination configuration.
     * @dev `solanaDestination` is the LayerZero recipient for the 30% share allocation
     *      auto-bridge executed during finalizePhase2 (Solana seed wallet / mesh custody).
     */
    function setSolanaConfig(address _adapter, bytes32 _destination) external onlyProtocolTreasury {
        solanaBridgeAdapter = _adapter;
        solanaDestination = _destination;
    }

    /**
     * @notice Set the platform default Solana ShareOFT peer used when registry peer is unset.
     * @dev Finalize auto-registers the creator coin, seeds registry from this default, then setPeer on ShareOFT.
     */
    function setSolanaShareOftPeer(bytes32 _peer) external onlyProtocolTreasury {
        solanaShareOftPeer = _peer;
    }

    /**
     * @notice Wire CREATE2-deployed helper modules after the batcher shell is live.
     * @dev One-shot Safe batch for initial cutover; `setPhase2Module` remains for hot-swap.
     */
    function wireDeploymentHelpers(
        address _phase2Module,
        address _phase3Helper,
        address _uniV4Helper,
        address _utilsHelper
    ) external onlyProtocolTreasury {
        phase2Module = DeploymentBatcherPhase2Module(_phase2Module);
        phase3Helper = DeploymentBatcherPhase3Helper(_phase3Helper);
        uniV4Helper = DeploymentBatcherUniV4Helper(_uniV4Helper);
        utilsHelper = DeploymentBatcherUtilsHelper(_utilsHelper);
    }

    /**
     * @notice Hot-swap the Phase 2 delegatecall module after deploying a replacement `DeploymentBatcherPhase2Module`.
     * @dev The replacement module must declare this batcher as its immutable `batcher` context.
     */
    function setPhase2Module(address _phase2Module) external onlyProtocolTreasury {
        if (_phase2Module == address(0)) revert ZeroAddress();
        if (DeploymentBatcherPhase2Module(_phase2Module).batcher() != address(this)) revert InvalidPhase2Module();
        phase2Module = DeploymentBatcherPhase2Module(_phase2Module);
    }

    function setPhase1Module(address _phase1Module) external onlyProtocolTreasury {
        if (_phase1Module == address(0)) revert ZeroAddress();
        if (DeploymentBatcherPhase1Module(_phase1Module).batcher() != address(this)) revert InvalidPhase1Module();
        phase1Module = DeploymentBatcherPhase1Module(_phase1Module);
    }

    /**
     * @notice Configure OVault runtime composer + Solana EID.
     * @dev Enabled configs require a non-zero composer and EID.
     */
    function setOVaultRuntimeConfig(address _hubComposer, uint32 _solanaEid, bool _enabled) external onlyProtocolTreasury {
        if (_enabled) {
            if (_hubComposer == address(0)) revert ZeroAddress();
            if (_solanaEid == 0) revert InvalidSolanaEid();
        }
        ovaultRuntimeConfig = OVaultRuntimeConfig({hubComposer: _hubComposer, solanaEid: _solanaEid, enabled: _enabled});
    }

    function getOVaultRuntimeConfig() external view returns (OVaultRuntimeConfig memory) {
        return ovaultRuntimeConfig;
    }

    /**
     * @notice Configure optional role-policy validation for phase-2 deployment.
     * @dev Set `manager = address(0)` to disable policy checks entirely.
     */
    function setVaultRolePolicyConfig(address manager, uint256 policyId) external onlyProtocolTreasury {
        if (manager != address(0) && manager.code.length == 0) revert InvalidRolePolicyManager();
        vaultRolePolicyManager = manager;
        vaultRolePolicyId = policyId;
        emit VaultRolePolicyConfigSet(manager, policyId);
    }

    // FIX: F-26 — admin function to clear stuck Phase 1 state so (creatorToken, owner, version)
    // tuples are not permanently blocked by stale/abandoned deployments.
    // The reset must be tuple-scoped so callers cannot accidentally clear an
    // unrelated deployment state.
    function resetPhase1State(address creatorToken, address owner, string calldata version) external onlyProtocolTreasury {
        if (creatorToken == address(0) || owner == address(0)) revert ZeroAddress();
        bytes32 baseSalt = utilsHelper.deriveBaseSalt(creatorToken, owner, block.chainid, version);
        Phase1SplitState storage state = phase1SplitStates[baseSalt];
        // Only allow reset if Phase 1 was started but Phase 2 has not consumed it
        // (i.e., pending auction for this salt must not exist).
        if (state.vault == address(0)) revert Phase1StateNotStuck();
        PendingAuction storage pending = pendingAuctions[baseSalt];
        if (pending.amount != 0) revert AuctionAlreadyPending();
        delete phase1SplitStates[baseSalt];
    }

    // ================================
    // HELPERS
    // ================================

    function _requireOwner(address owner) internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    function _delegatePhase1(bytes memory callData) internal returns (bytes memory result) {
        (bool ok, bytes memory outData) = address(phase1Module).delegatecall(callData);
        if (!ok) {
            assembly {
                revert(add(outData, 0x20), mload(outData))
            }
        }
        return outData;
    }

    function _delegatePhase2(bytes memory callData) internal returns (bytes memory result) {
        (bool ok, bytes memory outData) = address(phase2Module).delegatecall(callData);
        if (!ok) {
            assembly {
                revert(add(outData, 0x20), mload(outData))
            }
        }
        return outData;
    }
}
