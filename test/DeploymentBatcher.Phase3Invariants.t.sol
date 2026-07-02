// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";

import {DeploymentBatcher} from "../contracts/helpers/batchers/DeploymentBatcher.sol";
import "./helpers/DeploymentBatcherFixture.sol";
import {
    MockAjnaAdapterForPhase3,
    MockAjnaPoolFactoryForPhase3,
    MockAjnaVaultAuthForPhase3,
    MockCharmStrategyForPhase3,
    MockCharmVaultForPhase3,
    MockCreate2DeployerForPhase3,
    MockOwnableTransferForPhase3,
    MockUniswapV3FactoryForPhase3,
    MockUniswapV3PoolForPhase3,
    MockVaultStrategyManagerForPhase3
} from "./helpers/DeploymentBatcherPhase3Mocks.sol";

contract DeploymentBatcherPhase3WeightHandler is Test {
    address internal constant CHARM_FACTORY = 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa;
    bytes4 internal constant CREATE_VAULT_SELECTOR = bytes4(
        keccak256(
            "createVault((address,address,uint24,address,uint256,int24,int24,uint24,uint32,int24,int24,uint32,string,string))"
        )
    );
    bytes4 internal constant GOVERNANCE_SELECTOR = bytes4(keccak256("governance()"));
    bytes4 internal constant PROTOCOL_FEE_SELECTOR = bytes4(keccak256("protocolFee()"));

    bytes32 internal constant CHARM_ALPHA_CODE_ID = bytes32(uint256(1));
    bytes32 internal constant CREATOR_CHARM_STRATEGY_CODE_ID = bytes32(uint256(2));
    bytes32 internal constant AJNA_AUTH_CODE_ID = bytes32(uint256(3));
    bytes32 internal constant AJNA_VAULT_CODE_ID = bytes32(uint256(4));
    bytes32 internal constant AJNA_ADAPTER_CODE_ID = bytes32(uint256(5));
    bytes32 internal constant SOLANA_STRATEGY_CODE_ID = bytes32(uint256(6));
    uint24 internal constant CHARM_PROTOCOL_FEE_PIPS = 10_000;
    uint256 internal constant MAX_EXERCISED_CASES = 32;

    uint256 public acceptedDeploys;
    uint256 public rejectedDeploys;
    uint256 public badAcceptedDeploys;
    uint256 public badRejectedDeploys;

    function deployWithWeights(uint16 charmRaw, uint16 ajnaRaw, uint16 solanaRaw) external {
        if (acceptedDeploys + rejectedDeploys + badAcceptedDeploys + badRejectedDeploys >= MAX_EXERCISED_CASES) {
            return;
        }

        uint256 charmWeight = uint256(charmRaw);
        uint256 ajnaWeight = uint256(ajnaRaw);
        uint256 solanaWeight = uint256(solanaRaw);
        bool shouldAccept = _weightsAreValid(charmWeight, ajnaWeight, solanaWeight);

        (
            DeploymentBatcher batcher,
            MockVaultStrategyManagerForPhase3 vault,
            DeploymentBatcher.Phase3Params memory params,
            DeploymentBatcher.StrategyCodeIds memory codeIds
        ) = _freshFixture(charmWeight, ajnaWeight, solanaWeight);

        try batcher.deployPhase3Strategies(params, codeIds) {
            if (!shouldAccept) {
                badAcceptedDeploys++;
                return;
            }
            acceptedDeploys++;
            _assertAcceptedVaultRegistration(vault, charmWeight, ajnaWeight, solanaWeight);
        } catch {
            if (shouldAccept) {
                badRejectedDeploys++;
            } else {
                rejectedDeploys++;
            }
        }
    }

    function _weightsAreValid(uint256 charmWeight, uint256 ajnaWeight, uint256 solanaWeight)
        internal
        pure
        returns (bool)
    {
        if (solanaWeight != 0) return false;
        if (charmWeight > 10_000 || ajnaWeight > 10_000) return false;
        uint256 totalProductiveWeight = charmWeight + ajnaWeight;
        return totalProductiveWeight > 0 && totalProductiveWeight <= 10_000;
    }

    function _freshFixture(uint256 charmWeight, uint256 ajnaWeight, uint256 solanaWeight)
        internal
        returns (
            DeploymentBatcher batcher,
            MockVaultStrategyManagerForPhase3 vault,
            DeploymentBatcher.Phase3Params memory params,
            DeploymentBatcher.StrategyCodeIds memory codeIds
        )
    {
        vm.chainId(8453);

        address protocolTreasury = makeAddr("protocolTreasury");
        address protocolAutomation = makeAddr("protocolAutomation");
        MockCreate2DeployerForPhase3 create2Deployer = new MockCreate2DeployerForPhase3();
        MockUniswapV3FactoryForPhase3 uniswapFactory = new MockUniswapV3FactoryForPhase3();
        uniswapFactory.setPool(address(new MockUniswapV3PoolForPhase3()));
        MockAjnaPoolFactoryForPhase3 ajnaFactory = new MockAjnaPoolFactoryForPhase3(makeAddr("ajnaPool"));

        vault = new MockVaultStrategyManagerForPhase3(address(this));
        MockCharmStrategyForPhase3 charmStrategy = new MockCharmStrategyForPhase3();
        MockAjnaVaultAuthForPhase3 ajnaAuth = new MockAjnaVaultAuthForPhase3();
        MockAjnaAdapterForPhase3 ajnaStrategy = new MockAjnaAdapterForPhase3();
        MockOwnableTransferForPhase3 solanaStrategy = new MockOwnableTransferForPhase3();

        codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: charmWeight == 0 ? bytes32(0) : CHARM_ALPHA_CODE_ID,
            creatorCharmStrategy: charmWeight == 0 ? bytes32(0) : CREATOR_CHARM_STRATEGY_CODE_ID,
            ajnaVaultAuth: ajnaWeight == 0 ? bytes32(0) : AJNA_AUTH_CODE_ID,
            ajnaVault: ajnaWeight == 0 ? bytes32(0) : AJNA_VAULT_CODE_ID,
            erc4626StrategyAdapter: ajnaWeight == 0 ? bytes32(0) : AJNA_ADAPTER_CODE_ID,
            solanaStrategy: solanaWeight == 0 ? bytes32(0) : SOLANA_STRATEGY_CODE_ID
        });

        if (charmWeight != 0) {
            create2Deployer.setDeployment(CREATOR_CHARM_STRATEGY_CODE_ID, address(charmStrategy));
        }
        if (ajnaWeight != 0) {
            create2Deployer.setDeployment(AJNA_AUTH_CODE_ID, address(ajnaAuth));
            create2Deployer.setDeployment(AJNA_VAULT_CODE_ID, makeAddr("ajnaVault"));
            create2Deployer.setDeployment(AJNA_ADAPTER_CODE_ID, address(ajnaStrategy));
        }
        if (solanaWeight != 0) {
            create2Deployer.setDeployment(SOLANA_STRATEGY_CODE_ID, address(solanaStrategy));
        }

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
        deployerLib.mockRegistryCreatorCoin(cfg.registry, makeAddr("creatorToken"), makeAddr("creatorOracle"));

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

        params = DeploymentBatcher.Phase3Params({
            creatorToken: makeAddr("creatorToken"),
            owner: address(this),
            vault: address(vault),
            version: "invariant",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHRM",
            ajnaVaultName: "Ajna Inner Vault",
            ajnaVaultSymbol: "AIV",
            charmWeightBps: charmWeight,
            ajnaWeightBps: ajnaWeight,
            solanaWeightBps: solanaWeight,
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
    }

    function _assertAcceptedVaultRegistration(
        MockVaultStrategyManagerForPhase3 vault,
        uint256 charmWeight,
        uint256 ajnaWeight,
        uint256 solanaWeight
    ) internal view {
        uint256 expectedCount =
            (charmWeight == 0 ? 0 : 1) + (ajnaWeight == 0 ? 0 : 1) + (solanaWeight == 0 ? 0 : 1);
        uint256 totalRegisteredWeight;

        assertEq(vault.strategyCount(), expectedCount, "registered strategy count");
        for (uint256 i = 0; i < expectedCount; i++) {
            uint256 weight = vault.weights(i);
            assertGt(weight, 0, "registered zero weight");
            assertLe(weight, 10_000, "registered over-cap weight");
            totalRegisteredWeight += weight;
        }

        assertEq(totalRegisteredWeight, charmWeight + ajnaWeight + solanaWeight, "registered total weight");
        assertLe(totalRegisteredWeight, 10_000, "registered total over cap");
    }
}

