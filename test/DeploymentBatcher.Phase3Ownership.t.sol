// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {DeploymentBatcher, ICharmFactory} from "../contracts/helpers/batchers/DeploymentBatcher.sol";
import "./helpers/DeploymentBatcherFixture.sol";

contract MockOwnableTransfer {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external virtual {
        owner = newOwner;
    }
}

contract MockCharmStrategy is MockOwnableTransfer {
    bool public approvalsInitialized;
    address public creatorOracle;
    address public ajnaPool;

    function initializeApprovals() external {
        approvalsInitialized = true;
    }

    function setCreatorOracle(address _creatorOracle) external {
        creatorOracle = _creatorOracle;
    }

    function setAjnaPool(address _ajnaPool) external {
        ajnaPool = _ajnaPool;
    }

    function setAjnaBorrowConfig(bool, uint256, uint256, uint256, uint256, uint256) external {}
}

contract MockAjnaVaultAuth {
    address public admin;

    function setBufferRatio(uint256) external {}

    function setMinBucketIndex(uint256) external {}

    function setKeeper(address, bool) external {}

    function setSwapper(address) external {}

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

contract MockAjnaAdapter is MockOwnableTransfer {
    uint256 public idleBufferBps;

    function setIdleBufferBps(uint256 newBps) external {
        idleBufferBps = newBps;
    }
}

contract MockCharmVault {
    address public manager;

    constructor(address manager_) {
        manager = manager_;
    }
}

contract MockCreate2Deployer {
    bytes32 internal immutable charmCodeId;
    bytes32 internal immutable ajnaAuthCodeId;
    bytes32 internal immutable ajnaVaultCodeId;
    bytes32 internal immutable ajnaAdapterCodeId;
    bytes32 internal immutable solanaCodeId;

    constructor(
        bytes32 charmCodeId_,
        bytes32 ajnaAuthCodeId_,
        bytes32 ajnaVaultCodeId_,
        bytes32 ajnaAdapterCodeId_,
        bytes32 solanaCodeId_
    ) {
        charmCodeId = charmCodeId_;
        ajnaAuthCodeId = ajnaAuthCodeId_;
        ajnaVaultCodeId = ajnaVaultCodeId_;
        ajnaAdapterCodeId = ajnaAdapterCodeId_;
        solanaCodeId = solanaCodeId_;
    }

    function deploy(bytes32, bytes32 codeId, bytes calldata) external returns (address addr) {
        if (codeId == charmCodeId) {
            return address(new MockCharmStrategy());
        }
        if (codeId == ajnaAuthCodeId) {
            return address(new MockAjnaVaultAuth());
        }
        if (codeId == ajnaVaultCodeId) {
            return address(uint160(uint256(keccak256("ajnaVault"))));
        }
        if (codeId == ajnaAdapterCodeId) {
            return address(new MockAjnaAdapter());
        }
        if (codeId == solanaCodeId) {
            return address(new MockOwnableTransfer());
        }
        revert("unknown codeId");
    }

    function computeAddress(bytes32, bytes32) external pure returns (address) {
        return address(0x1234);
    }
}

contract MockUniswapV3Factory {
    address internal immutable existingPool;

    constructor(address pool_) {
        existingPool = pool_;
    }

    function getPool(address, address, uint24) external view returns (address) {
        return existingPool;
    }

    function createPool(address, address, uint24) external pure returns (address) {
        revert("unused");
    }
}

contract MockAjnaPoolFactory {
    address internal immutable existingPool;

    constructor(address pool_) {
        existingPool = pool_;
    }

    function ERC20_NON_SUBSET_HASH() external pure returns (bytes32) {
        return bytes32(uint256(1));
    }

    function deployedPools(bytes32, address, address) external view returns (address) {
        return existingPool;
    }

    function deployPool(address, address, uint256) external view returns (address) {
        return existingPool;
    }

    function MIN_RATE() external pure returns (uint256) {
        return 1e16;
    }

    function MAX_RATE() external pure returns (uint256) {
        return 1e17;
    }
}

contract MockVaultStrategyManager {
    address public owner;
    address public managementAddress;
    mapping(address => uint256) public addedWeights;
    bool public autoAllocate;

    error Unauthorized();

    constructor(address owner_) {
        owner = owner_;
        managementAddress = owner_;
    }

    function addStrategy(address strategy, uint256 weight) external {
        if (msg.sender != managementAddress && msg.sender != owner) revert Unauthorized();
        addedWeights[strategy] = weight;
    }

    function management() external view returns (address) {
        return managementAddress;
    }

    function setManagement(address account) external {
        managementAddress = account;
    }

    function setAutoAllocate(bool enabled) external {
        if (msg.sender != managementAddress && msg.sender != owner) revert Unauthorized();
        autoAllocate = enabled;
    }
}

contract DeploymentBatcherPhase3OwnershipTest is Test {
    bytes4 internal constant CREATE_VAULT_SELECTOR =
        bytes4(keccak256("createVault((address,address,uint24,address,uint256,int24,int24,uint24,uint32,int24,int24,uint32,string,string))"));
    bytes4 internal constant GOVERNANCE_SELECTOR = bytes4(keccak256("governance()"));
    bytes4 internal constant PROTOCOL_FEE_SELECTOR = bytes4(keccak256("protocolFee()"));

    bytes32 internal constant CHARM_ALPHA_VAULT_DEPLOY_CODE_ID = keccak256("charm-alpha-vault-deploy");
    bytes32 internal constant CREATOR_CHARM_STRATEGY_CODE_ID = keccak256("creator-charm-strategy");
    bytes32 internal constant AJNA_AUTH_CODE_ID = keccak256("ajna-auth");
    bytes32 internal constant AJNA_VAULT_CODE_ID = keccak256("ajna-vault");
    bytes32 internal constant AJNA_ADAPTER_CODE_ID = keccak256("ajna-adapter");
    bytes32 internal constant SOLANA_STRATEGY_CODE_ID = keccak256("solana-strategy");
    uint24 internal constant CHARM_MANAGER_FEE_PIPS = 160_000; // 16% in Charm's 1e6 precision
    uint24 internal constant CHARM_PROTOCOL_FEE_PIPS = 10_000; // 1% in Charm's 1e6 precision

    address internal immutable ownerAddr = makeAddr("owner");
    address internal immutable protocolTreasury = makeAddr("protocolTreasury");
    address internal immutable protocolAutomation = makeAddr("protocolAutomation");

    MockVaultStrategyManager internal vault;
    MockCreate2Deployer internal create2Deployer;
    DeploymentBatcher internal batcher;

    function setUp() public {
        vm.chainId(8453);

        vault = new MockVaultStrategyManager(ownerAddr);
        create2Deployer = new MockCreate2Deployer(
            CREATOR_CHARM_STRATEGY_CODE_ID,
            AJNA_AUTH_CODE_ID,
            AJNA_VAULT_CODE_ID,
            AJNA_ADAPTER_CODE_ID,
            SOLANA_STRATEGY_CODE_ID
        );

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
            uniswapV3Factory: address(new MockUniswapV3Factory(makeAddr("v3Pool"))),
            uniswapRouter: makeAddr("uniswapRouter"),
            ajnaFactory: address(new MockAjnaPoolFactory(makeAddr("ajnaPool"))),
            vaultCoreModule: makeAddr("vaultCoreModule"),
            vaultStrategiesModule: makeAddr("vaultStrategiesModule"),
            vaultAdminModule: makeAddr("vaultAdminModule")
        });
        (batcher,) = deployerLib.deployBatcher(cfg);
        vault.setManagement(address(batcher));
        deployerLib.mockRegistryCreatorCoin(cfg.registry, makeAddr("creatorToken"), makeAddr("creatorOracle"));

        vm.mockCall(
            batcher.CHARM_FACTORY(),
            abi.encodeWithSelector(GOVERNANCE_SELECTOR),
            abi.encode(address(0x424cdd9021AF88A86C76b245e24583f9a71e32a1))
        );
        vm.mockCall(
            batcher.CHARM_FACTORY(), abi.encodeWithSelector(PROTOCOL_FEE_SELECTOR), abi.encode(CHARM_PROTOCOL_FEE_PIPS)
        );
        vm.mockCall(
            batcher.CHARM_FACTORY(),
            abi.encodeWithSelector(CREATE_VAULT_SELECTOR),
            abi.encode(address(new MockCharmVault(protocolAutomation)))
        );
    }

    function test_deployPhase3Strategies_setsNestedAjnaOwnerAndAuthAdminToTreasury() external {
        DeploymentBatcher.Phase3Params memory params = DeploymentBatcher.Phase3Params({
            creatorToken: makeAddr("creatorToken"),
            owner: ownerAddr,
            vault: address(vault),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHV",
            ajnaVaultName: "Ajna Inner Vault",
            ajnaVaultSymbol: "AIV",
            charmWeightBps: 7000,
            ajnaWeightBps: 2000,
            solanaWeightBps: 0,
            ajnaBufferRatioBps: 1_500,
            ajnaMinBucketIndex: 4_156,
            ajnaKeeper: makeAddr("ajnaKeeper"),
            solanaKeeper: makeAddr("solanaKeeper"),
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: makeAddr("solanaBridge"),
            enableAutoAllocate: true,
            expectedCharmProtocolFeePips: CHARM_PROTOCOL_FEE_PIPS
        });
        DeploymentBatcher.StrategyCodeIds memory codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: CHARM_ALPHA_VAULT_DEPLOY_CODE_ID,
            creatorCharmStrategy: CREATOR_CHARM_STRATEGY_CODE_ID,
            ajnaVaultAuth: AJNA_AUTH_CODE_ID,
            ajnaVault: AJNA_VAULT_CODE_ID,
            erc4626StrategyAdapter: AJNA_ADAPTER_CODE_ID,
            solanaStrategy: SOLANA_STRATEGY_CODE_ID
        });

        vm.prank(ownerAddr);
        DeploymentBatcher.Phase3Result memory out = batcher.deployPhase3Strategies(params, codeIds);

        assertEq(MockOwnableTransfer(out.ajnaStrategy).owner(), protocolTreasury, "ajna adapter owner should be treasury");
        assertEq(
            MockAjnaVaultAuth(out.ajnaVaultAuth).admin(),
            protocolAutomation,
            "ajna auth admin should be protocol automation Safe"
        );
        assertEq(MockAjnaAdapter(out.ajnaStrategy).idleBufferBps(), 0, "adapter idle buffer should be disabled");
        assertEq(MockOwnableTransfer(out.charmStrategy).owner(), protocolTreasury, "charm owner remains treasury");
        assertEq(vault.addedWeights(out.charmStrategy), params.charmWeightBps, "charm strategy should be registered");
        assertEq(vault.addedWeights(out.ajnaStrategy), params.ajnaWeightBps, "ajna strategy should be registered");
        assertTrue(vault.autoAllocate(), "auto-allocate should be enabled");
    }

    function test_deployPhase3Strategies_callsCharmFactoryWithExpectedManagerFeePips() external {
        DeploymentBatcher.Phase3Params memory params = DeploymentBatcher.Phase3Params({
            creatorToken: makeAddr("creatorToken"),
            owner: ownerAddr,
            vault: address(vault),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHV",
            ajnaVaultName: "Ajna Inner Vault",
            ajnaVaultSymbol: "AIV",
            charmWeightBps: 7000,
            ajnaWeightBps: 2000,
            solanaWeightBps: 0,
            ajnaBufferRatioBps: 1_500,
            ajnaMinBucketIndex: 4_156,
            ajnaKeeper: makeAddr("ajnaKeeper"),
            solanaKeeper: makeAddr("solanaKeeper"),
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: makeAddr("solanaBridge"),
            enableAutoAllocate: true,
            expectedCharmProtocolFeePips: CHARM_PROTOCOL_FEE_PIPS
        });
        DeploymentBatcher.StrategyCodeIds memory codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: CHARM_ALPHA_VAULT_DEPLOY_CODE_ID,
            creatorCharmStrategy: CREATOR_CHARM_STRATEGY_CODE_ID,
            ajnaVaultAuth: AJNA_AUTH_CODE_ID,
            ajnaVault: AJNA_VAULT_CODE_ID,
            erc4626StrategyAdapter: AJNA_ADAPTER_CODE_ID,
            solanaStrategy: SOLANA_STRATEGY_CODE_ID
        });

        address v3Pool = MockUniswapV3Factory(batcher.uniswapV3Factory()).getPool(params.creatorToken, batcher.usdc(), 3000);
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

        vm.expectCall(batcher.CHARM_FACTORY(), abi.encodeWithSelector(CREATE_VAULT_SELECTOR, expectedVaultParams));

        vm.prank(ownerAddr);
        batcher.deployPhase3Strategies(params, codeIds);
    }

    function test_deployPhase3Strategies_revertsWhenCharmFactoryProtocolFeeMismatches() external {
        DeploymentBatcher.Phase3Params memory params = DeploymentBatcher.Phase3Params({
            creatorToken: makeAddr("creatorToken"),
            owner: ownerAddr,
            vault: address(vault),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHV",
            ajnaVaultName: "Ajna Inner Vault",
            ajnaVaultSymbol: "AIV",
            charmWeightBps: 7000,
            ajnaWeightBps: 2000,
            solanaWeightBps: 0,
            ajnaBufferRatioBps: 1_500,
            ajnaMinBucketIndex: 4_156,
            ajnaKeeper: makeAddr("ajnaKeeper"),
            solanaKeeper: makeAddr("solanaKeeper"),
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: makeAddr("solanaBridge"),
            enableAutoAllocate: true,
            expectedCharmProtocolFeePips: CHARM_PROTOCOL_FEE_PIPS
        });
        DeploymentBatcher.StrategyCodeIds memory codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: CHARM_ALPHA_VAULT_DEPLOY_CODE_ID,
            creatorCharmStrategy: CREATOR_CHARM_STRATEGY_CODE_ID,
            ajnaVaultAuth: AJNA_AUTH_CODE_ID,
            ajnaVault: AJNA_VAULT_CODE_ID,
            erc4626StrategyAdapter: AJNA_ADAPTER_CODE_ID,
            solanaStrategy: SOLANA_STRATEGY_CODE_ID
        });

        uint24 mismatchedProtocolFee = CHARM_PROTOCOL_FEE_PIPS + 1;
        vm.mockCall(
            batcher.CHARM_FACTORY(), abi.encodeWithSelector(PROTOCOL_FEE_SELECTOR), abi.encode(mismatchedProtocolFee)
        );

        vm.prank(ownerAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                DeploymentBatcher.CharmFactoryProtocolFeeMismatch.selector,
                uint256(CHARM_PROTOCOL_FEE_PIPS),
                uint256(mismatchedProtocolFee)
            )
        );
        batcher.deployPhase3Strategies(params, codeIds);
    }

    function test_deployPhase3Strategies_usesDefaultCharmProtocolFeeWhenParamIsZero() external {
        DeploymentBatcher.Phase3Params memory params = DeploymentBatcher.Phase3Params({
            creatorToken: makeAddr("creatorToken"),
            owner: ownerAddr,
            vault: address(vault),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHV",
            ajnaVaultName: "Ajna Inner Vault",
            ajnaVaultSymbol: "AIV",
            charmWeightBps: 7000,
            ajnaWeightBps: 2000,
            solanaWeightBps: 0,
            ajnaBufferRatioBps: 1_500,
            ajnaMinBucketIndex: 4_156,
            ajnaKeeper: makeAddr("ajnaKeeper"),
            solanaKeeper: makeAddr("solanaKeeper"),
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: makeAddr("solanaBridge"),
            enableAutoAllocate: true,
            expectedCharmProtocolFeePips: 0
        });
        DeploymentBatcher.StrategyCodeIds memory codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: CHARM_ALPHA_VAULT_DEPLOY_CODE_ID,
            creatorCharmStrategy: CREATOR_CHARM_STRATEGY_CODE_ID,
            ajnaVaultAuth: AJNA_AUTH_CODE_ID,
            ajnaVault: AJNA_VAULT_CODE_ID,
            erc4626StrategyAdapter: AJNA_ADAPTER_CODE_ID,
            solanaStrategy: SOLANA_STRATEGY_CODE_ID
        });

        vm.prank(ownerAddr);
        DeploymentBatcher.Phase3Result memory out = batcher.deployPhase3Strategies(params, codeIds);
        assertEq(MockOwnableTransfer(out.charmStrategy).owner(), protocolTreasury, "default protocol fee guard should pass");
    }

    function test_deployPhase3Strategies_acceptsCustomExpectedCharmProtocolFee() external {
        DeploymentBatcher.Phase3Params memory params = DeploymentBatcher.Phase3Params({
            creatorToken: makeAddr("creatorToken"),
            owner: ownerAddr,
            vault: address(vault),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHV",
            ajnaVaultName: "Ajna Inner Vault",
            ajnaVaultSymbol: "AIV",
            charmWeightBps: 7000,
            ajnaWeightBps: 2000,
            solanaWeightBps: 0,
            ajnaBufferRatioBps: 1_500,
            ajnaMinBucketIndex: 4_156,
            ajnaKeeper: makeAddr("ajnaKeeper"),
            solanaKeeper: makeAddr("solanaKeeper"),
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: makeAddr("solanaBridge"),
            enableAutoAllocate: true,
            expectedCharmProtocolFeePips: 12_345
        });
        DeploymentBatcher.StrategyCodeIds memory codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: CHARM_ALPHA_VAULT_DEPLOY_CODE_ID,
            creatorCharmStrategy: CREATOR_CHARM_STRATEGY_CODE_ID,
            ajnaVaultAuth: AJNA_AUTH_CODE_ID,
            ajnaVault: AJNA_VAULT_CODE_ID,
            erc4626StrategyAdapter: AJNA_ADAPTER_CODE_ID,
            solanaStrategy: SOLANA_STRATEGY_CODE_ID
        });

        vm.mockCall(batcher.CHARM_FACTORY(), abi.encodeWithSelector(PROTOCOL_FEE_SELECTOR), abi.encode(uint24(12_345)));

        vm.prank(ownerAddr);
        DeploymentBatcher.Phase3Result memory out = batcher.deployPhase3Strategies(params, codeIds);
        assertEq(MockOwnableTransfer(out.charmStrategy).owner(), protocolTreasury, "custom protocol fee guard should pass");
    }

    function test_deployPhase3Strategies_revertsWhenCharmVaultManagerMismatches() external {
        DeploymentBatcher.Phase3Params memory params = DeploymentBatcher.Phase3Params({
            creatorToken: makeAddr("creatorToken"),
            owner: ownerAddr,
            vault: address(vault),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHV",
            ajnaVaultName: "Ajna Inner Vault",
            ajnaVaultSymbol: "AIV",
            charmWeightBps: 7000,
            ajnaWeightBps: 2000,
            solanaWeightBps: 0,
            ajnaBufferRatioBps: 1_500,
            ajnaMinBucketIndex: 4_156,
            ajnaKeeper: makeAddr("ajnaKeeper"),
            solanaKeeper: makeAddr("solanaKeeper"),
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: makeAddr("solanaBridge"),
            enableAutoAllocate: true,
            expectedCharmProtocolFeePips: CHARM_PROTOCOL_FEE_PIPS
        });
        DeploymentBatcher.StrategyCodeIds memory codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: CHARM_ALPHA_VAULT_DEPLOY_CODE_ID,
            creatorCharmStrategy: CREATOR_CHARM_STRATEGY_CODE_ID,
            ajnaVaultAuth: AJNA_AUTH_CODE_ID,
            ajnaVault: AJNA_VAULT_CODE_ID,
            erc4626StrategyAdapter: AJNA_ADAPTER_CODE_ID,
            solanaStrategy: SOLANA_STRATEGY_CODE_ID
        });

        address wrongManager = makeAddr("wrongManager");
        vm.mockCall(
            batcher.CHARM_FACTORY(),
            abi.encodeWithSelector(CREATE_VAULT_SELECTOR),
            abi.encode(address(new MockCharmVault(wrongManager)))
        );

        vm.prank(ownerAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                DeploymentBatcher.CharmVaultManagerMismatch.selector, protocolAutomation, wrongManager
            )
        );
        batcher.deployPhase3Strategies(params, codeIds);
    }
}
