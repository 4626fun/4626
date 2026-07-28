// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IAjnaPool} from "@4626/shared/interfaces/external/IAjnaPool.sol";
import {AjnaERC4626Vault} from "@4626/shared/strategies/ajna/AjnaERC4626Vault.sol";
import {AjnaVaultAuth} from "@4626/shared/strategies/ajna/AjnaVaultAuth.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockAjnaPool is IAjnaPool {
    IERC20 public immutable quoteToken;
    address public immutable collateralToken;
    /// @dev When > 0, pull full `amount` but report `amount - dustAmount` as addedAmount
    ///      (Ajna empty-bucket dust behavior that previously broke vault refunds).
    uint256 public dustAmount;

    mapping(uint256 => mapping(address => uint256)) public lenderLpBalance;
    mapping(uint256 => uint256) public bucketLpTotal;
    mapping(uint256 => uint256) public bucketDeposits;

    constructor(IERC20 quote_, address collateral_) {
        quoteToken = quote_;
        collateralToken = collateral_;
    }

    function setDustAmount(uint256 dustAmount_) external {
        dustAmount = dustAmount_;
    }

    function addQuoteToken(uint256 amount, uint256 index, uint256) external returns (uint256 bucketLP, uint256 addedAmount) {
        quoteToken.transferFrom(msg.sender, address(this), amount);
        uint256 credited = amount > dustAmount ? amount - dustAmount : 0;
        lenderLpBalance[index][msg.sender] += credited;
        bucketLpTotal[index] += credited;
        bucketDeposits[index] += credited;
        return (credited, credited);
    }

    function drawDebt(address, uint256, uint256, uint256) external {}

    function repayDebt(address, uint256, uint256, address, uint256) external pure returns (uint256 amountRepaid) {
        return 0;
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

    function borrowerInfo(address) external pure returns (uint256 t0Debt, uint256 collateral, uint256 npTpRatio) {
        return (0, 0, 0);
    }

    function inflatorInfo() external view returns (uint256 inflator, uint256 lastUpdate) {
        return (1e18, block.timestamp);
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
        auth.setSwapper(user);

        asset.mint(user, 1_000e18);
        vm.prank(user);
        asset.approve(address(vault), type(uint256).max);
    }

    function _setToll(uint256 bps) internal {
        auth.setToll(bps);
        vm.warp(auth.pendingTollAt());
        auth.executeTollUpdate();
    }

    function _setTax(uint256 bps) internal {
        auth.setTax(bps);
        vm.warp(auth.pendingTaxAt());
        auth.executeTaxUpdate();
    }


    function testDepositCollectsTollAndMintsNetShares() public {
        _setToll(100);

        vm.prank(user);
        uint256 shares = vault.deposit(100e18, user);

        assertEq(shares, 99e18);
        assertEq(vault.balanceOf(user), 99e18);
        assertEq(vault.totalAssets(), 99e18);
        assertEq(vault.bufferAssets(), 99e18);
        assertEq(asset.balanceOf(address(this)), 1e18);
    }

    function testAdminCannotBypassSwapperGuardForDeposit() public {
        asset.mint(address(this), 100e18);
        asset.approve(address(vault), type(uint256).max);
        vm.expectRevert(AjnaERC4626Vault.NotAuthorized.selector);
        vault.deposit(100e18, address(this));
    }

    function testMintCollectsTollAndMintsRequestedShares() public {
        _setToll(100);

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

        _setTax(100);

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

        // moveFromBuffer is swapper-only (user is swapper).
        // M-14: default 5% buffer floor still allows moving 90 of 100.
        vm.prank(user);
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

        // moveFromBuffer is swapper-only (user); keepers only pull back via moveToBuffer.
        vm.prank(user);
        vm.expectRevert();
        vault.moveFromBuffer(4_156, 81e18);

        vm.prank(user);
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

        // ODA-519-5: pause blocks entries only — exits remain available.
        vm.prank(user);
        vault.redeem(10e18, user, user);
        assertEq(vault.balanceOf(user), 0);
    }

    function testMaxWithdrawRoundsDownNetAssetsWhenTaxIsSet() public {
        vm.prank(user);
        vault.deposit(101, user);

        _setTax(100);

        assertEq(vault.maxWithdraw(user), 99);
    }

    function testPreviewRedeemRoundsDownNetAssetsWhenTaxIsSet() public {
        vm.prank(user);
        vault.deposit(101, user);

        _setTax(100);

        assertEq(vault.previewRedeem(101), 99);
    }

    function testMoveFromBufferRejectsBucketIndexAboveAjnaRange() public {
        vm.prank(user);
        vault.deposit(100e18, user);

        auth.setKeeper(keeper, true);

        vm.prank(user);
        vm.expectRevert();
        vault.moveFromBuffer(7_389, 10e18);
    }

    function testKeeperCannotMoveFromBuffer() public {
        vm.prank(user);
        vault.deposit(100e18, user);

        auth.setKeeper(keeper, true);

        vm.prank(keeper);
        vm.expectRevert(AjnaERC4626Vault.NotAuthorized.selector);
        vault.moveFromBuffer(4_156, 10e18);
    }

    function testNonKeeperCannotCallMoveFunctions() public {
        vm.prank(user);
        vault.deposit(100e18, user);

        vm.prank(keeper);
        vm.expectRevert(AjnaERC4626Vault.NotAuthorized.selector);
        vault.moveFromBuffer(4_156, 10e18);
    }

    function testMoveToBufferAllowedWhilePausedForKeeper() public {
        vm.prank(user);
        vault.deposit(100e18, user);

        auth.setKeeper(keeper, true);
        vm.prank(user);
        vault.moveFromBuffer(4_156, 10e18);
        auth.pause();

        // ODA-519-5: emergency drain / exit liquidity must work while paused.
        vm.prank(keeper);
        (uint256 pulled,) = vault.moveToBuffer(4_156, 1e18);
        assertEq(pulled, 1e18);
        assertEq(vault.bucketLp(4_156), 9e18);
    }

    function testMoveFromBufferRefundsActualBalanceWhenPoolKeepsDust() public {
        // Reproduce AKITA live failure mode: pool pulls full assets but returns
        // slightly lower movedAssets. Refunding assets-movedAssets under-funds.
        pool.setDustAmount(7);

        vm.prank(user);
        vault.deposit(100e18, user);

        uint256 bufferBefore = vault.bufferAssets();
        vm.prank(user);
        (uint256 moved, uint256 lp) = vault.moveFromBuffer(4_156, 90e18);

        assertEq(moved, 90e18 - 7);
        assertEq(lp, 90e18 - 7);
        // Dust stayed in the pool; vault must not attempt a phantom refund.
        assertEq(asset.balanceOf(address(vault)), 0);
        // Buffer kept the unmoved floor (10e18) — no double-deposit / revert.
        assertEq(vault.bufferAssets(), bufferBefore - 90e18);
        assertEq(vault.bucketLp(4_156), 90e18 - 7);
    }
}
