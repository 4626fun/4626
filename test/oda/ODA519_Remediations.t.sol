// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {IAjnaPool} from "@4626/shared/interfaces/external/IAjnaPool.sol";
import {AjnaVaultLibrary} from "@4626/shared/strategies/ajna/AjnaVaultLibrary.sol";
import {AjnaVaultAuth} from "@4626/shared/strategies/ajna/AjnaVaultAuth.sol";
import {AjnaERC4626Vault} from "@4626/shared/strategies/ajna/AjnaERC4626Vault.sol";
import {ERC4626StrategyAdapter} from "@4626/shared/strategies/ERC4626StrategyAdapter.sol";

contract ODA519MockERC20 is ERC20 {
    constructor() ERC20("Q", "Q") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract ODA519MockAjnaPool is IAjnaPool {
    IERC20 public immutable quoteToken;
    address public immutable collateralToken;
    mapping(uint256 => mapping(address => uint256)) public lenderLpBalance;
    mapping(uint256 => mapping(address => uint256)) public lenderDepositTime;
    mapping(uint256 => uint256) public bucketLpTotal;
    mapping(uint256 => uint256) public bucketDeposits;
    mapping(uint256 => uint256) public bankruptcyTimes;

    constructor(address quote_, address collateral_) {
        quoteToken = IERC20(quote_);
        collateralToken = collateral_;
    }

    function setBankruptcy(uint256 index, uint256 t) external { bankruptcyTimes[index] = t; }

    function setBucketAccounting(uint256 index, uint256 lpTotal, uint256 deposits) external {
        bucketLpTotal[index] = lpTotal;
        bucketDeposits[index] = deposits;
    }

    function addQuoteToken(uint256 amount, uint256 index, uint256) external returns (uint256, uint256) {
        quoteToken.transferFrom(msg.sender, address(this), amount);
        lenderLpBalance[index][msg.sender] += amount;
        lenderDepositTime[index][msg.sender] = block.timestamp;
        bucketLpTotal[index] += amount;
        bucketDeposits[index] += amount;
        return (amount, amount);
    }

    function drawDebt(address, uint256, uint256, uint256) external {}
    function repayDebt(address, uint256, uint256, address, uint256) external pure returns (uint256) { return 0; }

    function removeQuoteToken(uint256 amount, uint256 index) external returns (uint256, uint256) {
        uint256 lpBalance = lenderLpBalance[index][msg.sender];
        // Quote-denominated: amount may be type(uint256).max for full exit.
        uint256 burnAmount = amount >= lpBalance ? lpBalance : amount;
        // If caller passed exact quote via lpToAssets (1:1 here), same.
        if (amount != type(uint256).max && amount < lpBalance) {
            // Treat as quote amount equal to LP in this 1:1 mock.
            burnAmount = amount;
        }
        lenderLpBalance[index][msg.sender] -= burnAmount;
        bucketLpTotal[index] -= burnAmount;
        bucketDeposits[index] -= burnAmount;
        quoteToken.transfer(msg.sender, burnAmount);
        return (burnAmount, burnAmount);
    }

    function moveQuoteToken(uint256 maxAmount, uint256 fromIndex, uint256 toIndex, uint256)
        external
        returns (uint256, uint256, uint256)
    {
        uint256 lpBalance = lenderLpBalance[fromIndex][msg.sender];
        uint256 moveAmount = maxAmount >= lpBalance ? lpBalance : maxAmount;
        lenderLpBalance[fromIndex][msg.sender] -= moveAmount;
        bucketLpTotal[fromIndex] -= moveAmount;
        bucketDeposits[fromIndex] -= moveAmount;
        lenderLpBalance[toIndex][msg.sender] += moveAmount;
        lenderDepositTime[toIndex][msg.sender] = block.timestamp;
        bucketLpTotal[toIndex] += moveAmount;
        bucketDeposits[toIndex] += moveAmount;
        return (moveAmount, moveAmount, moveAmount);
    }

    function lenderInfo(uint256 index, address lender) external view returns (uint256, uint256) {
        return (lenderLpBalance[index][lender], lenderDepositTime[index][lender]);
    }

    function bucketInfo(uint256 index)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256)
    {
        return (bucketLpTotal[index], 0, bankruptcyTimes[index], bucketDeposits[index], 1e18);
    }

    function borrowerInfo(address) external pure returns (uint256, uint256, uint256) { return (0, 0, 0); }
    function inflatorInfo() external view returns (uint256, uint256) { return (1e18, block.timestamp); }
    function quoteTokenAddress() external view returns (address) { return address(quoteToken); }
    function collateralAddress() external view returns (address) { return collateralToken; }
    function poolUtilization() external pure returns (uint256) { return 0; }
    function interestRate() external pure returns (uint256) { return 0; }
}

