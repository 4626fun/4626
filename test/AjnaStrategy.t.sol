// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/vault/strategies/AjnaStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @dev Simple ERC20 for testing
 */
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * 10 ** 18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title MockAjnaPool
 * @dev Mock Ajna pool for testing
 */
contract MockAjnaPool {
    mapping(uint256 => mapping(address => uint256)) public lenderLP;
    mapping(uint256 => uint256) public bucketDeposits;
    mapping(uint256 => uint256) public bucketTotalLP;

    IERC20 public quoteToken;
    IERC20 public collateralToken;

    constructor(address _quoteToken, address _collateralToken) {
        quoteToken = IERC20(_quoteToken);
        collateralToken = IERC20(_collateralToken);
    }

    function addQuoteToken(
        uint256 amount,
        uint256 index,
        uint256 /* expiry */
    )
        external
        returns (uint256 lpReceived, uint256 addedAmount)
    {
        // Transfer tokens from user
        quoteToken.transferFrom(msg.sender, address(this), amount);

        // Mint LP 1:1 for simplicity
        lpReceived = amount;
        addedAmount = amount;

        // Update tracking
        lenderLP[index][msg.sender] += lpReceived;
        bucketDeposits[index] += addedAmount;
        bucketTotalLP[index] += lpReceived;

        return (lpReceived, addedAmount);
    }

    function removeQuoteToken(uint256 lpAmount, uint256 index)
        external
        returns (uint256 removedAmount, uint256 redeemedLP)
    {
        require(lenderLP[index][msg.sender] >= lpAmount, "Insufficient LP");

        // Calculate amount to return (1:1 for simplicity)
        uint256 userShare = (lpAmount * bucketDeposits[index]) / bucketTotalLP[index];
        removedAmount = userShare;
        redeemedLP = lpAmount;

        // Update tracking
        lenderLP[index][msg.sender] -= redeemedLP;
        bucketTotalLP[index] -= redeemedLP;
        bucketDeposits[index] -= userShare;

        // Transfer tokens back
        quoteToken.transfer(msg.sender, removedAmount);

        return (removedAmount, redeemedLP);
    }

    function moveQuoteToken(
        uint256 lpAmount,
        uint256 fromIndex,
        uint256 toIndex,
        uint256 /* expiry */
    )
        external
        returns (uint256 fromLP, uint256 toLP, uint256 movedAmount)
    {
        require(lenderLP[fromIndex][msg.sender] >= lpAmount, "Insufficient LP");

        // Calculate amount being moved
        movedAmount = (lpAmount * bucketDeposits[fromIndex]) / bucketTotalLP[fromIndex];

        // Remove from source bucket
        lenderLP[fromIndex][msg.sender] -= lpAmount;
        bucketTotalLP[fromIndex] -= lpAmount;
        bucketDeposits[fromIndex] -= movedAmount;

        // Add to destination bucket
        lenderLP[toIndex][msg.sender] += lpAmount;
        bucketTotalLP[toIndex] += lpAmount;
        bucketDeposits[toIndex] += movedAmount;

        return (lpAmount, lpAmount, movedAmount);
    }

    function lenderInfo(uint256 index, address lender) external view returns (uint256 lpBalance, uint256 depositTime) {
        return (lenderLP[index][lender], block.timestamp);
    }

    function bucketInfo(uint256 index)
        external
        view
        returns (uint256 lpBalance, uint256 collateral, uint256 bankruptcyTime, uint256 deposit, uint256 scale)
    {
        return (bucketTotalLP[index], 0, 0, bucketDeposits[index], 1e18);
    }

    function quoteTokenAddress() external view returns (address) {
        return address(quoteToken);
    }

    function collateralAddress() external view returns (address) {
        return address(collateralToken);
    }

    function poolUtilization() external pure returns (uint256) {
        return 5000; // 50% utilization
    }

    function interestRate() external pure returns (uint256) {
        return 500; // 5% APY
    }
}

/**
 * @title MockAjnaPoolFactory
 * @dev Minimal Ajna factory mock (standard ERC20 non-subset pools)
 */
contract MockAjnaPoolFactory {
    bytes32 internal constant _ERC20_NON_SUBSET_HASH =
        0x2263c4378b4920f0bef611a3ff22c506afa4745b3319c50b6d704a874990b8b2;

    address public pool;
    address public collateral;
    address public quote;

    function setPool(address _pool, address _collateral, address _quote) external {
        pool = _pool;
        collateral = _collateral;
        quote = _quote;
    }

    function ERC20_NON_SUBSET_HASH() external pure returns (bytes32) {
        return _ERC20_NON_SUBSET_HASH;
    }

    function MIN_RATE() external pure returns (uint256) {
        return 1e16;
    }

    function MAX_RATE() external pure returns (uint256) {
        return 1e17;
    }

    function deployedPools(bytes32 subsetHash, address _collateral, address _quote) external view returns (address) {
        if (subsetHash != _ERC20_NON_SUBSET_HASH) return address(0);
        if (_collateral == collateral && _quote == quote) return pool;
        return address(0);
    }

    function deployPool(
        address _collateral,
        address _quote,
        uint256 /* rate */
    )
        external
        view
        returns (address)
    {
        require(_collateral == collateral, "collateral mismatch");
        require(_quote == quote, "quote mismatch");
        require(pool != address(0), "pool not set");
        return pool;
    }
}

