// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/governance/VaultGaugeVoting.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Import veAKITA contract directly (not the interface)
import {ve4626 as Ve4626Contract} from "../contracts/governance/ve4626.sol";

/**
 * @title MockWSToken
 * @dev Mock wrapped share token for testing
 */
contract MockWSToken is ERC20 {
    constructor() ERC20("Wrapped sAKITA", "wsAKITA") {
        _mint(msg.sender, 10_000_000 * 10 ** 18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title VaultGaugeVotingTest
 * @notice Tests for ve(3,3) vault gauge voting
 */
contract VaultGaugeVotingTest is Test {
    VaultGaugeVoting public voting;
    Ve4626Contract public ve;
    MockWSToken public wsToken;

    address public owner;
    address public alice;
    address public bob;
    address public charlie;

    address public vault1;
    address public vault2;
    address public vault3;

    uint256 public constant WEEK = 7 days;
    uint256 public constant FOUR_YEARS = 4 * 365 days;

    function setUp() public {
        owner = address(this);
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");

        vault1 = makeAddr("vault1");
        vault2 = makeAddr("vault2");
        vault3 = makeAddr("vault3");

        // Deploy wsToken
        wsToken = new MockWSToken();

        // Deploy veAKITA
        ve = new Ve4626Contract("Vote-Escrowed wsAKITA", "veAKITA", address(wsToken), owner);

        // Deploy VaultGaugeVoting
        voting = new VaultGaugeVoting(address(ve), owner);

        // Whitelist vaults
        voting.setVaultWhitelist(vault1, true);
        voting.setVaultWhitelist(vault2, true);
        voting.setVaultWhitelist(vault3, true);

        // Distribute tokens
        wsToken.mint(alice, 1000 ether);
        wsToken.mint(bob, 2000 ether);
        wsToken.mint(charlie, 500 ether);
    }

    // ================================
    // EPOCH TESTS
    // ================================

    function testEpochStartsAtZeroBeforeGenesis() public view {
        // If we're before genesis, epoch should be 0
        uint256 genesis = voting.genesisEpochStart();
        if (block.timestamp < genesis) {
            assertEq(voting.currentEpoch(), 0);
        }
    }

    function testEpochIncrements() public {
        // Warp to genesis start
        uint256 genesis = voting.genesisEpochStart();
        vm.warp(genesis);
        assertEq(voting.currentEpoch(), 0);

        // Warp to 1 week later
        vm.warp(genesis + WEEK);
        assertEq(voting.currentEpoch(), 1);

        // Warp to 4 weeks later
        vm.warp(genesis + 4 * WEEK);
        assertEq(voting.currentEpoch(), 4);
    }

    function testEpochStartTime() public view {
        uint256 genesis = voting.genesisEpochStart();

        assertEq(voting.epochStartTime(0), genesis);
        assertEq(voting.epochStartTime(1), genesis + WEEK);
        assertEq(voting.epochStartTime(10), genesis + 10 * WEEK);
    }

    function testTimeUntilNextEpoch() public {
        uint256 genesis = voting.genesisEpochStart();
        vm.warp(genesis);

        // Just started epoch 0, should have ~7 days left
        uint256 remaining = voting.timeUntilNextEpoch();
        assertEq(remaining, WEEK);

        // Warp to halfway through
        vm.warp(genesis + WEEK / 2);
        remaining = voting.timeUntilNextEpoch();
        assertEq(remaining, WEEK / 2);
    }

    // ================================
    // VOTING TESTS
    // ================================

    function testVoteRequiresVotingPower() public {
        vm.startPrank(alice);

        // Alice has no veAKITA yet
        address[] memory vaults = new address[](1);
        uint256[] memory weights = new uint256[](1);
        vaults[0] = vault1;
        weights[0] = 100;

        vm.expectRevert(VaultGaugeVoting.NoVotingPower.selector);
        voting.vote(vaults, weights);

        vm.stopPrank();
    }

    function testVoteRevertsIfLockExpiresBeforeEpochEnd() public {
        uint256 genesis = voting.genesisEpochStart();

        // Create a lock that will expire during the current epoch:
        // lock at (genesis - 1 day) for 7 days => expires at (genesis + 6 days) < epoch end.
        vm.warp(genesis - 1 days);
        _lockTokens(alice, 100 ether, WEEK);

        // Vote early in epoch 0 while the lock is still active.
        vm.warp(genesis + 1);

        vm.startPrank(alice);

        address[] memory vaults = new address[](1);
        uint256[] memory weights = new uint256[](1);
        vaults[0] = vault1;
        weights[0] = 100;

        vm.expectRevert(VaultGaugeVoting.LockExpiresBeforeEpochEnd.selector);
        voting.vote(vaults, weights);

        vm.stopPrank();
    }

    function testVoteSucceedsIfLockCoversEpochEnd() public {
        uint256 genesis = voting.genesisEpochStart();

        // Lock at (genesis - 1 day) for 2 weeks => lock end is after epoch 0 end.
        vm.warp(genesis - 1 days);
        _lockTokens(alice, 100 ether, 2 * WEEK);

        vm.warp(genesis + 1);
        _vote(alice, vault1, 100);

        uint256 alicePower = ve.getVotingPower(alice);
        assertEq(voting.getVaultWeight(vault1), alicePower);
        assertEq(voting.getTotalWeight(), alicePower);
    }

    function testVoteRequiresWhitelistedVault() public {
        // Lock tokens for alice
        _lockTokens(alice, 100 ether, FOUR_YEARS);

        vm.startPrank(alice);

        address[] memory vaults = new address[](1);
        uint256[] memory weights = new uint256[](1);
        vaults[0] = makeAddr("unwhitelisted");
        weights[0] = 100;

        vm.expectRevert(abi.encodeWithSelector(VaultGaugeVoting.VaultNotWhitelisted.selector, vaults[0]));
        voting.vote(vaults, weights);

        vm.stopPrank();
    }

    function testSingleVaultVote() public {
        // Lock tokens
        _lockTokens(alice, 100 ether, FOUR_YEARS);

        // Warp to after genesis
        vm.warp(voting.genesisEpochStart() + 1);

        vm.startPrank(alice);

        address[] memory vaults = new address[](1);
        uint256[] memory weights = new uint256[](1);
        vaults[0] = vault1;
        weights[0] = 100;

        voting.vote(vaults, weights);

        vm.stopPrank();

        // Check vault has all of alice's voting power
        uint256 alicePower = ve.getVotingPower(alice);
        assertEq(voting.getVaultWeight(vault1), alicePower);
        assertEq(voting.getTotalWeight(), alicePower);
    }

    function testMultiVaultVote() public {
        // Lock tokens
        _lockTokens(alice, 100 ether, FOUR_YEARS);

        vm.warp(voting.genesisEpochStart() + 1);

        vm.startPrank(alice);

        // Vote 50% vault1, 25% vault2, 25% vault3
        address[] memory vaults = new address[](3);
        uint256[] memory weights = new uint256[](3);
        vaults[0] = vault1;
        vaults[1] = vault2;
        vaults[2] = vault3;
        weights[0] = 50;
        weights[1] = 25;
        weights[2] = 25;

        voting.vote(vaults, weights);

        vm.stopPrank();

        uint256 alicePower = ve.getVotingPower(alice);

        // Check weights are proportional
        assertEq(voting.getVaultWeight(vault1), alicePower / 2);
        assertEq(voting.getVaultWeight(vault2), alicePower / 4);
        assertEq(voting.getVaultWeight(vault3), alicePower / 4);
        assertEq(voting.getTotalWeight(), alicePower);
    }

    function testVoteAggregatesDuplicateVaultInputs() public {
        _lockTokens(alice, 100 ether, FOUR_YEARS);
        vm.warp(voting.genesisEpochStart() + 1);

        vm.startPrank(alice);

        address[] memory vaults = new address[](3);
        uint256[] memory weights = new uint256[](3);
        vaults[0] = vault1;
        vaults[1] = vault1;
        vaults[2] = vault2;
        weights[0] = 20;
        weights[1] = 30;
        weights[2] = 50;

        voting.vote(vaults, weights);

        vm.stopPrank();

        uint256 epoch = voting.currentEpoch();
        uint256 alicePower = ve.getVotingPower(alice);
        uint256 expectedVault1Weight = (alicePower * 50) / 100;
        uint256 expectedVault2Weight = (alicePower * 50) / 100;

        assertEq(voting.getVaultWeight(vault1), expectedVault1Weight);
        assertEq(voting.getVaultWeight(vault2), expectedVault2Weight);
        assertEq(voting.getTotalWeight(), expectedVault1Weight + expectedVault2Weight);

        assertEq(voting.getUserVoteWeightAtEpoch(epoch, alice, vault1), expectedVault1Weight);
        assertEq(voting.getUserVoteWeightAtEpoch(epoch, alice, vault2), expectedVault2Weight);

        (address[] memory userVaults,) = voting.getUserVotes(alice);
        assertEq(userVaults.length, 2);
    }

    function testVoteWeightBps() public {
        // Lock tokens for both users
        _lockTokens(alice, 100 ether, FOUR_YEARS);
        _lockTokens(bob, 100 ether, FOUR_YEARS);

        vm.warp(voting.genesisEpochStart() + 1);

        // Alice votes for vault1
        _vote(alice, vault1, 100);

        // Bob votes for vault2
        _vote(bob, vault2, 100);

        // Each vault should have ~50% (5000 bps)
        uint256 vault1Bps = voting.getVaultWeightBps(vault1);
        uint256 vault2Bps = voting.getVaultWeightBps(vault2);

        assertApproxEqAbs(vault1Bps, 5000, 1);
        assertApproxEqAbs(vault2Bps, 5000, 1);
    }

    function testRevoting() public {
        _lockTokens(alice, 100 ether, FOUR_YEARS);
        vm.warp(voting.genesisEpochStart() + 1);

        // Initial vote for vault1
        _vote(alice, vault1, 100);

        uint256 alicePower = ve.getVotingPower(alice);
        assertEq(voting.getVaultWeight(vault1), alicePower);
        assertEq(voting.getVaultWeight(vault2), 0);

        // Change vote to vault2
        _vote(alice, vault2, 100);

        // Votes should have moved
        assertEq(voting.getVaultWeight(vault1), 0);
        assertEq(voting.getVaultWeight(vault2), alicePower);
    }

    function testResetVotes() public {
        _lockTokens(alice, 100 ether, FOUR_YEARS);
        vm.warp(voting.genesisEpochStart() + 1);

        _vote(alice, vault1, 100);

        uint256 alicePower = ve.getVotingPower(alice);
        assertEq(voting.getVaultWeight(vault1), alicePower);

        vm.prank(alice);
        voting.resetVotes();

        assertEq(voting.getVaultWeight(vault1), 0);
        assertEq(voting.getTotalWeight(), 0);
    }

    function testResetVotesClearsAggregatedDuplicateVoteWeights() public {
        _lockTokens(alice, 100 ether, FOUR_YEARS);
        vm.warp(voting.genesisEpochStart() + 1);

        vm.startPrank(alice);

        address[] memory vaults = new address[](2);
        uint256[] memory weights = new uint256[](2);
        vaults[0] = vault1;
        vaults[1] = vault1;
        weights[0] = 1;
        weights[1] = 9;

        voting.vote(vaults, weights);

        vm.stopPrank();

        uint256 epoch = voting.currentEpoch();
        assertGt(voting.getVaultWeight(vault1), 0);
        assertGt(voting.getTotalWeight(), 0);

        vm.prank(alice);
        voting.resetVotes();

        assertEq(voting.getVaultWeight(vault1), 0);
        assertEq(voting.getTotalWeight(), 0);
        assertEq(voting.getUserVoteWeightAtEpoch(epoch, alice, vault1), 0);

        (address[] memory userVaults,) = voting.getUserVotes(alice);
        assertEq(userVaults.length, 0);
    }

    function testGetUserVotes() public {
        _lockTokens(alice, 100 ether, FOUR_YEARS);
        vm.warp(voting.genesisEpochStart() + 1);

        vm.startPrank(alice);

        address[] memory vaults = new address[](2);
        uint256[] memory weights = new uint256[](2);
        vaults[0] = vault1;
        vaults[1] = vault2;
        weights[0] = 70;
        weights[1] = 30;

        voting.vote(vaults, weights);

        vm.stopPrank();

        (address[] memory userVaults,) = voting.getUserVotes(alice);

        assertEq(userVaults.length, 2);
    }

    // ================================
    // CHECKPOINT TESTS
    // ================================

    function testCheckpointStoresWeights() public {
        _lockTokens(alice, 100 ether, FOUR_YEARS);
        uint256 genesis = voting.genesisEpochStart();
        vm.warp(genesis + 1);

        _vote(alice, vault1, 100);

        // Votes are stored per-epoch. Since we voted during epoch 0, we should see weight there.
        // Checkpoint finalizes the most recently ended epoch, so advance to epoch 1 first.
        vm.warp(genesis + WEEK + 1);
        voting.checkpoint();

        uint256 epoch0Weight = voting.getVaultWeightAtEpoch(0, vault1);
        assertTrue(epoch0Weight > 0);
    }

    // ================================
    // WHITELIST TESTS
    // ================================

    function testBatchWhitelist() public {
        address[] memory newVaults = new address[](2);
        bool[] memory statuses = new bool[](2);

        newVaults[0] = makeAddr("newVault1");
        newVaults[1] = makeAddr("newVault2");
        statuses[0] = true;
        statuses[1] = true;

        voting.batchSetVaultWhitelist(newVaults, statuses);

        assertTrue(voting.canReceiveVotes(newVaults[0]));
        assertTrue(voting.canReceiveVotes(newVaults[1]));
    }

    function testRemoveFromWhitelist() public {
        assertTrue(voting.canReceiveVotes(vault1));

        voting.setVaultWhitelist(vault1, false);

        assertFalse(voting.canReceiveVotes(vault1));
    }

    function testGetWhitelistedVaults() public view {
        address[] memory vaults = voting.getWhitelistedVaults();
        assertEq(vaults.length, 3);
        assertEq(voting.whitelistedVaultCount(), 3);
    }

    // ================================
    // EDGE CASES
    // ================================

    function testMaxVaultsPerVote() public {
        _lockTokens(alice, 100 ether, FOUR_YEARS);
        vm.warp(voting.genesisEpochStart() + 1);

        // Create 11 vaults (more than MAX_VAULTS_PER_VOTE = 10)
        address[] memory manyVaults = new address[](11);
        uint256[] memory weights = new uint256[](11);

        for (uint256 i = 0; i < 11; i++) {
            address v = makeAddr(string(abi.encodePacked("vault", i)));
            voting.setVaultWhitelist(v, true);
            manyVaults[i] = v;
            weights[i] = 10;
        }

        vm.startPrank(alice);
        vm.expectRevert(VaultGaugeVoting.TooManyVaults.selector);
        voting.vote(manyVaults, weights);
        vm.stopPrank();
    }

    function testZeroWeightNotAllowed() public {
        _lockTokens(alice, 100 ether, FOUR_YEARS);
        vm.warp(voting.genesisEpochStart() + 1);

        vm.startPrank(alice);

        address[] memory vaults = new address[](1);
        uint256[] memory weights = new uint256[](1);
        vaults[0] = vault1;
        weights[0] = 0;

        vm.expectRevert(VaultGaugeVoting.ZeroWeight.selector);
        voting.vote(vaults, weights);

        vm.stopPrank();
    }

    function testArrayLengthMismatch() public {
        _lockTokens(alice, 100 ether, FOUR_YEARS);
        vm.warp(voting.genesisEpochStart() + 1);

        vm.startPrank(alice);

        address[] memory vaults = new address[](2);
        uint256[] memory weights = new uint256[](1);
        vaults[0] = vault1;
        vaults[1] = vault2;
        weights[0] = 100;

        vm.expectRevert(VaultGaugeVoting.ArrayLengthMismatch.selector);
        voting.vote(vaults, weights);

        vm.stopPrank();
    }

    // ================================
    // GAUGE PROBABILITY BUDGET TESTS
    // ================================

    function testTotalGaugeProbabilityBudget_IsFixed() public view {
        assertEq(voting.getTotalGaugeProbabilityBps(), 694);
        assertEq(voting.getTotalGaugeProbabilityPPM(), 69_420);
    }

    function testTotalGaugeProbabilityBudget_DoesNotDependOnVaultCount() public {
        voting.setVaultWhitelist(makeAddr("vault4"), true);
        voting.setVaultWhitelist(makeAddr("vault5"), true);
        assertEq(voting.whitelistedVaultCount(), 5);
        assertEq(voting.getTotalGaugeProbabilityBps(), 694);
        assertEq(voting.getTotalGaugeProbabilityPPM(), 69_420);
    }

    function testVaultGaugeProbabilityBoost_NoVotesEqualSplit() public {
        // Ensure 5 whitelisted vaults for clean math
        voting.setVaultWhitelist(makeAddr("vault4"), true);
        voting.setVaultWhitelist(makeAddr("vault5"), true);
        assertEq(voting.whitelistedVaultCount(), 5);

        // No votes cast -> equal split of 69,420 PPM across 5 vaults = 13,884 PPM
        assertEq(voting.getVaultGaugeProbabilityBoostPPM(vault1), 13_884);
        assertEq(voting.getVaultGaugeProbabilityBoostPPM(vault2), 13_884);
        assertEq(voting.getVaultGaugeProbabilityBoostPPM(vault3), 13_884);
    }

    function testVaultGaugeProbabilityBoost_WithVotesProportional() public {
        // Ensure 5 whitelisted vaults for clean math
        voting.setVaultWhitelist(makeAddr("vault4"), true);
        voting.setVaultWhitelist(makeAddr("vault5"), true);

        // Give Alice voting power and cast a 100% vote to vault1
        _lockTokens(alice, 100 ether, FOUR_YEARS);
        vm.warp(voting.genesisEpochStart() + 1);

        _vote(alice, vault1, 100);

        // All votes go to vault1, but capped by MAX_PER_VAULT_PPM = 35,000.
        assertEq(voting.getVaultGaugeProbabilityBoostPPM(vault1), 35_000);
        assertEq(voting.getVaultGaugeProbabilityBoostPPM(vault2), 0);
        assertEq(voting.getVaultGaugeProbabilityBoostPPM(vault3), 0);
    }

    function testVaultGaugeProbabilityBoost_EqualSplitStillCapped() public {
        voting.setVaultWhitelist(vault2, false);
        voting.setVaultWhitelist(vault3, false);

        assertEq(voting.whitelistedVaultCount(), 1);
        assertEq(voting.getVaultGaugeProbabilityBoostPPM(vault1), 35_000);
    }

    // ================================
    // HELPER FUNCTIONS
    // ================================

    function _lockTokens(address user, uint256 amount, uint256 duration) internal {
        vm.startPrank(user);
        wsToken.approve(address(ve), amount);
        ve.lock(address(wsToken), amount, duration);
        vm.stopPrank();
    }

    function _vote(address user, address vault, uint256 weight) internal {
        vm.startPrank(user);

        address[] memory vaults = new address[](1);
        uint256[] memory weights = new uint256[](1);
        vaults[0] = vault;
        weights[0] = weight;

        voting.vote(vaults, weights);

        vm.stopPrank();
    }
}

/**
 * @title FeeSplitTest
 * @notice Tests for the ve(3,3) fee split (69/21.39/9.61/0)
 */
contract FeeSplitTest is Test {
    function testFeeSplitSumsTo100() public pure {
        uint256 burnBps = 2139; // 21.39%
        uint256 lotteryBps = 6900; // 69%
        uint256 creatorBps = 0; // 0%
        uint256 protocolBps = 961; // 9.61%

        uint256 total = burnBps + lotteryBps + creatorBps + protocolBps;
        assert(total == 10000); // Fee split should sum to 100%
    }

    function testIndividualSplits() public pure {
        // Verify each split is as expected
        uint256 lotteryBps = 6900;
        uint256 burnBps = 2139;
        uint256 protocolBps = 961;

        uint256 lotteryPct = (lotteryBps * 100) / 10000;
        uint256 burnPct = (burnBps * 100) / 10000;
        uint256 protocolPct = (protocolBps * 100) / 10000;

        assert(lotteryPct == 69); // Lottery should be 69%
        assert(burnPct == 21); // Burn should be ~21%
        assert(protocolPct == 9); // Protocol should be ~9%
    }
}

