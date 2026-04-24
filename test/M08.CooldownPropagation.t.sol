// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../contracts/vault/CreatorOVaultWrapper.sol";

/// @dev FIX: M-08 — regression test for the wrapper-cooldown-bypass-via-ShareOFT-transfer finding.
///      The vulnerability: a user could deposit through the wrapper, transfer the resulting
///      ShareOFT to a fresh address, and have that fresh address call `withdraw` in the same
///      block — defeating the wrapper's flash-loan cooldown.
///
///      The fix (spanning `CreatorOVaultWrapper.sol` and `CreatorShareOFT.sol`) adds a
///      `propagateCooldownOnTransfer(from, to)` hook on the wrapper, callable only by the
///      registered ShareOFT. The ShareOFT's `_update` override calls the hook on every
///      non-mint/non-burn ERC20 movement, forwarding `lastWrapperDepositBlock[from]` to `to`
///      (monotonic max). This test uses a minimal mock ShareOFT that replicates the
///      `_update`-to-hook call so the property can be tested in isolation from the full
///      OFT/LayerZero stack.

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

interface IWrapperCooldownHook {
    function propagateCooldownOnTransfer(address from, address to) external;
}

/// @dev Minimal ShareOFT stand-in: same `mint`/`burn` ABI as the production `IShareOFT`,
///      plus an ERC20 `transfer` path that calls the wrapper cooldown hook exactly the way
///      CreatorShareOFT._update does. Inheriting OZ ERC20 and overriding _update gives us
///      the real-world call shape.
contract MockShareOFTWithHook is ERC20 {
    address public wrapper;

    constructor() ERC20("MockShareOFT", "mOFT") {}

    function setWrapper(address _wrapper) external {
        wrapper = _wrapper;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    function _update(address from, address to, uint256 value) internal virtual override {
        super._update(from, to, value);

        address _wrapper = wrapper;
        if (_wrapper == address(0)) return;
        if (from == address(0) || to == address(0)) return;
        if (from == to) return;
        IWrapperCooldownHook(_wrapper).propagateCooldownOnTransfer(from, to);
    }
}

contract M08CooldownPropagationTest is Test {
    MockCreatorCoin internal creatorCoin;
    MockVaultShare internal vaultShare;
    MockShareOFTWithHook internal shareOFT;
    CreatorOVaultWrapper internal wrapper;

    address internal alice = makeAddr("alice");
    address internal fresh = makeAddr("fresh");
    address internal bob = makeAddr("bob");

    function setUp() public {
        creatorCoin = new MockCreatorCoin();
        vaultShare = new MockVaultShare(address(creatorCoin));
        shareOFT = new MockShareOFTWithHook();

        wrapper = new CreatorOVaultWrapper(address(creatorCoin), address(vaultShare), address(this));
        wrapper.setShareOFT(address(shareOFT));
        shareOFT.setWrapper(address(wrapper));

        // Give alice + bob vault shares to wrap
        vaultShare.mint(alice, 10_000);
        vaultShare.mint(bob, 10_000);
        vm.prank(alice);
        vaultShare.approve(address(wrapper), type(uint256).max);
        vm.prank(bob);
        vaultShare.approve(address(wrapper), type(uint256).max);
    }

    /// @dev THE BYPASS: before the fix, alice could wrap, transfer to a fresh wallet,
    ///      and that fresh wallet could unwrap in the same block. After the fix the
    ///      fresh wallet inherits alice's cooldown and unwrap reverts until the cooldown
    ///      elapses.
    function test_M08_transferToFreshAddress_inheritsCooldown() public {
        // 1. alice wraps at block N
        vm.prank(alice);
        uint256 out = wrapper.wrap(1_000);
        assertEq(out, 1, "wrapped");
        assertEq(wrapper.lastWrapperDepositBlock(alice), block.number);

        // 2. alice transfers ShareOFT to a fresh wallet in the same block
        vm.prank(alice);
        shareOFT.transfer(fresh, 1);

        // 3. Cooldown must have propagated
        assertEq(
            wrapper.lastWrapperDepositBlock(fresh),
            wrapper.lastWrapperDepositBlock(alice),
            "cooldown propagated to transferee"
        );

        // 4. Fresh wallet attempting to unwrap in the same block must revert
        vm.prank(fresh);
        vm.expectRevert(
            abi.encodeWithSelector(
                CreatorOVaultWrapper.WrapperWithdrawTooSoon.selector,
                block.number,
                block.number + 1
            )
        );
        wrapper.unwrap(1);

        // 5. After the cooldown elapses, unwrap succeeds
        vm.roll(block.number + 1);
        vm.prank(fresh);
        uint256 sharesOut = wrapper.unwrap(1);
        assertEq(sharesOut, 1_000, "unwraps cleanly after cooldown");
    }

    /// @dev Propagation is monotonic: a later transfer must not clobber an even-newer
    ///      cooldown already held by the recipient.
    function test_M08_propagation_isMonotonicMax() public {
        // alice wraps at N
        vm.prank(alice);
        wrapper.wrap(1_000);
        uint256 aliceBlock = wrapper.lastWrapperDepositBlock(alice);

        // Advance 2 blocks
        vm.roll(block.number + 2);

        // bob wraps at N+2 (newer cooldown)
        vm.prank(bob);
        wrapper.wrap(1_000);
        uint256 bobBlock = wrapper.lastWrapperDepositBlock(bob);
        assertGt(bobBlock, aliceBlock);

        // alice sends her ShareOFT to bob — must NOT reduce bob's cooldown
        vm.prank(alice);
        shareOFT.transfer(bob, 1);

        assertEq(
            wrapper.lastWrapperDepositBlock(bob),
            bobBlock,
            "bob's newer cooldown was NOT clobbered by alice's older one"
        );
    }

    /// @dev Hook is only callable by the registered ShareOFT.
    function test_M08_hook_rejectsUnauthorizedCaller() public {
        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorOVaultWrapper.CooldownHookUnauthorizedCaller.selector, attacker)
        );
        wrapper.propagateCooldownOnTransfer(alice, fresh);
    }

    /// @dev Mints (from == 0) and burns (to == 0) are no-ops: deposit paths in the
    ///      wrapper already record the cooldown on the original depositor.
    function test_M08_hook_ignoresMintAndBurn() public {
        // Call with from == address(0) — should not touch `to`'s cooldown
        uint256 before = wrapper.lastWrapperDepositBlock(alice);

        vm.prank(address(shareOFT));
        wrapper.propagateCooldownOnTransfer(address(0), alice);
        assertEq(wrapper.lastWrapperDepositBlock(alice), before, "mint hook is a no-op");

        vm.prank(address(shareOFT));
        wrapper.propagateCooldownOnTransfer(alice, address(0));
        assertEq(wrapper.lastWrapperDepositBlock(alice), before, "burn hook is a no-op");
    }

    /// @dev Regression: alice can still wrap + unwrap in the normal (single-address) flow
    ///      after the cooldown elapses. Fix must not break the happy path.
    function test_M08_happyPath_unchanged() public {
        vm.prank(alice);
        wrapper.wrap(1_000);

        vm.roll(block.number + 1);

        vm.prank(alice);
        uint256 sharesOut = wrapper.unwrap(1);
        assertEq(sharesOut, 1_000);
    }

    /// @dev Transfers with from == to are a no-op.
    function test_M08_selfTransfer_noop() public {
        vm.prank(alice);
        wrapper.wrap(1_000);

        uint256 before = wrapper.lastWrapperDepositBlock(alice);
        vm.prank(address(shareOFT));
        wrapper.propagateCooldownOnTransfer(alice, alice);
        assertEq(wrapper.lastWrapperDepositBlock(alice), before);
    }
}