/**
 * @title MockVault
 * @dev Mock vault for testing
 */
contract MockVault {
    function deposit(uint256, address) external pure returns (uint256) {
        return 0;
    }
}

/**
 * @title AjnaStrategyTest
 * @dev Comprehensive test suite for AjnaStrategy
 */
contract AjnaStrategyTest is Test {
    AjnaStrategy public strategy;
    MockERC20 public creatorToken;
    MockERC20 public quoteToken;
    MockAjnaPool public ajnaPool;
    MockAjnaPoolFactory public ajnaFactory;
    MockVault public vault;

    address public owner = address(this);
    address public user = address(0x1);

    uint256 constant DEPOSIT_AMOUNT = 100 * 10 ** 18; // 100 tokens

    event StrategyDeposit(uint256 amount, uint256 shares);
    event StrategyWithdraw(uint256 amount, uint256 shares);
    event YieldHarvested(uint256 amount, uint256 timestamp);

    function setUp() public {
        // Deploy tokens
        creatorToken = new MockERC20("AKITA", "AKITA");
        quoteToken = new MockERC20("WETH", "WETH");

        // Deploy mock vault
        vault = new MockVault();

        // Deploy mock Ajna pool
        ajnaPool = new MockAjnaPool(address(creatorToken), address(quoteToken));

        // Deploy mock Ajna factory + wire pool
        ajnaFactory = new MockAjnaPoolFactory();
        ajnaFactory.setPool(address(ajnaPool), address(quoteToken), address(creatorToken));

        // Deploy strategy
        strategy = new AjnaStrategy(
            address(vault),
            address(creatorToken),
            address(ajnaFactory),
            address(quoteToken), // collateral token
            owner
        );
        strategy.initializeApprovals();

        // Fund vault to simulate transfers
        creatorToken.mint(address(vault), 1000 * 10 ** 18);
    }

    function testDeployment() public {
        assertEq(strategy.vault(), address(vault));
        assertEq(strategy.asset(), address(creatorToken));
        assertEq(strategy.ajnaPool(), address(ajnaPool));
        assertEq(strategy.bucketIndex(), 4156);
        assertTrue(strategy.isActive());
    }

    function testDepositToAjna() public {
        // Approve strategy to pull from vault
        vm.prank(address(vault));
        creatorToken.approve(address(strategy), DEPOSIT_AMOUNT);

        // Deposit (strategy pulls from vault)
        vm.prank(address(vault));
        uint256 deposited = strategy.deposit(DEPOSIT_AMOUNT);

        assertEq(deposited, DEPOSIT_AMOUNT);
        assertEq(strategy.getTotalAssets(), DEPOSIT_AMOUNT);
    }

    function testWithdrawFromAjna() public {
        // First deposit
        testDepositToAjna();

        // Withdraw
        vm.prank(address(vault));
        uint256 withdrawn = strategy.withdraw(DEPOSIT_AMOUNT / 2);

        assertGt(withdrawn, 0);
        assertEq(strategy.getTotalAssets(), DEPOSIT_AMOUNT / 2);
    }

    function testBalanceCalculation() public {
        // Deposit
        testDepositToAjna();

        // Balance should equal deposit (LP:deposit ratio is 1:1 in mock)
        uint256 balance = strategy.getTotalAssets();
        assertEq(balance, DEPOSIT_AMOUNT);
    }

    function testHarvestYield() public {
        // harvest is intentionally a no-op; profit is captured via vault.report() on totalAssets delta
        vm.prank(address(vault));
        uint256 harvested = strategy.harvest();
        assertEq(harvested, 0);
    }

    function testSetBucketIndex() public {
        uint256 newIndex = 4000;

        strategy.setBucketIndex(newIndex);

        assertEq(strategy.bucketIndex(), newIndex);
    }

    function testCannotChangeBucketWithFunds() public {
        // Deposit first
        testDepositToAjna();

        // Try to change bucket - should fail
        vm.expectRevert("Move liquidity before changing bucket");
        strategy.setBucketIndex(4000);
    }

    function testMoveToBucket() public {
        // Deposit to initial bucket
        testDepositToAjna();

        uint256 newBucket = 4000;

        // Move to new bucket
        strategy.moveToBucket(newBucket, 0); // 0 = move all

        assertEq(strategy.bucketIndex(), newBucket);
    }

    function testInvalidBucketIndex() public {
        vm.expectRevert("Invalid bucket index");
        strategy.setBucketIndex(8000); // > 7388
    }

    function testEmergencyWithdraw() public {
        // Deposit
        testDepositToAjna();

        uint256 balanceBefore = creatorToken.balanceOf(address(vault));

        // Emergency withdraw
        vm.prank(address(vault));
        uint256 withdrawn = strategy.emergencyWithdraw();

        uint256 balanceAfter = creatorToken.balanceOf(address(vault));

        assertGt(withdrawn, 0);
        assertEq(balanceAfter - balanceBefore, withdrawn);
        assertFalse(strategy.isActive()); // Strategy should be paused
    }

    function testPauseUnpause() public {
        assertTrue(strategy.isActive());

        // Pause
        strategy.setActive(false);
        assertFalse(strategy.isActive());

        // Try to deposit while paused
        vm.prank(address(vault));
        vm.expectRevert(AjnaStrategy.StrategyPaused.selector);
        strategy.deposit(DEPOSIT_AMOUNT);

        // Unpause
        strategy.setActive(true);
        assertTrue(strategy.isActive());
    }

    function testOnlyVaultCanDeposit() public {
        vm.prank(user);
        vm.expectRevert(AjnaStrategy.OnlyVault.selector);
        strategy.deposit(DEPOSIT_AMOUNT);
    }

    function testOnlyVaultCanWithdraw() public {
        vm.prank(user);
        vm.expectRevert(AjnaStrategy.OnlyVault.selector);
        strategy.withdraw(DEPOSIT_AMOUNT);
    }

    function testOnlyVaultCanHarvest() public {
        vm.prank(user);
        vm.expectRevert(AjnaStrategy.OnlyVault.selector);
        strategy.harvest();
    }

    function testViewFunctions() public {
        testDepositToAjna();

        // Test all view functions
        assertEq(strategy.asset(), address(creatorToken));
        assertGt(strategy.getTotalAssets(), 0);
        assertTrue(strategy.isActive());
        assertEq(strategy.name(), "Ajna Lending Strategy");
        assertEq(strategy.yieldSource(), "Ajna Protocol - Permissionless Lending");
        assertEq(strategy.estimatedAPY(), 500); // 5%
    }

    function testRebalance() public {
        // Rebalance is a no-op for Ajna but should not revert
        vm.prank(address(vault));
        strategy.rebalance();
    }

    function testWithdrawMoreThanDeposited() public {
        testDepositToAjna();

        vm.prank(address(vault));
        uint256 withdrawn = strategy.withdraw(DEPOSIT_AMOUNT * 2);
        // Strategy should return as much as it can (up to total assets), not revert.
        assertEq(withdrawn, DEPOSIT_AMOUNT);
        assertEq(strategy.getTotalAssets(), 0);
    }

    function testMultipleDepositsAndWithdrawals() public {
        // Deposit 1
        vm.prank(address(vault));
        creatorToken.approve(address(strategy), DEPOSIT_AMOUNT);
        vm.prank(address(vault));
        strategy.deposit(DEPOSIT_AMOUNT);

        // Deposit 2
        vm.prank(address(vault));
        creatorToken.approve(address(strategy), DEPOSIT_AMOUNT);
        vm.prank(address(vault));
        strategy.deposit(DEPOSIT_AMOUNT);

        uint256 totalDeposited = DEPOSIT_AMOUNT * 2;
        assertEq(strategy.getTotalAssets(), totalDeposited);

        // Withdraw half
        vm.prank(address(vault));
        uint256 withdrawn1 = strategy.withdraw(totalDeposited / 2);
        assertGt(withdrawn1, 0);
        assertGt(strategy.getTotalAssets(), 0);

        // Withdraw another quarter
        vm.prank(address(vault));
        uint256 withdrawn2 = strategy.withdraw(totalDeposited / 4);
        assertGt(withdrawn2, 0);
        assertGt(strategy.getTotalAssets(), 0);

        // Multiple deposits and withdrawals work correctly
        assertTrue(withdrawn1 > 0 && withdrawn2 > 0);
    }

    function testZeroDeposit() public {
        vm.prank(address(vault));
        uint256 deposited = strategy.deposit(0);

        assertEq(deposited, 0);
    }

    function testZeroWithdraw() public {
        vm.prank(address(vault));
        uint256 withdrawn = strategy.withdraw(0);

        assertEq(withdrawn, 0);
    }

    function testRescueTokens() public {
        // Mint some other token to strategy
        MockERC20 otherToken = new MockERC20("OTHER", "OTHER");
        otherToken.mint(address(strategy), 100 * 10 ** 18);

        uint256 balanceBefore = otherToken.balanceOf(owner);

        // Rescue tokens
        strategy.rescueTokens(address(otherToken), 100 * 10 ** 18, owner);

        uint256 balanceAfter = otherToken.balanceOf(owner);
        assertEq(balanceAfter - balanceBefore, 100 * 10 ** 18);
    }

    function testCannotRescueCreatorTokenWhenActive() public {
        vm.expectRevert("Cannot rescue creator token when active");
        strategy.rescueTokens(address(creatorToken), 100 * 10 ** 18, owner);
    }
}
