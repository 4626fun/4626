// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ICreatorRegistry} from "../../interfaces/core/ICreatorRegistry.sol";
import {ICreatorGaugeController} from "../../interfaces/core/ICreatorGaugeController.sol";
import {ICreatorOVault} from "../../interfaces/core/ICreatorOVault.sol";
import {CreatorLinearVesting} from "../vesting/CreatorLinearVesting.sol";

interface IUniversalCreate2DeployerFromStore {
    function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr);
    function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address);
}

interface IUniversalBytecodeStore {
    function get(bytes32 codeId) external view returns (bytes memory);
}

interface ICreatorCoin {
    function setPayoutRecipient(address _recipient) external;
}

interface ICreatorOVaultWrapper {
    function setShareOFT(address _shareOFT) external;
    function wrap(uint256 amount) external returns (uint256 wsTokens);
    function transferOwnership(address newOwner) external;
}

interface ICreatorShareOFT {
    function setRegistry(address _registry) external;
    function setVault(address _vault) external;
    function setMinter(address minter, bool status) external;
    function setGaugeController(address _controller) external;
    function setHubConfig(bool _isHub, uint32 _hubEid, address _hubGaugeReceiver) external;
    function setHubLotteryPeer(uint32 _hubEid, bytes32 _hubLotteryPeer) external;
    function setPeer(uint32 _eid, bytes32 _peer) external;
    function transferOwnership(address newOwner) external;
}

interface ICCALaunchStrategy {
    function setApprovedLauncher(address launcher, bool approved) external;
    function setOracleConfig(address _oracle, address _poolManager, address _taxHook, address _feeRecipient) external;
    function setDefaultTickSpacing(uint256 _spacing) external;
    function launchAuction(
        uint256 amount,
        uint256 floorPrice,
        uint128 requiredRaise,
        bytes calldata auctionSteps
    ) external returns (address auction);
    function transferOwnership(address newOwner) external;
}

interface IOwnableTransfer {
    function transferOwnership(address newOwner) external;
}

interface IOFTBootstrapRegistry {
    function setLayerZeroEndpoint(uint16 chainId, address endpoint) external;
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
    function createVault(
        address pool,
        address manager,
        uint256 maxTotalSupply,
        int24 baseThreshold,
        int24 limitThreshold,
        uint24 fullRangeWeight,
        uint32 period,
        string memory name,
        string memory symbol
    ) external returns (address vault);
}

interface ICreatorCharmStrategy {
    function initializeApprovals() external;
}

interface ICreatorOVaultStrategyManager {
    function addStrategy(address strategy, uint256 weight) external;
    function setAutoAllocate(bool autoAllocate) external;
}

/**
 * @title CreatorVaultDeployer
 * @author 0xakita.eth
 * @notice Multi-transaction CreatorVault deployment orchestrator (Phases 1–3).
 * @dev We can no longer deploy the full stack in one transaction on Base due to code-deposit gas limits.
 *      This contract splits deployment into multiple calls:
 *      - Phase 1: deploy vault + wrapper + shareOFT + minimal wiring (no token pulls / no auction)
 *      - Phase 2a: deploy gauge + CCA + oracle + wiring (no token pulls)
 *      - Phase 2b: deposit + vesting + ownership transfers (plus optional deferred auction)
 */
