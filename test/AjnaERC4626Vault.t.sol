// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IAjnaPool} from "../contracts/interfaces/IAjnaPool.sol";
import {AjnaERC4626Vault} from "../contracts/vault/strategies/ajna4626/AjnaERC4626Vault.sol";
import {AjnaVaultAuth} from "../contracts/vault/strategies/ajna4626/AjnaVaultAuth.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockAjnaPool is IAjnaPool {
    IERC20 public immutable quoteToken;
    address public immutable collateralToken;

    mapping(uint256 => mapping(address => uint256)) public lenderLpBalance;
    mapping(uint256 => uint256) public bucketLpTotal;
    mapping(uint256 => uint256) public bucketDeposits;

    constructor(IERC20 quote_, address collateral_) {
        quoteToken = quote_;
        collateralToken = collateral_;
    }

    function addQuoteToken(uint256 amount, uint256 index, uint256) external returns (uint256 bucketLP, uint256 addedAmount) {
        quoteToken.transferFrom(msg.sender, address(this), amount);
        lenderLpBalance[index][msg.sender] += amount;
        bucketLpTotal[index] += amount;
        bucketDeposits[index] += amount;
        return (amount, amount);
    }

    function removeQuoteToken(uint256 amount, uint256 index)
        external
        returns (uint256 removedAmount, uint256 redeemedLP)
    {
        uint256 lpBalance = lenderLpBalance[index][msg.sender];
        uint256 burnAmount = amount > lpBalance ? lpBalance : amount;

        lenderLpBalance[index][msg.sender] -= burnAmount;
        bucketLpTotal[index] -= burnAmount;
        bucketDeposits[index] -= burnAmount;

        quoteToken.transfer(msg.sender, burnAmount);
        return (burnAmount, burnAmount);
    }

    function moveQuoteToken(uint256 maxAmount, uint256 fromIndex, uint256 toIndex, uint256)
        external
        returns (uint256 fromBucketLP, uint256 toBucketLP, uint256 movedAmount)
    {
        uint256 lpBalance = lenderLpBalance[fromIndex][msg.sender];
        uint256 moveAmount = maxAmount > lpBalance ? lpBalance : maxAmount;

        lenderLpBalance[fromIndex][msg.sender] -= moveAmount;
        bucketLpTotal[fromIndex] -= moveAmount;
        bucketDeposits[fromIndex] -= moveAmount;

        lenderLpBalance[toIndex][msg.sender] += moveAmount;
        bucketLpTotal[toIndex] += moveAmount;
        bucketDeposits[toIndex] += moveAmount;

        return (moveAmount, moveAmount, moveAmount);
    }

    function lenderInfo(uint256 index, address lender) external view returns (uint256 lpBalance, uint256 depositTime) {
        return (lenderLpBalance[index][lender], block.timestamp);
    }

    function bucketInfo(uint256 index)
        external
        view
        returns (uint256 lpBalance, uint256 collateral, uint256 bankruptcyTime, uint256 deposit, uint256 scale)
    {
        return (bucketLpTotal[index], 0, 0, bucketDeposits[index], 1e18);
    }

    function quoteTokenAddress() external view returns (address) {
        return address(quoteToken);
    }

    function collateralAddress() external view returns (address) {
        return collateralToken;
    }

    function poolUtilization() external pure returns (uint256) {
        return 0;
    }

    function interestRate() external pure returns (uint256) {
        return 0;
    }
}

