// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {GaugeSurfaceRegistry4626} from "@4626/shared/governance/surfaces/GaugeSurfaceRegistry4626.sol";
import {IGaugeSurfaceRegistry} from "@4626/shared/governance/surfaces/IGaugeSurfaceRegistry.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";

import {ve4626 as ve4626Contract} from "@4626/shared/governance/ve4626.sol";
import {ve4626GaugeVoting} from "@4626/shared/governance/ve4626GaugeVoting.sol";
import {BribesFactory4626} from "@4626/shared/governance/factories/BribesFactory4626.sol";
import {BribeDepot4626} from "@4626/shared/governance/bribes/BribeDepot4626.sol";
import {RewardStreamFactory4626} from "@4626/shared/governance/rewards/RewardStreamFactory4626.sol";
import {RewardStream4626} from "@4626/shared/governance/rewards/RewardStream4626.sol";
import {IRewardStream4626} from "@4626/shared/governance/rewards/interfaces/IRewardStream4626.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockWSTokenSurface is ERC20 {
    constructor() ERC20("Wrapped s4626", "ws4626") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockRewardToken is ERC20 {
    constructor() ERC20("Reward", "RWD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title GaugeSurfaceRegistry4626Test
 * @notice Registry views + factory / voting / fund-path capability wiring.
 */
contract GaugeSurfaceRegistry4626Test is Test {
    GaugeSurfaceRegistry4626 public surfaces;
    MockWSTokenSurface public wsToken;
    ve4626Contract public ve;
    ve4626GaugeVoting public voting;
    BribesFactory4626 public bribesFactory;
    RewardStreamFactory4626 public streamFactory;
    MockRewardToken public rewardToken;

    address public owner;
    address public registrar;
    address public vaultA;
    address public vaultB;
    address public funder;

    bytes32 public constant LANE_CREATOR = keccak256("creator");
    bytes32 public constant LANE_AGENT = keccak256("agent");

    function setUp() public {
        owner = address(this);
        registrar = makeAddr("registrar");
        vaultA = makeAddr("vaultA");
        vaultB = makeAddr("vaultB");
        funder = makeAddr("funder");

        surfaces = new GaugeSurfaceRegistry4626(owner);
        surfaces.setRegistrar(registrar, true);

        wsToken = new MockWSTokenSurface();
        rewardToken = new MockRewardToken();
        ve = new ve4626Contract("Vote-Escrowed ws4626", "ve4626", address(wsToken), owner);
        voting = new ve4626GaugeVoting(address(ve), owner);

        bribesFactory = new BribesFactory4626(address(voting), owner);
        streamFactory = new RewardStreamFactory4626(address(voting), owner);

        rewardToken.mint(funder, 1_000_000 ether);
    }

    /// @dev Arm voting so create/fund gates use the surface registry (single policy surface).
    function _armSurfaceRegistry() internal {
        voting.setSurfaceRegistry(address(surfaces));
        voting.setUseSurfaceRegistry(true);
    }

    // -------------------------------------------------------------------------
    // Registry core
    // -------------------------------------------------------------------------

    function testRegisterSurface_DefaultsAndViews() public {
        vm.prank(registrar);
        surfaces.registerSurface(vaultA, IRegistry4626.VaultKind.Creator, LANE_CREATOR, true, true, true);

        IGaugeSurfaceRegistry.Surface memory s = surfaces.getSurface(vaultA);
        assertTrue(s.registered);
        assertTrue(s.votes);
        assertTrue(s.bribes);
        assertTrue(s.streams);
        assertFalse(s.paused);
        assertEq(uint8(s.kind), uint8(IRegistry4626.VaultKind.Creator));
        assertEq(s.laneId, LANE_CREATOR);

        assertTrue(surfaces.isRegistered(vaultA));
        assertTrue(surfaces.canReceiveVotes(vaultA));
        assertTrue(surfaces.canReceiveBribes(vaultA));
        assertTrue(surfaces.canReceiveStreams(vaultA));
        assertEq(surfaces.surfaceCount(), 1);
        assertEq(surfaces.surfaceAt(0), vaultA);
    }

    function testRegisterSurface_RejectsDuplicateAndZero() public {
        vm.prank(registrar);
        surfaces.registerSurface(vaultA, IRegistry4626.VaultKind.Creator, LANE_CREATOR, true, true, true);

        vm.prank(registrar);
        vm.expectRevert(abi.encodeWithSelector(IGaugeSurfaceRegistry.SurfaceAlreadyRegistered.selector, vaultA));
        surfaces.registerSurface(vaultA, IRegistry4626.VaultKind.Creator, LANE_CREATOR, true, true, true);

        vm.prank(registrar);
        vm.expectRevert(IGaugeSurfaceRegistry.ZeroAddress.selector);
        surfaces.registerSurface(address(0), IRegistry4626.VaultKind.Creator, LANE_CREATOR, true, true, true);
    }

    function testRegisterSurface_OnlyRegistrar() public {
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert(IGaugeSurfaceRegistry.NotRegistrar.selector);
        surfaces.registerSurface(vaultA, IRegistry4626.VaultKind.Creator, LANE_CREATOR, true, true, true);

        // Owner is always registrar
        surfaces.registerSurface(vaultA, IRegistry4626.VaultKind.Agent, LANE_AGENT, true, false, true);
        assertTrue(surfaces.canReceiveVotes(vaultA));
        assertFalse(surfaces.canReceiveBribes(vaultA));
        assertTrue(surfaces.canReceiveStreams(vaultA));
    }

    function testSetCapabilities_IndependentFlagsAndPause() public {
        vm.prank(registrar);
        surfaces.registerSurface(vaultA, IRegistry4626.VaultKind.Creator, LANE_CREATOR, true, true, true);

        vm.prank(registrar);
        surfaces.setCapabilities(vaultA, true, false, true, false);
        assertTrue(surfaces.canReceiveVotes(vaultA));
        assertFalse(surfaces.canReceiveBribes(vaultA));
        assertTrue(surfaces.canReceiveStreams(vaultA));

        vm.prank(registrar);
        surfaces.setCapabilities(vaultA, true, true, true, true);
        assertFalse(surfaces.canReceiveVotes(vaultA));
        assertFalse(surfaces.canReceiveBribes(vaultA));
        assertFalse(surfaces.canReceiveStreams(vaultA));
    }

    function testGlobalPause_FreezesAllCapabilities() public {
        vm.prank(registrar);
        surfaces.registerSurface(vaultA, IRegistry4626.VaultKind.Creator, LANE_CREATOR, true, true, true);

        surfaces.setGlobalPaused(true);
        assertFalse(surfaces.canReceiveVotes(vaultA));
        assertFalse(surfaces.canReceiveBribes(vaultA));
        assertFalse(surfaces.canReceiveStreams(vaultA));

        surfaces.setGlobalPaused(false);
        assertTrue(surfaces.canReceiveVotes(vaultA));
    }

    function testRemoveSurface() public {
        vm.prank(registrar);
        surfaces.registerSurface(vaultA, IRegistry4626.VaultKind.Creator, LANE_CREATOR, true, true, true);

        vm.prank(registrar);
        surfaces.removeSurface(vaultA);
        assertFalse(surfaces.isRegistered(vaultA));
        assertFalse(surfaces.canReceiveVotes(vaultA));
        assertEq(surfaces.surfaceCount(), 0);
    }

    // -------------------------------------------------------------------------
    // Factory create gates
    // -------------------------------------------------------------------------

    function testBribesFactory_FallsBackToVotingWhitelistWithoutRegistry() public {
        voting.setVaultWhitelist(vaultA, true);
        address depot = bribesFactory.createBribeDepot4626(vaultA);
        assertTrue(depot != address(0));
        assertEq(bribesFactory.bribeDepot4626Of(vaultA), depot);

        address rogue = makeAddr("rogue");
        vm.expectRevert(abi.encodeWithSelector(BribesFactory4626.VaultNotWhitelisted.selector, rogue));
        bribesFactory.createBribeDepot4626(rogue);
    }

    function testBribesFactory_SurfaceRegistryGatesCreate() public {
        // Not registered → reject even if voting whitelist is set
        voting.setVaultWhitelist(vaultA, true);
        _armSurfaceRegistry();
        vm.expectRevert(abi.encodeWithSelector(BribesFactory4626.VaultNotWhitelisted.selector, vaultA));
        bribesFactory.createBribeDepot4626(vaultA);

        vm.prank(registrar);
        surfaces.registerSurface(vaultA, IRegistry4626.VaultKind.Creator, LANE_CREATOR, true, false, true);
        // bribes=false
        vm.expectRevert(abi.encodeWithSelector(BribesFactory4626.VaultNotWhitelisted.selector, vaultA));
        bribesFactory.createBribeDepot4626(vaultA);

        vm.prank(registrar);
        surfaces.setCapabilities(vaultA, true, true, true, false);
        address depot = bribesFactory.createBribeDepot4626(vaultA);
        assertTrue(depot != address(0));
        assertEq(BribeDepot4626(depot).owner(), owner);
    }

    function testRewardStreamFactory_SurfaceRegistryGatesCreate() public {
        voting.setVaultWhitelist(vaultA, true);
        _armSurfaceRegistry();

        vm.expectRevert(abi.encodeWithSelector(RewardStreamFactory4626.VaultNotWhitelisted.selector, vaultA));
        streamFactory.createStream(vaultA);

        vm.prank(registrar);
        surfaces.registerSurface(vaultA, IRegistry4626.VaultKind.Creator, LANE_CREATOR, true, true, false);
        vm.expectRevert(abi.encodeWithSelector(RewardStreamFactory4626.VaultNotWhitelisted.selector, vaultA));
        streamFactory.createStream(vaultA);

        vm.prank(registrar);
        surfaces.setCapabilities(vaultA, true, true, true, false);
        address stream = streamFactory.createStream(vaultA);
        assertTrue(stream != address(0));
    }

    function testVoting_SetUseSurfaceRegistry_RequiresRegistry() public {
        vm.expectRevert(ve4626GaugeVoting.ZeroAddress.selector);
        voting.setUseSurfaceRegistry(true);

        voting.setSurfaceRegistry(address(surfaces));
        voting.setUseSurfaceRegistry(true);
        assertTrue(voting.useSurfaceRegistry());

        voting.setUseSurfaceRegistry(false);
        assertFalse(voting.useSurfaceRegistry());
    }

    function testVoting_ClearSurfaceRegistry_DisablesUseSurfaceRegistry() public {
        voting.setSurfaceRegistry(address(surfaces));
        voting.setUseSurfaceRegistry(true);
        assertTrue(voting.useSurfaceRegistry());

        voting.setSurfaceRegistry(address(0));
        assertEq(address(voting.surfaceRegistry()), address(0));
        assertFalse(voting.useSurfaceRegistry());
    }

    function testVoting_GetEligibleVaults_UsesSurfaceRegistryWhenArmed() public {
        voting.setVaultWhitelist(vaultA, true);
        address[] memory wl = voting.getEligibleVaults();
        assertEq(wl.length, 1);
        assertEq(wl[0], vaultA);

        _armSurfaceRegistry();
        // Surface mode on, vaultA not registered → empty discovery
        assertEq(voting.getEligibleVaults().length, 0);
        assertEq(voting.eligibleVaultCount(), 0);

        vm.prank(registrar);
        surfaces.registerSurface(vaultA, IRegistry4626.VaultKind.Creator, LANE_CREATOR, true, true, false);
        address[] memory eligible = voting.getEligibleVaults();
        assertEq(eligible.length, 1);
        assertEq(eligible[0], vaultA);
        assertEq(voting.eligibleVaultCount(), 1);

        // votes=false removes from discovery
        vm.prank(registrar);
        surfaces.setCapabilities(vaultA, false, true, false, false);
        assertEq(voting.getEligibleVaults().length, 0);
    }

    // -------------------------------------------------------------------------
    // Voting override + fund path capability split
    // -------------------------------------------------------------------------

    function testVoting_UseSurfaceRegistryOverridesWhitelist() public {
        voting.setVaultWhitelist(vaultA, true);
        assertTrue(voting.canReceiveVotes(vaultA));

        _armSurfaceRegistry();
        // Not on surface registry
        assertFalse(voting.canReceiveVotes(vaultA));
        assertFalse(voting.canReceiveBribes(vaultA));
        assertFalse(voting.canReceiveStreams(vaultA));

        vm.prank(registrar);
        surfaces.registerSurface(vaultA, IRegistry4626.VaultKind.Creator, LANE_CREATOR, true, false, true);
        assertTrue(voting.canReceiveVotes(vaultA));
        assertFalse(voting.canReceiveBribes(vaultA));
        assertTrue(voting.canReceiveStreams(vaultA));
    }

    function testBribeFund_RespectsBribesCapability() public {
        // Create under whitelist, then arm surface mode and strip bribes capability
        voting.setVaultWhitelist(vaultA, true);
        BribeDepot4626 depot = BribeDepot4626(bribesFactory.createBribeDepot4626(vaultA));

        _armSurfaceRegistry();
        vm.prank(registrar);
        surfaces.registerSurface(vaultA, IRegistry4626.VaultKind.Creator, LANE_CREATOR, true, false, true);

        vm.startPrank(funder);
        rewardToken.approve(address(depot), 1 ether);
        vm.expectRevert(BribeDepot4626.VaultNotWhitelisted.selector);
        depot.bribe(address(rewardToken), 1 ether);
        vm.stopPrank();

        vm.prank(registrar);
        surfaces.setCapabilities(vaultA, true, true, true, false);

        vm.startPrank(funder);
        rewardToken.approve(address(depot), 1 ether);
        depot.bribe(address(rewardToken), 1 ether);
        vm.stopPrank();

        uint256 epoch = voting.currentEpoch();
        assertEq(depot.totalBribes(epoch, address(rewardToken)), 1 ether);
    }

    function testStreamFund_RespectsStreamsCapability() public {
        voting.setVaultWhitelist(vaultA, true);
        RewardStream4626 stream = RewardStream4626(streamFactory.createStream(vaultA));
        stream.addRewardToken(address(rewardToken));

        _armSurfaceRegistry();
        vm.prank(registrar);
        surfaces.registerSurface(vaultA, IRegistry4626.VaultKind.Creator, LANE_CREATOR, true, true, false);

        vm.startPrank(funder);
        IERC20(address(rewardToken)).approve(address(stream), 1 ether);
        vm.expectRevert(IRewardStream4626.VaultNotWhitelisted.selector);
        stream.fund(address(rewardToken), 1 ether);
        vm.stopPrank();

        vm.prank(registrar);
        surfaces.setCapabilities(vaultA, true, true, true, false);

        vm.startPrank(funder);
        IERC20(address(rewardToken)).approve(address(stream), 1 ether);
        stream.fund(address(rewardToken), 1 ether);
        vm.stopPrank();

        uint256 epoch = voting.currentEpoch();
        assertEq(stream.epochTokenRewards(epoch, address(rewardToken)), 1 ether);
    }
}