contract MockOuterVault519 {
    IERC20 public immutable ASSET;
    constructor(IERC20 a) { ASSET = a; }
    function asset() external view returns (address) { return address(ASSET); }
}

/// @notice Focused ODA-519 remediations for Charm/Ajna strategy sleeve.
contract ODA519_RemediationsTest is Test {
    ODA519MockERC20 internal asset;
    ODA519MockAjnaPool internal pool;
    AjnaVaultAuth internal auth;
    AjnaERC4626Vault internal vault;
    ERC4626StrategyAdapter internal adapter;
    MockOuterVault519 internal outer;

    address internal swapper = address(0xBEEF);

    function setUp() public {
        asset = new ODA519MockERC20();
        pool = new ODA519MockAjnaPool(address(asset), makeAddr("collat"));
        auth = new AjnaVaultAuth(address(this));
        vault = new AjnaERC4626Vault(address(pool), IERC20(address(asset)), "Ajna", "AJNA", auth);
        outer = new MockOuterVault519(IERC20(address(asset)));
        adapter = new ERC4626StrategyAdapter(address(outer), address(vault), address(this));
        // Vault entrypoints require AUTH.swapper == msg.sender.
        auth.setSwapper(swapper);

        asset.mint(swapper, 1_000e18);
        vm.prank(swapper);
        asset.approve(address(vault), type(uint256).max);
    }

    function test_519_1_postBankruptcyLpStillValued() public {
        vm.prank(swapper);
        vault.deposit(100e18, swapper);
        vm.prank(swapper);
        vault.moveFromBuffer(4156, 50e18);

        (, uint256 storedDep) = pool.lenderInfo(4156, address(vault));

        // Historic bankruptcy before our deposit — LP remains valuable.
        pool.setBankruptcy(4156, storedDep - 1);
        assertEq(
            AjnaVaultLibrary.lpToAssets(IAjnaPool(address(pool)), 4156, 50e18, address(vault)),
            50e18,
            "post-bankruptcy LP must still price"
        );

        // depositTime <= bankruptcyTime voids this lender's LP.
        pool.setBankruptcy(4156, storedDep);
        assertEq(
            AjnaVaultLibrary.lpToAssets(IAjnaPool(address(pool)), 4156, 50e18, address(vault)),
            0,
            "pre/eq bankruptcy LP void"
        );
    }

    function test_519_3_and_5_pauseAllowsMoveToBufferFullExit() public {
        vm.prank(swapper);
        vault.deposit(100e18, swapper);
        vm.prank(swapper);
        vault.moveFromBuffer(4156, 40e18);
        assertGt(vault.bucketLp(4156), 0);

        auth.pause();
        // Entries blocked
        vm.prank(swapper);
        vm.expectRevert(AjnaERC4626Vault.VaultPaused.selector);
        vault.deposit(1e18, swapper);

        // Exit drain still works (quote max path). Cache LP before prank —
        // a view arg would consume the single-use prank.
        uint256 lp = vault.bucketLp(4156);
        vm.prank(swapper);
        (uint256 pulled,) = vault.moveToBuffer(4156, lp);
        assertEq(pulled, 40e18);
        assertEq(vault.bucketLp(4156), 0);
    }

    function test_519_18_valuationGuardCannotSelfDisable() public {
        vm.expectRevert(ERC4626StrategyAdapter.InvalidBps.selector);
        adapter.setValuationGuard(10_000, 1_000, 30 minutes);
        vm.expectRevert(ERC4626StrategyAdapter.InvalidBps.selector);
        adapter.setValuationGuard(1_000, 10_000, 30 minutes);
        adapter.setValuationGuard(5_000, 5_000, 30 minutes);
    }

    function test_519_7_syncValuationPermissionless() public {
        vm.warp(block.timestamp + 1 days);
        adapter.syncValuation();
        assertEq(adapter.lastValuationTimestamp(), block.timestamp);
    }

    function test_519_3_partialZeroQuoteDoesNotFullDrain() public {
        vm.prank(swapper);
        vault.deposit(100e18, swapper);
        vm.prank(swapper);
        vault.moveFromBuffer(4156, 50e18);

        // Impair bucket so 1 wei LP prices to 0 quote: deposits << lpTotal.
        pool.setBucketAccounting(4156, /*lpTotal*/ 1e18, /*deposits*/ 1);

        vm.prank(swapper);
        vm.expectRevert(AjnaERC4626Vault.ZeroQuoteAmount.selector);
        vault.moveToBuffer(4156, 1);

        assertEq(vault.bucketLp(4156), 50e18, "partial zero-quote must not drain");
    }
}