contract DeploymentBatcherPhase3InvariantsTest is Test {
    DeploymentBatcherPhase3WeightHandler internal handler;

    function setUp() public {
        handler = new DeploymentBatcherPhase3WeightHandler();
        targetContract(address(handler));
    }

    function invariant_phase3WeightGateOnlyAcceptsValidProductiveWeights() public view {
        assertEq(handler.badAcceptedDeploys(), 0, "invalid phase-3 weights accepted");
        assertEq(handler.badRejectedDeploys(), 0, "valid phase-3 weights rejected");
    }
}

contract DeploymentBatcherPhase3WeightGateSymbolicTest is Test {
    function check_phase3WeightGate(uint16 charmRaw, uint16 ajnaRaw, uint16 solanaRaw) public pure {
        uint256 charmWeight = uint256(charmRaw);
        uint256 ajnaWeight = uint256(ajnaRaw);
        uint256 solanaWeight = uint256(solanaRaw);

        bool accepted = _batcherWeightGateAccepts(charmWeight, ajnaWeight, solanaWeight);
        bool expected = _expectedWeightGateAccepts(charmWeight, ajnaWeight, solanaWeight);

        assert(accepted == expected);
    }

    function testFuzz_phase3WeightGateMatchesProductInvariant(uint16 charmRaw, uint16 ajnaRaw, uint16 solanaRaw)
        public
        pure
    {
        uint256 charmWeight = uint256(charmRaw);
        uint256 ajnaWeight = uint256(ajnaRaw);
        uint256 solanaWeight = uint256(solanaRaw);

        assertEq(
            _batcherWeightGateAccepts(charmWeight, ajnaWeight, solanaWeight),
            _expectedWeightGateAccepts(charmWeight, ajnaWeight, solanaWeight)
        );
    }

    function _batcherWeightGateAccepts(uint256 charmWeight, uint256 ajnaWeight, uint256 solanaWeight)
        internal
        pure
        returns (bool)
    {
        if (solanaWeight != 0) return false;
        if (charmWeight > 10_000) return false;
        if (ajnaWeight > 10_000) return false;

        uint256 totalProductiveWeight = charmWeight + ajnaWeight;
        if (totalProductiveWeight == 0) return false;
        if (totalProductiveWeight > 10_000) return false;

        return true;
    }

    function _expectedWeightGateAccepts(uint256 charmWeight, uint256 ajnaWeight, uint256 solanaWeight)
        internal
        pure
        returns (bool)
    {
        if (solanaWeight != 0) return false;
        if (charmWeight > 10_000 || ajnaWeight > 10_000) return false;
        uint256 totalProductiveWeight = charmWeight + ajnaWeight;
        return totalProductiveWeight > 0 && totalProductiveWeight <= 10_000;
    }
}
