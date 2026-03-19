// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IAjnaPool} from "../contracts/interfaces/IAjnaPool.sol";
import {ERC4626StrategyAdapter} from "../contracts/vault/strategies/ERC4626StrategyAdapter.sol";
import {AjnaERC4626Vault} from "../contracts/vault/strategies/ajna4626/AjnaERC4626Vault.sol";
import {AjnaVaultAuth} from "../contracts/vault/strategies/ajna4626/AjnaVaultAuth.sol";

contract MockAdapterERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockAdapterAjnaPool is IAjnaPool {
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

contract MockCreatorOVaultLike {
    IERC20 public immutable CREATOR_COIN;

    constructor(IERC20 asset_) {
        CREATOR_COIN = asset_;
    }
}

contract ERC4626StrategyAdapterAjnaInnerVaultTest is Test {
    MockAdapterERC20 internal asset;
    MockAdapterERC20 internal collateral;
    MockAdapterAjnaPool internal pool;
    AjnaVaultAuth internal auth;
    AjnaERC4626Vault internal innerVault;
    MockCreatorOVaultLike internal outerVault;
    ERC4626StrategyAdapter internal adapter;

    address internal keeper = address(0xCAFE);

    function setUp() public {
        asset = new MockAdapterERC20("Creator", "CREATOR");
        collateral = new MockAdapterERC20("USD Coin", "USDC");
        pool = new MockAdapterAjnaPool(IERC20(address(asset)), address(collateral));
        auth = new AjnaVaultAuth(address(this));
        innerVault = new AjnaERC4626Vault(address(pool), IERC20(address(asset)), "Ajna Inner Vault", "AIV", auth);
        outerVault = new MockCreatorOVaultLike(IERC20(address(asset)));
        adapter = new ERC4626StrategyAdapter(address(outerVault), address(innerVault), address(this));
        auth.setSwapper(address(adapter));

        asset.mint(address(outerVault), 1_000e18);

        vm.prank(address(outerVault));
        asset.approve(address(adapter), type(uint256).max);
    }

    function testDepositKeepsAssetsIdleWhenInnerVaultIsPaused() public {
        auth.pause();

        vm.prank(address(outerVault));
        uint256 deposited = adapter.deposit(100e18);

        assertEq(deposited, 100e18);
        assertEq(asset.balanceOf(address(adapter)), 100e18);
        assertEq(innerVault.totalAssets(), 0);
        assertEq(adapter.getTotalAssets(), 100e18);
    }

    function testWithdrawReturnsOnlyAdapterIdleWhenInnerBufferIsEmpty() public {
        vm.prank(address(outerVault));
        adapter.deposit(100e18);

        auth.setSwapper(keeper);

        vm.prank(keeper);
        innerVault.moveFromBuffer(4_156, 90e18);

        uint256 beforeBalance = asset.balanceOf(address(outerVault));

        vm.prank(address(outerVault));
        uint256 withdrawn = adapter.withdraw(50e18);

        uint256 afterBalance = asset.balanceOf(address(outerVault));

        assertEq(withdrawn, 10e18);
        assertEq(afterBalance - beforeBalance, 10e18);
        assertEq(innerVault.bufferAssets(), 0);
        assertEq(adapter.getTotalAssets(), 90e18);
    }

    function testValuationReadyRemainsTrueWithAjnaBucketExposure() public {
        vm.prank(address(outerVault));
        adapter.deposit(100e18);

        auth.setSwapper(keeper);

        vm.prank(keeper);
        innerVault.moveFromBuffer(4_156, 90e18);

        assertTrue(adapter.isValuationReady());
        assertEq(adapter.getTotalAssets(), 100e18);
    }
}
