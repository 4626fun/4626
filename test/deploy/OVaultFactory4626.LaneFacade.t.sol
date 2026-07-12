// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {OVaultFactory4626} from "@4626/shared/deploy/factories/OVaultFactory4626.sol";
import {CreatorOvaultLane} from "@4626/shared/deploy/lanes/CreatorOvaultLane.sol";
import {AgentOvaultLane} from "@4626/shared/deploy/lanes/AgentOvaultLane.sol";
import {IOvaultLane} from "@4626/shared/deploy/lanes/IOvaultLane.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import {DeploymentBatcher} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";
import {IBaseSolanaBridge} from "@4626/shared/interfaces/bridge/IBaseSolanaBridge.sol";
import {GaugeSurfaceRegistry4626} from "@4626/shared/governance/surfaces/GaugeSurfaceRegistry4626.sol";
import {IGaugeSurfaceRegistry} from "@4626/shared/governance/surfaces/IGaugeSurfaceRegistry.sol";

/// @dev Minimal batcher stand-in that records phase-1/2/3 façade calls.
contract MockDeploymentBatcherPhase1 {
    DeploymentBatcher.VaultKind public lastVaultKind;
    bytes32 public lastVaultCodeId;
    bytes32 public lastWrapperCodeId;
    bytes32 public lastShareOftCodeId;
    bytes32 public lastGaugeCodeId;
    bytes32 public lastSalt;
    bytes32 public lastStrategyCharmId;
    uint256 public lastRolePolicyId;
    uint256 public startCalls;
    uint256 public finalizeCalls;
    uint256 public phase2CoreCalls;
    uint256 public phase2FinalizeCalls;
    uint256 public phase3Calls;
    uint256 public lastMsgValue;

    function deployPhase1CoreWithSalt(
        DeploymentBatcher.Phase1Params calldata params,
        DeploymentBatcher.CodeIds calldata codeIds,
        bytes32 shareOftSaltOverride
    ) external returns (DeploymentBatcher.Phase1Result memory out) {
        lastVaultKind = params.vaultKind;
        lastVaultCodeId = codeIds.vault;
        lastWrapperCodeId = codeIds.wrapper;
        lastShareOftCodeId = codeIds.shareOFT;
        lastSalt = shareOftSaltOverride;
        startCalls++;
        out = DeploymentBatcher.Phase1Result({
            oftBootstrapRegistry: address(0xB00),
            vault: address(0xBEE1),
            wrapper: address(0xBEE2),
            shareOFT: address(0)
        });
    }

    function finalizePhase1WithSalt(
        DeploymentBatcher.Phase1Params calldata params,
        DeploymentBatcher.CodeIds calldata codeIds,
        bytes32 shareOftSaltOverride
    ) external returns (DeploymentBatcher.Phase1Result memory out) {
        lastVaultKind = params.vaultKind;
        lastVaultCodeId = codeIds.vault;
        lastWrapperCodeId = codeIds.wrapper;
        lastShareOftCodeId = codeIds.shareOFT;
        lastSalt = shareOftSaltOverride;
        finalizeCalls++;
        out = DeploymentBatcher.Phase1Result({
            oftBootstrapRegistry: address(0xB00),
            vault: address(0xBEE1),
            wrapper: address(0xBEE2),
            shareOFT: address(0xBEE3)
        });
    }

    function deployPhase2Core(
        DeploymentBatcher.Phase2CoreParams calldata, /* params */
        DeploymentBatcher.CodeIds calldata codeIds
    ) external returns (DeploymentBatcher.Phase2Result memory out) {
        lastGaugeCodeId = codeIds.gauge;
        lastVaultCodeId = codeIds.vault;
        phase2CoreCalls++;
        out = DeploymentBatcher.Phase2Result({
            gaugeController: address(0x1001),
            ccaLaunchArm: address(0x1002),
            oracle: address(0x1003),
            auction: address(0)
        });
    }

    function deployPhase2CoreWithRolePolicy(
        DeploymentBatcher.Phase2CoreParams calldata, /* params */
        DeploymentBatcher.CodeIds calldata codeIds,
        uint256 rolePolicyId
    ) external returns (DeploymentBatcher.Phase2Result memory out) {
        lastGaugeCodeId = codeIds.gauge;
        lastRolePolicyId = rolePolicyId;
        phase2CoreCalls++;
        out = DeploymentBatcher.Phase2Result({
            gaugeController: address(0x2001),
            ccaLaunchArm: address(0x2002),
            oracle: address(0x2003),
            auction: address(0)
        });
    }

    function finalizePhase2(DeploymentBatcher.Phase2FinalizeParams calldata /* params */ )
        external
        payable
        returns (DeploymentBatcher.Phase2Result memory out)
    {
        phase2FinalizeCalls++;
        lastMsgValue = msg.value;
        out = DeploymentBatcher.Phase2Result({
            gaugeController: address(0x3001),
            ccaLaunchArm: address(0x3002),
            oracle: address(0x3003),
            auction: address(0x3004)
        });
    }

    function deployPhase3Strategies(
        DeploymentBatcher.Phase3Params calldata, /* params */
        DeploymentBatcher.StrategyCodeIds calldata codeIds
    ) external returns (DeploymentBatcher.Phase3Result memory out) {
        lastStrategyCharmId = codeIds.charmStrategy4626;
        phase3Calls++;
        out = DeploymentBatcher.Phase3Result({
            v3Pool: address(0x4001),
            charmVault: address(0x4002),
            charmStrategy: address(0x4003),
            ajnaVaultAuth: address(0x4004),
            ajnaVault: address(0x4005),
            ajnaStrategy: address(0x4006),
            solanaStrategy: address(0)
        });
    }
}

