// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {ICreatorRegistry} from "../contracts/interfaces/core/ICreatorRegistry.sol";
import "../contracts/helpers/batchers/DeploymentBatcher.sol";
import "./helpers/DeploymentBatcherFixture.sol";

contract MockUniswapV3PoolForPhase3 {
    uint160 public lastSqrtPriceX96;

    function initialize(uint160 sqrtPriceX96) external {
        lastSqrtPriceX96 = sqrtPriceX96;
    }
}

contract MockUniswapV3FactoryForPhase3 {
    address public pool;

    function setPool(address pool_) external {
        pool = pool_;
    }

    function getPool(address, address, uint24) external view returns (address) {
        return pool;
    }

    function createPool(address, address, uint24) external returns (address createdPool) {
        createdPool = address(new MockUniswapV3PoolForPhase3());
        pool = createdPool;
    }
}

contract MockAjnaPoolFactoryForPhase3 {
    address public pool;

    constructor(address pool_) {
        pool = pool_;
    }

    function ERC20_NON_SUBSET_HASH() external pure returns (bytes32) {
        return bytes32(uint256(1));
    }

    function deployedPools(bytes32, address, address) external view returns (address) {
        return pool;
    }

    function deployPool(address, address, uint256) external view returns (address) {
        return pool;
    }

    function MIN_RATE() external pure returns (uint256) {
        return 1e16;
    }

    function MAX_RATE() external pure returns (uint256) {
        return 1e17;
    }
}

contract MockOwnableTransferForPhase3 {
    address public lastOwner;

    function transferOwnership(address newOwner) external virtual {
        lastOwner = newOwner;
    }
}

contract MockCharmStrategyForPhase3 is MockOwnableTransferForPhase3 {
    bool public approvalsInitialized;
    address public creatorOracle;
    address public ajnaPool;
    bool public ajnaBorrowEnabled;
    uint256 public ajnaMaxDebt;
    uint256 public ajnaMaxBorrowPerWithdraw;
    uint256 public ajnaMinCollateralRatioBps;

    function initializeApprovals() external {
        approvalsInitialized = true;
    }

    function setCreatorOracle(address _creatorOracle) external {
        creatorOracle = _creatorOracle;
    }

    function setAjnaPool(address _ajnaPool) external {
        ajnaPool = _ajnaPool;
    }

    function setAjnaBorrowConfig(
        bool _enabled,
        uint256 _maxDebt,
        uint256 _maxBorrowPerWithdraw,
        uint256 _minCollateralRatioBps,
        uint256,
        uint256
    ) external {
        ajnaBorrowEnabled = _enabled;
        ajnaMaxDebt = _maxDebt;
        ajnaMaxBorrowPerWithdraw = _maxBorrowPerWithdraw;
        ajnaMinCollateralRatioBps = _minCollateralRatioBps;
    }
}

contract MockAjnaVaultAuthForPhase3 {
    address public admin;
    uint256 public bufferRatio;
    uint256 public minBucketIndex;
    mapping(address => bool) public keepers;
    address public swapper;

    function setBufferRatio(uint256 ratio) external {
        bufferRatio = ratio;
    }

    function setMinBucketIndex(uint256 index) external {
        minBucketIndex = index;
    }

    function setKeeper(address keeper, bool status) external {
        keepers[keeper] = status;
    }

    function setSwapper(address nextSwapper) external {
        swapper = nextSwapper;
    }

    function setAdmin(address nextAdmin) external {
        admin = nextAdmin;
    }

    // F-21: isAdmin check before transferAdmin
    function isAdmin(address account) external view returns (bool) {
        return admin == address(0) || admin == account;
    }

    // F-04: two-step admin transfer
    function transferAdmin(address nextAdmin) external {
        admin = nextAdmin;
    }
}

contract MockAjnaAdapterForPhase3 is MockOwnableTransferForPhase3 {
    uint256 public idleBufferBps;

    function setIdleBufferBps(uint256 newBps) external {
        idleBufferBps = newBps;
    }
}

