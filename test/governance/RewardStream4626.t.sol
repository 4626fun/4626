// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "@4626/shared/governance/ve4626GaugeVoting.sol";
import {ve4626 as ve4626Contract} from "@4626/shared/governance/ve4626.sol";

import {RewardStreamFactory4626} from "@4626/shared/governance/rewards/RewardStreamFactory4626.sol";
import {RewardStream4626} from "@4626/shared/governance/rewards/RewardStream4626.sol";
import {IRewardStream4626} from "@4626/shared/governance/rewards/interfaces/IRewardStream4626.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockWSToken is ERC20 {
    constructor() ERC20("Wrapped s4626", "ws4626") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract FeeOnTransferERC20 is ERC20 {
    uint256 public constant BPS = 10_000;
    uint256 public constant FEE_BPS = 1_000; // 10%

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && value > 0) {
            uint256 fee = (value * FEE_BPS) / BPS;
            uint256 net = value - fee;
            super._update(from, address(0), fee);
            super._update(from, to, net);
        } else {
            super._update(from, to, value);
        }
    }
}

contract RewardStream4626Test is Test {
    MockWSToken public wsToken;
    ve4626Contract public ve;
    ve4626GaugeVoting public voting;

    RewardStreamFactory4626 public factory;
    RewardStream4626 public stream;

    MockERC20 public rewardA;
    MockERC20 public rewardB;
    FeeOnTransferERC20 public fotToken;

    address public owner;
    address public vault1;
    address public funder;
    address public alice;
    address public bob;

    uint256 public constant WEEK = 7 days;
    uint256 public constant FOUR_YEARS = 4 * 365 days;

    function setUp() public {
        owner = address(this);
        vault1 = makeAddr("vault1");
        funder = makeAddr("funder");
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        wsToken = new MockWSToken();
        rewardA = new MockERC20("RewardA", "RWA");
        rewardB = new MockERC20("RewardB", "RWB");
        fotToken = new FeeOnTransferERC20("FOT", "FOT");

        ve = new ve4626Contract("Vote-Escrowed ws4626", "ve4626", address(wsToken), owner);
        voting = new ve4626GaugeVoting(address(ve), owner);
        voting.setVaultWhitelist(vault1, true);

        factory = new RewardStreamFactory4626(address(voting), owner);
        stream = RewardStream4626(factory.createStream(vault1));

        // Allowlist campaign tokens
        stream.addRewardToken(address(rewardA));
        stream.addRewardToken(address(rewardB));
        stream.addRewardToken(address(fotToken));

        wsToken.mint(alice, 1_000 ether);
        wsToken.mint(bob, 1_000 ether);

        rewardA.mint(funder, 100_000 ether);
        rewardB.mint(funder, 100_000 ether);
        fotToken.mint(funder, 100_000 ether);
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

    function _fund(address token, uint256 amount) internal {
        vm.startPrank(funder);
        IERC20(token).approve(address(stream), amount);
        stream.fund(token, amount);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Factory
    // -------------------------------------------------------------------------

    function testCreateStream_RejectsNonWhitelistedVault() public {
        address rogue = makeAddr("rogueVault");
        vm.expectRevert(abi.encodeWithSelector(RewardStreamFactory4626.VaultNotWhitelisted.selector, rogue));
        factory.createStream(rogue);
    }

    function testCreateStream_RejectsDuplicate() public {
        vm.expectRevert(
            abi.encodeWithSelector(RewardStreamFactory4626.StreamAlreadyExists.selector, vault1, address(stream))
        );
        factory.createStream(vault1);
    }

    function testGetOrCreateStream_Idempotent() public {
        address s1 = factory.getOrCreateStream(vault1);
        address s2 = factory.getOrCreateStream(vault1);
        assertEq(s1, address(stream));
        assertEq(s2, address(stream));
    }

    // -------------------------------------------------------------------------
    // Allowlist
    // -------------------------------------------------------------------------

    function testFund_RevertsWhenTokenNotAllowlisted() public {
        MockERC20 stranger = new MockERC20("X", "X");
        stranger.mint(funder, 1 ether);

        vm.warp(voting.genesisEpochStart() + 1);
        vm.startPrank(funder);
        stranger.approve(address(stream), 1 ether);
        vm.expectRevert(abi.encodeWithSelector(IRewardStream4626.TokenNotAllowed.selector, address(stranger)));
        stream.fund(address(stranger), 1 ether);
        vm.stopPrank();
    }

    function testAddRewardToken_OnlyOwner() public {
        MockERC20 stranger = new MockERC20("X", "X");
        vm.prank(alice);
        vm.expectRevert();
        stream.addRewardToken(address(stranger));
    }

    function testRemoveRewardToken_BlocksFurtherFunding() public {
        stream.removeRewardToken(address(rewardB));
        vm.warp(voting.genesisEpochStart() + 1);

        vm.startPrank(funder);
        rewardB.approve(address(stream), 1 ether);
        vm.expectRevert(abi.encodeWithSelector(IRewardStream4626.TokenNotAllowed.selector, address(rewardB)));
        stream.fund(address(rewardB), 1 ether);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Fund + claim (multi-token pro-rata)
    // -------------------------------------------------------------------------

    function testFund_CreditsCurrentEpoch() public {
        vm.warp(voting.genesisEpochStart() + 1);
        assertEq(voting.currentEpoch(), 0);

        _fund(address(rewardA), 1 ether);
        assertEq(stream.epochTokenRewards(0, address(rewardA)), 1 ether);
    }

    function testClaim_MultiTokenProRataAfterEpochEnd() public {
        uint256 genesis = voting.genesisEpochStart();

        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);
        _lock(bob, 100 ether, FOUR_YEARS);

        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        uint256 amountA = 1_000 ether;
        uint256 amountB = 500 ether;
        _fund(address(rewardA), amountA);
        _fund(address(rewardB), amountB);

        _voteSingle(alice, vault1);
        _voteSingle(bob, vault1);

        // Cannot claim current epoch
        vm.prank(alice);
        vm.expectRevert(IRewardStream4626.EpochNotEnded.selector);
        stream.claim(0, address(rewardA));

        // Finalize epoch 0
        vm.warp(genesis + WEEK + 1);
        assertEq(voting.currentEpoch(), 1);

        assertApproxEqAbs(stream.previewClaim(alice, 0, address(rewardA)), 500 ether, 1);

        vm.prank(alice);
        uint256 aliceA = stream.claim(0, address(rewardA));
        vm.prank(alice);
        uint256 aliceB = stream.claim(0, address(rewardB));

        vm.prank(bob);
        uint256 bobA = stream.claim(0, address(rewardA));
        vm.prank(bob);
        uint256 bobB = stream.claim(0, address(rewardB));

        assertApproxEqAbs(aliceA, 500 ether, 1);
        assertApproxEqAbs(bobA, 500 ether, 1);
        assertApproxEqAbs(aliceB, 250 ether, 1);
        assertApproxEqAbs(bobB, 250 ether, 1);
        assertLe(aliceA + bobA, amountA);
        assertLe(aliceB + bobB, amountB);
    }

    function testClaimMany_SingleCall() public {
        uint256 genesis = voting.genesisEpochStart();

        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);

        vm.warp(genesis + 1);
        _fund(address(rewardA), 100 ether);
        _fund(address(rewardB), 40 ether);
        _voteSingle(alice, vault1);

        vm.warp(genesis + WEEK + 1);

        address[] memory tokens = new address[](2);
        tokens[0] = address(rewardA);
        tokens[1] = address(rewardB);

        vm.prank(alice);
        uint256 total = stream.claimMany(0, tokens);
        assertEq(total, 140 ether);
        assertEq(rewardA.balanceOf(alice), 100 ether);
        assertEq(rewardB.balanceOf(alice), 40 ether);
    }

    function testClaim_DoubleClaimReverts() public {
        uint256 genesis = voting.genesisEpochStart();

        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);

        vm.warp(genesis + 1);
        _fund(address(rewardA), 100 ether);
        _voteSingle(alice, vault1);

        vm.warp(genesis + WEEK + 1);

        vm.prank(alice);
        stream.claim(0, address(rewardA));

        vm.prank(alice);
        vm.expectRevert(IRewardStream4626.AlreadyClaimed.selector);
        stream.claim(0, address(rewardA));
    }

    function testClaim_NoVotesReverts() public {
        uint256 genesis = voting.genesisEpochStart();

        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);
        _lock(bob, 100 ether, FOUR_YEARS);

        vm.warp(genesis + 1);
        _fund(address(rewardA), 100 ether);
        // Only bob votes
        _voteSingle(bob, vault1);

        vm.warp(genesis + WEEK + 1);

        vm.prank(alice);
        vm.expectRevert(IRewardStream4626.NoUserVotes.selector);
        stream.claim(0, address(rewardA));

        vm.prank(bob);
        assertEq(stream.claim(0, address(rewardA)), 100 ether);
    }

    // -------------------------------------------------------------------------
    // Fee-on-transfer
    // -------------------------------------------------------------------------

    function testFund_FeeOnTransferCreditsReceived() public {
        vm.warp(voting.genesisEpochStart() + 1);

        uint256 amount = 1_000 ether;
        _fund(address(fotToken), amount);

        // 10% fee burned on transfer → credit 900 ether
        uint256 expected = (amount * 9_000) / 10_000;
        assertEq(stream.epochTokenRewards(0, address(fotToken)), expected);
    }

    // -------------------------------------------------------------------------
    // Zero-vote rollover
    // -------------------------------------------------------------------------

    function testRolloverZeroVoteEpoch() public {
        uint256 genesis = voting.genesisEpochStart();
        vm.warp(genesis + 1);

        _fund(address(rewardA), 1_000 ether);
        assertEq(stream.epochTokenRewards(0, address(rewardA)), 1_000 ether);

        // Need epoch >= 2 so epoch 0 has been ended for ≥1 epoch
        vm.warp(genesis + 2 * WEEK + 1);
        assertEq(voting.currentEpoch(), 2);

        uint256 rolled = stream.rolloverZeroVoteEpoch(0, address(rewardA));
        assertEq(rolled, 1_000 ether);
        assertEq(stream.epochTokenRewards(0, address(rewardA)), 0);
        assertEq(stream.epochTokenRewards(2, address(rewardA)), 1_000 ether);
        assertTrue(stream.isClosed(0, address(rewardA)));
    }

    function testRolloverZeroVoteEpoch_RevertsIfVotesExist() public {
        uint256 genesis = voting.genesisEpochStart();

        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);

        vm.warp(genesis + 1);
        _fund(address(rewardA), 100 ether);
        _voteSingle(alice, vault1);

        vm.warp(genesis + 2 * WEEK + 1);

        vm.expectRevert(IRewardStream4626.NotZeroVoteEpoch.selector);
        stream.rolloverZeroVoteEpoch(0, address(rewardA));
    }

    function testRolloverZeroVoteEpoch_RevertsTooSoon() public {
        uint256 genesis = voting.genesisEpochStart();
        vm.warp(genesis + 1);
        _fund(address(rewardA), 100 ether);

        // Only one epoch later — not enough grace for zero-vote path
        vm.warp(genesis + WEEK + 1);
        assertEq(voting.currentEpoch(), 1);

        vm.expectRevert(IRewardStream4626.RolloverNotAllowedYet.selector);
        stream.rolloverZeroVoteEpoch(0, address(rewardA));
    }

    // -------------------------------------------------------------------------
    // Owner leftover rollover
    // -------------------------------------------------------------------------

    function testRolloverExpiredEpoch_OwnerOnly() public {
        uint256 genesis = voting.genesisEpochStart();

        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);
        _lock(bob, 100 ether, FOUR_YEARS);

        vm.warp(genesis + 1);
        _fund(address(rewardA), 1_000 ether);
        _voteSingle(alice, vault1);
        _voteSingle(bob, vault1);

        // Alice claims half in epoch 1
        vm.warp(genesis + WEEK + 1);
        vm.prank(alice);
        stream.claim(0, address(rewardA));

        // Bob never claims — after grace (4 epochs), owner rolls leftover
        vm.warp(genesis + 5 * WEEK + 1);
        assertEq(voting.currentEpoch(), 5);

        vm.prank(alice);
        vm.expectRevert();
        stream.rolloverExpiredEpoch(0, address(rewardA));

        uint256 rolled = stream.rolloverExpiredEpoch(0, address(rewardA));
        assertApproxEqAbs(rolled, 500 ether, 1);
        assertTrue(stream.isClosed(0, address(rewardA)));
        assertApproxEqAbs(stream.epochTokenRewards(5, address(rewardA)), 500 ether, 1);
    }

    // -------------------------------------------------------------------------
    // Delisted vault
    // -------------------------------------------------------------------------

    function testFund_RevertsWhenVaultDelisted() public {
        vm.warp(voting.genesisEpochStart() + 1);
        voting.setVaultWhitelist(vault1, false);

        vm.startPrank(funder);
        rewardA.approve(address(stream), 1 ether);
        vm.expectRevert(IRewardStream4626.VaultNotWhitelisted.selector);
        stream.fund(address(rewardA), 1 ether);
        vm.stopPrank();
    }
}

