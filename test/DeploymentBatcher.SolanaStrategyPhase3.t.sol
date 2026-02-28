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

    function setPool(address _pool) external {
        pool = _pool;
    }

    function getPool(address, address, uint24) external view returns (address) {
        return pool;
    }

    function createPool(address, address, uint24) external returns (address createdPool) {
        createdPool = address(new MockUniswapV3PoolForPhase3());
        pool = createdPool;
    }
}

contract MockCharmFactoryForPhase3 {
    function createVault(address, address, uint256, int24, int24, uint24, uint32, string memory, string memory)
        external
        returns (address vault)
    {
        vault = address(new MockUniswapV3PoolForPhase3());
    }
}

contract MockOwnableTransferForPhase3 {
    address public lastOwner;

    function transferOwnership(address newOwner) external {
        lastOwner = newOwner;
    }
}

contract MockCharmStrategyForPhase3 is MockOwnableTransferForPhase3 {
    bool public approvalsInitialized;

    function initializeApprovals() external {
        approvalsInitialized = true;
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

    bytes32 internal constant CHARM_ALPHA_CODE_ID = bytes32(uint256(1));
    bytes32 internal constant CREATOR_CHARM_STRATEGY_CODE_ID = bytes32(uint256(2));
    bytes32 internal constant AJNA_STRATEGY_CODE_ID = bytes32(uint256(3));
    bytes32 internal constant SOLANA_STRATEGY_CODE_ID = bytes32(uint256(4));

    DeploymentBatcher internal batcher;
    MockCreate2DeployerForPhase3 internal create2Deployer;
    MockUniswapV3FactoryForPhase3 internal uniswapFactory;
    MockVaultStrategyManagerForPhase3 internal vault;

    MockCharmStrategyForPhase3 internal charmStrategy;
    MockOwnableTransferForPhase3 internal ajnaStrategy;
    MockOwnableTransferForPhase3 internal solanaStrategy;

    address internal protocolTreasury;
    address internal creatorToken;
    address internal solanaKeeper;
    address internal solanaBridge;

    function setUp() public {
        protocolTreasury = makeAddr("protocolTreasury");
        creatorToken = makeAddr("creatorToken");
        solanaKeeper = makeAddr("solanaKeeper");
        solanaBridge = makeAddr("solanaBridge");

        MockCharmFactoryForPhase3 charmFactoryImpl = new MockCharmFactoryForPhase3();
        vm.etch(CHARM_FACTORY, address(charmFactoryImpl).code);

        create2Deployer = new MockCreate2DeployerForPhase3();
        uniswapFactory = new MockUniswapV3FactoryForPhase3();
        uniswapFactory.setPool(address(new MockUniswapV3PoolForPhase3()));

        vault = new MockVaultStrategyManagerForPhase3();
        charmStrategy = new MockCharmStrategyForPhase3();
        ajnaStrategy = new MockOwnableTransferForPhase3();
        solanaStrategy = new MockOwnableTransferForPhase3();

        create2Deployer.setDeployment(CREATOR_CHARM_STRATEGY_CODE_ID, address(charmStrategy));
        create2Deployer.setDeployment(AJNA_STRATEGY_CODE_ID, address(ajnaStrategy));
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
            makeAddr("ajnaFactory"),
            makeAddr("vaultCoreModule"),
            makeAddr("vaultStrategiesModule"),
            makeAddr("vaultAdminModule")
        );
    }

    function test_deployPhase3Strategies_deploysAndRegistersSolanaStrategy() public {
        DeploymentBatcher.Phase3Params memory params = DeploymentBatcher.Phase3Params({
            creatorToken: creatorToken,
            owner: address(this),
            vault: address(vault),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHRM",
            charmWeightBps: 6_000,
            ajnaWeightBps: 2_500,
            solanaWeightBps: 1_000,
            solanaKeeper: solanaKeeper,
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: solanaBridge,
            enableAutoAllocate: true
        });

        DeploymentBatcher.StrategyCodeIds memory codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: CHARM_ALPHA_CODE_ID,
            creatorCharmStrategy: CREATOR_CHARM_STRATEGY_CODE_ID,
            ajnaStrategy: AJNA_STRATEGY_CODE_ID,
            solanaStrategy: SOLANA_STRATEGY_CODE_ID
        });

        DeploymentBatcher.Phase3Result memory out = batcher.deployPhase3Strategies(params, codeIds);

        assertEq(out.charmStrategy, address(charmStrategy), "charm strategy mismatch");
        assertEq(out.ajnaStrategy, address(ajnaStrategy), "ajna strategy mismatch");
        assertEq(out.solanaStrategy, address(solanaStrategy), "solana strategy mismatch");

        assertEq(vault.strategyCount(), 3, "expected three registered strategies");
        assertEq(vault.strategies(0), address(charmStrategy), "first strategy should be charm");
        assertEq(vault.weights(0), 6_000, "charm weight mismatch");
        assertEq(vault.strategies(1), address(ajnaStrategy), "second strategy should be ajna");
        assertEq(vault.weights(1), 2_500, "ajna weight mismatch");
        assertEq(vault.strategies(2), address(solanaStrategy), "third strategy should be solana");
        assertEq(vault.weights(2), 1_000, "solana weight mismatch");
        assertTrue(vault.autoAllocate(), "auto-allocate should be enabled");

        assertTrue(charmStrategy.approvalsInitialized(), "charm strategy approvals not initialized");
        assertEq(charmStrategy.lastOwner(), protocolTreasury, "charm strategy ownership not transferred");
        assertEq(ajnaStrategy.lastOwner(), protocolTreasury, "ajna strategy ownership not transferred");
        assertEq(solanaStrategy.lastOwner(), protocolTreasury, "solana strategy ownership not transferred");
    }

    function test_deployPhase3Strategies_revertsWhenSolanaWeightSetWithoutCodeId() public {
        DeploymentBatcher.Phase3Params memory params = DeploymentBatcher.Phase3Params({
            creatorToken: creatorToken,
            owner: address(this),
            vault: address(vault),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHRM",
            charmWeightBps: 6_000,
            ajnaWeightBps: 2_500,
            solanaWeightBps: 500,
            solanaKeeper: solanaKeeper,
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: solanaBridge,
            enableAutoAllocate: false
        });

        DeploymentBatcher.StrategyCodeIds memory codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: CHARM_ALPHA_CODE_ID,
            creatorCharmStrategy: CREATOR_CHARM_STRATEGY_CODE_ID,
            ajnaStrategy: AJNA_STRATEGY_CODE_ID,
            solanaStrategy: bytes32(0)
        });

        vm.expectRevert(DeploymentBatcher.InvalidCodeId.selector);
        batcher.deployPhase3Strategies(params, codeIds);
    }

    function test_deployPhase3Strategies_revertsWhenAjnaWeightIsZero() public {
        DeploymentBatcher.Phase3Params memory params = DeploymentBatcher.Phase3Params({
            creatorToken: creatorToken,
            owner: address(this),
            vault: address(vault),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHRM",
            charmWeightBps: 6_000,
            ajnaWeightBps: 0,
            solanaWeightBps: 1_000,
            solanaKeeper: solanaKeeper,
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: solanaBridge,
            enableAutoAllocate: false
        });

        DeploymentBatcher.StrategyCodeIds memory codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: CHARM_ALPHA_CODE_ID,
            creatorCharmStrategy: CREATOR_CHARM_STRATEGY_CODE_ID,
            ajnaStrategy: AJNA_STRATEGY_CODE_ID,
            solanaStrategy: SOLANA_STRATEGY_CODE_ID
        });

        vm.expectRevert(DeploymentBatcher.InvalidWeight.selector);
        batcher.deployPhase3Strategies(params, codeIds);
    }

    function test_deployPhase3Strategies_revertsWhenSolanaWeightIsZero() public {
        DeploymentBatcher.Phase3Params memory params = DeploymentBatcher.Phase3Params({
            creatorToken: creatorToken,
            owner: address(this),
            vault: address(vault),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHRM",
            charmWeightBps: 6_000,
            ajnaWeightBps: 3_000,
            solanaWeightBps: 0,
            solanaKeeper: solanaKeeper,
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: solanaBridge,
            enableAutoAllocate: false
        });

        DeploymentBatcher.StrategyCodeIds memory codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: CHARM_ALPHA_CODE_ID,
            creatorCharmStrategy: CREATOR_CHARM_STRATEGY_CODE_ID,
            ajnaStrategy: AJNA_STRATEGY_CODE_ID,
            solanaStrategy: SOLANA_STRATEGY_CODE_ID
        });

        vm.expectRevert(DeploymentBatcher.InvalidWeight.selector);
        batcher.deployPhase3Strategies(params, codeIds);
    }
}