contract MockVaultStrategyManagerForPhase3 {
    address public owner;
    address public managementAddress;
    address[] public strategies;
    uint256[] public weights;
    bool public autoAllocate;

    constructor(address owner_) {
        owner = owner_;
        managementAddress = owner_;
    }

    function addStrategy(address strategy, uint256 weight) external {
        strategies.push(strategy);
        weights.push(weight);
    }

    function setAutoAllocate(bool enabled) external {
        autoAllocate = enabled;
    }

    function management() external view returns (address) {
        return managementAddress;
    }

    function setManagement(address account) external {
        managementAddress = account;
    }

    function strategyCount() external view returns (uint256) {
        return strategies.length;
    }
}

contract MockCharmVaultForPhase3 {
    address public manager;

    constructor(address manager_) {
        manager = manager_;
    }
}

contract MockCreate2DeployerForPhase3 is IUniversalCreate2DeployerFromStore {
    mapping(bytes32 => address) public deployments;

    function setDeployment(bytes32 codeId, address deployed) external {
        deployments[codeId] = deployed;
    }

    function deploy(bytes32, bytes32 codeId, bytes calldata) external view override returns (address addr) {
        addr = deployments[codeId];
        require(addr != address(0), "missing deployment");
    }

    function computeAddress(bytes32 salt, bytes32 initCodeHash) external pure override returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(salt, initCodeHash)))));
    }
}

