// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/governance/VaultGaugeVoting.sol";
import {ve4626 as Ve4626Contract} from "../contracts/governance/ve4626.sol";

import "../contracts/factories/BribesFactory.sol";
import {BribeDepot} from "../contracts/governance/bribes/BribeDepot.sol";

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

contract FeeOnTransferERC20 is ERC20 {
    uint256 public constant BPS = 10_000;
    uint256 public constant FEE_BPS = 1_000; // 10%

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        // Charge a fee on normal transfers only (not mint/burn).
        if (from != address(0) && to != address(0) && value > 0) {
            uint256 fee = (value * FEE_BPS) / BPS;
            uint256 net = value - fee;

            // Burn the fee and transfer the remainder.
            super._update(from, address(0), fee);
            super._update(from, to, net);
        } else {
            super._update(from, to, value);
        }
    }
}

contract BribesTest is Test {
    MockWSToken public wsToken;
    Ve4626Contract public ve;
    VaultGaugeVoting public voting;

    BribesFactory public factory;
    BribeDepot public depot;

    MockERC20 public bribeToken;

    address public owner;
    address public vault1;
    address public briber;
    address public alice;
    address public bob;

    uint256 public constant WEEK = 7 days;
    uint256 public constant FOUR_YEARS = 4 * 365 days;

    function setUp() public {
        owner = address(this);
        vault1 = makeAddr("vault1");
        briber = makeAddr("briber");
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        wsToken = new MockWSToken();
        bribeToken = new MockERC20("BribeToken", "BRIBE");

        ve = new Ve4626Contract("Vote-Escrowed wsAKITA", "veAKITA", address(wsToken), owner);
        voting = new VaultGaugeVoting(address(ve), owner);
        voting.setVaultWhitelist(vault1, true);

        factory = new BribesFactory(address(voting));
        depot = BribeDepot(factory.createBribeDepot(vault1));

        // Fund voters
        wsToken.mint(alice, 1_000 ether);
        wsToken.mint(bob, 1_000 ether);

        // Fund briber
        bribeToken.mint(briber, 10_000 ether);
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

    function testBribeTracksCurrentEpoch() public {
        vm.warp(voting.genesisEpochStart() + 1);
        assertEq(voting.currentEpoch(), 0);

        uint256 amount = 1 ether;
        vm.startPrank(briber);
        bribeToken.approve(address(depot), amount);
        depot.bribe(address(bribeToken), amount);
        vm.stopPrank();

        assertEq(depot.totalBribes(0, address(bribeToken)), amount);
    }

    function testClaimBribe_ProRataAfterEpochEnd() public {
        uint256 genesis = voting.genesisEpochStart();

        // Lock before genesis so locks are at least 1 epoch old when voting
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);
        _lock(bob, 100 ether, FOUR_YEARS);

        // Epoch 0: bribe current epoch
        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        uint256 amount = 1_000 ether;
        vm.startPrank(briber);
        bribeToken.approve(address(depot), amount);
        depot.bribe(address(bribeToken), amount);
        vm.stopPrank();

        // Epoch 0: both vote for vault1
        _voteSingle(alice, vault1);
        _voteSingle(bob, vault1);

        // Move to epoch 1 so epoch 0 is finalized before claims.
        vm.warp(voting.genesisEpochStart() + WEEK + 1);
        assertEq(voting.currentEpoch(), 1);

        vm.prank(alice);
        uint256 aliceClaim = depot.claim(0, address(bribeToken));

        vm.prank(bob);
        uint256 bobClaim = depot.claim(0, address(bribeToken));

        assertApproxEqAbs(aliceClaim, 500 ether, 1);
        assertApproxEqAbs(bobClaim, 500 ether, 1);
        assertLe(aliceClaim + bobClaim, amount);
    }

    function testExpiringLockCannotVoteOrClaimBribes() public {
        uint256 genesis = voting.genesisEpochStart();

        // Create an expiring lock that will end before epoch 0 finishes.
        // lock at (genesis - WEEK) for WEEK => expires at genesis < epoch end (genesis + WEEK).
        // G-09 satisfied: lock is exactly 1 epoch old at genesis + 1.
        // G-03: votingPowerAt(epochEnd) = 0 because lock expires before epoch end,
        // so NoVotingPower fires before LockExpiresBeforeEpochEnd.
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, WEEK);
        _lock(bob, 100 ether, FOUR_YEARS);

        // Epoch 0 actions
        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        uint256 amount = 1_000 ether;
        vm.startPrank(briber);
        bribeToken.approve(address(depot), amount);
        depot.bribe(address(bribeToken), amount);
        vm.stopPrank();

        // Alice cannot vote (lock expires before epoch end => votingPowerAt(epochEnd) = 0)
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

        // Finalize epoch 0
        vm.warp(genesis + WEEK + 1);
        assertEq(voting.currentEpoch(), 1);

        // Alice cannot claim since no weight was recorded for her.
        vm.prank(alice);
        vm.expectRevert(BribeDepot.NoUserVotes.selector);
        depot.claim(0, address(bribeToken));

        // Bob claims the full bribe amount.
        vm.prank(bob);
        uint256 bobClaim = depot.claim(0, address(bribeToken));
        assertEq(bobClaim, amount);
    }

    function testClaimBribe_DuplicateVaultInputsStillPayCorrectProRata() public {
        uint256 genesis = voting.genesisEpochStart();

        // Lock before genesis so locks are at least 1 epoch old when voting
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);
        _lock(bob, 100 ether, FOUR_YEARS);

        // Epoch 0: bribe current epoch
        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        uint256 amount = 1_000 ether;
        vm.startPrank(briber);
        bribeToken.approve(address(depot), amount);
        depot.bribe(address(bribeToken), amount);
        vm.stopPrank();

        // Alice votes with duplicate vault entries (should aggregate to 100% vault1)
        vm.startPrank(alice);
        address[] memory duplicateVaults = new address[](2);
        uint256[] memory duplicateWeights = new uint256[](2);
        duplicateVaults[0] = vault1;
        duplicateVaults[1] = vault1;
        duplicateWeights[0] = 10;
        duplicateWeights[1] = 90;
        voting.vote(duplicateVaults, duplicateWeights);
        vm.stopPrank();

        // Bob votes normally for vault1
        _voteSingle(bob, vault1);

        // Move to epoch 1 so epoch 0 is finalized before claims.
        vm.warp(voting.genesisEpochStart() + WEEK + 1);
        assertEq(voting.currentEpoch(), 1);

        vm.prank(alice);
        uint256 aliceClaim = depot.claim(0, address(bribeToken));

        vm.prank(bob);
        uint256 bobClaim = depot.claim(0, address(bribeToken));

        assertApproxEqAbs(aliceClaim, 500 ether, 1);
        assertApproxEqAbs(bobClaim, 500 ether, 1);
        assertApproxEqAbs(aliceClaim + bobClaim, amount, 2);
    }

    function testClaimBribe_RevertsIfEpochNotEnded() public {
        uint256 genesis = voting.genesisEpochStart();

        // Lock before genesis so lock is at least 1 epoch old when voting
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);

        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        uint256 amount = 250 ether;
        vm.startPrank(briber);
        bribeToken.approve(address(depot), amount);
        depot.bribe(address(bribeToken), amount);
        vm.stopPrank();

        _voteSingle(alice, vault1);

        vm.prank(alice);
        vm.expectRevert(BribeDepot.EpochNotEnded.selector);
        depot.claim(0, address(bribeToken));
    }

    function testClaimBribe_RevertsWithoutVotes() public {
        vm.warp(voting.genesisEpochStart() + 1);
        assertEq(voting.currentEpoch(), 0);

        uint256 amount = 123 ether;
        vm.startPrank(briber);
        bribeToken.approve(address(depot), amount);
        depot.bribe(address(bribeToken), amount);
        vm.stopPrank();

        // Move to epoch 1 so epoch 0 is finalized, then assert no-vote behavior.
        vm.warp(voting.genesisEpochStart() + WEEK + 1);
        assertEq(voting.currentEpoch(), 1);

        vm.prank(alice);
        vm.expectRevert(BribeDepot.NoUserVotes.selector);
        depot.claim(0, address(bribeToken));
    }

    function testBribe_FeeOnTransfer_CreditsReceivedNotInputAmount() public {
        FeeOnTransferERC20 fot = new FeeOnTransferERC20("FeeOnTransfer", "FOT");

        vm.warp(voting.genesisEpochStart() + 1);
        assertEq(voting.currentEpoch(), 0);

        uint256 amount = 100 ether;
        uint256 expectedReceived = amount - ((amount * fot.FEE_BPS()) / fot.BPS());

        fot.mint(briber, amount);

        vm.startPrank(briber);
        fot.approve(address(depot), amount);
        depot.bribe(address(fot), amount);
        vm.stopPrank();

        assertEq(depot.totalBribes(0, address(fot)), expectedReceived);
        assertEq(fot.balanceOf(address(depot)), expectedReceived);
    }

    function testClaim_FeeOnTransfer_DoesNotRevertAndNeverOverpaysRecordedTotal() public {
        FeeOnTransferERC20 fot = new FeeOnTransferERC20("FeeOnTransfer", "FOT");
        uint256 genesis = voting.genesisEpochStart();

        // Lock before genesis so locks are at least 1 epoch old when voting
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);
        _lock(bob, 100 ether, FOUR_YEARS);

        // Epoch 0: bribe
        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        uint256 amountIn = 100 ether;
        fot.mint(briber, amountIn);

        vm.startPrank(briber);
        fot.approve(address(depot), amountIn);
        depot.bribe(address(fot), amountIn);
        vm.stopPrank();

        uint256 credited = depot.totalBribes(0, address(fot));
        assertEq(credited, 90 ether);
        assertEq(fot.balanceOf(address(depot)), credited);

        // Epoch 0: both vote for vault1
        _voteSingle(alice, vault1);
        _voteSingle(bob, vault1);

        // Finalize epoch 0
        vm.warp(voting.genesisEpochStart() + WEEK + 1);
        assertEq(voting.currentEpoch(), 1);

        vm.prank(alice);
        uint256 aliceClaim = depot.claim(0, address(fot));

        vm.prank(bob);
        uint256 bobClaim = depot.claim(0, address(fot));

        // Claims are computed off the credited total (not caller-supplied amount).
        assertEq(aliceClaim + bobClaim, credited);
        assertEq(fot.balanceOf(address(depot)), 0);
    }

    function testRolloverZeroVoteEpoch_MovesPoolToCurrentEpoch() public {
        uint256 genesis = voting.genesisEpochStart();

        // Lock before genesis so lock is at least 1 epoch old when voting
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);

        // Epoch 0: bribe, but no votes
        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        uint256 amount = 1_000 ether;
        vm.startPrank(briber);
        bribeToken.approve(address(depot), amount);
        depot.bribe(address(bribeToken), amount);
        vm.stopPrank();

        assertEq(depot.totalBribes(0, address(bribeToken)), amount);
        assertEq(voting.getVaultWeightAtEpoch(0, vault1), 0);

        // Move to epoch 2 so rollover satisfies epoch + 1 < currentEpoch.
        vm.warp(genesis + 2 * WEEK + 1);
        assertEq(voting.currentEpoch(), 2);

        uint256 rolled = depot.rolloverZeroVoteEpoch(0, address(bribeToken));
        assertEq(rolled, amount);
        assertEq(depot.totalBribes(0, address(bribeToken)), 0);
        assertEq(depot.totalBribes(2, address(bribeToken)), amount);

        // Vote in epoch 2 and claim after epoch 2 ends.
        _voteSingle(alice, vault1);

        vm.warp(genesis + 3 * WEEK + 1);
        assertEq(voting.currentEpoch(), 3);

        vm.prank(alice);
        uint256 claimed = depot.claim(2, address(bribeToken));
        assertEq(claimed, amount);
    }

    function testRolloverExpiredEpoch_AfterGrace_MovesRemainder() public {
        uint256 genesis = voting.genesisEpochStart();

        // Lock before genesis so locks are at least 1 epoch old when voting
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);
        _lock(bob, 100 ether, FOUR_YEARS);

        // Epoch 0: bribe a tiny amount so integer division floors all claims to 0.
        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        uint256 amount = 1; // 1 wei
        vm.startPrank(briber);
        bribeToken.approve(address(depot), amount);
        depot.bribe(address(bribeToken), amount);
        vm.stopPrank();

        _voteSingle(alice, vault1);
        _voteSingle(bob, vault1);

        // Finalize epoch 0, then both claim (each gets 0).
        vm.warp(voting.genesisEpochStart() + WEEK + 1);
        assertEq(voting.currentEpoch(), 1);

        vm.prank(alice);
        assertEq(depot.claim(0, address(bribeToken)), 0);

        vm.prank(bob);
        assertEq(depot.claim(0, address(bribeToken)), 0);

        // Dust is still in the contract.
        assertEq(bribeToken.balanceOf(address(depot)), amount);

        // After grace (4 epochs) we can roll leftover forward into the current epoch.
        vm.warp(voting.genesisEpochStart() + 5 * WEEK + 1);
        assertEq(voting.currentEpoch(), 5);

        uint256 rolled = depot.rolloverExpiredEpoch(0, address(bribeToken));
        assertEq(rolled, amount);
        assertTrue(depot.isClosed(0, address(bribeToken)));
        assertEq(depot.totalBribes(5, address(bribeToken)), amount);

        // Closed epochs cannot be claimed, even if the caller had votes.
        vm.prank(alice);
        vm.expectRevert(BribeDepot.EpochClosed.selector);
        depot.claim(0, address(bribeToken));
    }

    function testClaim_RevertsAfterEpochTokenClosed() public {
        uint256 genesis = voting.genesisEpochStart();

        // Lock before genesis so locks are at least 1 epoch old when voting
        vm.warp(genesis - WEEK);
        _lock(alice, 100 ether, FOUR_YEARS);
        _lock(bob, 100 ether, FOUR_YEARS);

        // Epoch 0: bribe + votes
        vm.warp(genesis + 1);
        assertEq(voting.currentEpoch(), 0);

        uint256 amount = 1_000 ether;
        vm.startPrank(briber);
        bribeToken.approve(address(depot), amount);
        depot.bribe(address(bribeToken), amount);
        vm.stopPrank();

        _voteSingle(alice, vault1);
        _voteSingle(bob, vault1);

        // Finalize epoch 0, then let Bob claim but not Alice.
        vm.warp(voting.genesisEpochStart() + WEEK + 1);
        assertEq(voting.currentEpoch(), 1);

        vm.prank(bob);
        uint256 bobClaim = depot.claim(0, address(bribeToken));
        assertGt(bobClaim, 0);

        // After grace, close epoch 0 and roll the leftover forward.
        vm.warp(voting.genesisEpochStart() + 5 * WEEK + 1);
        assertEq(voting.currentEpoch(), 5);

        depot.rolloverExpiredEpoch(0, address(bribeToken));

        vm.prank(alice);
        vm.expectRevert(BribeDepot.EpochClosed.selector);
        depot.claim(0, address(bribeToken));
    }
}

