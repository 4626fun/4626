// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {DeploymentBatcher} from "../contracts/helpers/batchers/DeploymentBatcher.sol";

contract MockOwnableTransfer {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }
}

contract MockCharmStrategy is MockOwnableTransfer {
    bool public approvalsInitialized;

    function initializeApprovals() external {
        approvalsInitialized = true;
    }
}

contract MockCreate2Deployer {
    bytes32 internal immutable charmCodeId;
    bytes32 internal immutable ajnaCodeId;
    bytes32 internal immutable solanaCodeId;

    constructor(bytes32 charmCodeId_, bytes32 ajnaCodeId_, bytes32 solanaCodeId_) {
        charmCodeId = charmCodeId_;
        ajnaCodeId = ajnaCodeId_;
        solanaCodeId = solanaCodeId_;
    }

    function deploy(bytes32, bytes32 codeId, bytes calldata) external returns (address addr) {
        if (codeId == charmCodeId) {
            return address(new MockCharmStrategy());
        }
        if (codeId == ajnaCodeId || codeId == solanaCodeId) {
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

contract MockVaultStrategyManager {
    mapping(address => uint256) public addedWeights;
    bool public autoAllocate;

    function addStrategy(address strategy, uint256 weight) external {
        addedWeights[strategy] = weight;
    }

    function setAutoAllocate(bool enabled) external {
        autoAllocate = enabled;
    }
}

contract DeploymentBatcherPhase3OwnershipTest is Test {
    bytes4 internal constant CREATE_VAULT_SELECTOR =
        bytes4(keccak256("createVault((address,address,uint24,address,uint256,int24,int24,uint24,uint32,int24,int24,uint32,string,string))"));

    bytes32 internal constant CHARM_ALPHA_VAULT_DEPLOY_CODE_ID = keccak256("charm-alpha-vault-deploy");
    bytes32 internal constant CREATOR_CHARM_STRATEGY_CODE_ID = keccak256("creator-charm-strategy");
    bytes32 internal constant AJNA_STRATEGY_CODE_ID = keccak256("ajna-strategy");
    bytes32 internal constant SOLANA_STRATEGY_CODE_ID = keccak256("solana-strategy");

    address internal immutable ownerAddr = makeAddr("owner");
    address internal immutable protocolTreasury = makeAddr("protocolTreasury");

    MockVaultStrategyManager internal vault;
    MockCreate2Deployer internal create2Deployer;
    DeploymentBatcher internal batcher;

    function setUp() public {
        vault = new MockVaultStrategyManager();
        create2Deployer =
            new MockCreate2Deployer(CREATOR_CHARM_STRATEGY_CODE_ID, AJNA_STRATEGY_CODE_ID, SOLANA_STRATEGY_CODE_ID);

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
            address(new MockUniswapV3Factory(makeAddr("v3Pool"))),
            makeAddr("uniswapRouter"),
            makeAddr("ajnaFactory"),
            makeAddr("vaultCoreModule"),
            makeAddr("vaultStrategiesModule"),
            makeAddr("vaultAdminModule")
        );

        vm.mockCall(
            batcher.CHARM_FACTORY(), abi.encodeWithSelector(CREATE_VAULT_SELECTOR), abi.encode(makeAddr("charmVault"))
        );
    }

    function test_deployPhase3Strategies_setsAjnaOwnerToCanonicalOwner_forKeeperPath() external {
        DeploymentBatcher.Phase3Params memory params = DeploymentBatcher.Phase3Params({
            creatorToken: makeAddr("creatorToken"),
            owner: ownerAddr,
            vault: address(vault),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHV",
            charmWeightBps: 7000,
            ajnaWeightBps: 3000,
            solanaWeightBps: 0,
            enableAutoAllocate: true
        });
        DeploymentBatcher.StrategyCodeIds memory codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: CHARM_ALPHA_VAULT_DEPLOY_CODE_ID,
            creatorCharmStrategy: CREATOR_CHARM_STRATEGY_CODE_ID,
            ajnaStrategy: AJNA_STRATEGY_CODE_ID,
            solanaStrategy: bytes32(0)
        });

        vm.prank(ownerAddr);
        DeploymentBatcher.Phase3Result memory out = batcher.deployPhase3Strategies(params, codeIds);

        assertEq(MockOwnableTransfer(out.ajnaStrategy).owner(), ownerAddr, "ajna owner should stay canonical owner");
        assertEq(MockOwnableTransfer(out.charmStrategy).owner(), protocolTreasury, "charm owner remains treasury");
        assertEq(vault.addedWeights(out.charmStrategy), params.charmWeightBps, "charm strategy should be registered");
        assertEq(vault.addedWeights(out.ajnaStrategy), params.ajnaWeightBps, "ajna strategy should be registered");
        assertTrue(vault.autoAllocate(), "auto-allocate should be enabled");
    }
}