contract AjnaERC4626VaultTest is Test {
    MockERC20 internal asset;
    MockERC20 internal collateral;
    MockAjnaPool internal pool;
    AjnaVaultAuth internal auth;
    AjnaERC4626Vault internal vault;

    address internal user = address(0xBEEF);
    address internal keeper = address(0xCAFE);

    function setUp() public {
        asset = new MockERC20("Creator", "CREATOR");
        collateral = new MockERC20("USD Coin", "USDC");
        pool = new MockAjnaPool(IERC20(address(asset)), address(collateral));
        auth = new AjnaVaultAuth(address(this));
        vault = new AjnaERC4626Vault(address(pool), IERC20(address(asset)), "Ajna Inner Vault", "AIV", auth);

        asset.mint(user, 1_000e18);
        vm.prank(user);
        asset.approve(address(vault), type(uint256).max);
    }

    function testDepositCollectsTollAndMintsNetShares() public {
        auth.setToll(100);

        vm.prank(user);
        uint256 shares = vault.deposit(100e18, user);

        assertEq(shares, 99e18);
        assertEq(vault.balanceOf(user), 99e18);
        assertEq(vault.totalAssets(), 99e18);
        assertEq(vault.bufferAssets(), 99e18);
        assertEq(asset.balanceOf(address(this)), 1e18);
    }

    function testMintCollectsTollAndMintsRequestedShares() public {
        auth.setToll(100);

        vm.prank(user);
        uint256 assetsIn = vault.mint(99e18, user);

        assertEq(assetsIn, 100e18);
        assertEq(vault.balanceOf(user), 99e18);
        assertEq(vault.totalAssets(), 99e18);
        assertEq(vault.bufferAssets(), 99e18);
        assertEq(asset.balanceOf(address(this)), 1e18);
    }

    function testRedeemAppliesTaxAndReturnsNetAssets() public {
        vm.prank(user);
        vault.deposit(100e18, user);

        auth.setTax(100);

        vm.prank(user);
        uint256 assetsOut = vault.redeem(100e18, user, user);

        assertEq(assetsOut, 99e18);
        assertEq(asset.balanceOf(user), 999e18);
        assertEq(asset.balanceOf(address(this)), 1e18);
        assertEq(vault.totalSupply(), 0);
        assertEq(vault.bufferAssets(), 0);
    }

    function testWithdrawRevertsWhenBufferLiquidityIsInsufficient() public {
        vm.prank(user);
        vault.deposit(100e18, user);

        auth.setKeeper(keeper, true);

        vm.prank(keeper);
        vault.moveFromBuffer(4_156, 90e18);

        vm.prank(user);
        vm.expectRevert();
        vault.withdraw(11e18, user, user);
    }

    function testKeeperMoveFromBufferRespectsConfiguredRatioAndMoveToBufferRestoresLiquidity() public {
        vm.prank(user);
        vault.deposit(100e18, user);

        auth.setKeeper(keeper, true);
        auth.setBufferRatio(2_000);

        vm.prank(keeper);
        vm.expectRevert();
        vault.moveFromBuffer(4_156, 81e18);

        vm.prank(keeper);
        vault.moveFromBuffer(4_156, 80e18);

        assertEq(vault.bufferAssets(), 20e18);
        assertEq(vault.bucketLp(4_156), 80e18);
        assertEq(vault.totalAssets(), 100e18);

        vm.prank(keeper);
        vault.moveToBuffer(4_156, 30e18);

        assertEq(vault.bufferAssets(), 50e18);
        assertEq(vault.bucketLp(4_156), 50e18);
        assertEq(vault.totalAssets(), 100e18);
    }

    function testPauseAndDepositCapGuardsUserFlows() public {
        auth.setDepositCap(50e18);

        vm.prank(user);
        vm.expectRevert();
        vault.deposit(60e18, user);

        auth.pause();

        vm.prank(user);
        vm.expectRevert();
        vault.deposit(10e18, user);

        auth.unpause();

        vm.prank(user);
        vault.deposit(10e18, user);

        auth.pause();

        vm.prank(user);
        vm.expectRevert();
        vault.redeem(10e18, user, user);
    }

    function testMaxWithdrawRoundsDownNetAssetsWhenTaxIsSet() public {
        vm.prank(user);
        vault.deposit(101, user);

        auth.setTax(100);

        assertEq(vault.maxWithdraw(user), 99);
    }

    function testPreviewRedeemRoundsDownNetAssetsWhenTaxIsSet() public {
        vm.prank(user);
        vault.deposit(101, user);

        auth.setTax(100);

        assertEq(vault.previewRedeem(101), 99);
    }

    function testMoveFromBufferRejectsBucketIndexAboveAjnaRange() public {
        vm.prank(user);
        vault.deposit(100e18, user);

        auth.setKeeper(keeper, true);

        vm.prank(keeper);
        vm.expectRevert();
        vault.moveFromBuffer(7_389, 10e18);
    }
}
