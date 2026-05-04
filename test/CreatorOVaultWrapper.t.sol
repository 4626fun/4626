// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../contracts/vault/CreatorOVaultWrapper.sol";

contract MockCreatorCoin is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockVaultShare is ERC20 {
    ERC20 public immutable assetToken;

    constructor(address _asset) ERC20("Vault Share", "vSHARE") {
        assetToken = ERC20(_asset);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        assetToken.transferFrom(msg.sender, address(this), assets);
        shares = assets;
        _mint(receiver, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        _burn(owner, shares);
        assetToken.transfer(receiver, shares);
        return shares;
    }

    function previewDeposit(uint256 assets) external pure returns (uint256) {
        return assets;
    }

    function previewRedeem(uint256 shares) external pure returns (uint256) {
        return shares;
    }

    function totalAssets() external view returns (uint256) {
        return assetToken.balanceOf(address(this));
    }
}

contract MockShareOFT {
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function burn(address from, uint256 amount) external {
        balanceOf[from] -= amount;
        totalSupply -= amount;
    }
}

contract CreatorOVaultWrapperTest is Test {
    MockCreatorCoin internal creatorCoin;
    MockVaultShare internal vaultShare;
    MockShareOFT internal shareOFT;
    CreatorOVaultWrapper internal wrapper;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal composer = makeAddr("composer");
    address internal sweepRecipient = makeAddr("sweepRecipient");

    function setUp() public {
        creatorCoin = new MockCreatorCoin();
        vaultShare = new MockVaultShare(address(creatorCoin));
        shareOFT = new MockShareOFT();

        wrapper = new CreatorOVaultWrapper(address(creatorCoin), address(vaultShare), address(this));
        wrapper.setShareOFT(address(shareOFT));

        _mintVaultSharesAndApprove(alice, 10_000);
        _mintVaultSharesAndApprove(bob, 10_000);
    }

    function test_wrap_tracksRemainderPerUser() public {
        vm.prank(alice);
        uint256 out = wrapper.wrap(1001);

        assertEq(out, 1);
        assertEq(shareOFT.balanceOf(alice), 1);
        assertEq(wrapper.userDustShares(alice), 1);
        assertEq(wrapper.totalUserDustShares(), 1);
        assertEq(wrapper.totalLocked(), 1001);
        assertEq(wrapper.totalMinted(), 1);
        assertTrue(wrapper.isBalanced());
        assertTrue(wrapper.verify());
    }

    function test_secondWrap_consumesOwnDust() public {
        vm.prank(alice);
        wrapper.wrap(1001);

        vm.prank(alice);
        uint256 out2 = wrapper.wrap(999);

        assertEq(out2, 1);
        assertEq(shareOFT.balanceOf(alice), 2);
        assertEq(wrapper.userDustShares(alice), 0);
        assertEq(wrapper.totalUserDustShares(), 0);
        assertEq(wrapper.totalLocked(), 2000);
        assertEq(wrapper.totalMinted(), 2);
    }

    function test_dust_isNotTransferableAcrossUsers() public {
        vm.prank(alice);
        wrapper.wrap(1001);

        vm.prank(bob);
        vm.expectRevert(CreatorOVaultWrapper.AmountTooSmallToNormalize.selector);
        wrapper.wrap(999);

        assertEq(wrapper.userDustShares(alice), 1);
        assertEq(wrapper.userDustShares(bob), 0);
        assertEq(shareOFT.balanceOf(bob), 0);
    }

    function test_unwrap_returnsUserDust() public {
        vm.prank(alice);
        wrapper.wrap(1001);

        vm.roll(block.number + 1);

        vm.prank(alice);
        uint256 sharesOut = wrapper.unwrap(1);

        assertEq(sharesOut, 1001);
        assertEq(vaultShare.balanceOf(alice), 10_000);
        assertEq(shareOFT.balanceOf(alice), 0);
        assertEq(wrapper.userDustShares(alice), 0);
        assertEq(wrapper.totalUserDustShares(), 0);
        assertEq(wrapper.totalLocked(), 0);
        assertEq(wrapper.totalMinted(), 0);
        assertTrue(wrapper.isBalanced());
        assertTrue(wrapper.verify());
    }

    function test_wrap_reverts_whenOutputZeroAfterFees() public {
        wrapper.setFees(1000, 0); // 10% wrap fee

        vm.prank(alice);
        vm.expectRevert(CreatorOVaultWrapper.AmountTooSmallToNormalize.selector);
        wrapper.wrap(1000); // after fee = 900, with zero dust -> 0 normalized mint
    }

    function test_depositFor_revertsForUntrustedThirdPartyAttribution() public {
        creatorCoin.mint(alice, 2_000);
        vm.prank(alice);
        creatorCoin.approve(address(wrapper), type(uint256).max);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorOVaultWrapper.UnauthorizedBeneficiaryOperator.selector, alice, bob)
        );
        wrapper.depositFor(1_000, 0, bob);
    }

    function test_depositFor_tracksDustPerBeneficiary() public {
        wrapper.setBeneficiaryOperator(composer, true);

        creatorCoin.mint(composer, 2_000);
        vm.prank(composer);
        creatorCoin.approve(address(wrapper), type(uint256).max);

        vm.prank(composer);
        uint256 firstOut = wrapper.depositFor(1_001, 0, alice);
        assertEq(firstOut, 1);
        assertEq(shareOFT.balanceOf(composer), 1);
        assertEq(wrapper.userDustShares(alice), 1);
        assertEq(wrapper.userDustShares(bob), 0);

        vm.prank(composer);
        vm.expectRevert(CreatorOVaultWrapper.AmountTooSmallToNormalize.selector);
        wrapper.depositFor(999, 0, bob);

        vm.prank(composer);
        uint256 secondOut = wrapper.depositFor(999, 0, alice);
        assertEq(secondOut, 1);
        assertEq(shareOFT.balanceOf(composer), 2);
        assertEq(wrapper.userDustShares(alice), 0);
        assertEq(wrapper.userDustShares(bob), 0);
    }

    function test_withdrawFor_consumesBeneficiaryDust() public {
        wrapper.setBeneficiaryOperator(composer, true);

        creatorCoin.mint(composer, 1_001);
        vm.prank(composer);
        creatorCoin.approve(address(wrapper), type(uint256).max);

        vm.prank(composer);
        wrapper.depositFor(1_001, 0, alice);
        assertEq(wrapper.userDustShares(alice), 1);
        assertEq(shareOFT.balanceOf(composer), 1);

        // Advance past per-user wrapper cooldown (M-01 fix)
        vm.roll(block.number + 1);

        vm.prank(composer);
        uint256 creatorOut = wrapper.withdrawFor(1, 0, alice);
        assertEq(creatorOut, 1_001);
        assertEq(wrapper.userDustShares(alice), 0);
        assertEq(shareOFT.balanceOf(composer), 0);
    }

    function test_verify_and_isBalanced_includeDust() public {
        vm.prank(alice);
        wrapper.wrap(1001);

        assertEq(wrapper.requiredLockedBacking(), 1001);
        assertEq(wrapper.totalLocked(), 1001);
        assertTrue(wrapper.isBalanced());
        assertTrue(wrapper.verify());
    }

    function test_emergencyWithdraw_cannotDrainBackedVaultShares() public {
        vm.prank(alice);
        wrapper.wrap(1001);

        vm.expectRevert(CreatorOVaultWrapper.InsufficientLocked.selector);
        wrapper.emergencyWithdraw(address(vaultShare), sweepRecipient, 1);

        // Simulate accidental extra share transfer to wrapper.
        vaultShare.mint(address(wrapper), 50);

        vm.expectRevert(CreatorOVaultWrapper.InsufficientLocked.selector);
        wrapper.emergencyWithdraw(address(vaultShare), sweepRecipient, 51);

        wrapper.emergencyWithdraw(address(vaultShare), sweepRecipient, 50);
        assertEq(vaultShare.balanceOf(sweepRecipient), 50);
        assertEq(vaultShare.balanceOf(address(wrapper)), wrapper.requiredLockedBacking());
    }

    function _mintVaultSharesAndApprove(address user, uint256 amount) internal {
        vaultShare.mint(user, amount);
        vm.prank(user);
        vaultShare.approve(address(wrapper), type(uint256).max);
    }
}
