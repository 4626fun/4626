// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CreatorCharmStrategy} from "../../contracts/vault/strategies/univ3/CreatorCharmStrategy.sol";
import {IAjnaPool, IAjnaPoolFactory} from "../../contracts/interfaces/IAjnaPool.sol";
import {IUniswapV3Factory} from "../../contracts/interfaces/uniswap/IUniswapV3Factory.sol";
import {IUniswapV3Pool} from "../../contracts/interfaces/uniswap/IUniswapV3Pool.sol";

contract ForkCharmOracleMock {
    int256 public priceUsd18;
    bool public fresh;
    uint256 public ajnaBucketFromV3Twap;
    bool public revertAjnaBucket;

    function setPrice(int256 _priceUsd18, bool _fresh) external {
        priceUsd18 = _priceUsd18;
        fresh = _fresh;
    }

    function setAjnaBucketFromV3Twap(uint256 bucket, bool shouldRevert_) external {
        ajnaBucketFromV3Twap = bucket;
        revertAjnaBucket = shouldRevert_;
    }

    function isPriceFresh() external view returns (bool) {
        return fresh;
    }

    function getCreatorPrice() external view returns (int256 price, uint256 ts) {
        return (priceUsd18, block.timestamp);
    }

    function getAjnaBucketFromV3TWAP(uint32) external view returns (uint256 bucketIndex) {
        if (revertAjnaBucket) revert("NO_BUCKET");
        return ajnaBucketFromV3Twap;
    }
}

contract ForkCharmVaultMock {
    address public token0;
    address public token1;
    address public pool;

    uint256 public totalSupply;
    uint256 public total0;
    uint256 public total1;
    uint256 public withdrawAmount0;
    uint256 public withdrawAmount1;
    uint256 public lastDepositAmount0;
    uint256 public lastDepositAmount1;
    address public lastDepositTo;
    uint256 public depositCallCount;
    uint256 public withdrawCallCount;

    mapping(address => uint256) public balanceOf;

    constructor(address token0_, address token1_) {
        token0 = token0_;
        token1 = token1_;
    }

    function setPool(address pool_) external {
        pool = pool_;
    }

    function setTotalSupply(uint256 value) external {
        totalSupply = value;
    }

    function setTotalAmounts(uint256 amount0, uint256 amount1) external {
        total0 = amount0;
        total1 = amount1;
    }

    function setBalance(address account, uint256 value) external {
        balanceOf[account] = value;
    }

    function setWithdrawAmounts(uint256 amount0, uint256 amount1) external {
        withdrawAmount0 = amount0;
        withdrawAmount1 = amount1;
    }

    function getTotalAmounts() external view returns (uint256, uint256) {
        return (total0, total1);
    }

    function deposit(uint256 amount0, uint256 amount1, uint256, uint256, address to)
        external
        returns (uint256 shares, uint256 used0, uint256 used1)
    {
        depositCallCount += 1;
        if (amount0 > 0) IERC20(token0).transferFrom(msg.sender, address(this), amount0);
        if (amount1 > 0) IERC20(token1).transferFrom(msg.sender, address(this), amount1);
        lastDepositAmount0 = amount0;
        lastDepositAmount1 = amount1;
        lastDepositTo = to;
        return (amount0 + amount1, amount0, amount1);
    }

    function withdraw(uint256, uint256, uint256, address to) external returns (uint256 amount0, uint256 amount1) {
        withdrawCallCount += 1;
        amount0 = withdrawAmount0;
        amount1 = withdrawAmount1;
        if (amount0 > 0) IERC20(token0).transfer(to, amount0);
        if (amount1 > 0) IERC20(token1).transfer(to, amount1);
    }

    function baseLower() external pure returns (int24) {
        return -887200;
    }

    function baseUpper() external pure returns (int24) {
        return 887200;
    }
}