contract DeploymentBatcherSolanaStrategyPhase3Test is Test {
    address internal constant CHARM_FACTORY = 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa;
    bytes4 internal constant CREATE_VAULT_SELECTOR =
        bytes4(keccak256("createVault((address,address,uint24,address,uint256,int24,int24,uint24,uint32,int24,int24,uint32,string,string))"));
    bytes4 internal constant GOVERNANCE_SELECTOR = bytes4(keccak256("governance()"));
    bytes4 internal constant PROTOCOL_FEE_SELECTOR = bytes4(keccak256("protocolFee()"));

    bytes32 internal constant CHARM_ALPHA_CODE_ID = bytes32(uint256(1));
    bytes32 internal constant CREATOR_CHARM_STRATEGY_CODE_ID = bytes32(uint256(2));
    bytes32 internal constant AJNA_AUTH_CODE_ID = bytes32(uint256(3));
    bytes32 internal constant AJNA_VAULT_CODE_ID = bytes32(uint256(4));
    bytes32 internal constant AJNA_ADAPTER_CODE_ID = bytes32(uint256(5));
    bytes32 internal constant SOLANA_STRATEGY_CODE_ID = bytes32(uint256(6));
    uint24 internal constant CHARM_MANAGER_FEE_PIPS = 160_000; // 16% in Charm's 1e6 precision
    uint24 internal constant CHARM_PROTOCOL_FEE_PIPS = 10_000; // 1% in Charm's 1e6 precision

    DeploymentBatcher internal batcher;
    MockCreate2DeployerForPhase3 internal create2Deployer;
    MockUniswapV3FactoryForPhase3 internal uniswapFactory;
    MockAjnaPoolFactoryForPhase3 internal ajnaFactory;
    MockVaultStrategyManagerForPhase3 internal vault;

    MockCharmStrategyForPhase3 internal charmStrategy;
    MockAjnaVaultAuthForPhase3 internal ajnaAuth;
    address internal ajnaVault;
    MockAjnaAdapterForPhase3 internal ajnaStrategy;
    MockOwnableTransferForPhase3 internal solanaStrategy;

    address internal protocolTreasury;
    address internal protocolAutomation;
    address internal creatorToken;
    address internal solanaKeeper;
    address internal solanaBridge;
    address internal ajnaKeeper;
    address internal creatorOracle;

    function setUp() public {
        vm.chainId(8453);

        protocolTreasury = makeAddr("protocolTreasury");
        protocolAutomation = makeAddr("protocolAutomation");
        creatorToken = makeAddr("creatorToken");
        solanaKeeper = makeAddr("solanaKeeper");
        solanaBridge = makeAddr("solanaBridge");
        ajnaKeeper = makeAddr("ajnaKeeper");
        creatorOracle = makeAddr("creatorOracle");

        create2Deployer = new MockCreate2DeployerForPhase3();
        uniswapFactory = new MockUniswapV3FactoryForPhase3();
        uniswapFactory.setPool(address(new MockUniswapV3PoolForPhase3()));
        ajnaFactory = new MockAjnaPoolFactoryForPhase3(makeAddr("ajnaPool"));

        vault = new MockVaultStrategyManagerForPhase3(address(this));
        charmStrategy = new MockCharmStrategyForPhase3();
        ajnaAuth = new MockAjnaVaultAuthForPhase3();
        ajnaVault = makeAddr("ajnaVault");
        ajnaStrategy = new MockAjnaAdapterForPhase3();
        solanaStrategy = new MockOwnableTransferForPhase3();

        create2Deployer.setDeployment(CREATOR_CHARM_STRATEGY_CODE_ID, address(charmStrategy));
        create2Deployer.setDeployment(AJNA_AUTH_CODE_ID, address(ajnaAuth));
        create2Deployer.setDeployment(AJNA_VAULT_CODE_ID, ajnaVault);
        create2Deployer.setDeployment(AJNA_ADAPTER_CODE_ID, address(ajnaStrategy));
        create2Deployer.setDeployment(SOLANA_STRATEGY_CODE_ID, address(solanaStrategy));

        DeploymentBatcherFixture deployerLib = new DeploymentBatcherFixture();
        DeploymentBatcherFixture.BatcherConfig memory cfg = DeploymentBatcherFixture.BatcherConfig({
            registry: makeAddr("registry"),
            bytecodeStore: makeAddr("bytecodeStore"),
            create2Deployer: address(create2Deployer),
            protocolTreasury: protocolTreasury,
            protocolAutomation: protocolAutomation,
            poolManager: makeAddr("poolManager"),
            taxHook: makeAddr("taxHook"),
            chainlinkEthUsd: makeAddr("chainlinkEthUsd"),
            vaultActivationBatcher: makeAddr("vaultActivationBatcher"),
            lotteryManager: makeAddr("lotteryManager"),
            permit2: makeAddr("permit2"),
            usdc: makeAddr("usdc"),
            uniswapV3Factory: address(uniswapFactory),
            uniswapRouter: makeAddr("uniswapRouter"),
            ajnaFactory: address(ajnaFactory),
            vaultCoreModule: makeAddr("vaultCoreModule"),
            vaultStrategiesModule: makeAddr("vaultStrategiesModule"),
            vaultAdminModule: makeAddr("vaultAdminModule")
        });
        (batcher,) = deployerLib.deployBatcher(cfg);
        vault.setManagement(address(batcher));

        vm.mockCall(
            CHARM_FACTORY,
            abi.encodeWithSelector(GOVERNANCE_SELECTOR),
            abi.encode(address(0x424cdd9021AF88A86C76b245e24583f9a71e32a1))
        );
        vm.mockCall(CHARM_FACTORY, abi.encodeWithSelector(PROTOCOL_FEE_SELECTOR), abi.encode(CHARM_PROTOCOL_FEE_PIPS));
        vm.mockCall(
            CHARM_FACTORY,
            abi.encodeWithSelector(CREATE_VAULT_SELECTOR),
            abi.encode(address(new MockCharmVaultForPhase3(protocolAutomation)))
        );
        _mockCreatorOracle(creatorOracle);
    }

    function _mockCreatorOracle(address oracle) internal {
        ICreatorRegistry.CreatorCoinInfo memory info;
        info.oracle = oracle;
        vm.mockCall(
            address(batcher.registry()),
            abi.encodeWithSelector(ICreatorRegistry.getCreatorCoin.selector, creatorToken),
            abi.encode(info)
        );
    }

    function _phase3Params() internal view returns (DeploymentBatcher.Phase3Params memory params) {
        params = DeploymentBatcher.Phase3Params({
            creatorToken: creatorToken,
            owner: address(this),
            vault: address(vault),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHRM",
            ajnaVaultName: "Ajna Inner Vault",
            ajnaVaultSymbol: "AIV",
            charmWeightBps: 4_500,
            ajnaWeightBps: 4_500,
            solanaWeightBps: 0,
            ajnaBufferRatioBps: 1_500,
            ajnaMinBucketIndex: 4_156,
            ajnaKeeper: ajnaKeeper,
            solanaKeeper: solanaKeeper,
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: solanaBridge,
            enableAutoAllocate: true,
            expectedCharmProtocolFeePips: CHARM_PROTOCOL_FEE_PIPS
        });
    }

    function _strategyCodeIds() internal pure returns (DeploymentBatcher.StrategyCodeIds memory codeIds) {
        codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: CHARM_ALPHA_CODE_ID,
            creatorCharmStrategy: CREATOR_CHARM_STRATEGY_CODE_ID,
            ajnaVaultAuth: AJNA_AUTH_CODE_ID,
            ajnaVault: AJNA_VAULT_CODE_ID,
            erc4626StrategyAdapter: AJNA_ADAPTER_CODE_ID,
            solanaStrategy: SOLANA_STRATEGY_CODE_ID
        });
    }

    function test_deployPhase3Strategies_deploysAndRegistersNestedAjnaStrategy() public {
        DeploymentBatcher.Phase3Result memory out = batcher.deployPhase3Strategies(_phase3Params(), _strategyCodeIds());

        assertEq(out.charmStrategy, address(charmStrategy), "charm strategy mismatch");
        assertEq(out.ajnaVaultAuth, address(ajnaAuth), "ajna auth mismatch");
        assertEq(out.ajnaVault, ajnaVault, "ajna vault mismatch");
        assertEq(out.ajnaStrategy, address(ajnaStrategy), "ajna adapter mismatch");
        assertEq(out.solanaStrategy, address(0), "solana strategy removed from Phase 3");

        assertEq(vault.strategyCount(), 2, "expected two registered strategies");
        assertEq(vault.strategies(0), address(charmStrategy), "first strategy should be charm");
        assertEq(vault.weights(0), 4_500, "charm weight mismatch");
        assertEq(vault.strategies(1), address(ajnaStrategy), "second strategy should be ajna adapter");
        assertEq(vault.weights(1), 4_500, "ajna weight mismatch");
        assertTrue(vault.autoAllocate(), "auto-allocate should be enabled");

        assertTrue(charmStrategy.approvalsInitialized(), "charm strategy approvals not initialized");
        assertEq(charmStrategy.lastOwner(), protocolTreasury, "charm strategy ownership not transferred");
        assertTrue(charmStrategy.ajnaBorrowEnabled(), "charm ajna borrow backstop should be enabled");
        assertEq(charmStrategy.ajnaPool(), makeAddr("ajnaPool"), "charm ajna pool mismatch");
        assertEq(charmStrategy.creatorOracle(), creatorOracle, "charm creator oracle mismatch");
        assertEq(charmStrategy.ajnaMinCollateralRatioBps(), 12_500, "charm min collateral ratio mismatch");
        assertEq(ajnaStrategy.lastOwner(), protocolTreasury, "ajna adapter ownership not transferred");
        assertEq(ajnaStrategy.idleBufferBps(), 0, "adapter idle buffer should be disabled");
        assertEq(ajnaAuth.bufferRatio(), 1_500, "ajna buffer ratio mismatch");
        assertEq(ajnaAuth.minBucketIndex(), 4_156, "ajna min bucket mismatch");
        assertTrue(ajnaAuth.keepers(ajnaKeeper), "ajna keeper should be configured");
        assertEq(ajnaAuth.admin(), protocolAutomation, "ajna auth admin should transfer to automation Safe");
    }

    function test_deployPhase3Strategies_callsCharmFactoryWithExpectedManagerFeePips() public {
        DeploymentBatcher.Phase3Params memory params = _phase3Params();
        address v3Pool = uniswapFactory.pool();
        ICharmFactory.VaultParams memory expectedVaultParams = ICharmFactory.VaultParams({
            pool: v3Pool,
            manager: protocolAutomation,
            managerFee: CHARM_MANAGER_FEE_PIPS,
            rebalanceDelegate: params.owner,
            maxTotalSupply: type(uint256).max,
            baseThreshold: 3000,
            limitThreshold: 6000,
            fullRangeWeight: 0,
            period: 1800,
            minTickMove: int24(10),
            maxTwapDeviation: 500,
            twapDuration: 300,
            name: params.charmVaultName,
            symbol: params.charmVaultSymbol
        });

        vm.expectCall(CHARM_FACTORY, abi.encodeWithSelector(CREATE_VAULT_SELECTOR, expectedVaultParams));

        batcher.deployPhase3Strategies(params, _strategyCodeIds());
    }

    function test_deployPhase3Strategies_revertsWhenCharmFactoryProtocolFeeMismatches() public {
        uint24 mismatchedProtocolFee = CHARM_PROTOCOL_FEE_PIPS + 1;
        vm.mockCall(CHARM_FACTORY, abi.encodeWithSelector(PROTOCOL_FEE_SELECTOR), abi.encode(mismatchedProtocolFee));

        vm.expectRevert(
            abi.encodeWithSelector(
                DeploymentBatcher.CharmFactoryProtocolFeeMismatch.selector,
                uint256(CHARM_PROTOCOL_FEE_PIPS),
                uint256(mismatchedProtocolFee)
            )
        );
        batcher.deployPhase3Strategies(_phase3Params(), _strategyCodeIds());
    }

    function test_deployPhase3Strategies_usesDefaultCharmProtocolFeeWhenExpectedIsZero() public {
        DeploymentBatcher.Phase3Params memory params = _phase3Params();
        params.expectedCharmProtocolFeePips = 0;
        batcher.deployPhase3Strategies(params, _strategyCodeIds());
    }

    function test_deployPhase3Strategies_acceptsCustomExpectedCharmProtocolFee() public {
        DeploymentBatcher.Phase3Params memory params = _phase3Params();
        params.expectedCharmProtocolFeePips = 12_345;
        vm.mockCall(CHARM_FACTORY, abi.encodeWithSelector(PROTOCOL_FEE_SELECTOR), abi.encode(uint24(12_345)));
        batcher.deployPhase3Strategies(params, _strategyCodeIds());
    }

    function test_deployPhase3Strategies_revertsWhenAjnaCodeIdsMissing() public {
        DeploymentBatcher.StrategyCodeIds memory codeIds = _strategyCodeIds();
        codeIds.ajnaVault = bytes32(0);

        vm.expectRevert(DeploymentBatcher.InvalidCodeId.selector);
        batcher.deployPhase3Strategies(_phase3Params(), codeIds);
    }

    function test_deployPhase3Strategies_revertsWhenSolanaWeightIsNonZero() public {
        DeploymentBatcher.Phase3Params memory params = _phase3Params();
        params.solanaWeightBps = 1_000;

        vm.expectRevert(DeploymentBatcher.InvalidWeight.selector);
        batcher.deployPhase3Strategies(params, _strategyCodeIds());
    }

    function test_deployPhase3Strategies_skipsAjnaWhenWeightIsZero() public {
        // Ajna is an OPT-IN paid feature (`ajna_sleeve`, $100 USDC). Callers
        // that omit payment pass `ajnaWeightBps = 0`; Phase 3 must deploy
        // everything else and leave Ajna fields empty instead of reverting.
        DeploymentBatcher.Phase3Params memory params = _phase3Params();
        params.ajnaWeightBps = 0;
        params.solanaWeightBps = 0;

        DeploymentBatcher.Phase3Result memory out =
            batcher.deployPhase3Strategies(params, _strategyCodeIds());

        assertEq(out.ajnaVault, address(0), "ajnaVault should be zero when skipped");
        assertEq(out.ajnaVaultAuth, address(0), "ajnaVaultAuth should be zero when skipped");
        assertEq(out.ajnaStrategy, address(0), "ajnaStrategy should be zero when skipped");
        assertTrue(out.charmStrategy != address(0), "charm should still deploy");
        assertEq(out.solanaStrategy, address(0), "solana strategy removed from Phase 3");
        assertFalse(charmStrategy.ajnaBorrowEnabled(), "charm-only deploy should not wire ajna backstop");
        assertEq(charmStrategy.ajnaPool(), address(0), "charm-only deploy should not set ajna pool");
    }

    function test_deployPhase3Strategies_revertsWhenSynergyOracleMissing() public {
        _mockCreatorOracle(address(0));

        vm.expectRevert(DeploymentBatcherPhase3Helper.MissingCreatorOracleForSynergy.selector);
        batcher.deployPhase3Strategies(_phase3Params(), _strategyCodeIds());
    }

    function test_deployPhase3Strategies_skipsCharmWhenWeightIsZero() public {
        // Mirror of the Ajna skip test for the `charm_active_lp` paid feature.
        DeploymentBatcher.Phase3Params memory params = _phase3Params();
        params.charmWeightBps = 0;

        DeploymentBatcher.Phase3Result memory out =
            batcher.deployPhase3Strategies(params, _strategyCodeIds());

        assertEq(out.charmVault, address(0), "charmVault should be zero when skipped");
        assertEq(out.charmStrategy, address(0), "charmStrategy should be zero when skipped");
        assertTrue(out.ajnaStrategy != address(0), "ajna should still deploy");
        assertEq(out.solanaStrategy, address(0), "solana strategy removed from Phase 3");
    }

    function test_deployPhase3Strategies_revertsWhenOnlySolanaWeightRequested() public {
        DeploymentBatcher.Phase3Params memory params = _phase3Params();
        params.charmWeightBps = 0;
        params.ajnaWeightBps = 0;
        params.solanaWeightBps = 100;

        vm.expectRevert(DeploymentBatcher.InvalidWeight.selector);
        batcher.deployPhase3Strategies(params, _strategyCodeIds());
    }

    function test_deployPhase3Strategies_alwaysSkipsSolanaStrategy() public {
        DeploymentBatcher.Phase3Params memory params = _phase3Params();

        DeploymentBatcher.Phase3Result memory out =
            batcher.deployPhase3Strategies(params, _strategyCodeIds());

        assertEq(out.solanaStrategy, address(0), "solanaStrategy should always be zero");
        assertTrue(out.charmStrategy != address(0), "charm should still deploy");
        assertTrue(out.ajnaStrategy != address(0), "ajna should still deploy");
    }

    function test_deployPhase3Strategies_revertsOnZeroProductiveWeightSum() public {
        // Product invariant: every deploy must install at least ONE productive
        // strategy. A pure-idle vault (0/0/0) accrues no yield and is disallowed.
        DeploymentBatcher.Phase3Params memory params = _phase3Params();
        params.charmWeightBps = 0;
        params.ajnaWeightBps = 0;
        params.solanaWeightBps = 0;

        DeploymentBatcher.StrategyCodeIds memory codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: bytes32(0),
            creatorCharmStrategy: bytes32(0),
            ajnaVaultAuth: bytes32(0),
            ajnaVault: bytes32(0),
            erc4626StrategyAdapter: bytes32(0),
            solanaStrategy: bytes32(0)
        });

        vm.expectRevert(DeploymentBatcher.InvalidWeight.selector);
        batcher.deployPhase3Strategies(params, codeIds);
    }

    function test_deployPhase3Strategies_acceptsSingleStrategyAt9000Bps() public {
        // Server-side resolver scales per-strategy weight to 9_000 when only
        // one strategy is active (9_000 productive + 1_000 idle = 10_000).
        DeploymentBatcher.Phase3Params memory params = _phase3Params();
        params.charmWeightBps = 9_000;
        params.ajnaWeightBps = 0;
        params.solanaWeightBps = 0;

        DeploymentBatcher.StrategyCodeIds memory codeIds = _strategyCodeIds();
        // Ajna + Solana codeIds are unused this run; keep them just to
        // verify the batcher doesn't require them when weights are zero.
        codeIds.ajnaVault = bytes32(0);
        codeIds.ajnaVaultAuth = bytes32(0);
        codeIds.erc4626StrategyAdapter = bytes32(0);
        codeIds.solanaStrategy = bytes32(0);

        DeploymentBatcher.Phase3Result memory out = batcher.deployPhase3Strategies(params, codeIds);

        assertTrue(out.charmStrategy != address(0), "charm should deploy at 90 % weight");
        assertEq(out.ajnaStrategy, address(0));
        assertEq(out.solanaStrategy, address(0));
    }

    function test_deployPhase3Strategies_revertsWhenCharmVaultManagerMismatches() public {
        address wrongManager = makeAddr("wrongManager");
        vm.mockCall(
            CHARM_FACTORY,
            abi.encodeWithSelector(CREATE_VAULT_SELECTOR),
            abi.encode(address(new MockCharmVaultForPhase3(wrongManager)))
        );

        vm.expectRevert(
            abi.encodeWithSelector(DeploymentBatcher.CharmVaultManagerMismatch.selector, protocolAutomation, wrongManager)
        );
        batcher.deployPhase3Strategies(_phase3Params(), _strategyCodeIds());
    }
}