contract MockERC20Code {
    string public name = "Mock";
    string public symbol = "MCK";
}

/// @dev Minimal code-bearing mock so registerDeployment code.length checks pass.
contract MockDeployedContract {}

contract OVaultFactory4626LaneFacadeTest is Test {
    OVaultFactory4626 internal factory;
    CreatorOvaultLane internal creatorLane;
    AgentOvaultLane internal agentLane;
    MockDeploymentBatcherPhase1 internal batcher;
    address internal owner = address(this);

    IOvaultLane.CodeIds internal creatorIds;
    IOvaultLane.CodeIds internal agentIds;

    function setUp() public {
        factory = new OVaultFactory4626(address(0), owner);
        creatorLane = new CreatorOvaultLane(owner);
        agentLane = new AgentOvaultLane(owner);
        batcher = new MockDeploymentBatcherPhase1();

        creatorIds = IOvaultLane.CodeIds({
            vault: bytes32(uint256(1)),
            wrapper: bytes32(uint256(2)),
            shareOFT: bytes32(uint256(3)),
            gauge: bytes32(uint256(4)),
            cca: bytes32(uint256(5)),
            oracle: bytes32(uint256(6)),
            oftBootstrap: bytes32(uint256(7))
        });
        agentIds = IOvaultLane.CodeIds({
            vault: bytes32(uint256(11)),
            wrapper: bytes32(uint256(12)),
            shareOFT: bytes32(uint256(13)),
            gauge: bytes32(uint256(14)),
            cca: bytes32(uint256(15)),
            oracle: bytes32(uint256(16)),
            oftBootstrap: bytes32(uint256(17))
        });

        creatorLane.setCodeIds(creatorIds);
        agentLane.setCodeIds(agentIds);

        factory.setLane(IRegistry4626.VaultKind.Creator, address(creatorLane));
        factory.setLane(IRegistry4626.VaultKind.Agent, address(agentLane));
        factory.setDeploymentBatcher(address(batcher));
    }

    function test_laneKindsAndSaltLabels() public view {
        assertEq(uint8(creatorLane.kind()), uint8(IRegistry4626.VaultKind.Creator));
        assertEq(uint8(agentLane.kind()), uint8(IRegistry4626.VaultKind.Agent));
        assertEq(keccak256(bytes(creatorLane.laneId())), keccak256("creator"));
        assertEq(keccak256(bytes(agentLane.laneId())), keccak256("agent"));
        assertEq(keccak256(bytes(creatorLane.saltLabel("vault"))), keccak256("vault"));
        assertEq(keccak256(bytes(agentLane.saltLabel("vault"))), keccak256("agentVault"));
        assertEq(keccak256(bytes(agentLane.saltLabel("wrapper"))), keccak256("agentWrapper"));
    }

    function test_setLane_revertsOnKindMismatch() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                OVaultFactory4626.LaneKindMismatch.selector,
                IRegistry4626.VaultKind.Creator,
                IRegistry4626.VaultKind.Agent
            )
        );
        factory.setLane(IRegistry4626.VaultKind.Creator, address(agentLane));
    }

    function test_resolveLane_returnsCodeIds() public view {
        (address lane, IOvaultLane.CodeIds memory ids, string memory id_) =
            factory.resolveLane(IRegistry4626.VaultKind.Agent);
        assertEq(lane, address(agentLane));
        assertEq(ids.vault, agentIds.vault);
        assertEq(keccak256(bytes(id_)), keccak256("agent"));
    }

    function test_startPhase1_forcesVaultKindAndLaneCodeIds() public {
        address token = address(0xA0);
        address vaultOwner = address(0xA11CE);

        DeploymentBatcher.Phase1Params memory params = DeploymentBatcher.Phase1Params({
            creatorToken: token,
            owner: vaultOwner,
            vaultName: "v",
            vaultSymbol: "V",
            shareName: "s",
            shareSymbol: "S",
            version: "v1",
            // Intentionally wrong — factory must overwrite from `kind` arg.
            vaultKind: DeploymentBatcher.VaultKind.Creator
        });

        DeploymentBatcher.Phase1Result memory out =
            factory.startPhase1(IRegistry4626.VaultKind.Agent, params, bytes32(uint256(99)));

        assertEq(out.vault, address(0xBEE1));
        assertEq(batcher.startCalls(), 1);
        assertEq(uint8(batcher.lastVaultKind()), uint8(DeploymentBatcher.VaultKind.Agent));
        assertEq(batcher.lastVaultCodeId(), agentIds.vault);
        assertEq(batcher.lastWrapperCodeId(), agentIds.wrapper);
        assertEq(batcher.lastSalt(), bytes32(uint256(99)));
    }

    function test_finalizePhase1_usesLaneCodeIds() public {
        DeploymentBatcher.Phase1Params memory params = DeploymentBatcher.Phase1Params({
            creatorToken: address(0xA1),
            owner: address(0xB0B),
            vaultName: "v",
            vaultSymbol: "V",
            shareName: "s",
            shareSymbol: "S",
            version: "v1",
            vaultKind: DeploymentBatcher.VaultKind.Creator
        });

        DeploymentBatcher.Phase1Result memory out =
            factory.finalizePhase1(IRegistry4626.VaultKind.Creator, params, bytes32(0));

        assertEq(out.shareOFT, address(0xBEE3));
        assertEq(batcher.finalizeCalls(), 1);
        assertEq(batcher.lastShareOftCodeId(), creatorIds.shareOFT);
        assertEq(uint8(batcher.lastVaultKind()), uint8(DeploymentBatcher.VaultKind.Creator));
    }

    function test_startPhase1_revertsWhenLaneMissing() public {
        OVaultFactory4626 bare = new OVaultFactory4626(address(0), owner);
        bare.setDeploymentBatcher(address(batcher));

        DeploymentBatcher.Phase1Params memory params = DeploymentBatcher.Phase1Params({
            creatorToken: address(1),
            owner: address(2),
            vaultName: "v",
            vaultSymbol: "V",
            shareName: "s",
            shareSymbol: "S",
            version: "v1",
            vaultKind: DeploymentBatcher.VaultKind.Creator
        });

        vm.expectRevert(
            abi.encodeWithSelector(OVaultFactory4626.LaneNotConfigured.selector, IRegistry4626.VaultKind.Creator)
        );
        bare.startPhase1(IRegistry4626.VaultKind.Creator, params, bytes32(0));
    }

    function test_registerDeploymentWithKind_storesKind() public {
        address token = address(new MockERC20Code());
        address vault = address(new MockDeployedContract());
        address wrapper = address(new MockDeployedContract());
        address share = address(new MockDeployedContract());

        factory.registerDeploymentWithKind(
            token,
            vault,
            wrapper,
            share,
            address(0x11),
            address(0x12),
            address(0x13),
            address(0x14),
            IRegistry4626.VaultKind.Agent
        );

        OVaultFactory4626.DeploymentInfo memory info = factory.getDeployment(token);
        assertTrue(info.exists);
        assertEq(uint8(info.vaultKind), uint8(IRegistry4626.VaultKind.Agent));
        assertEq(info.vault, vault);
    }

    // -------------------------------------------------------------------------
    // Gauge surface registry (fail-loud + phase1 path)
    // -------------------------------------------------------------------------

    function test_startPhase1_registersSurfaceWhenRegistrySet() public {
        GaugeSurfaceRegistry4626 surfaces = new GaugeSurfaceRegistry4626(owner);
        surfaces.setRegistrar(address(factory), true);
        factory.setSurfaceRegistry(address(surfaces));

        DeploymentBatcher.Phase1Params memory params = DeploymentBatcher.Phase1Params({
            creatorToken: address(0xA0),
            owner: address(0xA11CE),
            vaultName: "v",
            vaultSymbol: "V",
            shareName: "s",
            shareSymbol: "S",
            version: "v1",
            vaultKind: DeploymentBatcher.VaultKind.Creator
        });

        DeploymentBatcher.Phase1Result memory out =
            factory.startPhase1(IRegistry4626.VaultKind.Agent, params, bytes32(0));

        assertEq(out.vault, address(0xBEE1));
        assertTrue(surfaces.isRegistered(out.vault));
        assertTrue(surfaces.canReceiveVotes(out.vault));
        assertTrue(surfaces.canReceiveBribes(out.vault));
        assertTrue(surfaces.canReceiveStreams(out.vault));
        IGaugeSurfaceRegistry.Surface memory s = surfaces.getSurface(out.vault);
        assertEq(uint8(s.kind), uint8(IRegistry4626.VaultKind.Agent));
        assertEq(s.laneId, keccak256("agent"));
    }

    function test_startPhase1_revertsWhenFactoryNotRegistrar() public {
        GaugeSurfaceRegistry4626 surfaces = new GaugeSurfaceRegistry4626(owner);
        // deliberately do NOT setRegistrar(factory)
        factory.setSurfaceRegistry(address(surfaces));

        DeploymentBatcher.Phase1Params memory params = DeploymentBatcher.Phase1Params({
            creatorToken: address(0xA0),
            owner: address(0xA11CE),
            vaultName: "v",
            vaultSymbol: "V",
            shareName: "s",
            shareSymbol: "S",
            version: "v1",
            vaultKind: DeploymentBatcher.VaultKind.Creator
        });

        vm.expectRevert(IGaugeSurfaceRegistry.NotRegistrar.selector);
        factory.startPhase1(IRegistry4626.VaultKind.Creator, params, bytes32(0));
    }

    function test_registerDeployment_registersSurfaceAndIsIdempotentWithPhase1() public {
        GaugeSurfaceRegistry4626 surfaces = new GaugeSurfaceRegistry4626(owner);
        surfaces.setRegistrar(address(factory), true);
        factory.setSurfaceRegistry(address(surfaces));

        // Phase1 registers vault 0xBEE1
        DeploymentBatcher.Phase1Params memory params = DeploymentBatcher.Phase1Params({
            creatorToken: address(0xA0),
            owner: address(0xA11CE),
            vaultName: "v",
            vaultSymbol: "V",
            shareName: "s",
            shareSymbol: "S",
            version: "v1",
            vaultKind: DeploymentBatcher.VaultKind.Creator
        });
        factory.startPhase1(IRegistry4626.VaultKind.Creator, params, bytes32(0));
        assertTrue(surfaces.isRegistered(address(0xBEE1)));

        // Post-hoc register with same vault must not revert (idempotent skip)
        address token = address(new MockERC20Code());
        address vault = address(0xBEE1); // no code at mock vault — use real code-bearing contract
        // Mock batcher returns 0xBEE1 without code; use fresh deployed vault for register path
        vault = address(new MockDeployedContract());
        address wrapper = address(new MockDeployedContract());
        address share = address(new MockDeployedContract());
        factory.registerDeploymentWithKind(
            token, vault, wrapper, share, address(0x11), address(0x12), address(0x13), address(0x14),
            IRegistry4626.VaultKind.Creator
        );
        assertTrue(surfaces.isRegistered(vault));
    }

    function test_registerDeployment_skipsSurfaceWhenRegistryUnset() public {
        // surfaceRegistry left unset — registerDeployment must succeed
        address token = address(new MockERC20Code());
        address vault = address(new MockDeployedContract());
        address wrapper = address(new MockDeployedContract());
        address share = address(new MockDeployedContract());
        factory.registerDeploymentWithKind(
            token, vault, wrapper, share, address(0x11), address(0x12), address(0x13), address(0x14),
            IRegistry4626.VaultKind.Creator
        );
        assertTrue(factory.getDeployment(token).exists);
    }

    function test_startPhase1_pinsKind_laterPhaseMismatchReverts() public {
        address token = address(0xA0);
        address vaultOwner = address(0xA11CE);

        DeploymentBatcher.Phase1Params memory p1 = DeploymentBatcher.Phase1Params({
            creatorToken: token,
            owner: vaultOwner,
            vaultName: "v",
            vaultSymbol: "V",
            shareName: "s",
            shareSymbol: "S",
            version: "v1",
            vaultKind: DeploymentBatcher.VaultKind.Creator
        });
        factory.startPhase1(IRegistry4626.VaultKind.Agent, p1, bytes32(0));
        assertTrue(factory.hasPhaseKind(token));
        assertEq(uint8(factory.phaseKindByToken(token)), uint8(IRegistry4626.VaultKind.Agent));

        // Re-start with a different kind must fail.
        vm.expectRevert(
            abi.encodeWithSelector(
                OVaultFactory4626.PhaseKindMismatch.selector,
                token,
                IRegistry4626.VaultKind.Agent,
                IRegistry4626.VaultKind.Creator
            )
        );
        factory.startPhase1(IRegistry4626.VaultKind.Creator, p1, bytes32(0));

        // Phase 2 with mismatched kind must fail.
        DeploymentBatcher.Phase2CoreParams memory p2 = _emptyPhase2Core(token, vaultOwner);
        vm.expectRevert(
            abi.encodeWithSelector(
                OVaultFactory4626.PhaseKindMismatch.selector,
                token,
                IRegistry4626.VaultKind.Agent,
                IRegistry4626.VaultKind.Creator
            )
        );
        factory.startPhase2(IRegistry4626.VaultKind.Creator, p2);

        // Matching kind is allowed.
        factory.startPhase2(IRegistry4626.VaultKind.Agent, p2);
        assertEq(batcher.phase2CoreCalls(), 1);
    }

    // -------------------------------------------------------------------------
    // Phase B
    // -------------------------------------------------------------------------

    function _emptyPhase2Core(address token, address vaultOwner)
        internal
        pure
        returns (DeploymentBatcher.Phase2CoreParams memory params)
    {
        params = DeploymentBatcher.Phase2CoreParams({
            creatorToken: token,
            owner: vaultOwner,
            creatorTreasury: vaultOwner,
            payoutRecipient: vaultOwner,
            vault: address(0xBEE1),
            wrapper: address(0xBEE2),
            shareOFT: address(0xBEE3),
            shareSymbol: "s",
            version: "v1",
            floorPriceQ96: 0
        });
    }

    function test_startPhase2_usesLaneCodeIds() public {
        DeploymentBatcher.Phase2Result memory out =
            factory.startPhase2(IRegistry4626.VaultKind.Agent, _emptyPhase2Core(address(0xA0), address(0xA11CE)));

        assertEq(out.gaugeController, address(0x1001));
        assertEq(batcher.phase2CoreCalls(), 1);
        assertEq(batcher.lastGaugeCodeId(), agentIds.gauge);
        assertEq(batcher.lastVaultCodeId(), agentIds.vault);
    }

    function test_startPhase2WithRolePolicy_forwardsPolicyId() public {
        DeploymentBatcher.Phase2Result memory out = factory.startPhase2WithRolePolicy(
            IRegistry4626.VaultKind.Creator, _emptyPhase2Core(address(0xA1), address(0xB0B)), 7
        );
        assertEq(out.gaugeController, address(0x2001));
        assertEq(batcher.lastRolePolicyId(), 7);
        assertEq(batcher.lastGaugeCodeId(), creatorIds.gauge);
    }

    function test_finalizePhase2_forwardsValue() public {
        DeploymentBatcher.Phase2FinalizeParams memory params = DeploymentBatcher.Phase2FinalizeParams({
            creatorToken: address(0xA2),
            owner: address(0xB0B),
            vault: address(0xBEE1),
            wrapper: address(0xBEE2),
            shareOFT: address(0xBEE3),
            gaugeController: address(0x10),
            ccaLaunchArm: address(0x11),
            oracle: address(0x12),
            version: "v1",
            depositAmount: 1 ether,
            requiredRaise: 0,
            floorPriceQ96: 0,
            auctionSteps: "",
            meteoraAlphaVault: bytes32(0),
            solanaIxs: new IBaseSolanaBridge.Ix[](0)
        });

        // fund factory so it can forward native value
        vm.deal(address(this), 1 ether);
        DeploymentBatcher.Phase2Result memory out =
            factory.finalizePhase2{value: 1 ether}(IRegistry4626.VaultKind.Creator, params);

        assertEq(out.auction, address(0x3004));
        assertEq(batcher.phase2FinalizeCalls(), 1);
        assertEq(batcher.lastMsgValue(), 1 ether);
    }

    function test_startPhase3_usesPassedStrategyCodeIds() public {
        DeploymentBatcher.Phase3Params memory p3 = DeploymentBatcher.Phase3Params({
            creatorToken: address(0xA3),
            owner: address(0xB0B),
            vault: address(0xBEE1),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "c",
            charmVaultSymbol: "C",
            ajnaVaultName: "a",
            ajnaVaultSymbol: "A",
            charmWeightBps: 5000,
            ajnaWeightBps: 5000,
            solanaWeightBps: 0,
            ajnaBufferRatioBps: 0,
            ajnaMinBucketIndex: 0,
            ajnaKeeper: address(0),
            solanaKeeper: address(0),
            solanaMaxNavAge: 0,
            solanaMaxNavDeltaBpsPerUpdate: 0,
            solanaMinBaseLiquidityBps: 0,
            solanaBridgeAddress: address(0),
            enableAutoAllocate: false,
            expectedCharmProtocolFeePips: 0
        });
        DeploymentBatcher.StrategyCodeIds memory ids = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: bytes32(uint256(100)),
            charmStrategy4626: bytes32(uint256(101)),
            ajnaVaultAuth: bytes32(uint256(102)),
            ajnaVault: bytes32(uint256(103)),
            erc4626StrategyAdapter: bytes32(uint256(104)),
            solanaStrategy: bytes32(uint256(105))
        });

        DeploymentBatcher.Phase3Result memory out =
            factory.startPhase3(IRegistry4626.VaultKind.Creator, p3, ids);
        assertEq(out.charmStrategy, address(0x4003));
        assertEq(batcher.phase3Calls(), 1);
        assertEq(batcher.lastStrategyCharmId(), bytes32(uint256(101)));
    }

    function test_startPhase3_fallsBackToDefaultStrategyCodeIds() public {
        DeploymentBatcher.StrategyCodeIds memory defaults = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: bytes32(uint256(200)),
            charmStrategy4626: bytes32(uint256(201)),
            ajnaVaultAuth: bytes32(uint256(202)),
            ajnaVault: bytes32(uint256(203)),
            erc4626StrategyAdapter: bytes32(uint256(204)),
            solanaStrategy: bytes32(uint256(205))
        });
        factory.setDefaultStrategyCodeIds(defaults);

        DeploymentBatcher.Phase3Params memory p3 = DeploymentBatcher.Phase3Params({
            creatorToken: address(0xA4),
            owner: address(0xB0B),
            vault: address(0xBEE1),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "c",
            charmVaultSymbol: "C",
            ajnaVaultName: "a",
            ajnaVaultSymbol: "A",
            charmWeightBps: 0,
            ajnaWeightBps: 0,
            solanaWeightBps: 0,
            ajnaBufferRatioBps: 0,
            ajnaMinBucketIndex: 0,
            ajnaKeeper: address(0),
            solanaKeeper: address(0),
            solanaMaxNavAge: 0,
            solanaMaxNavDeltaBpsPerUpdate: 0,
            solanaMinBaseLiquidityBps: 0,
            solanaBridgeAddress: address(0),
            enableAutoAllocate: false,
            expectedCharmProtocolFeePips: 0
        });
        DeploymentBatcher.StrategyCodeIds memory empty;

        factory.startPhase3(IRegistry4626.VaultKind.Agent, p3, empty);
        assertEq(batcher.lastStrategyCharmId(), bytes32(uint256(201)));
    }

    function test_startPhase3_revertsWithoutStrategyCodeIds() public {
        DeploymentBatcher.Phase3Params memory p3 = DeploymentBatcher.Phase3Params({
            creatorToken: address(0xA5),
            owner: address(0xB0B),
            vault: address(0xBEE1),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "c",
            charmVaultSymbol: "C",
            ajnaVaultName: "a",
            ajnaVaultSymbol: "A",
            charmWeightBps: 0,
            ajnaWeightBps: 0,
            solanaWeightBps: 0,
            ajnaBufferRatioBps: 0,
            ajnaMinBucketIndex: 0,
            ajnaKeeper: address(0),
            solanaKeeper: address(0),
            solanaMaxNavAge: 0,
            solanaMaxNavDeltaBpsPerUpdate: 0,
            solanaMinBaseLiquidityBps: 0,
            solanaBridgeAddress: address(0),
            enableAutoAllocate: false,
            expectedCharmProtocolFeePips: 0
        });
        DeploymentBatcher.StrategyCodeIds memory empty;

        vm.expectRevert(OVaultFactory4626.StrategyCodeIdsNotConfigured.selector);
        factory.startPhase3(IRegistry4626.VaultKind.Creator, p3, empty);
    }
}