contract CreatorCharmStrategyForkIntegrationTest is Test {
    event StrategyRebalanced(uint256 newTotalAssets);

    // Base mainnet addresses
    address internal constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant WETH = 0x4200000000000000000000000000000000000006;
    address internal constant UNISWAP_V3_FACTORY = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD;
    address internal constant UNISWAP_V3_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address internal constant AJNA_FACTORY = 0x214f62B5836D83f3D6c4f71F174209097B1A779C;

    bool internal forkEnabled;
    ForkCharmVaultMock internal charm;
    CreatorCharmStrategy internal strategy;

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;

        vm.createSelectFork(rpc);
        forkEnabled = true;

        address swapPool = _findUsdcWethPool();
        require(swapPool != address(0), "missing USDC/WETH pool");

        charm = new ForkCharmVaultMock(WETH, USDC);
        charm.setPool(swapPool);

        strategy = new CreatorCharmStrategy(
            address(this), WETH, USDC, UNISWAP_V3_ROUTER, address(charm), swapPool, address(this)
        );

        strategy.setUniFactory(UNISWAP_V3_FACTORY);
        strategy.setAutoFeeTier(true);
    }

    function testFork_withdraw_realRouter_revertsWhenMinOutTooStrict() external {
        if (!forkEnabled) return;

        strategy.setParameters(5, 0, 500, 3000); // swap slippage = 0 bps
        strategy.initializeApprovals();

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 5_000e6);
        charm.setWithdrawAmounts(0, 5_000e6);

        deal(USDC, address(charm), 5_000e6);

        vm.expectRevert(
            abi.encodeWithSelector(CreatorCharmStrategy.WithdrawLiquidityUnavailable.selector, 1e18, 0)
        );
        strategy.withdraw(1e18);
    }

    function testFork_withdraw_realAjnaBorrow_satisfiesResidual() external {
        if (!forkEnabled) return;

        ForkCharmOracleMock oracle = new ForkCharmOracleMock();
        oracle.setPrice(3000e18, true); // conservative WETH oracle price for collateral checks
        oracle.setAjnaBucketFromV3Twap(7_300, false);
        strategy.setCreatorOracle(address(oracle));

        address ajnaPoolAddr = _getOrDeployAjnaPool();
        strategy.setAjnaPool(ajnaPoolAddr);
        strategy.setAjnaBorrowConfig(true, type(uint256).max, type(uint256).max, 12_500, 0, 0);
        strategy.initializeApprovals();

        IAjnaPool ajnaPool = IAjnaPool(ajnaPoolAddr);
        address lender = makeAddr("lender");
        deal(WETH, lender, 50e18);

        vm.startPrank(lender);
        IERC20(WETH).approve(ajnaPoolAddr, type(uint256).max);
        ajnaPool.addQuoteToken(25e18, 2000, block.timestamp + 1 days);
        vm.stopPrank();

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 1_000_000e6);
        charm.setWithdrawAmounts(0, 1_000_000e6);

        deal(USDC, address(charm), 1_000_000e6);

        uint256 withdrawn = strategy.withdraw(0.01e18);
        assertEq(withdrawn, 0.01e18, "Ajna borrow should satisfy full withdraw amount");
        assertEq(IERC20(WETH).balanceOf(address(this)), 0.01e18, "vault should receive exact creator asset");

        (, bool readable, uint256 debtCreator, uint256 collateralUsdc,) = strategy.getAjnaPosition();
        assertTrue(readable, "Ajna state should be readable");
        assertGt(debtCreator, 0, "Ajna debt should be opened");
        assertGt(collateralUsdc, 0, "Ajna collateral should be pledged");
    }

    function testFork_deposit_realAjnaRepay_accountsReleasedUsdcAndReducedCreator() external {
        if (!forkEnabled) return;

        ForkCharmOracleMock oracle = new ForkCharmOracleMock();
        oracle.setPrice(3000e18, true); // conservative WETH oracle price for collateral checks
        oracle.setAjnaBucketFromV3Twap(7_300, false);
        strategy.setCreatorOracle(address(oracle));

        address ajnaPoolAddr = _getOrDeployAjnaPool();
        strategy.setAjnaPool(ajnaPoolAddr);
        strategy.setAjnaBorrowConfig(true, type(uint256).max, type(uint256).max, 12_500, 0, 0);
        strategy.initializeApprovals();

        IAjnaPool ajnaPool = IAjnaPool(ajnaPoolAddr);
        address lender = makeAddr("lender");
        deal(WETH, lender, 50e18);

        vm.startPrank(lender);
        IERC20(WETH).approve(ajnaPoolAddr, type(uint256).max);
        ajnaPool.addQuoteToken(25e18, 2000, block.timestamp + 1 days);
        vm.stopPrank();

        // First open a real Ajna debt position via strategy withdraw.
        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 40e6);
        charm.setWithdrawAmounts(0, 40e6);
        deal(USDC, address(charm), 40e6);

        uint256 opened = strategy.withdraw(0.01e18);
        assertEq(opened, 0.01e18, "expected initial withdraw to open Ajna position");

        (, bool readableBefore, uint256 debtBefore, uint256 collateralBefore,) = strategy.getAjnaPosition();
        assertTrue(readableBefore, "Ajna state should be readable before repay");
        assertGt(debtBefore, 0, "debt should be open before deposit");
        assertGt(collateralBefore, 0, "collateral should be open before deposit");

        // Set Charm ratio to consume near-total post-repay legs:
        // 0.02 WETH in -> repay ~debt -> remaining creator is paired with existing+released USDC.
        uint256 usdcBeforeDeposit = IERC20(USDC).balanceOf(address(strategy));
        charm.setTotalAmounts(1e18, 4_000e6);
        deal(WETH, address(this), 0.02e18);
        IERC20(WETH).approve(address(strategy), type(uint256).max);

        uint256 deposited = strategy.deposit(0.02e18);
        assertEq(deposited, 0.02e18, "deposit should preserve strict vault accounting");

        (, bool readableAfter, uint256 debtAfter, uint256 collateralAfter,) = strategy.getAjnaPosition();
        assertTrue(readableAfter, "Ajna state should be readable after repay");
        assertEq(debtAfter, 0, "deposit should repay opened Ajna debt first");
        assertEq(collateralAfter, 0, "repay should release pledged collateral");

        uint256 expectedCreatorLeg = debtBefore >= 0.02e18 ? 0 : 0.02e18 - debtBefore;
        assertApproxEqAbs(
            charm.lastDepositAmount0(),
            expectedCreatorLeg,
            5e12, // tiny tolerance for pool/repay rounding
            "creator leg should reflect debt repayment before charm deposit"
        );

        uint256 strategyUsdcAfter = IERC20(USDC).balanceOf(address(strategy));
        assertApproxEqAbs(
            charm.lastDepositAmount1() + strategyUsdcAfter,
            usdcBeforeDeposit + collateralBefore,
            5,
            "existing plus released USDC should be either deposited to Charm or kept idle"
        );
        assertEq(charm.lastDepositTo(), address(strategy), "charm deposit recipient should be strategy");
    }

    function testFork_rebalance_ownerAndVault_emitExpectedAssets_withoutCharmMutations() external {
        if (!forkEnabled) return;

        address swapPool = charm.pool();
        address ownerAddr = makeAddr("owner");
        address vaultAddr = makeAddr("vault");
        CreatorCharmStrategy strategy2 =
            new CreatorCharmStrategy(vaultAddr, WETH, USDC, UNISWAP_V3_ROUTER, address(charm), swapPool, ownerAddr);
        vm.prank(ownerAddr);
        strategy2.setUniFactory(UNISWAP_V3_FACTORY);
        vm.prank(ownerAddr);
        strategy2.setAutoFeeTier(true);

        // 25% share of 80 WETH in Charm => 20 WETH, plus 5 WETH idle = 25 WETH total assets.
        charm.setTotalSupply(200e18);
        charm.setBalance(address(strategy2), 50e18);
        charm.setTotalAmounts(80e18, 0);
        deal(WETH, address(strategy2), 5e18);

        uint256 expectedAssets = strategy2.getTotalAssets();
        assertEq(expectedAssets, 25e18, "unexpected precondition");

        uint256 depositCallsBefore = charm.depositCallCount();
        uint256 withdrawCallsBefore = charm.withdrawCallCount();

        vm.recordLogs();
        vm.prank(ownerAddr);
        strategy2.rebalance();
        Vm.Log[] memory ownerLogs = vm.getRecordedLogs();
        _assertRebalanceLog(ownerLogs, address(strategy2), expectedAssets);

        vm.recordLogs();
        vm.prank(vaultAddr);
        strategy2.rebalance();
        Vm.Log[] memory vaultLogs = vm.getRecordedLogs();
        _assertRebalanceLog(vaultLogs, address(strategy2), expectedAssets);

        assertEq(charm.depositCallCount(), depositCallsBefore, "rebalance should not call charm deposit");
        assertEq(charm.withdrawCallCount(), withdrawCallsBefore, "rebalance should not call charm withdraw");
    }

    function _assertRebalanceLog(Vm.Log[] memory logs, address emitter, uint256 expectedAssets) internal {
        bytes32 sig = keccak256("StrategyRebalanced(uint256)");
        bool found = false;

        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter != emitter) continue;
            if (logs[i].topics.length == 0 || logs[i].topics[0] != sig) continue;

            uint256 emittedAssets = abi.decode(logs[i].data, (uint256));
            assertEq(emittedAssets, expectedAssets, "rebalance emitted unexpected assets");
            found = true;
            break;
        }

        assertTrue(found, "missing StrategyRebalanced event");
    }

    function _findUsdcWethPool() internal view returns (address poolAddr) {
        IUniswapV3Factory factory = IUniswapV3Factory(UNISWAP_V3_FACTORY);
        uint24[4] memory fees = [uint24(100), uint24(500), uint24(3000), uint24(10000)];
        uint128 bestLiquidity;

        for (uint256 i = 0; i < fees.length; i++) {
            address candidate = factory.getPool(USDC, WETH, fees[i]);
            if (candidate == address(0)) continue;
            uint128 liq = IUniswapV3Pool(candidate).liquidity();
            if (liq > bestLiquidity) {
                bestLiquidity = liq;
                poolAddr = candidate;
            }
        }
    }

    function _getOrDeployAjnaPool() internal returns (address poolAddr) {
        IAjnaPoolFactory factory = IAjnaPoolFactory(AJNA_FACTORY);
        bytes32 subsetHash = factory.ERC20_NON_SUBSET_HASH();
        poolAddr = factory.deployedPools(subsetHash, USDC, WETH);
        if (poolAddr != address(0)) return poolAddr;

        uint256 minRate = factory.MIN_RATE();
        poolAddr = factory.deployPool(USDC, WETH, minRate);
    }
}
