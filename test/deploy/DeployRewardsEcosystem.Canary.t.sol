// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {ve4626} from "@4626/shared/governance/ve4626.sol";
import {ve4626Utility} from "@4626/shared/governance/ve4626Utility.sol";
import {ve4626BoostManager} from "@4626/shared/governance/ve4626BoostManager.sol";
import {ve4626GaugeVoting} from "@4626/shared/governance/ve4626GaugeVoting.sol";
import {ve4626VoterRewardsDistributor} from "@4626/shared/governance/ve4626VoterRewardsDistributor.sol";
import {BribesFactory4626} from "@4626/shared/governance/factories/BribesFactory4626.sol";
import {RewardStreamFactory4626} from "@4626/shared/governance/rewards/RewardStreamFactory4626.sol";
import {GaugeSurfaceRegistry4626} from "@4626/shared/governance/surfaces/GaugeSurfaceRegistry4626.sol";
import {BribeDepot4626} from "@4626/shared/governance/bribes/BribeDepot4626.sol";
import {RewardStream4626} from "@4626/shared/governance/rewards/RewardStream4626.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";

/// @dev ■4626 stand-in for lock asset.
contract MockWrappedShareOFT is ERC20 {
    constructor() ERC20("Protocol Share", "s4626") {}

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
 * @title DeployRewardsEcosystemCanaryTest
 * @notice Integration dry-run of the canary deploy posture (mirrors DeployRewardsEcosystem.s.sol defaults):
 *         - Full stack deploys
 *         - Utility wired into boost + voting
 *         - Surface registry deployed but useSurfaceRegistry=false
 *         - Optional surface one-shot on factories when "wired"
 *         - No LotteryManager (canary keeps LM boost/gauge at 0x0 off-script)
 *         - End-to-end lock → vote → bribe → claim + stream fund → claim
 */
contract DeployRewardsEcosystemCanaryTest is Test {
    address internal owner;
    address internal alice;
    address internal briber;

    MockWrappedShareOFT internal share;
    MockRewardToken internal reward;

    ve4626 internal ve;
    ve4626Utility internal utility;
    ve4626BoostManager internal boostManager;
    ve4626GaugeVoting internal voting;
    ve4626VoterRewardsDistributor internal distributor;
    BribesFactory4626 internal bribesFactory;
    RewardStreamFactory4626 internal streamFactory;
    GaugeSurfaceRegistry4626 internal surfaces;

    address internal vault1;

    uint256 internal constant WEEK = 7 days;
    uint256 internal constant FOUR_YEARS = 4 * 365 days;

    function setUp() public {
        owner = address(this);
        alice = makeAddr("alice");
        briber = makeAddr("briber");
        vault1 = makeAddr("vault1");

        share = new MockWrappedShareOFT();
        reward = new MockRewardToken();

        // --- Same order as DeployRewardsEcosystem canary defaults ---
        ve = new ve4626("Vote-Escrowed s4626", "ve4626", address(share), owner);
        utility = new ve4626Utility(address(ve), owner);
        boostManager = new ve4626BoostManager(address(ve), owner);
        boostManager.setUtility(address(utility));

        voting = new ve4626GaugeVoting(address(ve), owner);
        voting.setUtility(address(utility));

        // Canary: manual whitelist (registry optional; skip empty registry)
        voting.setVaultWhitelist(vault1, true);

        // Distributor needs a registry address; zero is allowed at construct in some builds —
        // use a non-zero placeholder if constructor rejects zero. Check: requires non-zero.
        // Pass address(this) as dummy registry for construct; we only exercise bribes/streams here.
        distributor = new ve4626VoterRewardsDistributor(address(voting), address(this), owner);
        distributor.setProtocolTreasury(makeAddr("treasury"));

        bribesFactory = new BribesFactory4626(address(voting), owner);
        streamFactory = new RewardStreamFactory4626(address(voting), owner);

        surfaces = new GaugeSurfaceRegistry4626(owner);
        // WIRE_SURFACE_REGISTRY=0: set address on voting but do NOT enable override
        voting.setSurfaceRegistry(address(surfaces));
        assertFalse(voting.useSurfaceRegistry());

        ve.setBoostManager(address(boostManager));

        // Fund users
        share.mint(alice, 1_000 ether);
        reward.mint(briber, 100_000 ether);
        reward.mint(alice, 100_000 ether);
    }

    function test_canary_wiringInvariants() public view {
        assertEq(address(boostManager.utility()), address(utility));
        // utility sets veLottery on boost via setUtility
        assertTrue(address(utility.ve33()) != address(0));
        assertTrue(address(utility.veLottery()) != address(0));

        assertEq(address(voting.utility()), address(utility));
        assertEq(address(ve.boostManager()), address(boostManager));

        assertEq(bribesFactory.gaugeVoting(), address(voting));
        assertEq(bribesFactory.depotOwner(), owner);
        assertEq(streamFactory.gaugeVoting(), address(voting));
        assertEq(streamFactory.streamOwner(), owner);

        // Surface registry present but not armed
        assertEq(address(voting.surfaceRegistry()), address(surfaces));
        assertFalse(voting.useSurfaceRegistry());
        // Whitelist still works
        assertTrue(voting.canReceiveVotes(vault1));
        assertTrue(voting.canReceiveBribes(vault1));
        assertTrue(voting.canReceiveStreams(vault1));
    }

    function test_canary_surfaceRegistry_optionalWire_gatesFactories() public {
        // Phase C: arm voting surface override (factories always read canReceive* from voting)
        voting.setUseSurfaceRegistry(true);

        // Not registered on surface → create fails even if voting whitelist true
        vm.expectRevert(abi.encodeWithSelector(BribesFactory4626.VaultNotWhitelisted.selector, vault1));
        bribesFactory.createBribeDepot4626(vault1);

        surfaces.registerSurface(
            vault1, IRegistry4626.VaultKind.Creator, keccak256("creator"), true, true, true
        );

        address depot = bribesFactory.createBribeDepot4626(vault1);
        assertTrue(depot != address(0));
        assertEq(BribeDepot4626(depot).owner(), owner);

        address stream = streamFactory.createStream(vault1);
        assertTrue(stream != address(0));
    }

    function test_canary_endToEnd_voteBribeClaim_andStream() public {
        // Align lock so max-duration capacity is full (same posture as rights-split tests).
        uint256 genesis = voting.genesisEpochStart();
        uint256 maxDuration = ve.MAX_LOCK_DURATION();
        uint256 lockStart = ((genesis + maxDuration + WEEK - 1) / WEEK) * WEEK - maxDuration;
        if (lockStart > block.timestamp) {
            vm.warp(lockStart);
        }

        vm.startPrank(alice);
        share.approve(address(ve), 100 ether);
        ve.lock(address(share), 100 ether, maxDuration);
        // Prefer utility path: claim free capacity as ve33 (not type(uint256).max)
        utility.claimAllOutstanding();
        vm.stopPrank();
        assertGt(utility.ve33Of(alice), 0);

        // Locks must be ≥1 epoch old (LockTooRecent) and after genesis for epoch 0 voting.
        // Warp to first full epoch after both genesis and lock-age requirements.
        uint256 voteTime = block.timestamp + WEEK + 1;
        if (voteTime < genesis + 1) voteTime = genesis + 1;
        // Ensure lock is at least WEEK old
        if (voteTime < lockStart + WEEK + 1) voteTime = lockStart + WEEK + 1;
        vm.warp(voteTime);
        // If we landed past epoch 0, that's fine — bribe/stream use current epoch then claim after next.
        uint256 bribeEpoch = voting.currentEpoch();

        address[] memory vaults = new address[](1);
        uint256[] memory weights = new uint256[](1);
        vaults[0] = vault1;
        weights[0] = 100;
        vm.prank(alice);
        voting.vote(vaults, weights);

        // Bribe + fund current epoch
        BribeDepot4626 depot = BribeDepot4626(bribesFactory.createBribeDepot4626(vault1));
        uint256 bribeAmt = 1_000 ether;
        vm.startPrank(briber);
        reward.approve(address(depot), bribeAmt);
        depot.bribe(address(reward), bribeAmt);
        vm.stopPrank();
        assertEq(depot.totalBribes(bribeEpoch, address(reward)), bribeAmt);

        RewardStream4626 stream = RewardStream4626(streamFactory.createStream(vault1));
        stream.addRewardToken(address(reward));
        uint256 fundAmt = 500 ether;
        vm.startPrank(alice);
        reward.approve(address(stream), fundAmt);
        stream.fund(address(reward), fundAmt);
        vm.stopPrank();
        assertEq(stream.epochTokenRewards(bribeEpoch, address(reward)), fundAmt);

        // Advance past funded epoch
        vm.warp(voting.epochEndTime(bribeEpoch) + 1);
        assertGt(voting.currentEpoch(), bribeEpoch);

        uint256 aliceBefore = reward.balanceOf(alice);
        vm.prank(alice);
        uint256 bribePaid = depot.claim(bribeEpoch, address(reward));
        vm.prank(alice);
        uint256 streamPaid = stream.claim(bribeEpoch, address(reward));

        assertEq(bribePaid, bribeAmt); // sole voter
        assertEq(streamPaid, fundAmt);
        assertEq(reward.balanceOf(alice), aliceBefore + bribePaid + streamPaid);
    }

    function test_canary_enableSurfaceRegistry_blocksDelistedBribeFund() public {
        BribeDepot4626 depot = BribeDepot4626(bribesFactory.createBribeDepot4626(vault1));

        surfaces.registerSurface(
            vault1, IRegistry4626.VaultKind.Creator, keccak256("creator"), true, true, true
        );
        voting.setSurfaceRegistry(address(surfaces));
        voting.setUseSurfaceRegistry(true);

        // Pause bribes capability
        surfaces.setCapabilities(vault1, true, false, true, false);
        assertFalse(voting.canReceiveBribes(vault1));
        assertTrue(voting.canReceiveVotes(vault1));

        vm.startPrank(briber);
        reward.approve(address(depot), 1 ether);
        vm.expectRevert(BribeDepot4626.VaultNotWhitelisted.selector);
        depot.bribe(address(reward), 1 ether);
        vm.stopPrank();
    }
}