contract CreatorVaultDeployer is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint24 public constant V3_FEE_TIER = 3000; // 0.3% CREATOR/USDC pool
    
    /// @notice Charm Finance Alpha Vault Factory on Base
    /// @dev Vaults created via this factory appear on alpha.charm.fi UI
    address public constant CHARM_FACTORY = 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa;

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

    struct Phase2Params {
        address creatorToken;
        address owner;
        address creatorTreasury;
        address payoutRecipient;
        address vault;
        address wrapper;
        address shareOFT;
        string shareSymbol;
        string version;
        uint256 depositAmount;
        uint8 auctionPercent;
        uint128 requiredRaise;
        uint256 floorPriceQ96;
        bytes auctionSteps;
    }

    struct Phase2CoreParams {
        address creatorToken;
        address owner;
        address creatorTreasury;
        address payoutRecipient;
        address vault;
        address wrapper;
        address shareOFT;
        string shareSymbol;
        string version;
        uint256 floorPriceQ96;
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
        uint8 auctionPercent;
        uint128 requiredRaise;
        uint256 floorPriceQ96;
        bytes auctionSteps;
    }

    struct PermitData {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct Phase1Result {
        address oftBootstrapRegistry;
        address vault;
        address wrapper;
        address shareOFT;
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
    }

    struct DeferredAuctionParams {
        address creatorToken;
        address owner;
        address shareOFT;
        string version;
        uint256 floorPriceQ96;
        uint128 requiredRaise;
        bytes auctionSteps;
    }

    struct StrategyCodeIds {
        bytes32 charmAlphaVaultDeploy;
        bytes32 creatorCharmStrategy;
        bytes32 ajnaStrategy;
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
        uint256 charmWeightBps;
        uint256 ajnaWeightBps;
        bool enableAutoAllocate;
    }

    struct Phase3Result {
        address v3Pool;
        address charmVault;
        address charmStrategy;
        address ajnaStrategy;
    }

    error ZeroAddress();
    error InvalidPercent();
    error InvalidCodeId();
    error NotOwner();
    error Phase1Missing();
    error InvalidWeight();
    error V3PoolMissing();
    error MissingInitialSqrtPriceX96();
    error AuctionAlreadyPending();
    error NoPendingAuction();
    error AuctionShareOFTMismatch();
    error AuctionAmountMismatch();
    error Phase2Missing();

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

    /// @notice Pending auction allocations keyed by creator/owner/version salt.
    mapping(bytes32 => PendingAuction) public pendingAuctions;

    event Phase1Deployed(
        address indexed creatorToken,
        address indexed owner,
        address oftBootstrapRegistry,
        address vault,
        address wrapper,
        address shareOFT
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
        uint256 amount
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
        address ajnaStrategy,
        uint256 charmWeightBps,
        uint256 ajnaWeightBps
    );

    event CreatorShareVestingDeployed(
        address indexed shareOFT,
        address indexed beneficiary,
        address vesting,
        uint256 amount,
        uint64 startTimestamp,
        uint64 durationSeconds
    );

    constructor(
        address _registry,
        address _bytecodeStore,
        address _create2Deployer,
        address _protocolTreasury,
        address _poolManager,
        address _taxHook,
        address _chainlinkEthUsd,
        address _vaultActivationBatcher,
        address _lotteryManager,
        address _permit2,
        address _usdc,
        address _uniswapV3Factory,
        address _uniswapRouter,
        address _ajnaFactory
    ) {
        if (_registry == address(0) || _bytecodeStore == address(0) || _create2Deployer == address(0)) revert ZeroAddress();
        if (_protocolTreasury == address(0) || _poolManager == address(0) || _taxHook == address(0)) revert ZeroAddress();
        if (_chainlinkEthUsd == address(0)) revert ZeroAddress();
        if (_usdc == address(0) || _uniswapV3Factory == address(0) || _uniswapRouter == address(0) || _ajnaFactory == address(0)) {
            revert ZeroAddress();
        }

        registry = ICreatorRegistry(_registry);
        bytecodeStore = IUniversalBytecodeStore(_bytecodeStore);
        create2Deployer = IUniversalCreate2DeployerFromStore(_create2Deployer);
        protocolTreasury = _protocolTreasury;
        poolManager = _poolManager;
        taxHook = _taxHook;
        chainlinkEthUsd = _chainlinkEthUsd;
        vaultActivationBatcher = _vaultActivationBatcher;
        lotteryManager = _lotteryManager;
        permit2 = _permit2;
        usdc = _usdc;
        uniswapV3Factory = _uniswapV3Factory;
        uniswapRouter = _uniswapRouter;
        ajnaFactory = _ajnaFactory;
    }

    // ================================
    // PHASE 1
    // ================================

    function deployPhase1(
        Phase1Params calldata params,
        CodeIds calldata codeIds
    ) external nonReentrant returns (Phase1Result memory out) {
        return _deployPhase1Internal(params, codeIds, bytes32(0));
    }

    function deployPhase1WithSalt(
        Phase1Params calldata params,
        CodeIds calldata codeIds,
        bytes32 shareOftSaltOverride
    ) external nonReentrant returns (Phase1Result memory out) {
        return _deployPhase1Internal(params, codeIds, shareOftSaltOverride);
    }

    function _deployPhase1Internal(
        Phase1Params calldata params,
        CodeIds calldata codeIds,
        bytes32 shareOftSaltOverride
    ) internal returns (Phase1Result memory out) {
        _requireOwner(params.owner);
        if (params.creatorToken == address(0) || params.owner == address(0)) revert ZeroAddress();
        _requirePhase1CodeIds(codeIds);

        // Batcher owns the contracts until Phase 2 completes final wiring + ownership transfers.
        address tempOwner = address(this);

        // Keep a deterministic, case-insensitive key for CREATE2 salts and oracle wiring,
        // but preserve the creator-facing symbol display on the token itself.
        string memory shareSymbolLower = _toLower(params.shareSymbol);
        string memory shareSymbolUpper = _toUpper(params.shareSymbol);

        bytes32 baseSalt = _deriveBaseSalt(params.creatorToken, params.owner, params.version);
        bytes32 vaultSalt = _saltFor(baseSalt, "vault");
        bytes32 wrapperSalt = _saltFor(baseSalt, "wrapper");
        bytes32 shareOftSalt = shareOftSaltOverride == bytes32(0)
            ? _deriveShareOftSalt(params.owner, shareSymbolLower, params.version)
            : shareOftSaltOverride;

        // OFT bootstrap registry is chain-global + constructor-less ⇒ initCodeHash == codeId.
        bytes32 oftBootstrapSalt = keccak256("CreatorVault:OFTBootstrapRegistry:v1");
        out.oftBootstrapRegistry = create2Deployer.computeAddress(oftBootstrapSalt, codeIds.oftBootstrap);
        if (out.oftBootstrapRegistry.code.length == 0) {
            create2Deployer.deploy(oftBootstrapSalt, codeIds.oftBootstrap, bytes(""));
        }

        address lzEndpoint = registry.getLayerZeroEndpoint(uint16(block.chainid));
        IOFTBootstrapRegistry(out.oftBootstrapRegistry).setLayerZeroEndpoint(uint16(block.chainid), lzEndpoint);

        bytes memory vaultArgs = abi.encode(params.creatorToken, tempOwner, params.vaultName, params.vaultSymbol);
        out.vault = create2Deployer.deploy(vaultSalt, codeIds.vault, vaultArgs);

        bytes memory wrapperArgs = abi.encode(params.creatorToken, out.vault, tempOwner);
        out.wrapper = create2Deployer.deploy(wrapperSalt, codeIds.wrapper, wrapperArgs);

        // Token metadata: always uppercase the symbol (e.g. ■AKITA) for consistency on explorers.
        bytes memory shareOftArgs = abi.encode(params.shareName, shareSymbolUpper, out.oftBootstrapRegistry, tempOwner);
        out.shareOFT = create2Deployer.deploy(shareOftSalt, codeIds.shareOFT, shareOftArgs);

        // Minimal wiring so Phase 2 can proceed without redeploying Phase 1 components.
        ICreatorOVaultWrapper(out.wrapper).setShareOFT(out.shareOFT);
        ICreatorShareOFT(out.shareOFT).setRegistry(address(registry));
        ICreatorShareOFT(out.shareOFT).setVault(out.vault);
        ICreatorShareOFT(out.shareOFT).setMinter(out.wrapper, true);
        
        // Hub-centric: mark this as the hub chain deployment (isHub=true)
        ICreatorShareOFT(out.shareOFT).setHubConfig(true, 0, address(0));

        ICreatorOVault(out.vault).setWhitelist(out.wrapper, true);
        ICreatorOVault(out.vault).setWhitelist(address(this), true);
        if (vaultActivationBatcher != address(0)) {
            ICreatorOVault(out.vault).setWhitelist(vaultActivationBatcher, true);
        }

        emit Phase1Deployed(params.creatorToken, params.owner, out.oftBootstrapRegistry, out.vault, out.wrapper, out.shareOFT);
    }

    // ================================
    // PHASE 2
    // ================================

    function deployPhase2AndLaunch(
        Phase2Params calldata params,
        CodeIds calldata codeIds
    ) external nonReentrant returns (Phase2Result memory out) {
        _requireOwner(params.owner);
        _pullCreatorTokens(params.creatorToken, params.owner, params.depositAmount);
        Phase2Result memory coreOut = _deployPhase2Core(
            Phase2CoreParams({
                creatorToken: params.creatorToken,
                owner: params.owner,
                creatorTreasury: params.creatorTreasury,
                payoutRecipient: params.payoutRecipient,
                vault: params.vault,
                wrapper: params.wrapper,
                shareOFT: params.shareOFT,
                shareSymbol: params.shareSymbol,
                version: params.version,
                floorPriceQ96: params.floorPriceQ96
            }),
            codeIds
        );
        out = _finalizePhase2Internal(
            Phase2FinalizeParams({
                creatorToken: params.creatorToken,
                owner: params.owner,
                vault: params.vault,
                wrapper: params.wrapper,
                shareOFT: params.shareOFT,
                gaugeController: coreOut.gaugeController,
                ccaStrategy: coreOut.ccaStrategy,
                oracle: coreOut.oracle,
                version: params.version,
                depositAmount: params.depositAmount,
                auctionPercent: params.auctionPercent,
                requiredRaise: params.requiredRaise,
                floorPriceQ96: params.floorPriceQ96,
                auctionSteps: params.auctionSteps
            })
        );
    }

    function deployPhase2AndLaunchWithPermit(
        Phase2Params calldata params,
        CodeIds calldata codeIds,
        PermitData calldata permit
    ) external nonReentrant returns (Phase2Result memory out) {
        _requireOwner(params.owner);
        _permitAndPull(params.creatorToken, params.owner, params.depositAmount, permit);
        Phase2Result memory coreOut = _deployPhase2Core(
            Phase2CoreParams({
                creatorToken: params.creatorToken,
                owner: params.owner,
                creatorTreasury: params.creatorTreasury,
                payoutRecipient: params.payoutRecipient,
                vault: params.vault,
                wrapper: params.wrapper,
                shareOFT: params.shareOFT,
                shareSymbol: params.shareSymbol,
                version: params.version,
                floorPriceQ96: params.floorPriceQ96
            }),
            codeIds
        );
        out = _finalizePhase2Internal(
            Phase2FinalizeParams({
                creatorToken: params.creatorToken,
                owner: params.owner,
                vault: params.vault,
                wrapper: params.wrapper,
                shareOFT: params.shareOFT,
                gaugeController: coreOut.gaugeController,
                ccaStrategy: coreOut.ccaStrategy,
                oracle: coreOut.oracle,
                version: params.version,
                depositAmount: params.depositAmount,
                auctionPercent: params.auctionPercent,
                requiredRaise: params.requiredRaise,
                floorPriceQ96: params.floorPriceQ96,
                auctionSteps: params.auctionSteps
            })
        );
    }

    function deployPhase2Core(
        Phase2CoreParams calldata params,
        CodeIds calldata codeIds
    ) external nonReentrant returns (Phase2Result memory out) {
        _requireOwner(params.owner);
        out = _deployPhase2Core(params, codeIds);
    }

    function finalizePhase2(
        Phase2FinalizeParams calldata params
    ) external nonReentrant returns (Phase2Result memory out) {
        _requireOwner(params.owner);
        _pullCreatorTokens(params.creatorToken, params.owner, params.depositAmount);
        out = _finalizePhase2Internal(params);
    }

    // ================================
    // PHASE 4: Deferred auction launch
    // ================================

    function launchDeferredAuction(
        DeferredAuctionParams calldata params
    ) external nonReentrant returns (address auction) {
        _requireOwner(params.owner);
        if (params.creatorToken == address(0) || params.owner == address(0) || params.shareOFT == address(0)) revert ZeroAddress();

        bytes32 baseSalt = _deriveBaseSalt(params.creatorToken, params.owner, params.version);
        PendingAuction memory pending = pendingAuctions[baseSalt];
        if (pending.amount == 0) revert NoPendingAuction();
        if (pending.shareOFT != params.shareOFT) revert AuctionShareOFTMismatch();
        if (IERC20(params.shareOFT).balanceOf(address(this)) < pending.amount) revert AuctionAmountMismatch();

        IERC20(params.shareOFT).forceApprove(pending.ccaStrategy, pending.amount);
        auction = ICCALaunchStrategy(pending.ccaStrategy).launchAuction(
            pending.amount,
            params.floorPriceQ96,
            params.requiredRaise,
            params.auctionSteps
        );

        delete pendingAuctions[baseSalt];

        emit AuctionLaunchedDeferred(
            params.creatorToken,
            params.owner,
            params.shareOFT,
            pending.ccaStrategy,
            pending.amount,
            auction
        );
    }

    function _deployPhase2Core(
        Phase2CoreParams memory params,
        CodeIds calldata codeIds
    ) internal returns (Phase2Result memory out) {
        if (params.creatorToken == address(0) || params.owner == address(0)) revert ZeroAddress();
        if (params.vault == address(0) || params.wrapper == address(0) || params.shareOFT == address(0)) revert ZeroAddress();
        _requirePhase2CodeIds(codeIds);

        // Require phase-1 contracts to exist.
        if (params.vault.code.length == 0 || params.wrapper.code.length == 0 || params.shareOFT.code.length == 0) revert Phase1Missing();

        address treasury = params.creatorTreasury == address(0) ? params.owner : params.creatorTreasury;
        address tempOwner = address(this);

        string memory shareSymbolLower = _toLower(params.shareSymbol);

        bytes32 baseSalt = _deriveBaseSalt(params.creatorToken, params.owner, params.version);
        bytes32 gaugeSalt = _saltFor(baseSalt, "gauge");
        bytes32 ccaSalt = _saltFor(baseSalt, "cca");
        bytes32 oracleSalt = _saltFor(baseSalt, "oracle");

        bytes memory gaugeArgs = abi.encode(params.shareOFT, treasury, protocolTreasury, tempOwner);
        out.gaugeController = create2Deployer.deploy(gaugeSalt, codeIds.gauge, gaugeArgs);

        bytes memory ccaArgs = abi.encode(params.shareOFT, address(0), params.vault, params.vault, tempOwner);
        out.ccaStrategy = create2Deployer.deploy(ccaSalt, codeIds.cca, ccaArgs);

        bytes memory oracleArgs = abi.encode(address(registry), chainlinkEthUsd, shareSymbolLower, tempOwner);
        out.oracle = create2Deployer.deploy(oracleSalt, codeIds.oracle, oracleArgs);

        if (params.payoutRecipient != address(0)) {
            ICreatorCoin(params.creatorToken).setPayoutRecipient(params.payoutRecipient);
        }

        // Phase-2 wiring (now that gauge + oracle exist).
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
        ICCALaunchStrategy(out.ccaStrategy).setOracleConfig(out.oracle, poolManager, taxHook, out.gaugeController);
        ICCALaunchStrategy(out.ccaStrategy).setDefaultTickSpacing(_defaultTickSpacingQ96(params.floorPriceQ96));

        emit Phase2CoreDeployed(params.creatorToken, params.owner, out.gaugeController, out.ccaStrategy, out.oracle);
    }

    function _finalizePhase2Internal(
        Phase2FinalizeParams memory params
    ) internal returns (Phase2Result memory out) {
        if (params.creatorToken == address(0) || params.owner == address(0)) revert ZeroAddress();
        if (params.vault == address(0) || params.wrapper == address(0) || params.shareOFT == address(0)) revert ZeroAddress();
        if (params.gaugeController == address(0) || params.ccaStrategy == address(0) || params.oracle == address(0)) revert ZeroAddress();
        if (params.auctionPercent > 100) revert InvalidPercent();

        // Require phase-1 + phase-2 contracts to exist.
        if (params.vault.code.length == 0 || params.wrapper.code.length == 0 || params.shareOFT.code.length == 0) revert Phase1Missing();
        if (params.gaugeController.code.length == 0 || params.ccaStrategy.code.length == 0 || params.oracle.code.length == 0) {
            revert Phase2Missing();
        }

        bytes32 baseSalt = _deriveBaseSalt(params.creatorToken, params.owner, params.version);

        out.gaugeController = params.gaugeController;
        out.ccaStrategy = params.ccaStrategy;
        out.oracle = params.oracle;

        // Deposit + wrap + deferred auction (launch in later phase)
        IERC20(params.creatorToken).forceApprove(params.vault, params.depositAmount);
        uint256 shares = ICreatorOVault(params.vault).deposit(params.depositAmount, address(this));

        IERC20(params.vault).forceApprove(params.wrapper, shares);
        uint256 wsTokens = ICreatorOVaultWrapper(params.wrapper).wrap(shares);

        uint256 auctionAmount = (wsTokens * params.auctionPercent) / 100;
        if (auctionAmount > 0) {
            PendingAuction storage pending = pendingAuctions[baseSalt];
            if (pending.amount != 0) revert AuctionAlreadyPending();
            pendingAuctions[baseSalt] = PendingAuction({
                shareOFT: params.shareOFT,
                ccaStrategy: params.ccaStrategy,
                amount: auctionAmount
            });
            emit AuctionDeferred(params.creatorToken, params.owner, params.shareOFT, params.ccaStrategy, auctionAmount);
        }

        uint256 remaining = wsTokens - auctionAmount;
        if (remaining > 0) {
            // Vest the creator’s ShareOFT allocation to reduce immediate sell pressure.
            // Default: linear over 365 days, no cliff, starting now.
            CreatorLinearVesting vesting = new CreatorLinearVesting(
                params.shareOFT,
                params.owner,
                uint64(block.timestamp),
                uint64(365 days)
            );
            IERC20(params.shareOFT).safeTransfer(address(vesting), remaining);
            emit CreatorShareVestingDeployed(
                params.shareOFT,
                params.owner,
                address(vesting),
                remaining,
                uint64(block.timestamp),
                uint64(365 days)
            );
        }

        // Final ownership (hybrid)
        ICreatorOVault(params.vault).setProtocolRescue(protocolTreasury);
        ICreatorOVault(params.vault).transferOwnership(params.owner);
        ICreatorOVaultWrapper(params.wrapper).transferOwnership(protocolTreasury);
        ICreatorShareOFT(params.shareOFT).transferOwnership(protocolTreasury);
        ICreatorGaugeController(params.gaugeController).transferOwnership(protocolTreasury);
        ICCALaunchStrategy(params.ccaStrategy).transferOwnership(protocolTreasury);
        IOwnableTransfer(params.oracle).transferOwnership(protocolTreasury);

        emit Phase2DeployedAndLaunched(
            params.creatorToken,
            params.owner,
            params.gaugeController,
            params.ccaStrategy,
            params.oracle,
            out.auction
        );
    }

    // ================================
    // PHASE 3 (STRATEGIES)
    // ================================

    /**
     * @notice Deploy + register initial yield strategies (Charm CREATOR/USDC + Ajna lending).
     * @dev Uses UniversalBytecodeStore + CREATE2 deployer to avoid embedding initcode in this batcher.
     */
    function deployPhase3Strategies(
        Phase3Params calldata params,
        StrategyCodeIds calldata codeIds
    ) external nonReentrant returns (Phase3Result memory out) {
        _requireOwner(params.owner);

        if (params.creatorToken == address(0) || params.owner == address(0) || params.vault == address(0)) revert ZeroAddress();
        if (params.charmWeightBps == 0 || params.charmWeightBps > 10_000) revert InvalidWeight();
        if (params.ajnaWeightBps > 10_000) revert InvalidWeight();
        if (params.charmWeightBps + params.ajnaWeightBps > 10_000) revert InvalidWeight();

        if (codeIds.charmAlphaVaultDeploy == bytes32(0) || codeIds.creatorCharmStrategy == bytes32(0)) revert InvalidCodeId();
        if (params.ajnaWeightBps > 0 && codeIds.ajnaStrategy == bytes32(0)) revert InvalidCodeId();

        // ───────────────────────────────
        // 1) Ensure CREATOR/USDC V3 pool exists (0.3% fee)
        // ───────────────────────────────
        address v3Pool = IUniswapV3Factory(uniswapV3Factory).getPool(params.creatorToken, usdc, V3_FEE_TIER);
        if (v3Pool == address(0)) {
            if (params.initialSqrtPriceX96 == 0) revert MissingInitialSqrtPriceX96();
            v3Pool = IUniswapV3Factory(uniswapV3Factory).createPool(params.creatorToken, usdc, V3_FEE_TIER);
            if (v3Pool == address(0)) revert V3PoolMissing();
            IUniswapV3Pool(v3Pool).initialize(params.initialSqrtPriceX96);
        }
        out.v3Pool = v3Pool;

        // ───────────────────────────────
        // 2) Deploy Charm alpha vault via Charm Factory (shows on alpha.charm.fi UI)
        // ───────────────────────────────
        // NOTE: Using Charm's official factory ensures vault appears on their UI
        // Parameters: manager=protocolTreasury can rebalance, baseThreshold=3000 ticks, 
        //             limitThreshold=6000 ticks, fullRangeWeight=0 (no full range), period=1800s (30min)
        out.charmVault = ICharmFactory(CHARM_FACTORY).createVault(
            v3Pool,
            protocolTreasury,      // manager (can call rebalance)
            type(uint256).max,     // maxTotalSupply (unlimited)
            3000,                  // baseThreshold (ticks, must be multiple of tickSpacing)
            6000,                  // limitThreshold (ticks)
            0,                     // fullRangeWeight (0 = no full range position)
            1800,                  // period (30 minutes between rebalances)
            params.charmVaultName,
            params.charmVaultSymbol
        );
        
        bytes32 baseSalt = _deriveBaseSalt(params.creatorToken, params.owner, params.version);

        // ───────────────────────────────
        // 3) Deploy Charm strategy adapter + initialize approvals
        // ───────────────────────────────
        bytes32 charmStratSalt = _saltFor(baseSalt, "charmStrategyV3");
        bytes memory charmStratArgs = abi.encode(
            params.vault,
            params.creatorToken,
            usdc,
            uniswapRouter,
            out.charmVault,
            v3Pool,
            address(this)
        );
        out.charmStrategy = create2Deployer.deploy(charmStratSalt, codeIds.creatorCharmStrategy, charmStratArgs);
        ICreatorCharmStrategy(out.charmStrategy).initializeApprovals();
        IOwnableTransfer(out.charmStrategy).transferOwnership(protocolTreasury);

        // ───────────────────────────────
        // 4) Deploy Ajna strategy (optional) + transfer ownership
        // ───────────────────────────────
        if (params.ajnaWeightBps > 0) {
            bytes32 ajnaSalt = _saltFor(baseSalt, "ajnaStrategy");
            bytes memory ajnaArgs = abi.encode(params.vault, params.creatorToken, ajnaFactory, usdc, address(this));
            out.ajnaStrategy = create2Deployer.deploy(ajnaSalt, codeIds.ajnaStrategy, ajnaArgs);
            IOwnableTransfer(out.ajnaStrategy).transferOwnership(protocolTreasury);
        }

        // ───────────────────────────────
        // 5) Register strategies on the vault (batcher remains `management` from Phase 1)
        // ───────────────────────────────
        ICreatorOVaultStrategyManager(params.vault).addStrategy(out.charmStrategy, params.charmWeightBps);
        if (params.ajnaWeightBps > 0) {
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
            out.ajnaStrategy,
            params.charmWeightBps,
            params.ajnaWeightBps
        );
    }

    // ================================
    // REMOTE CHAIN DEPLOYMENT (Hub-Centric)
    // ================================

    struct RemoteDeployParams {
        address creatorToken;
        address owner;
        string shareName;
        string shareSymbol;
        string version;
        /// @notice Hub chain config
        uint32 hubEid;               // LayerZero EID for Base
        address hubGaugeReceiver;     // GaugeController address on Base
        bytes32 hubLotteryPeer;       // LotteryManager address on Base (bytes32)
        bytes32 hubOftPeer;           // Hub ShareOFT address (bytes32) for OFT peering
    }

    struct RemoteDeployResult {
        address oftBootstrapRegistry;
        address shareOFT;
    }

    event RemoteOFTDeployed(
        address indexed creatorToken,
        address indexed owner,
        address shareOFT,
        uint32 hubEid,
        address hubGaugeReceiver
    );

    /**
     * @notice Deploy a CreatorShareOFT on a remote chain (non-hub)
     * @dev This is the ONLY deployment needed on remote chains in the hub-centric model.
     *      No vault, wrapper, gauge, lottery, VRF, or oracle is deployed.
     *      The OFT is configured with isHub=false and pointed at the Base hub.
     *
     * @param params Remote deployment parameters
     * @param codeIds Code IDs for CREATE2 deployment
     * @return out The deployed addresses
     */
    function deployRemoteOFT(
        RemoteDeployParams calldata params,
        CodeIds calldata codeIds
    ) external nonReentrant returns (RemoteDeployResult memory out) {
        return _deployRemoteOFTInternal(params, codeIds, bytes32(0));
    }

    /**
     * @notice Deploy a CreatorShareOFT on a remote chain with a custom salt
     */
    function deployRemoteOFTWithSalt(
        RemoteDeployParams calldata params,
        CodeIds calldata codeIds,
        bytes32 shareOftSaltOverride
    ) external nonReentrant returns (RemoteDeployResult memory out) {
        return _deployRemoteOFTInternal(params, codeIds, shareOftSaltOverride);
    }

    function _deployRemoteOFTInternal(
        RemoteDeployParams calldata params,
        CodeIds calldata codeIds,
        bytes32 shareOftSaltOverride
    ) internal returns (RemoteDeployResult memory out) {
        _requireOwner(params.owner);
        if (params.creatorToken == address(0) || params.owner == address(0)) revert ZeroAddress();
        if (codeIds.shareOFT == bytes32(0) || codeIds.oftBootstrap == bytes32(0)) revert InvalidCodeId();

        // --- OFT Bootstrap Registry (shared, deploy-once-per-chain) ---
        bytes32 oftBootstrapSalt = keccak256("CreatorVault:OFTBootstrapRegistry:v1");
        out.oftBootstrapRegistry = create2Deployer.computeAddress(oftBootstrapSalt, codeIds.oftBootstrap);
        if (out.oftBootstrapRegistry.code.length == 0) {
            create2Deployer.deploy(oftBootstrapSalt, codeIds.oftBootstrap, bytes(""));
        }

        address lzEndpoint = registry.getLayerZeroEndpoint(uint16(block.chainid));
        IOFTBootstrapRegistry(out.oftBootstrapRegistry).setLayerZeroEndpoint(uint16(block.chainid), lzEndpoint);

        // --- Deploy ShareOFT ---
        string memory shareSymbolLower = _toLower(params.shareSymbol);
        string memory shareSymbolUpper = _toUpper(params.shareSymbol);

        bytes32 shareOftSalt = shareOftSaltOverride == bytes32(0)
            ? _deriveShareOftSalt(params.owner, shareSymbolLower, params.version)
            : shareOftSaltOverride;

        // tempOwner = this for wiring, then transfer to protocolTreasury
        address tempOwner = address(this);

        bytes memory shareOftArgs = abi.encode(params.shareName, shareSymbolUpper, out.oftBootstrapRegistry, tempOwner);
        out.shareOFT = create2Deployer.deploy(shareOftSalt, codeIds.shareOFT, shareOftArgs);

        // --- Configure as remote (non-hub) ---
        ICreatorShareOFT(out.shareOFT).setRegistry(address(registry));
        ICreatorShareOFT(out.shareOFT).setHubConfig(false, params.hubEid, params.hubGaugeReceiver);

        // Set lottery peer (LotteryManager on Base)
        if (params.hubLotteryPeer != bytes32(0)) {
            ICreatorShareOFT(out.shareOFT).setHubLotteryPeer(params.hubEid, params.hubLotteryPeer);
        }

        // Set OFT peer (hub ShareOFT on Base for token bridging)
        if (params.hubOftPeer != bytes32(0)) {
            ICreatorShareOFT(out.shareOFT).setPeer(params.hubEid, params.hubOftPeer);
        }

        // Transfer ownership to protocol treasury
        ICreatorShareOFT(out.shareOFT).transferOwnership(protocolTreasury);

        emit RemoteOFTDeployed(
            params.creatorToken,
            params.owner,
            out.shareOFT,
            params.hubEid,
            params.hubGaugeReceiver
        );
    }

    // ================================
    // HELPERS
    // ================================

    function _requireOwner(address owner) internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    function _pullCreatorTokens(address creatorToken, address owner, uint256 amount) internal {
        if (owner != msg.sender) revert NotOwner();
        IERC20(creatorToken).safeTransferFrom(msg.sender, address(this), amount);
    }

    function _permitAndPull(address creatorToken, address owner, uint256 amount, PermitData calldata permit) internal {
        if (owner != msg.sender) revert NotOwner();
        IERC20Permit(creatorToken).permit(msg.sender, address(this), amount, permit.deadline, permit.v, permit.r, permit.s);
        IERC20(creatorToken).safeTransferFrom(msg.sender, address(this), amount);
    }

    function _requirePhase1CodeIds(CodeIds calldata codeIds) internal pure {
        if (
            codeIds.vault == bytes32(0) ||
            codeIds.wrapper == bytes32(0) ||
            codeIds.shareOFT == bytes32(0) ||
            codeIds.oftBootstrap == bytes32(0)
        ) {
            revert InvalidCodeId();
        }
    }

    function _requirePhase2CodeIds(CodeIds calldata codeIds) internal pure {
        if (codeIds.gauge == bytes32(0) || codeIds.cca == bytes32(0) || codeIds.oracle == bytes32(0)) {
            revert InvalidCodeId();
        }
    }

    function _deriveBaseSalt(address creatorToken, address owner, string memory version) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(creatorToken, owner, block.chainid, "CreatorVault:deploy:", version));
    }

    function _saltFor(bytes32 baseSalt, string memory label) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(baseSalt, label));
    }

    function _deriveShareOftSalt(address owner, string memory shareSymbolLower, string memory version) internal pure returns (bytes32) {
        bytes32 base = keccak256(abi.encodePacked(owner, shareSymbolLower));
        return keccak256(abi.encodePacked(base, "CreatorShareOFT:", version));
    }

    function _defaultTickSpacingQ96(uint256 floorPriceQ96) internal pure returns (uint256) {
        uint256 spacing = floorPriceQ96 / 100;
        return spacing > 1 ? spacing : 2;
    }

    function _toLower(string memory input) internal pure returns (string memory) {
        bytes memory b = bytes(input);
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 65 && c <= 90) {
                b[i] = bytes1(c + 32);
            }
        }
        return string(b);
    }

    function _toUpper(string memory input) internal pure returns (string memory) {
        bytes memory b = bytes(input);
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 97 && c <= 122) {
                b[i] = bytes1(c - 32);
            }
        }
        return string(b);
    }
}
