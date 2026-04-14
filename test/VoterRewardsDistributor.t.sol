// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/governance/VaultGaugeVoting.sol";
import "../contracts/governance/VoterRewardsDistributor.sol";

// Import veAKITA contract only (avoid name collision with IveAKITA interface)
import {ve4626 as Ve4626Contract} from "../contracts/governance/ve4626.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockWSToken is ERC20 {
    constructor() ERC20("Wrapped sAKITA", "wsAKITA") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockCreatorRegistry {
    mapping(address => address) public vaultToToken;
    mapping(address => address) public tokenToGauge;

    function setVaultToken(address vault, address token) external {
        vaultToToken[vault] = token;
    }

    function setGaugeForToken(address token, address gauge) external {
        tokenToGauge[token] = gauge;
    }

    function getTokenForVault(address vault) external view returns (address) {
        return vaultToToken[vault];
    }

    function getGaugeControllerForToken(address token) external view returns (address) {
        return tokenToGauge[token];
    }
}

contract VoterRewardsDistributorTest is Test {
    MockWSToken public wsToken;
    MockCreatorRegistry public registry;
    Ve4626Contract public ve;
    VaultGaugeVoting public voting;
    VoterRewardsDistributor public distributor;

    MockERC20 public rewardToken;

    address public owner;
    address public alice;
    address public bob;
    address public vault1;
    address public creatorToken;
    address public protocolTreasury;

    uint256 public constant FOUR_YEARS = 4 * 365 days;
    uint256 public constant WEEK = 7 days;

    function setUp() public {
        owner = address(this);
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        vault1 = makeAddr("vault1");
        creatorToken = makeAddr("creatorToken");
        protocolTreasury = makeAddr("protocolTreasury");

        wsToken = new MockWSToken();
        registry = new MockCreatorRegistry();
        rewardToken = new MockERC20("VaultShares", "sTOKEN");

        ve = new Ve4626Contract("Vote-Escrowed wsAKITA", "veAKITA", address(wsToken), owner);
        voting = new VaultGaugeVoting(address(ve), owner);
        distributor = new VoterRewardsDistributor(address(voting), address(registry), owner);

        registry.setVaultToken(vault1, creatorToken);
        registry.setGaugeForToken(creatorToken, address(this));

        voting.setVaultWhitelist(vault1, true);
        distributor.setProtocolTreasury(protocolTreasury);

        // Fund users with wsToken for locking
        wsToken.mint(alice, 1_000 ether);
        wsToken.mint(bob, 1_000 ether);

        // Fund payer with rewards
        rewardToken.mint(address(this), 10_000 ether);
    }

    function testNotifyRewards_RevertsForUnauthorizedNotifier() public {
        uint256 amount = 100 ether;
        rewardToken.mint(alice, amount);

        vm.startPrank(alice);
        rewardToken.approve(address(distributor), amount);
        vm.expectRevert(VoterRewardsDistributor.UnauthorizedNotifier.selector);
        distributor.notifyRewards(vault1, address(rewardToken), amount);
        vm.stopPrank();
    }

    function testNotifyRewards_AuthorizedGaugeCanInitializeToken() public {
        vm.warp(voting.genesisEpochStart() + 1);
        uint256 amount = 100 ether;

        rewardToken.approve(address(distributor), amount);
        distributor.notifyRewards(vault1, address(rewardToken), amount);

        assertEq(distributor.vaultRewardToken(vault1), address(rewardToken));
        assertEq(distributor.epochVaultRewards(voting.currentEpoch(), vault1), amount);
    }

    function testRecoverVaultRewardToken_AllowsFutureNotifiesAndClaims() public {
        uint256 genesis = voting.genesisEpochStart();
        // G-09: lock before genesis so lock is old enough when voting
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);

        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        MockERC20 badToken = new MockERC20("BadShares", "BAD");
        badToken.mint(address(this), 1 ether);
        badToken.approve(address(distributor), 1 ether);
        distributor.notifyRewards(vault1, address(badToken), 1 ether);

        rewardToken.approve(address(distributor), 100 ether);
        vm.expectRevert(VoterRewardsDistributor.RewardTokenMismatch.selector);
        distributor.notifyRewards(vault1, address(rewardToken), 100 ether);

        distributor.recoverVaultRewardToken(vault1, address(rewardToken));
        assertEq(distributor.vaultRewardToken(vault1), address(rewardToken));

        _voteSingle(alice, vault1);

        // Epoch 1: Alice votes again
        vm.warp(voting.genesisEpochStart() + WEEK + 1);
        assertEq(voting.currentEpoch(), 1);
        _voteSingle(alice, vault1);

        // Epoch 2: G-04 credits rewards to epoch 1 (current-1 = 2-1 = 1)
        vm.warp(voting.genesisEpochStart() + 2 * WEEK + 1);
        assertEq(voting.currentEpoch(), 2);

        rewardToken.approve(address(distributor), 100 ether);
        distributor.notifyRewards(vault1, address(rewardToken), 100 ether);

        // Epoch 3: claim epoch 1
        vm.warp(voting.genesisEpochStart() + 3 * WEEK + 1);
        assertEq(voting.currentEpoch(), 3);

        vm.prank(alice);
        uint256 claimed = distributor.claim(vault1, 1);
        assertEq(claimed, 100 ether);
    }

    function _lock(address user, uint256 amount, uint256 duration) internal {
        vm.startPrank(user);
        wsToken.approve(address(ve), amount);
        ve.lock(address(wsToken), amount, duration);
        vm.stopPrank();
    }

    function _voteSingle(address user, address vault) internal {
        vm.startPrank(user);
        address[] memory vaults = new address[](1);
        uint256[] memory weights = new uint256[](1);
        vaults[0] = vault;
        weights[0] = 100;
        voting.vote(vaults, weights);
        vm.stopPrank();
    }

    function testNotifyAndClaim_EqualSplit() public {
        uint256 genesis = voting.genesisEpochStart();
        // G-09: lock before genesis so lock is old enough when voting
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);
        _lock(bob, 100 ether, FOUR_YEARS);

        // Warp to epoch 0 start
        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        // Both vote 100% for vault1
        _voteSingle(alice, vault1);
        _voteSingle(bob, vault1);

        // Notify reward for epoch 0
        uint256 amount = 1_000 ether;
        rewardToken.approve(address(distributor), amount);
        distributor.notifyRewards(vault1, address(rewardToken), amount);

        // Claims only after the epoch ends (strict epoch accounting)
        vm.warp(voting.genesisEpochStart() + WEEK + 1);
        assertEq(voting.currentEpoch(), 1);

        // Claims
        vm.prank(alice);
        uint256 aliceClaim = distributor.claim(vault1, 0);

        vm.prank(bob);
        uint256 bobClaim = distributor.claim(vault1, 0);

        // Each should get ~50% (integer rounding may leave dust)
        assertApproxEqAbs(aliceClaim, 500 ether, 1);
        assertApproxEqAbs(bobClaim, 500 ether, 1);
        assertLe(aliceClaim + bobClaim, amount);
    }

    function testExpiringLockCannotVoteOrClaimRewards() public {
        uint256 genesis = voting.genesisEpochStart();

        // G-09: locks must be at least 1 epoch old when voting.
        // Alice locks at (genesis - WEEK) for WEEK => expires at genesis => zero power at epoch end.
        // Bob locks at (genesis - WEEK) for FOUR_YEARS => passes all checks.
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, WEEK);
        _lock(bob, 100 ether, FOUR_YEARS);

        // Epoch 0 voting
        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        // Alice cannot vote: G-03 uses votingPowerAt(epochEnd) which is 0 (lock expired at genesis)
        vm.startPrank(alice);
        address[] memory vaults = new address[](1);
        uint256[] memory weights = new uint256[](1);
        vaults[0] = vault1;
        weights[0] = 100;
        vm.expectRevert(VaultGaugeVoting.NoVotingPower.selector);
        voting.vote(vaults, weights);
        vm.stopPrank();

        // Bob votes successfully and becomes the sole claimant.
        _voteSingle(bob, vault1);

        // Notify reward for epoch 0
        uint256 amount = 1_000 ether;
        rewardToken.approve(address(distributor), amount);
        distributor.notifyRewards(vault1, address(rewardToken), amount);

        // Claims only after the epoch ends (strict epoch accounting)
        vm.warp(genesis + WEEK + 1);
        assertEq(voting.currentEpoch(), 1);

        assertEq(distributor.previewClaim(alice, vault1, 0), 0);
        assertEq(distributor.previewClaim(bob, vault1, 0), amount);

        vm.prank(alice);
        uint256 aliceClaim = distributor.claim(vault1, 0);
        assertEq(aliceClaim, 0);

        vm.prank(bob);
        uint256 bobClaim = distributor.claim(vault1, 0);
        assertEq(bobClaim, amount);
    }

    function testNotifyAndClaim_DuplicateVaultInputsStillPayCorrectProRata() public {
        uint256 genesis = voting.genesisEpochStart();
        // G-09: lock before genesis so lock is old enough when voting
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);
        _lock(bob, 100 ether, FOUR_YEARS);

        // Warp to epoch 0 start
        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        // Alice votes with duplicate entries for the same vault.
        vm.startPrank(alice);
        address[] memory duplicateVaults = new address[](2);
        uint256[] memory duplicateWeights = new uint256[](2);
        duplicateVaults[0] = vault1;
        duplicateVaults[1] = vault1;
        duplicateWeights[0] = 10;
        duplicateWeights[1] = 90;
        voting.vote(duplicateVaults, duplicateWeights);
        vm.stopPrank();

        // Bob votes normally for vault1.
        _voteSingle(bob, vault1);

        uint256 amount = 1_000 ether;
        rewardToken.approve(address(distributor), amount);
        distributor.notifyRewards(vault1, address(rewardToken), amount);

        // Claims only after the epoch ends.
        vm.warp(voting.genesisEpochStart() + WEEK + 1);
        assertEq(voting.currentEpoch(), 1);

        uint256 alicePreview = distributor.previewClaim(alice, vault1, 0);
        uint256 bobPreview = distributor.previewClaim(bob, vault1, 0);
        assertApproxEqAbs(alicePreview, 500 ether, 1);
        assertApproxEqAbs(bobPreview, 500 ether, 1);

        vm.prank(alice);
        uint256 aliceClaim = distributor.claim(vault1, 0);

        vm.prank(bob);
        uint256 bobClaim = distributor.claim(vault1, 0);

        assertApproxEqAbs(aliceClaim, 500 ether, 1);
        assertApproxEqAbs(bobClaim, 500 ether, 1);
        assertApproxEqAbs(aliceClaim + bobClaim, amount, 2);
    }

    function testClaim_RequiresVote() public {
        uint256 genesis = voting.genesisEpochStart();
        // G-09: lock before genesis so lock is old enough when voting
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);
        _lock(bob, 100 ether, FOUR_YEARS);

        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        // Only Alice votes
        _voteSingle(alice, vault1);

        uint256 amount = 1_000 ether;
        rewardToken.approve(address(distributor), amount);
        distributor.notifyRewards(vault1, address(rewardToken), amount);

        // Claims only after the epoch ends (strict epoch accounting)
        vm.warp(voting.genesisEpochStart() + WEEK + 1);
        assertEq(voting.currentEpoch(), 1);

        vm.prank(bob);
        uint256 bobClaim = distributor.claim(vault1, 0);
        assertEq(bobClaim, 0);

        vm.prank(alice);
        uint256 aliceClaim = distributor.claim(vault1, 0);
        assertEq(aliceClaim, amount);
    }

    function testEpochIsolation() public {
        uint256 genesis = voting.genesisEpochStart();
        // G-09: lock before genesis so lock is old enough when voting
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);
        _lock(bob, 100 ether, FOUR_YEARS);

        // Epoch 0: Alice votes
        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);
        _voteSingle(alice, vault1);

        // G-04: notifyRewards during epoch 0 credits epoch 0 (special case: current == 0)
        uint256 amount0 = 1_000 ether;
        rewardToken.approve(address(distributor), amount0);
        distributor.notifyRewards(vault1, address(rewardToken), amount0);

        // Epoch 1: Bob votes
        vm.warp(voting.genesisEpochStart() + WEEK + 1);
        assertEq(voting.currentEpoch(), 1);
        _voteSingle(bob, vault1);

        // Epoch 2: notify rewards — G-04 credits epoch 1 (current-1 = 2-1 = 1)
        vm.warp(voting.genesisEpochStart() + 2 * WEEK + 1);
        assertEq(voting.currentEpoch(), 2);

        uint256 amount1 = 2_000 ether;
        rewardToken.approve(address(distributor), amount1);
        distributor.notifyRewards(vault1, address(rewardToken), amount1);

        // Claims for epoch 0 (epoch 0 ended; current epoch is 2)
        vm.prank(alice);
        uint256 alice0 = distributor.claim(vault1, 0);
        assertEq(alice0, amount0);

        vm.prank(bob);
        uint256 bob0 = distributor.claim(vault1, 0);
        assertEq(bob0, 0);

        // Claims for epoch 1 (epoch 1 ended; current epoch is 2)
        vm.prank(alice);
        uint256 alice1 = distributor.claim(vault1, 1);
        assertEq(alice1, 0);

        vm.prank(bob);
        uint256 bob1 = distributor.claim(vault1, 1);
        assertEq(bob1, amount1);
    }

    function testSweepZeroVoteEpoch_AfterGrace_SendsToProtocol() public {
        // Epoch 0 (no votes)
        vm.warp(voting.genesisEpochStart() + 1);
        assertEq(voting.currentEpoch(), 0);

        uint256 amount = 1_000 ether;
        rewardToken.approve(address(distributor), amount);
        distributor.notifyRewards(vault1, address(rewardToken), amount);

        // Move forward far enough: sweepGraceEpochs=4 → sweepable starting epoch 5
        vm.warp(voting.genesisEpochStart() + 5 * WEEK + 1);
        assertEq(voting.currentEpoch(), 5);

        uint256 swept = distributor.sweepZeroVoteEpoch(vault1, 0);
        assertEq(swept, amount);
        assertEq(rewardToken.balanceOf(protocolTreasury), amount);
        assertEq(distributor.epochVaultRewards(0, vault1), 0);
    }

    function testClaim_RevertsIfEpochNotEnded() public {
        uint256 genesis = voting.genesisEpochStart();
        // G-09: lock before genesis so lock is old enough when voting
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);

        // Epoch 0
        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        _voteSingle(alice, vault1);

        uint256 amount = 1_000 ether;
        rewardToken.approve(address(distributor), amount);
        distributor.notifyRewards(vault1, address(rewardToken), amount);

        vm.prank(alice);
        vm.expectRevert(VoterRewardsDistributor.EpochNotEnded.selector);
        distributor.claim(vault1, 0);
    }

    function testSweepZeroVoteEpoch_RevertsBeforeGrace() public {
        // Epoch 0 (no votes)
        vm.warp(voting.genesisEpochStart() + 1);
        assertEq(voting.currentEpoch(), 0);

        uint256 amount = 1_000 ether;
        rewardToken.approve(address(distributor), amount);
        distributor.notifyRewards(vault1, address(rewardToken), amount);

        // Not far enough: epoch 4 is still within the 4-epoch grace window
        vm.warp(voting.genesisEpochStart() + 4 * WEEK + 1);
        assertEq(voting.currentEpoch(), 4);

        vm.expectRevert(VoterRewardsDistributor.SweepNotAllowedYet.selector);
        distributor.sweepZeroVoteEpoch(vault1, 0);
    }

    function testSweepZeroVoteEpoch_RevertsIfVotesExist() public {
        uint256 genesis = voting.genesisEpochStart();
        // G-09: lock before genesis so lock is old enough when voting
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);

        // Epoch 0
        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        _voteSingle(alice, vault1);

        uint256 amount = 1_000 ether;
        rewardToken.approve(address(distributor), amount);
        distributor.notifyRewards(vault1, address(rewardToken), amount);

        // Move forward far enough: sweepGraceEpochs=4 → sweepable starting epoch 5
        vm.warp(voting.genesisEpochStart() + 5 * WEEK + 1);
        assertEq(voting.currentEpoch(), 5);

        vm.expectRevert(VoterRewardsDistributor.NotZeroVoteEpoch.selector);
        distributor.sweepZeroVoteEpoch(vault1, 0);
    }
}

