// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {CreatorOVault} from "../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultAdminModule} from "../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";
import {CreatorOImpairmentClaims} from "../contracts/vault/CreatorOImpairmentClaims.sol";
import {CreatorORecoveryEscrow} from "../contracts/vault/CreatorORecoveryEscrow.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IStrategy} from "../contracts/interfaces/IStrategy.sol";
import {IStrategyValuation} from "../contracts/interfaces/IStrategyValuation.sol";

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
    CreatorOImpairmentClaims internal claims;
    CreatorORecoveryEscrow internal escrow;

    address internal alice;
    ImpairmentMockStrategy internal strat;

    function setUp() public {
        alice = _pickEmptyCodeAddress("impairment-alice");
        creatorCoin = new MockCreatorCoinImp();
        vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovCR8R");

        address coreModule = address(new CreatorOVaultCoreModule());
        address strategiesModule = address(new CreatorOVaultStrategiesModule());
        address adminModule = address(new CreatorOVaultAdminModule());
        vault.setModulesOnce(coreModule, strategiesModule, adminModule);

        claims = new CreatorOImpairmentClaims(address(this));
        escrow = new CreatorORecoveryEscrow(address(this));
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
}

