// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {CreatorOVault} from "@4626/creator/vault/CreatorOVault.sol";
import {OVaultAdminModule} from "@4626/shared/vault/modules/OVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "@4626/creator/vault/modules/CreatorOVaultCoreModule.sol";
import {OVaultStrategiesModule} from "@4626/shared/vault/modules/OVaultStrategiesModule.sol";
import {OVaultImpairmentClaims} from "@4626/shared/vault/recovery/OVaultImpairmentClaims.sol";
import {OVaultRecoveryEscrow} from "@4626/shared/vault/recovery/OVaultRecoveryEscrow.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IStrategy} from "@4626/shared/interfaces/strategies/IStrategy.sol";
import {IStrategyValuation} from "@4626/shared/interfaces/strategies/IStrategyValuation.sol";

contract MockCreatorCoinImp is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ImpairmentMockStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    bool public valuationReady = true;
    uint256 public trackedAssets;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function setValuationReady(bool ready) external {
        valuationReady = ready;
    }

    function isValuationReady() external view override returns (bool) {
        return valuationReady;
    }

    function isActive() external pure override returns (bool) {
        return true;
    }

    function asset() external view override returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external view override returns (uint256) {
        return trackedAssets;
    }

    function deposit(uint256 amount) external override returns (uint256 deposited) {
        if (amount == 0) return 0;
        require(TOKEN.transferFrom(msg.sender, address(this), amount), "transferFrom failed");
        trackedAssets += amount;
        return amount;
    }

    function withdraw(uint256 amount) external override returns (uint256 withdrawn) {
        withdrawn = amount > trackedAssets ? trackedAssets : amount;
        if (withdrawn == 0) return 0;
        trackedAssets -= withdrawn;
        require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
    }

    function emergencyWithdraw() external override returns (uint256 withdrawn) {
        withdrawn = trackedAssets;
        trackedAssets = 0;
        if (withdrawn > 0) require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
    }

    function harvest() external pure override returns (uint256) {
        return 0;
    }

    function rebalance() external override {}
}

