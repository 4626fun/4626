// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {CreatorOVault} from "../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultWrapper} from "../contracts/vault/CreatorOVaultWrapper.sol";

contract MockCreatorCoin is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

abstract contract MintBurnToken is ERC20 {
    address public owner;
    mapping(address => bool) public isMinter;

    error NotOwner();
    error NotMinter();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyMinter() {
        if (!isMinter[msg.sender]) revert NotMinter();
        _;
    }

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        owner = msg.sender;
    }

    function setMinter(address minter, bool status) external onlyOwner {
        isMinter[minter] = status;
    }

    function mint(address to, uint256 amount) external virtual;
    function burn(address from, uint256 amount) external virtual;
}

contract GoodShareOFT is MintBurnToken {
    constructor() MintBurnToken("Good ShareOFT", "gOFT") {}

    function mint(address to, uint256 amount) external override onlyMinter {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external override onlyMinter {
        _burn(from, amount);
    }
}

contract NoOpMintShareOFT is MintBurnToken {
    constructor() MintBurnToken("No-op Mint ShareOFT", "nMINT") {}

    function mint(
        address,
        /*to*/
        uint256 /*amount*/
    )
        external
        override
        onlyMinter
    {
        // no-op
    }

    function burn(address from, uint256 amount) external override onlyMinter {
        _burn(from, amount);
    }
}

contract NoOpBurnShareOFT is MintBurnToken {
    constructor() MintBurnToken("No-op Burn ShareOFT", "nBURN") {}

    function mint(address to, uint256 amount) external override onlyMinter {
        _mint(to, amount);
    }

    function burn(
        address,
        /*from*/
        uint256 /*amount*/
    )
        external
        override
        onlyMinter
    {
        // no-op
    }
}

contract CreatorOVaultWrapperShareOFTValidationTest is Test {
    address internal alice = makeAddr("alice");

    function _deploySystem()
        internal
        returns (MockCreatorCoin coin, CreatorOVault vault, CreatorOVaultWrapper wrapper)
    {
        coin = new MockCreatorCoin();
        vault = new CreatorOVault(address(coin), address(this), "Creator OVault", "ovTEST");
        wrapper = new CreatorOVaultWrapper(address(coin), address(vault), address(this));
    }

    function test_setShareOFT_revertsForEOA() public {
        (,, CreatorOVaultWrapper wrapper) = _deploySystem();

        vm.expectRevert(abi.encodeWithSelector(CreatorOVaultWrapper.ShareOFTNotContract.selector, alice));
        wrapper.setShareOFT(alice);
    }

    function test_setShareOFT_isOneTimeOnly() public {
        (,, CreatorOVaultWrapper wrapper) = _deploySystem();

        GoodShareOFT token1 = new GoodShareOFT();
        GoodShareOFT token2 = new GoodShareOFT();

        wrapper.setShareOFT(address(token1));

        vm.expectRevert(CreatorOVaultWrapper.ShareOFTAlreadySet.selector);
        wrapper.setShareOFT(address(token2));
    }

    function test_deposit_revertsWhen_shareOFT_mintIsNoOp() public {
        (MockCreatorCoin coin, CreatorOVault vault, CreatorOVaultWrapper wrapper) = _deploySystem();

        NoOpMintShareOFT share = new NoOpMintShareOFT();
        wrapper.setShareOFT(address(share));
        share.setMinter(address(wrapper), true);

        uint256 amount = vault.MINIMUM_FIRST_DEPOSIT();
        coin.mint(alice, amount);

        vm.prank(alice);
        coin.approve(address(wrapper), type(uint256).max);

        vm.prank(alice);
        uint256 expectedOut = wrapper.previewDeposit(amount);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                CreatorOVaultWrapper.ShareOFTMintBalanceMismatch.selector, alice, uint256(0), uint256(0), expectedOut
            )
        );
        wrapper.deposit(amount);

        // All state should revert atomically.
        assertEq(coin.balanceOf(alice), amount);
        assertEq(coin.balanceOf(address(wrapper)), 0);
        assertEq(coin.balanceOf(address(vault)), 0);
        assertEq(vault.totalSupply(), 0);
        assertEq(wrapper.totalLocked(), 0);
        assertEq(wrapper.totalMinted(), 0);
        assertEq(share.balanceOf(alice), 0);
    }

    function test_withdraw_revertsWhen_shareOFT_burnIsNoOp() public {
        (MockCreatorCoin coin, CreatorOVault vault, CreatorOVaultWrapper wrapper) = _deploySystem();

        NoOpBurnShareOFT share = new NoOpBurnShareOFT();
        wrapper.setShareOFT(address(share));
        share.setMinter(address(wrapper), true);

        uint256 amount = vault.MINIMUM_FIRST_DEPOSIT();
        coin.mint(alice, amount);

        vm.startPrank(alice);
        coin.approve(address(wrapper), type(uint256).max);
        uint256 shareOut = wrapper.deposit(amount);

        assertEq(share.balanceOf(alice), shareOut);
        assertEq(wrapper.totalMinted(), shareOut);
        assertEq(wrapper.totalLocked(), shareOut * wrapper.NORMALIZATION_FACTOR());

        vm.expectRevert(
            abi.encodeWithSelector(
                CreatorOVaultWrapper.ShareOFTBurnBalanceMismatch.selector, alice, shareOut, shareOut, shareOut
            )
        );
        wrapper.withdraw(shareOut);
        vm.stopPrank();

        // Withdrawal should not proceed and wrapper accounting stays intact.
        assertEq(share.balanceOf(alice), shareOut);
        assertEq(wrapper.totalMinted(), shareOut);
        assertEq(wrapper.totalLocked(), shareOut * wrapper.NORMALIZATION_FACTOR());
        assertTrue(wrapper.verify());
    }

    function test_depositThenWithdraw_succeedsWithWellBehavedShareOFT() public {
        (MockCreatorCoin coin, CreatorOVault vault, CreatorOVaultWrapper wrapper) = _deploySystem();

        GoodShareOFT share = new GoodShareOFT();
        wrapper.setShareOFT(address(share));
        share.setMinter(address(wrapper), true);

        uint256 bootstrapAmount = vault.MINIMUM_FIRST_DEPOSIT();
        uint256 smallAmount = 1e18;
        coin.mint(alice, bootstrapAmount + smallAmount);

        vm.startPrank(alice);
        coin.approve(address(wrapper), type(uint256).max);

        uint256 bootstrapShares = wrapper.deposit(bootstrapAmount);
        uint256 smallShares = wrapper.deposit(smallAmount);
        assertEq(share.balanceOf(alice), bootstrapShares + smallShares);
        assertTrue(wrapper.verify());

        // Vault flashloan/MEV protection requires 1 block delay after the wrapper receives shares.
        vm.roll(block.number + 1);

        uint256 expectedOut = wrapper.previewWithdraw(smallShares);
        uint256 coinOut = wrapper.withdraw(smallShares);
        vm.stopPrank();

        assertEq(coinOut, expectedOut);
        assertEq(share.balanceOf(alice), bootstrapShares);
        assertEq(coin.balanceOf(alice), coinOut);
        assertTrue(wrapper.verify());
    }
}

