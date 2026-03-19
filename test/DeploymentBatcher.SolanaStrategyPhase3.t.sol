// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/helpers/batchers/DeploymentBatcher.sol";

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

    function initializeApprovals() external {
        approvalsInitialized = true;
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
}

contract MockAjnaAdapterForPhase3 is MockOwnableTransferForPhase3 {
    uint256 public idleBufferBps;

    function setIdleBufferBps(uint256 newBps) external {
        idleBufferBps = newBps;
    }
}

contract MockVaultStrategyManagerForPhase3 {
    address[] public strategies;
    uint256[] public weights;
    bool public autoAllocate;

    function addStrategy(address strategy, uint256 weight) external {
        strategies.push(strategy);
        weights.push(weight);
    }

    function setAutoAllocate(bool enabled) external {
        autoAllocate = enabled;
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

    bytes32 internal constant CHARM_ALPHA_CODE_ID = bytes32(uint256(1));
    bytes32 internal constant CREATOR_CHARM_STRATEGY_CODE_ID = bytes32(uint256(2));
    bytes32 internal constant AJNA_AUTH_CODE_ID = bytes32(uint256(3));
    bytes32 internal constant AJNA_VAULT_CODE_ID = bytes32(uint256(4));
    bytes32 internal constant AJNA_ADAPTER_CODE_ID = bytes32(uint256(5));
    bytes32 internal constant SOLANA_STRATEGY_CODE_ID = bytes32(uint256(6));

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
    address internal creatorToken;
    address internal solanaKeeper;
    address internal solanaBridge;
    address internal ajnaKeeper;

    function setUp() public {
        protocolTreasury = makeAddr("protocolTreasury");
        creatorToken = makeAddr("creatorToken");
        solanaKeeper = makeAddr("solanaKeeper");
        solanaBridge = makeAddr("solanaBridge");
        ajnaKeeper = makeAddr("ajnaKeeper");

        create2Deployer = new MockCreate2DeployerForPhase3();
        uniswapFactory = new MockUniswapV3FactoryForPhase3();
        uniswapFactory.setPool(address(new MockUniswapV3PoolForPhase3()));
        ajnaFactory = new MockAjnaPoolFactoryForPhase3(makeAddr("ajnaPool"));

        vault = new MockVaultStrategyManagerForPhase3();
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

        batcher = new DeploymentBatcher(
            makeAddr("registry"),
            makeAddr("bytecodeStore"),
            address(create2Deployer),
            protocolTreasury,
            makeAddr("poolManager"),
            makeAddr("taxHook"),
            makeAddr("chainlinkEthUsd"),
            makeAddr("vaultActivationBatcher"),
            makeAddr("lotteryManager"),
            makeAddr("permit2"),
            makeAddr("usdc"),
            address(uniswapFactory),
            makeAddr("uniswapRouter"),
            address(ajnaFactory),
            makeAddr("vaultCoreModule"),
            makeAddr("vaultStrategiesModule"),
            makeAddr("vaultAdminModule")
        );

        vm.mockCall(
            CHARM_FACTORY,
            abi.encodeWithSelector(GOVERNANCE_SELECTOR),
            abi.encode(batcher.CHARM_FACTORY_GOVERNANCE())
        );
        vm.mockCall(
            CHARM_FACTORY,
            abi.encodeWithSelector(CREATE_VAULT_SELECTOR),
            abi.encode(address(new MockCharmVaultForPhase3(protocolTreasury)))
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
            charmWeightBps: 6_000,
            ajnaWeightBps: 2_500,
            solanaWeightBps: 1_000,
            ajnaBufferRatioBps: 1_500,
            ajnaMinBucketIndex: 4_156,
            ajnaKeeper: ajnaKeeper,
            solanaKeeper: solanaKeeper,
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: solanaBridge,
            enableAutoAllocate: true
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
        assertEq(out.solanaStrategy, address(solanaStrategy), "solana strategy mismatch");

        assertEq(vault.strategyCount(), 3, "expected three registered strategies");
        assertEq(vault.strategies(0), address(charmStrategy), "first strategy should be charm");
        assertEq(vault.weights(0), 6_000, "charm weight mismatch");
        assertEq(vault.strategies(1), address(ajnaStrategy), "second strategy should be ajna adapter");
        assertEq(vault.weights(1), 2_500, "ajna weight mismatch");
        assertEq(vault.strategies(2), address(solanaStrategy), "third strategy should be solana");
        assertEq(vault.weights(2), 1_000, "solana weight mismatch");
        assertTrue(vault.autoAllocate(), "auto-allocate should be enabled");

        assertTrue(charmStrategy.approvalsInitialized(), "charm strategy approvals not initialized");
        assertEq(charmStrategy.lastOwner(), protocolTreasury, "charm strategy ownership not transferred");
        assertEq(ajnaStrategy.lastOwner(), protocolTreasury, "ajna adapter ownership not transferred");
        assertEq(solanaStrategy.lastOwner(), protocolTreasury, "solana strategy ownership not transferred");
        assertEq(ajnaStrategy.idleBufferBps(), 0, "adapter idle buffer should be disabled");
        assertEq(ajnaAuth.bufferRatio(), 1_500, "ajna buffer ratio mismatch");
        assertEq(ajnaAuth.minBucketIndex(), 4_156, "ajna min bucket mismatch");
        assertTrue(ajnaAuth.keepers(ajnaKeeper), "ajna keeper should be configured");
        assertEq(ajnaAuth.admin(), address(this), "ajna auth admin should transfer to creator owner");
    }

    function test_deployPhase3Strategies_revertsWhenAjnaCodeIdsMissing() public {
        DeploymentBatcher.StrategyCodeIds memory codeIds = _strategyCodeIds();
        codeIds.ajnaVault = bytes32(0);

        vm.expectRevert(DeploymentBatcher.InvalidCodeId.selector);
        batcher.deployPhase3Strategies(_phase3Params(), codeIds);
    }

    function test_deployPhase3Strategies_revertsWhenSolanaWeightSetWithoutCodeId() public {
        DeploymentBatcher.StrategyCodeIds memory codeIds = _strategyCodeIds();
        codeIds.solanaStrategy = bytes32(0);

        vm.expectRevert(DeploymentBatcher.InvalidCodeId.selector);
        batcher.deployPhase3Strategies(_phase3Params(), codeIds);
    }

    function test_deployPhase3Strategies_revertsWhenAjnaWeightIsZero() public {
        DeploymentBatcher.Phase3Params memory params = _phase3Params();
        params.ajnaWeightBps = 0;

        vm.expectRevert(DeploymentBatcher.InvalidWeight.selector);
        batcher.deployPhase3Strategies(params, _strategyCodeIds());
    }

    function test_deployPhase3Strategies_revertsWhenSolanaWeightIsZero() public {
        DeploymentBatcher.Phase3Params memory params = _phase3Params();
        params.solanaWeightBps = 0;

        vm.expectRevert(DeploymentBatcher.InvalidWeight.selector);
        batcher.deployPhase3Strategies(params, _strategyCodeIds());
    }

    function test_deployPhase3Strategies_revertsWhenCharmVaultManagerMismatches() public {
        address wrongManager = makeAddr("wrongManager");
        vm.mockCall(
            CHARM_FACTORY,
            abi.encodeWithSelector(CREATE_VAULT_SELECTOR),
            abi.encode(address(new MockCharmVaultForPhase3(wrongManager)))
        );

        vm.expectRevert(
            abi.encodeWithSelector(DeploymentBatcher.CharmVaultManagerMismatch.selector, protocolTreasury, wrongManager)
        );
        batcher.deployPhase3Strategies(_phase3Params(), _strategyCodeIds());
    }
}