contract CreatorOVaultImpairmentV1Test is Test {
    uint256 internal constant INITIAL_DEPOSIT = 50_000_000e18;

    MockCreatorCoinImp internal creatorCoin;
    CreatorOVault internal vault;
    OVaultImpairmentClaims internal claims;
    OVaultRecoveryEscrow internal escrow;

    address internal alice;
    ImpairmentMockStrategy internal strat;

    function setUp() public {
        alice = _pickEmptyCodeAddress("impairment-alice");
        creatorCoin = new MockCreatorCoinImp();
        vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovCR8R");

        address coreModule = address(new CreatorOVaultCoreModule());
        address strategiesModule = address(new OVaultStrategiesModule());
        address adminModule = address(new OVaultAdminModule());
        vault.setModulesOnce(coreModule, strategiesModule, adminModule);

        claims = new OVaultImpairmentClaims(address(this));
        escrow = new OVaultRecoveryEscrow(address(this));
        claims.setVault(address(vault));
        escrow.setVault(address(vault));
        vault.setImpairmentClaims(address(claims));
        vault.setImpairmentRecoveryEscrow(address(escrow));
        vault.setImpairmentChallengeWindow(1 hours);

        vault.setFlashLoanProtection(0, 1e18, 2);

        creatorCoin.mint(alice, INITIAL_DEPOSIT);
        vm.prank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);
        vm.prank(alice);
        vault.deposit(INITIAL_DEPOSIT, alice);

        strat = new ImpairmentMockStrategy(address(creatorCoin));
        vault.addStrategy(address(strat), 5_000, true);
        vault.deployToStrategies();
    }

    function _pickEmptyCodeAddress(string memory seed) internal view returns (address candidate) {
        for (uint256 i = 0; i < 32; i++) {
            candidate = address(uint160(uint256(keccak256(abi.encode(seed, i)))));
            if (candidate.code.length == 0) return candidate;
        }
        return address(0xA11CE);
    }

    function test_trip_blocksSyncFlows_untilFinalize() public {
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        assertEq(epochId, 1);
        assertEq(uint8(vault.vaultMode()), 1);

        vm.prank(alice);
        vm.expectRevert();
        vault.deposit(1e18, alice);

        vm.prank(alice);
        vm.expectRevert();
        vault.withdraw(1e18, alice, alice);

        assertEq(vault.maxDeposit(alice), 0);
        assertEq(vault.maxMint(alice), 0);
        assertEq(vault.maxWithdraw(alice), 0);
        assertEq(vault.maxRedeem(alice), 0);

        vm.expectRevert();
        vault.deployToStrategies();

        vm.expectRevert();
        vault.tend();

        vm.expectRevert();
        vault.rebalanceStrategies(500);
    }

    function test_finalize_allowsCleanBook_resume_and_claim_flow() public {
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        bytes32 leaf = keccak256(abi.encode(epochId, alice, vault.balanceOf(alice)));
        vault.proposeImpairmentRoot(epochId, leaf, vault.balanceOf(alice), address(creatorCoin));

        vm.warp(block.timestamp + 1 hours + 1);
        vault.finalizeImpairment(epochId);
        assertEq(uint8(vault.vaultMode()), 0);
        assertTrue(vault.strategyImpaired(address(strat)));

        creatorCoin.mint(address(vault), 100e18);
        vault.notifyImpairmentRecovery(epochId, 100e18);
        vault.mintImpairmentClaim(epochId, alice, vault.balanceOf(alice), new bytes32[](0));
        uint256 claimBal = claims.balanceOf(alice, epochId);

        vm.prank(alice);
        uint256 claimed = vault.claimImpairmentRecovery(epochId, alice, claimBal);
        assertEq(claimed, 100e18);
        assertEq(creatorCoin.balanceOf(alice), claimed);
    }

    function test_finalize_reverts_before_challenge_window() public {
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        bytes32 leaf = keccak256(abi.encode(epochId, alice, vault.balanceOf(alice)));
        vault.proposeImpairmentRoot(epochId, leaf, vault.balanceOf(alice), address(creatorCoin));
        vm.expectRevert();
        vault.finalizeImpairment(epochId);
    }

    function test_challenge_blocks_finalize_until_root_cleared_and_reproposed() public {
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        bytes32 leaf = keccak256(abi.encode(epochId, alice, vault.balanceOf(alice)));
        vault.proposeImpairmentRoot(epochId, leaf, vault.balanceOf(alice), address(creatorCoin));
        vault.challengeImpairmentRoot(epochId, "bad-root");
        vm.warp(block.timestamp + 1 hours + 1);
        vm.expectRevert();
        vault.finalizeImpairment(epochId);
        vault.clearImpairmentRootAfterChallenge(epochId);
        vault.proposeImpairmentRoot(epochId, leaf, vault.balanceOf(alice), address(creatorCoin));
        uint64 unlock = vault.impairmentRootUnlockTime(epochId);
        vm.warp(unlock + 1);
        vault.finalizeImpairment(epochId);
        (CreatorOVault.ImpairmentEpochStatus status,,,,,,,,,,,,,) = vault.impairmentEpochs(epochId);
        assertEq(uint8(status), 2);
    }

    function test_claimMint_reverts_before_finalize() public {
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        uint256 aliceShares = vault.balanceOf(alice);
        bytes32 leaf = keccak256(abi.encode(epochId, alice, aliceShares));
        vault.proposeImpairmentRoot(epochId, leaf, aliceShares, address(creatorCoin));
        (CreatorOVault.ImpairmentEpochStatus status,,,,,,,,,,,,,) = vault.impairmentEpochs(epochId);
        assertEq(uint8(status), 1);
        vm.expectRevert();
        vault.mintImpairmentClaim(epochId, alice, aliceShares, new bytes32[](0));
    }

    function test_claimMint_reverts_on_duplicate_mint() public {
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        uint256 aliceShares = vault.balanceOf(alice);
        bytes32 leaf = keccak256(abi.encode(epochId, alice, aliceShares));
        vault.proposeImpairmentRoot(epochId, leaf, aliceShares, address(creatorCoin));
        vm.warp(block.timestamp + 1 hours + 1);
        vault.finalizeImpairment(epochId);
        vault.mintImpairmentClaim(epochId, alice, aliceShares, new bytes32[](0));
        assertEq(claims.balanceOf(alice, epochId), aliceShares);
        vm.expectRevert();
        vault.mintImpairmentClaim(epochId, alice, aliceShares, new bytes32[](0));
    }

    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    /// FIX C-2: a hostile/over-stated root whose leaves sum past
    /// totalClaimSupply must not be able to mint claims beyond the cap.
    function test_claimMint_overMint_reverts_pastTotalClaimSupply() public {
        address bob = _pickEmptyCodeAddress("impairment-bob");
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        uint256 aliceShares = vault.balanceOf(alice);

        // Two leaves each claiming the FULL claim supply (sum = 2x cap).
        bytes32 leafAlice = keccak256(abi.encode(epochId, alice, aliceShares));
        bytes32 leafBob = keccak256(abi.encode(epochId, bob, aliceShares));
        bytes32 root = _hashPair(leafAlice, leafBob);
        vault.proposeImpairmentRoot(epochId, root, aliceShares, address(creatorCoin));
        vm.warp(block.timestamp + 1 hours + 1);
        vault.finalizeImpairment(epochId);

        bytes32[] memory proofAlice = new bytes32[](1);
        proofAlice[0] = leafBob;
        vault.mintImpairmentClaim(epochId, alice, aliceShares, proofAlice);
        assertEq(claims.totalSupply(epochId), aliceShares);

        bytes32[] memory proofBob = new bytes32[](1);
        proofBob[0] = leafAlice;
        vm.expectRevert(
            abi.encodeWithSelector(
                CreatorOVault.ClaimSupplyExceeded.selector, epochId, aliceShares, aliceShares * 2
            )
        );
        vault.mintImpairmentClaim(epochId, bob, aliceShares, proofBob);
        assertEq(claims.totalSupply(epochId), aliceShares);
    }

    /// FIX C-3: clearing a false-alarm trip must destroy the claim surface
    /// created by any root proposed during the trip.
    function test_clearTrip_zeroesRoot_and_blocksClaimSurface() public {
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        uint256 aliceShares = vault.balanceOf(alice);
        bytes32 leaf = keccak256(abi.encode(epochId, alice, aliceShares));
        vault.proposeImpairmentRoot(epochId, leaf, aliceShares, address(creatorCoin));
        assertGt(vault.impairmentRootUnlockTime(epochId), 0);

        vault.clearImpairmentTrip(epochId);

        (
            CreatorOVault.ImpairmentEpochStatus status,
            ,
            address recoveryAsset,
            ,
            ,
            ,
            ,
            ,
            ,
            uint256 totalClaimSupply,
            ,
            bytes32 snapshotRoot,
            ,
        ) = vault.impairmentEpochs(epochId);
        assertEq(uint8(status), 3); // Resolved
        assertEq(snapshotRoot, bytes32(0));
        assertEq(totalClaimSupply, 0);
        assertEq(recoveryAsset, address(0));
        assertEq(vault.impairmentRootUnlockTime(epochId), 0);
        assertFalse(vault.impairmentRootChallenged(epochId));

        vm.expectRevert(abi.encodeWithSelector(CreatorOVault.ImpairmentRootRequired.selector, epochId));
        vault.mintImpairmentClaim(epochId, alice, aliceShares, new bytes32[](0));

        vm.expectRevert(abi.encodeWithSelector(CreatorOVault.ImpairmentRootRequired.selector, epochId));
        vault.notifyImpairmentRecovery(epochId, 1e18);
    }

    /// FIX H-1: zero-amount notify must revert instead of writing state/events.
    function test_notifyRecovery_zeroAmount_reverts() public {
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        uint256 aliceShares = vault.balanceOf(alice);
        bytes32 leaf = keccak256(abi.encode(epochId, alice, aliceShares));
        vault.proposeImpairmentRoot(epochId, leaf, aliceShares, address(creatorCoin));
        vm.warp(block.timestamp + 1 hours + 1);
        vault.finalizeImpairment(epochId);

        vm.expectRevert(CreatorOVault.InvalidAmount.selector);
        vault.notifyImpairmentRecovery(epochId, 0);
    }

    /// FIX H-1: when the recovery asset is the creator coin, notify must sync
    /// the tracked coinBalance so totalAssets() drops by the escrowed amount
    /// instead of double-counting it (vault book + escrow).
    function test_notifyRecovery_creatorCoin_decrementsTotalAssets() public {
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        uint256 aliceShares = vault.balanceOf(alice);
        bytes32 leaf = keccak256(abi.encode(epochId, alice, aliceShares));
        vault.proposeImpairmentRoot(epochId, leaf, aliceShares, address(creatorCoin));
        vm.warp(block.timestamp + 1 hours + 1);
        vault.finalizeImpairment(epochId);

        uint256 totalAssetsBefore = vault.totalAssets();
        uint256 escrowBefore = creatorCoin.balanceOf(address(escrow));
        uint256 ppsBefore = vault.convertToAssets(1e18);
        uint256 amount = 100e18;
        assertGe(totalAssetsBefore, amount);

        vault.notifyImpairmentRecovery(epochId, amount);

        assertEq(creatorCoin.balanceOf(address(escrow)), escrowBefore + amount);
        assertEq(vault.totalAssets(), totalAssetsBefore - amount);
        // Share price reflects the outflow honestly — the escrowed amount is
        // no longer double-counted in the vault book.
        assertLt(vault.convertToAssets(1e18), ppsBefore);
    }

    // =================================
    // FIX: M-2 (docs/audits/CreatorOVault_aristotle) — Suspect-mode liveness bound
    // =================================

    function test_maxImpairmentTripDuration_defaultsTo14Days() public view {
        assertEq(vault.maxImpairmentTripDuration(), 14 days);
    }

    function test_setMaxImpairmentTripDuration_revertsOutOfBounds() public {
        // Cache the bound constants BEFORE arming `vm.expectRevert` — it fires on the very
        // next external call/staticcall, including argument-evaluation calls.
        uint64 min = vault.MIN_IMPAIRMENT_TRIP_DURATION();
        uint64 max = vault.MAX_IMPAIRMENT_TRIP_DURATION();

        vm.expectRevert(
            abi.encodeWithSelector(CreatorOVault.InvalidImpairmentTripDuration.selector, min - 1, min, max)
        );
        vault.setMaxImpairmentTripDuration(min - 1);

        vm.expectRevert(
            abi.encodeWithSelector(CreatorOVault.InvalidImpairmentTripDuration.selector, max + 1, min, max)
        );
        vault.setMaxImpairmentTripDuration(max + 1);
    }

    function test_setMaxImpairmentTripDuration_appliesWithinBounds() public {
        vault.setMaxImpairmentTripDuration(7 days);
        assertEq(vault.maxImpairmentTripDuration(), 7 days);
    }

    /// A stranger cannot clear a Tripped epoch early — the permissionless path only
    /// fires once `maxImpairmentTripDuration` has actually elapsed since the trip.
    function test_clearStaleImpairmentTrip_revertsBeforeDeadline() public {
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        uint64 staleAt = uint64(block.timestamp) + vault.maxImpairmentTripDuration();

        address stranger = _pickEmptyCodeAddress("impairment-stranger");
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorOVault.ImpairmentTripNotStale.selector, epochId, staleAt)
        );
        vault.clearStaleImpairmentTrip(epochId);
    }

    /// Once `maxImpairmentTripDuration` has elapsed with the impairment authority never
    /// having acted, ANY address can force the epoch back to Normal — the liveness valve
    /// M-2 asked for. The vault becomes depositable/withdrawable again and the strategy
    /// can be re-tripped (it is no longer "impaired") if it's still actually broken.
    function test_clearStaleImpairmentTrip_succeedsAfterDeadline_andUnfreezesVault() public {
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        assertEq(uint8(vault.vaultMode()), 1); // Suspect

        vm.warp(block.timestamp + vault.maxImpairmentTripDuration());

        address stranger = _pickEmptyCodeAddress("impairment-stranger");
        vm.expectEmit(true, true, true, true);
        emit CreatorOVault.ImpairmentTripClearedByTimeout(epochId, address(strat), stranger);
        vm.prank(stranger);
        vault.clearStaleImpairmentTrip(epochId);

        assertEq(uint8(vault.vaultMode()), 0); // Normal
        assertFalse(vault.strategyImpaired(address(strat)));

        (CreatorOVault.ImpairmentEpochStatus status,,,,,,,,,,,,,) = vault.impairmentEpochs(epochId);
        assertEq(uint8(status), 3); // Resolved

        // Vault is usable again for ordinary deposit flows.
        creatorCoin.mint(alice, 1e18);
        vm.prank(alice);
        vault.deposit(1e18, alice);

        // Strategy is no longer marked impaired, so it can be re-tripped if still broken.
        uint256 newEpochId = vault.tripImpairment(address(strat), 1);
        assertEq(newEpochId, epochId + 1);
    }

    /// The timeout clear is a hard bound on Suspect-mode duration regardless of internal
    /// sub-state — even if a root has already been proposed and is sitting in (or past)
    /// its own challenge window, a stranger can still force-clear once the *overall* trip
    /// has outlived `maxImpairmentTripDuration`. Governance controls both durations and is
    /// expected to size `maxImpairmentTripDuration` comfortably longer than its expected
    /// propose+challenge+finalize turnaround.
    function test_clearStaleImpairmentTrip_worksEvenWithProposedRoot() public {
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        uint256 aliceShares = vault.balanceOf(alice);
        bytes32 leaf = keccak256(abi.encode(epochId, alice, aliceShares));
        vault.proposeImpairmentRoot(epochId, leaf, aliceShares, address(creatorCoin));
        assertGt(vault.impairmentRootUnlockTime(epochId), 0);

        vm.warp(block.timestamp + vault.maxImpairmentTripDuration());

        address stranger = _pickEmptyCodeAddress("impairment-stranger-2");
        vm.prank(stranger);
        vault.clearStaleImpairmentTrip(epochId);

        assertEq(uint8(vault.vaultMode()), 0);
        assertEq(vault.impairmentRootUnlockTime(epochId), 0);
        assertFalse(vault.impairmentRootChallenged(epochId));
    }

    /// The permissionless timeout path must not interfere with the ordinary authorized
    /// clear path while the trip is still fresh (no regression vs. pre-M-2 behavior).
    function test_clearImpairmentTrip_authorized_stillWorksBeforeDeadline() public {
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        vault.clearImpairmentTrip(epochId);
        assertEq(uint8(vault.vaultMode()), 0);
        assertFalse(vault.strategyImpaired(address(strat)));
    }

    /// Once an epoch is already Resolved (by either clear path) or Finalized, the
    /// permissionless timeout path must not be replayable against it.
    function test_clearStaleImpairmentTrip_revertsOnAlreadyResolvedEpoch() public {
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        vault.clearImpairmentTrip(epochId);

        vm.expectRevert(abi.encodeWithSelector(CreatorOVault.InvalidImpairmentEpoch.selector, epochId));
        vault.clearStaleImpairmentTrip(epochId);
    }

    /// ODA-427-F1: per-epoch challenge cap stops indefinite challenge→clear→re-propose grief.
    function test_challengeCap_blocksIndefiniteGrief() public {
        vault.setMaxImpairmentChallengesPerEpoch(2);
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        bytes32 leaf = keccak256(abi.encode(epochId, alice, vault.balanceOf(alice)));

        for (uint256 i = 0; i < 2; i++) {
            vault.proposeImpairmentRoot(epochId, leaf, vault.balanceOf(alice), address(creatorCoin));
            vault.challengeImpairmentRoot(epochId, "grief");
            vault.clearImpairmentRootAfterChallenge(epochId);
        }

        vault.proposeImpairmentRoot(epochId, leaf, vault.balanceOf(alice), address(creatorCoin));
        vm.expectRevert(abi.encodeWithSelector(CreatorOVault.ImpairmentChallengeCapExceeded.selector, epochId, uint8(2)));
        vault.challengeImpairmentRoot(epochId, "too-many");

        // Unchallenged root can still finalize after the window.
        uint64 unlock = vault.impairmentRootUnlockTime(epochId);
        vm.warp(unlock + 1);
        vault.finalizeImpairment(epochId);
        (CreatorOVault.ImpairmentEpochStatus status,,,,,,,,,,,,,) = vault.impairmentEpochs(epochId);
        assertEq(uint8(status), 2);
    }

    /// ODA-427-F1: reject unfounded challenge slashes bond and keeps the root.
    function test_rejectImpairmentChallenge_slashesBondAndKeepsRoot() public {
        uint256 bond = 0.1 ether;
        vault.setImpairmentChallengeBond(bond);

        uint256 epochId = vault.tripImpairment(address(strat), 1);
        bytes32 leaf = keccak256(abi.encode(epochId, alice, vault.balanceOf(alice)));
        vault.proposeImpairmentRoot(epochId, leaf, vault.balanceOf(alice), address(creatorCoin));

        address challenger = makeAddr("challenger");
        vm.deal(challenger, 1 ether);
        vm.prank(challenger);
        vault.challengeImpairmentRoot{value: bond}(epochId, "bad");
        assertTrue(vault.impairmentRootChallenged(epochId));
        assertEq(vault.impairmentChallengeBondHeld(epochId), bond);

        uint256 vaultEthBefore = address(vault).balance;
        vault.rejectImpairmentChallenge(epochId);
        assertFalse(vault.impairmentRootChallenged(epochId));
        (,,,,,,,,,,, bytes32 root,,) = vault.impairmentEpochs(epochId);
        assertTrue(root != bytes32(0), "root must remain after reject");
        // Fee recipient is risk-timelocked; slash retains ETH in the vault by default.
        assertEq(address(vault).balance, vaultEthBefore);
        assertEq(vault.impairmentChallengeBondHeld(epochId), 0);
        assertEq(challenger.balance, 1 ether - bond);

        uint64 unlock = vault.impairmentRootUnlockTime(epochId);
        vm.warp(unlock + 1);
        vault.finalizeImpairment(epochId);
    }
}

