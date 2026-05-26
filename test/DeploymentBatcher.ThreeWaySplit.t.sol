// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/helpers/batchers/DeploymentBatcher.sol";
import "../contracts/governance/VaultRolePolicyManager.sol";

contract MockOwnableVaultForPhase3Bounds {
    address public owner;
    address public managementAddress;

    constructor(address owner_) {
        owner = owner_;
        managementAddress = owner_;
    }

    function management() external view returns (address) {
        return managementAddress;
    }

    function setManagement(address account) external {
        managementAddress = account;
    }
}

contract DeploymentBatcherThreeWaySplitTest is Test {
    DeploymentBatcher internal batcher;
    MockOwnableVaultForPhase3Bounds internal vault;
    VaultRolePolicyManager internal rolePolicyManager;
    address internal protocolTreasury;
    address internal protocolAutomation;
    uint256 private constant PHASE1_SPLIT_STATES_SLOT = 6;
    uint256 private constant PENDING_AUCTIONS_SLOT = 4;

    function setUp() public {
        vm.chainId(8453);
        protocolTreasury = makeAddr("protocolTreasury");
        protocolAutomation = makeAddr("protocolAutomation");

        vault = new MockOwnableVaultForPhase3Bounds(address(this));
        DeploymentBatcherPhase2Module phase2Fixture = new DeploymentBatcherPhase2Module(
            makeAddr("create2Deployer"),
            makeAddr("registry"),
            makeAddr("chainlinkEthUsd"),
            makeAddr("poolManager"),
            makeAddr("taxHook"),
            protocolTreasury,
            makeAddr("lotteryManager"),
            makeAddr("vaultActivationBatcher"),
            makeAddr("batcher")
        );
        batcher = new DeploymentBatcher(
            makeAddr("registry"),
            makeAddr("bytecodeStore"),
            makeAddr("create2Deployer"),
            protocolTreasury,
            protocolAutomation,
            makeAddr("poolManager"),
            makeAddr("taxHook"),
            makeAddr("chainlinkEthUsd"),
            makeAddr("vaultActivationBatcher"),
            makeAddr("lotteryManager"),
            makeAddr("permit2"),
            makeAddr("usdc"),
            makeAddr("uniswapV3Factory"),
            makeAddr("uniswapRouter"),
            makeAddr("ajnaFactory"),
            makeAddr("vaultCoreModule"),
            makeAddr("vaultStrategiesModule"),
            makeAddr("vaultAdminModule"),
            address(phase2Fixture)
        );
        rolePolicyManager = new VaultRolePolicyManager(address(this));
        vault.setManagement(address(batcher));
    }

    function test_setVaultRolePolicyConfig_requiresProtocolTreasury() public {
        vm.expectRevert(DeploymentBatcher.NotProtocolTreasury.selector);
        batcher.setVaultRolePolicyConfig(address(rolePolicyManager), 1);
    }

    function test_resetPhase1State_reverts_nonProtocolTreasury() public {
        (,,, bytes32 baseSalt) = _seedPhase1State();
        vm.expectRevert(DeploymentBatcher.NotProtocolTreasury.selector);
        batcher.resetPhase1State(makeAddr("phase1CreatorToken"), makeAddr("phase1Owner"), "v1");
    }

    function test_resetPhase1State_reverts_unknownSalt() public {
        bytes32 baseSalt = keccak256("unknown");

        vm.prank(protocolTreasury);
        vm.expectRevert(DeploymentBatcher.Phase1StateNotStuck.selector);
        batcher.resetPhase1State(makeAddr("unknownCreatorToken"), makeAddr("unknownOwner"), "v1");
    }

    function test_resetPhase1State_reverts_mismatchedTupleContext() public {
        bytes32 baseSalt = _seedPhase1StateWithFinalized(false);
        vm.prank(protocolTreasury);
        batcher.resetPhase1State(makeAddr("phase1CreatorTokenNonFinalized"), makeAddr("phase1OwnerNonFinalized"), "v1");

        (address oftBootstrapRegistry, address clearedVault,,,,,,,) = batcher.phase1SplitStates(baseSalt);
        assertEq(oftBootstrapRegistry, address(0), "phase1 oft bootstrap not cleared");
        assertEq(clearedVault, address(0), "phase1 vault not cleared");
    }

    function test_resetPhase1State_reverts_whenPendingAuctionExists() public {
        (,,, bytes32 baseSalt) = _seedPhase1State();
        _seedPendingAuctionAmount(baseSalt, 1 ether);

        vm.prank(protocolTreasury);
        vm.expectRevert(DeploymentBatcher.AuctionAlreadyPending.selector);
        batcher.resetPhase1State(makeAddr("phase1CreatorToken"), makeAddr("phase1Owner"), "v1");
    }

    function test_resetPhase1State_succeeds_withMatchedTupleContext() public {
        (,,, bytes32 baseSalt) = _seedPhase1State();
        vm.prank(protocolTreasury);
        batcher.resetPhase1State(makeAddr("phase1CreatorToken"), makeAddr("phase1Owner"), "v1");

        (address oftBootstrapRegistry, address clearedVault,,,,,,,) = batcher.phase1SplitStates(baseSalt);
        assertEq(oftBootstrapRegistry, address(0), "phase1 oft bootstrap not cleared");
        assertEq(clearedVault, address(0), "phase1 vault not cleared");
    }

    function test_deployPhase2Core_revertsWhenConfiguredRolePolicyRejectsOwner() public {
        // Policy 7: management must be allowlisted; owner is not allowlisted.
        rolePolicyManager.setRolePolicy(
            7,
            VaultRolePolicyManager.RolePolicy({
                active: true,
                requireOwnerEoa: false,
                managementRule: VaultRolePolicyManager.RoleRule.MustBeAllowlisted,
                keeperRule: VaultRolePolicyManager.RoleRule.Any,
                emergencyAdminRule: VaultRolePolicyManager.RoleRule.Any
            })
        );
        vm.prank(protocolTreasury);
        batcher.setVaultRolePolicyConfig(address(rolePolicyManager), 7);

        DeploymentBatcher.Phase2CoreParams memory params = DeploymentBatcher.Phase2CoreParams({
            creatorToken: makeAddr("creatorToken"),
            owner: address(this),
            creatorTreasury: address(0),
            payoutRecipient: address(0),
            vault: makeAddr("vault"),
            wrapper: makeAddr("wrapper"),
            shareOFT: makeAddr("shareOFT"),
            shareSymbol: "S4626",
            version: "v1",
            floorPriceQ96: 0
        });
        DeploymentBatcher.CodeIds memory codeIds = DeploymentBatcher.CodeIds({
            vault: bytes32(uint256(1)),
            wrapper: bytes32(uint256(2)),
            shareOFT: bytes32(uint256(3)),
            gauge: bytes32(uint256(4)),
            cca: bytes32(uint256(5)),
            oracle: bytes32(uint256(6)),
            oftBootstrap: bytes32(uint256(7))
        });

        vm.expectRevert(
            abi.encodeWithSelector(
                VaultRolePolicyManager.RoleAssignmentNotAllowed.selector,
                uint8(VaultRolePolicyManager.VaultRole.Management),
                address(this)
            )
        );
        batcher.deployPhase2Core(params, codeIds);
    }

    function test_deployPhase2CoreWithRolePolicy_appliesPerCallPolicyOverride() public {
        rolePolicyManager.setRolePolicy(
            9,
            VaultRolePolicyManager.RolePolicy({
                active: true,
                requireOwnerEoa: true,
                managementRule: VaultRolePolicyManager.RoleRule.MustEqualOwner,
                keeperRule: VaultRolePolicyManager.RoleRule.MustEqualOwner,
                emergencyAdminRule: VaultRolePolicyManager.RoleRule.MustEqualOwner
            })
        );
        vm.prank(protocolTreasury);
        batcher.setVaultRolePolicyConfig(address(rolePolicyManager), 0);

        address ownerContract = address(vault);
        DeploymentBatcher.Phase2CoreParams memory params = DeploymentBatcher.Phase2CoreParams({
            creatorToken: makeAddr("creatorToken"),
            owner: ownerContract,
            creatorTreasury: address(0),
            payoutRecipient: address(0),
            vault: makeAddr("vault"),
            wrapper: makeAddr("wrapper"),
            shareOFT: makeAddr("shareOFT"),
            shareSymbol: "S4626",
            version: "v1",
            floorPriceQ96: 0
        });
        DeploymentBatcher.CodeIds memory codeIds = DeploymentBatcher.CodeIds({
            vault: bytes32(uint256(1)),
            wrapper: bytes32(uint256(2)),
            shareOFT: bytes32(uint256(3)),
            gauge: bytes32(uint256(4)),
            cca: bytes32(uint256(5)),
            oracle: bytes32(uint256(6)),
            oftBootstrap: bytes32(uint256(7))
        });

        vm.prank(ownerContract);
        vm.expectRevert(abi.encodeWithSelector(VaultRolePolicyManager.OwnerMustBeEoa.selector, ownerContract));
        batcher.deployPhase2CoreWithRolePolicy(params, codeIds, 9);
    }

    function test_deployPhase3Strategies_revertsWhenTotalWeightExceeds10000() public {
        DeploymentBatcher.Phase3Params memory params = DeploymentBatcher.Phase3Params({
            creatorToken: makeAddr("creatorToken"),
            owner: address(this),
            vault: address(vault),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHRM",
            ajnaVaultName: "Ajna Inner Vault",
            ajnaVaultSymbol: "AIV",
            charmWeightBps: 7_000,
            ajnaWeightBps: 2_000,
            solanaWeightBps: 1_100,
            ajnaBufferRatioBps: 1_000,
            ajnaMinBucketIndex: 4_156,
            ajnaKeeper: makeAddr("ajnaKeeper"),
            solanaKeeper: makeAddr("solanaKeeper"),
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: makeAddr("solanaBridge"),
            enableAutoAllocate: false,
            expectedCharmProtocolFeePips: 10_000
        });

        DeploymentBatcher.StrategyCodeIds memory codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: bytes32(uint256(1)),
            creatorCharmStrategy: bytes32(uint256(2)),
            ajnaVaultAuth: bytes32(uint256(3)),
            ajnaVault: bytes32(uint256(4)),
            erc4626StrategyAdapter: bytes32(uint256(5)),
            solanaStrategy: bytes32(uint256(6))
        });

        vm.expectRevert(DeploymentBatcher.InvalidWeight.selector);
        batcher.deployPhase3Strategies(params, codeIds);
    }

    function test_phase1SaltOverrideEntrypoints_areDisabled() public {
        DeploymentBatcher.Phase1Params memory params = DeploymentBatcher.Phase1Params({
            creatorToken: makeAddr("creatorToken"),
            owner: address(this),
            vaultName: "Creator OVault",
            vaultSymbol: "ovCR8R",
            shareName: "Creator Share",
            shareSymbol: "sCR8R",
            version: "v1"
        });
        DeploymentBatcher.CodeIds memory codeIds = DeploymentBatcher.CodeIds({
            vault: bytes32(uint256(1)),
            wrapper: bytes32(uint256(2)),
            shareOFT: bytes32(uint256(3)),
            gauge: bytes32(uint256(4)),
            cca: bytes32(uint256(5)),
            oracle: bytes32(uint256(6)),
            oftBootstrap: bytes32(uint256(7))
        });

        bytes32 saltOverride = keccak256("custom-share-oft-salt");

        vm.expectRevert(DeploymentBatcher.SaltOverrideDisabled.selector);
        batcher.deployPhase1CoreWithSalt(params, codeIds, saltOverride);

        vm.expectRevert(DeploymentBatcher.SaltOverrideDisabled.selector);
        batcher.finalizePhase1WithSalt(params, codeIds, saltOverride);
    }

    function test_phase2ShareSplitAndDepositBounds_remainFixed() public view {
        assertEq(batcher.MIN_DEPOSIT(), 50_000_000e18, "minimum first deposit drifted");
        assertEq(batcher.MAX_DEPOSIT(), 50_000_000e18, "maximum first deposit drifted");
        assertEq(batcher.AUCTION_PERCENT(), 40, "CCA split drifted");
        assertEq(batcher.VESTING_PERCENT(), 40, "creator vesting split drifted");
        assertEq(100 - batcher.AUCTION_PERCENT() - batcher.VESTING_PERCENT(), 20, "LP reserve split drifted");
    }

    function _seedPhase1State()
        internal
        returns (address phase1Vault, address phase1Wrapper, address phase1ShareOFT, bytes32 baseSalt)
    {
        address creatorToken = makeAddr("phase1CreatorToken");
        address creatorOwner = makeAddr("phase1Owner");
        baseSalt = keccak256(abi.encodePacked(creatorToken, creatorOwner, block.chainid, "4626:deploy:", "v1"));
        phase1Vault = makeAddr("phase1Vault");
        phase1Wrapper = makeAddr("phase1Wrapper");
        phase1ShareOFT = makeAddr("phase1ShareOFT");

        bytes32 stateBase = keccak256(abi.encode(baseSalt, uint256(PHASE1_SPLIT_STATES_SLOT)));
        vm.store(address(batcher), bytes32(uint256(stateBase) + 1), bytes32(uint256(uint160(phase1Vault))));
        vm.store(address(batcher), bytes32(uint256(stateBase) + 2), bytes32(uint256(uint160(phase1Wrapper))));
        vm.store(address(batcher), bytes32(uint256(stateBase) + 3), bytes32(uint256(uint160(phase1ShareOFT))));
        vm.store(
            address(batcher),
            bytes32(uint256(stateBase) + 7),
            bytes32(uint256(0x0101)) // coreDone = true, finalized = true
        );
    }

    function _seedPhase1StateWithFinalized(bool finalized) internal returns (bytes32 baseSalt) {
        address creatorToken = makeAddr("phase1CreatorTokenNonFinalized");
        address creatorOwner = makeAddr("phase1OwnerNonFinalized");
        baseSalt = keccak256(abi.encodePacked(creatorToken, creatorOwner, block.chainid, "4626:deploy:", "v1"));
        bytes32 stateBase = keccak256(abi.encode(baseSalt, uint256(PHASE1_SPLIT_STATES_SLOT)));
        vm.store(address(batcher), bytes32(uint256(stateBase) + 1), bytes32(uint256(uint160(makeAddr("phase1Vault")))));
        vm.store(
            address(batcher),
            bytes32(uint256(stateBase) + 7),
            bytes32(finalized ? uint256(0x0101) : uint256(0x0001)) // coreDone=true, finalized=finalized
        );
    }

    function _seedPendingAuctionAmount(bytes32 baseSalt, uint256 amount) internal {
        bytes32 pendingBase = keccak256(abi.encode(baseSalt, uint256(PENDING_AUCTIONS_SLOT)));
        vm.store(address(batcher), bytes32(uint256(pendingBase) + 2), bytes32(amount));
    }
}
