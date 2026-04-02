// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CreatorCharmStrategy, ISwapRouter} from "../../contracts/vault/strategies/univ3/CreatorCharmStrategy.sol";
import {IAjnaPool} from "../../contracts/interfaces/IAjnaPool.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}

contract MockCharmVault {
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

    function getTotalAmounts() external view returns (uint256, uint256) {
        return (total0, total1);
    }

    function deposit(uint256 amount0, uint256 amount1, uint256, uint256, address to)
        external
        returns (uint256, uint256, uint256)
    {
        depositCallCount += 1;
        if (amount0 > 0) {
            ERC20(token0).transferFrom(msg.sender, address(this), amount0);
        }
        if (amount1 > 0) {
            ERC20(token1).transferFrom(msg.sender, address(this), amount1);
        }
        lastDepositAmount0 = amount0;
        lastDepositAmount1 = amount1;
        lastDepositTo = to;
        return (0, 0, 0);
    }

    function setWithdrawAmounts(uint256 amount0, uint256 amount1) external {
        withdrawAmount0 = amount0;
        withdrawAmount1 = amount1;
    }

    function withdraw(uint256, uint256, uint256, address to) external returns (uint256 amount0, uint256 amount1) {
        withdrawCallCount += 1;
        amount0 = withdrawAmount0;
        amount1 = withdrawAmount1;
        if (amount0 > 0) {
            ERC20(token0).transfer(to, amount0);
        }
        if (amount1 > 0) {
            ERC20(token1).transfer(to, amount1);
        }
    }

    function baseLower() external pure returns (int24) {
        return -887200;
    }

    function baseUpper() external pure returns (int24) {
        return 887200;
    }
}

contract MockV3Pool {
    address public token0;
    address public token1;

    uint160 public spotSqrtPriceX96;
    int24 public twapTick;
    uint16 public observationCardinality = 2;
    bool public revertObserve;

    constructor(address token0_, address token1_) {
        token0 = token0_;
        token1 = token1_;
        spotSqrtPriceX96 = uint160(1 << 96);
    }

    function setSpotSqrtPriceX96(uint160 value) external {
        spotSqrtPriceX96 = value;
    }

    function setTwapTick(int24 value) external {
        twapTick = value;
    }

    function setObservationCardinality(uint16 value) external {
        observationCardinality = value;
    }

    function setRevertObserve(bool value) external {
        revertObserve = value;
    }

    function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool) {
        return (spotSqrtPriceX96, twapTick, 0, observationCardinality, observationCardinality, 0, true);
    }

    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        if (revertObserve) revert("NO_OBS");
        require(secondsAgos.length >= 2, "len");

        tickCumulatives = new int56[](secondsAgos.length);
        secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);

        uint32 duration = secondsAgos[0] - secondsAgos[1];
        tickCumulatives[0] = 0;
        tickCumulatives[1] = int56(int24(twapTick)) * int56(uint56(duration));
    }
}

contract MockRouter {
    bool public shouldRevert;
    bool public called;
    uint256 public amountOutToReturn;
    uint256 public lastAmountOutMinimum;

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function setAmountOutToReturn(uint256 value) external {
        amountOutToReturn = value;
    }

    function exactInputSingle(ISwapRouter.ExactInputSingleParams calldata params) external returns (uint256 amountOut) {
        if (shouldRevert) revert("SWAP_FAIL");
        called = true;
        lastAmountOutMinimum = params.amountOutMinimum;
        if (params.amountIn > 0) {
            ERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        }
        if (amountOutToReturn > 0) {
            ERC20(params.tokenOut).transfer(params.recipient, amountOutToReturn);
        }
        amountOut = amountOutToReturn;
    }
}

contract MockAjnaPool is IAjnaPool {
    uint256 private constant USDC_TO_AJNA_WAD = 1e12;

    IERC20 public immutable quoteToken;
    IERC20 public immutable collateralToken;

    bool public shouldRevertDraw;
    bool public shouldRevertRepay;
    uint256 public inflator = 1e18;
    uint256 public lastDrawLimitIndex;
    uint256 public lastRepayLimitIndex;

    struct BorrowerState {
        uint256 t0Debt;
        uint256 collateralWad;
    }

    mapping(address => BorrowerState) internal borrowerStates;

    constructor(address quoteToken_, address collateralToken_) {
        quoteToken = IERC20(quoteToken_);
        collateralToken = IERC20(collateralToken_);
    }

    function setShouldRevertDraw(bool value) external {
        shouldRevertDraw = value;
    }

    function setShouldRevertRepay(bool value) external {
        shouldRevertRepay = value;
    }

    function seedPosition(address borrower, uint256 debtCreator, uint256 collateralUsdc) external {
        borrowerStates[borrower] = BorrowerState({t0Debt: debtCreator, collateralWad: collateralUsdc * USDC_TO_AJNA_WAD});
    }

    function drawDebt(address borrowerAddress, uint256 amountToBorrow, uint256 limitIndex, uint256 collateralToPledge)
        external
    {
        if (shouldRevertDraw) revert("DRAW_FAIL");
        lastDrawLimitIndex = limitIndex;

        if (collateralToPledge > 0) {
            uint256 collateralAmount = collateralToPledge / USDC_TO_AJNA_WAD;
            if (collateralAmount > 0) {
                collateralToken.transferFrom(msg.sender, address(this), collateralAmount);
            }
            borrowerStates[borrowerAddress].collateralWad += collateralToPledge;
        }

        if (amountToBorrow > 0) {
            quoteToken.transfer(msg.sender, amountToBorrow);
            borrowerStates[borrowerAddress].t0Debt += amountToBorrow;
        }
    }

    function repayDebt(
        address borrowerAddress,
        uint256 maxQuoteTokenAmountToRepay,
        uint256 collateralAmountToPull,
        address recipient,
        uint256 limitIndex
    )
        external
        returns (uint256 amountRepaid)
    {
        if (shouldRevertRepay) revert("REPAY_FAIL");
        lastRepayLimitIndex = limitIndex;

        BorrowerState storage position = borrowerStates[borrowerAddress];
        uint256 debt = position.t0Debt;
        amountRepaid = maxQuoteTokenAmountToRepay > debt ? debt : maxQuoteTokenAmountToRepay;

        if (amountRepaid > 0) {
            quoteToken.transferFrom(msg.sender, address(this), amountRepaid);
            position.t0Debt -= amountRepaid;
        }

        uint256 collateralToPullWad = collateralAmountToPull > position.collateralWad ? position.collateralWad : collateralAmountToPull;
        if (collateralToPullWad > 0) {
            position.collateralWad -= collateralToPullWad;
            uint256 collateralToPull = collateralToPullWad / USDC_TO_AJNA_WAD;
            if (collateralToPull > 0) {
                collateralToken.transfer(recipient, collateralToPull);
            }
        }
    }

    function addQuoteToken(uint256, uint256, uint256) external pure returns (uint256 bucketLP, uint256 addedAmount) {
        return (0, 0);
    }

    function removeQuoteToken(uint256, uint256) external pure returns (uint256 removedAmount, uint256 redeemedLP) {
        return (0, 0);
    }

    function moveQuoteToken(uint256, uint256, uint256, uint256)
        external
        pure
        returns (uint256 fromBucketLP, uint256 toBucketLP, uint256 movedAmount)
    {
        return (0, 0, 0);
    }

    function lenderInfo(uint256, address) external view returns (uint256 lpBalance, uint256 depositTime) {
        return (0, block.timestamp);
    }

    function bucketInfo(uint256)
        external
        pure
        returns (uint256 lpBalance, uint256 collateral, uint256 bankruptcyTime, uint256 deposit, uint256 scale)
    {
        return (0, 0, 0, 0, 1e18);
    }

    function borrowerInfo(address borrower) external view returns (uint256 t0Debt, uint256 collateral, uint256 npTpRatio) {
        BorrowerState memory state = borrowerStates[borrower];
        return (state.t0Debt, state.collateralWad, 1e18);
    }

    function inflatorInfo() external view returns (uint256, uint256) {
        return (inflator, block.timestamp);
    }

    function quoteTokenAddress() external view returns (address) {
        return address(quoteToken);
    }

    function collateralAddress() external view returns (address) {
        return address(collateralToken);
    }

    function poolUtilization() external pure returns (uint256) {
        return 0;
    }

    function interestRate() external pure returns (uint256) {
        return 0;
    }
}

contract MockCreatorOracle {
    int256 public priceUsd18;
    uint256 public timestamp;
    bool public fresh;
    uint256 public ajnaBucketFromV3Twap;
    bool public revertAjnaBucket;

    function setPrice(int256 _priceUsd18, uint256 _timestamp, bool _fresh) external {
        priceUsd18 = _priceUsd18;
        timestamp = _timestamp;
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
        return (priceUsd18, timestamp);
    }

    function getAjnaBucketFromV3TWAP(uint32) external view returns (uint256 bucketIndex) {
        if (revertAjnaBucket) revert("NO_BUCKET");
        return ajnaBucketFromV3Twap;
    }
}

contract CreatorCharmStrategyOracleTest is Test {
    event StrategyRebalanced(uint256 newTotalAssets);

    function _deployStrategy(MockERC20 creator, MockERC20 usdc, MockCharmVault charm, MockV3Pool pool)
        internal
        returns (CreatorCharmStrategy strategy)
    {
        MockRouter router = new MockRouter();
        strategy = _deployStrategyWithRouter(creator, usdc, charm, pool, router);
    }

    function _deployStrategyWithRouter(
        MockERC20 creator,
        MockERC20 usdc,
        MockCharmVault charm,
        MockV3Pool pool,
        MockRouter router
    ) internal returns (CreatorCharmStrategy strategy) {
        strategy = new CreatorCharmStrategy(
            address(this),
            address(creator),
            address(usdc),
            address(router),
            address(charm),
            address(pool),
            address(this)
        );
    }

    function test_getTotalAssets_usesOracle_notPoolPrice() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(usdc), address(creator));
        pool.setTwapTick(5000);

        MockCharmVault charm = new MockCharmVault(address(usdc), address(creator));
        CreatorCharmStrategy strategy = _deployStrategy(creator, usdc, charm, pool);

        MockCreatorOracle oracle = new MockCreatorOracle();
        oracle.setPrice(1e18, block.timestamp, true); // 1 USD per CREATOR
        strategy.setCreatorOracle(address(oracle));

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(77e18, 1_500_000e6);

        uint256 beforeAssets = strategy.getTotalAssets();

        pool.setSpotSqrtPriceX96(type(uint160).max);
        pool.setTwapTick(12000);
        uint256 afterUp = strategy.getTotalAssets();
        assertEq(afterUp, beforeAssets, "spot increase changed valuation");

        pool.setSpotSqrtPriceX96(1);
        pool.setTwapTick(-12000);
        uint256 afterDown = strategy.getTotalAssets();
        assertEq(afterDown, beforeAssets, "spot decrease changed valuation");
    }

    function test_getTotalAssets_accountsForCharmFeeOnGeneratedFees_viaNetCharmExposure() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(usdc), address(creator));
        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategy(creator, usdc, charm, pool);

        MockCreatorOracle oracle = new MockCreatorOracle();
        oracle.setPrice(1e18, block.timestamp, true); // 1 USD per CREATOR
        strategy.setCreatorOracle(address(oracle));

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);

        // Example economics:
        // - principal: 100 CREATOR + 1,000 USDC
        // - generated fees: +20 CREATOR + 200 USDC
        // - Charm fee: 1% of generated fees => 0.2 CREATOR + 2 USDC retained by Charm
        // - net strategy exposure reported by Charm:
        //   CREATOR: 119.8
        //   USDC: 1,198
        charm.setTotalAmounts(119_800_000_000_000_000_000, 1_198e6);

        uint256 assets = strategy.getTotalAssets();

        // At 1 USD/CREATOR, USDC converts 1:1 into CREATOR units.
        // 119.8 + 1198 = 1317.8 CREATOR.
        assertEq(assets, 1_317_800_000_000_000_000_000, "valuation must use net Charm exposure after Charm fee-on-fees");
    }

    function test_getTotalAssets_handlesCharmTokenOrientation() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(usdc), address(creator));
        pool.setTwapTick(5000);

        MockCharmVault charmCreatorToken0 = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategyCreatorToken0 = _deployStrategy(creator, usdc, charmCreatorToken0, pool);
        charmCreatorToken0.setTotalSupply(100e18);
        charmCreatorToken0.setBalance(address(strategyCreatorToken0), 100e18);
        charmCreatorToken0.setTotalAmounts(200e18, 2_000_000e6);

        MockCharmVault charmUsdcToken0 = new MockCharmVault(address(usdc), address(creator));
        CreatorCharmStrategy strategyUsdcToken0 = _deployStrategy(creator, usdc, charmUsdcToken0, pool);
        charmUsdcToken0.setTotalSupply(100e18);
        charmUsdcToken0.setBalance(address(strategyUsdcToken0), 100e18);
        charmUsdcToken0.setTotalAmounts(2_000_000e6, 200e18);

        uint256 assetsCreatorToken0 = strategyCreatorToken0.getTotalAssets();
        uint256 assetsUsdcToken0 = strategyUsdcToken0.getTotalAssets();

        assertApproxEqAbs(assetsCreatorToken0, assetsUsdcToken0, 2, "token orientation changed valuation");
    }

    function test_getTotalAssets_whenTwapUnavailable_usesOracleIfFresh() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(usdc), address(creator));
        pool.setObservationCardinality(1);

        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategy(creator, usdc, charm, pool);

        MockCreatorOracle oracle = new MockCreatorOracle();
        oracle.setPrice(1e18, block.timestamp, true); // 1 USD per CREATOR
        strategy.setCreatorOracle(address(oracle));

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(77e18, 1_500_000e6);

        // TWAP is unavailable, but valuation should still include USDC via CreatorOracle when fresh.
        uint256 totalAssets = strategy.getTotalAssets();
        assertEq(totalAssets, 77e18 + 1_500_000e18, "should include USDC via oracle");
    }

    function test_getTotalAssets_ignoresUsdc_whenOracleNotFresh() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(usdc), address(creator));

        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategy(creator, usdc, charm, pool);

        MockCreatorOracle oracle = new MockCreatorOracle();
        oracle.setPrice(1e18, block.timestamp, false);
        strategy.setCreatorOracle(address(oracle));

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(77e18, 1_500_000e6);

        assertEq(strategy.getTotalAssets(), 77e18, "should be conservative without fresh oracle");
        assertEq(strategy.isValuationReady(), false, "valuation should not be ready without fresh oracle");
    }

    function test_getTotalAssets_countsIdleUsdc_onlyWhenOracleFresh() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(usdc), address(creator));
        pool.setTwapTick(5000);

        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategy(creator, usdc, charm, pool);

        MockCreatorOracle oracle = new MockCreatorOracle();
        oracle.setPrice(1e18, block.timestamp, true);
        strategy.setCreatorOracle(address(oracle));

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(50e18, 0);

        usdc.mint(address(strategy), 2_000_000e6);
        uint256 withOracle = strategy.getTotalAssets();
        assertGt(withOracle, 50e18, "idle usdc should be valued with oracle when fresh");
        assertEq(strategy.isValuationReady(), true, "valuation should be ready when oracle is fresh");

        oracle.setPrice(1e18, block.timestamp, false);
        uint256 noOracle = strategy.getTotalAssets();
        assertEq(noOracle, 50e18, "idle usdc should be ignored without fresh oracle");
        assertEq(strategy.isValuationReady(), false, "valuation should not be ready when oracle is stale");
    }

    function test_isValuationReady_true_whenNoUsdcExposure_evenWithoutOracle() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(usdc), address(creator));

        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategy(creator, usdc, charm, pool);

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(77e18, 0);

        assertEq(strategy.isValuationReady(), true, "no usdc exposure => ready without oracle");
    }

    function test_getTotalAssets_reportsNetOfAjnaDebt() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(usdc), address(creator));
        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategy(creator, usdc, charm, pool);
        MockAjnaPool ajna = new MockAjnaPool(address(creator), address(usdc));
        MockCreatorOracle oracle = new MockCreatorOracle();
        oracle.setPrice(1e18, block.timestamp, true);

        strategy.setCreatorOracle(address(oracle));
        strategy.setAjnaPool(address(ajna));
        strategy.initializeApprovals();

        ajna.seedPosition(address(strategy), 40e18, 100e6);
        creator.mint(address(strategy), 50e18);
        usdc.mint(address(strategy), 10e6);

        // Gross = 50 CREATOR + (100 + 10) USDC ~= 160 CREATOR, minus 40 CREATOR debt = 120.
        assertEq(strategy.getTotalAssets(), 120e18, "valuation should subtract Ajna debt from gross exposure");
    }

    function test_isValuationReady_false_whenAjnaCollateralRatioBelowThreshold() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(usdc), address(creator));
        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategy(creator, usdc, charm, pool);
        MockAjnaPool ajna = new MockAjnaPool(address(creator), address(usdc));
        MockCreatorOracle oracle = new MockCreatorOracle();
        oracle.setPrice(1e18, block.timestamp, true);

        strategy.setCreatorOracle(address(oracle));
        strategy.setAjnaPool(address(ajna));
        strategy.setAjnaBorrowConfig(true, type(uint256).max, type(uint256).max, 12_500, 0, 0);

        // 50 USDC collateral value backing 100 CREATOR debt => 50% CR, below 125% threshold.
        ajna.seedPosition(address(strategy), 100e18, 50e6);
        assertFalse(strategy.isValuationReady(), "unsafe Ajna collateralization must disable valuation readiness");
    }

    function test_setTwapDuration_bounds() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(usdc), address(creator));
        MockCharmVault charm = new MockCharmVault(address(usdc), address(creator));
        CreatorCharmStrategy strategy = _deployStrategy(creator, usdc, charm, pool);

        vm.expectRevert(abi.encodeWithSelector(CreatorCharmStrategy.InvalidTwapDuration.selector, 59));
        strategy.setTwapDuration(59);

        vm.expectRevert(abi.encodeWithSelector(CreatorCharmStrategy.InvalidTwapDuration.selector, uint32(1 days + 1)));
        strategy.setTwapDuration(uint32(1 days + 1));

        strategy.setTwapDuration(3600);
        assertEq(strategy.twapDuration(), 3600);
    }

    function test_withdraw_reverts_whenSwapFailsAndNoAjnaBorrow() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        pool.setTwapTick(5000);
        MockRouter router = new MockRouter();
        router.setShouldRevert(true);

        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategyWithRouter(creator, usdc, charm, pool, router);
        strategy.initializeApprovals();

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 1_000_000e6);
        charm.setWithdrawAmounts(20e18, 2_000_000e6);

        creator.mint(address(charm), 50e18);
        usdc.mint(address(charm), 5_000_000e6);

        vm.expectRevert(
            abi.encodeWithSelector(CreatorCharmStrategy.WithdrawLiquidityUnavailable.selector, 100e18, 20e18)
        );
        strategy.withdraw(100e18);
    }

    function test_withdraw_reverts_whenTwapUnavailableAndNoAjnaBorrow() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        pool.setObservationCardinality(1); // force TWAP unavailable
        MockRouter router = new MockRouter();

        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategyWithRouter(creator, usdc, charm, pool, router);
        strategy.initializeApprovals();

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 1_000_000e6);
        charm.setWithdrawAmounts(15e18, 1_500_000e6);

        creator.mint(address(charm), 50e18);
        usdc.mint(address(charm), 5_000_000e6);

        vm.expectRevert(
            abi.encodeWithSelector(CreatorCharmStrategy.WithdrawLiquidityUnavailable.selector, 100e18, 15e18)
        );
        strategy.withdraw(100e18);
        assertFalse(router.called(), "router should not be called when TWAP is unavailable");
    }

    function test_withdraw_usesAjnaBorrowBeforeSwapFallback() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        pool.setTwapTick(5000);
        MockRouter router = new MockRouter();
        router.setShouldRevert(true);

        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategyWithRouter(creator, usdc, charm, pool, router);
        MockAjnaPool ajna = new MockAjnaPool(address(creator), address(usdc));
        MockCreatorOracle oracle = new MockCreatorOracle();
        oracle.setPrice(1e18, block.timestamp, true);
        strategy.setCreatorOracle(address(oracle));
        strategy.setAjnaPool(address(ajna));
        strategy.setAjnaBorrowConfig(true, type(uint256).max, type(uint256).max, 12_500, 0, 0);
        strategy.initializeApprovals();

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 1_000_000e6);
        charm.setWithdrawAmounts(20e18, 2_000_000e6);

        creator.mint(address(charm), 100e18);
        creator.mint(address(ajna), 1_000_000e18);
        usdc.mint(address(charm), 5_000_000e6);

        uint256 withdrawn = strategy.withdraw(100e18);

        assertEq(withdrawn, 100e18, "Ajna borrow should satisfy full withdraw");
        assertEq(creator.balanceOf(address(this)), 100e18, "vault should receive exact creator amount");
        assertFalse(router.called(), "swap should not execute when Ajna borrow covers deficit");

        (uint256 debt, uint256 collateralWad,) = ajna.borrowerInfo(address(strategy));
        assertGt(debt, 0, "Ajna debt should increase after borrow");
        assertGt(collateralWad, 0, "Ajna collateral should be pledged");
    }

    function test_withdraw_ajnaBorrow_autoLimitIndex_usesOracleBucketWithSafetyBuffer() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        pool.setTwapTick(5000);
        MockRouter router = new MockRouter();
        router.setShouldRevert(true);

        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategyWithRouter(creator, usdc, charm, pool, router);
        MockAjnaPool ajna = new MockAjnaPool(address(creator), address(usdc));
        MockCreatorOracle oracle = new MockCreatorOracle();
        oracle.setPrice(1e18, block.timestamp, true);
        oracle.setAjnaBucketFromV3Twap(6_000, false);
        strategy.setCreatorOracle(address(oracle));
        strategy.setAjnaPool(address(ajna));
        strategy.setAjnaBorrowConfig(true, type(uint256).max, type(uint256).max, 12_500, 0, 0);
        strategy.initializeApprovals();

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 1_000_000e6);
        charm.setWithdrawAmounts(20e18, 2_000_000e6);

        creator.mint(address(charm), 100e18);
        creator.mint(address(ajna), 1_000_000e18);
        usdc.mint(address(charm), 5_000_000e6);

        uint256 withdrawn = strategy.withdraw(100e18);
        assertEq(withdrawn, 100e18, "Ajna borrow should satisfy full withdraw");
        assertEq(ajna.lastDrawLimitIndex(), 6_050, "auto-limit should use oracle bucket plus ratio safety steps");
    }

    function test_withdraw_ajnaBorrow_autoLimitIndex_fallsBackToMaxWhenOracleBucketUnavailable() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        pool.setTwapTick(5000);
        MockRouter router = new MockRouter();
        router.setShouldRevert(true);

        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategyWithRouter(creator, usdc, charm, pool, router);
        MockAjnaPool ajna = new MockAjnaPool(address(creator), address(usdc));
        MockCreatorOracle oracle = new MockCreatorOracle();
        oracle.setPrice(1e18, block.timestamp, true);
        oracle.setAjnaBucketFromV3Twap(0, true);
        strategy.setCreatorOracle(address(oracle));
        strategy.setAjnaPool(address(ajna));
        strategy.setAjnaBorrowConfig(true, type(uint256).max, type(uint256).max, 12_500, 0, 0);
        strategy.initializeApprovals();

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 1_000_000e6);
        charm.setWithdrawAmounts(20e18, 2_000_000e6);

        creator.mint(address(charm), 100e18);
        creator.mint(address(ajna), 1_000_000e18);
        usdc.mint(address(charm), 5_000_000e6);

        uint256 withdrawn = strategy.withdraw(100e18);
        assertEq(withdrawn, 100e18, "Ajna borrow should still satisfy withdraw");
        assertEq(ajna.lastDrawLimitIndex(), 7_388, "auto-limit should fail-safe to max Ajna index");
    }

    function test_withdraw_swapFallback_usesTwapQuote_notSpot_forMinOut() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        pool.setTwapTick(5000);
        MockRouter router = new MockRouter();
        router.setAmountOutToReturn(15e18);

        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategyWithRouter(creator, usdc, charm, pool, router);
        strategy.initializeApprovals();

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 1_000_000e6);
        charm.setWithdrawAmounts(20e18, 500_000e6);

        creator.mint(address(charm), 500e18);
        creator.mint(address(router), 1_000e18);
        usdc.mint(address(charm), 5_000_000e6);

        uint256 withdrawnFirst = strategy.withdraw(30e18);
        uint256 minOutBefore = router.lastAmountOutMinimum();
        assertEq(withdrawnFirst, 30e18, "first withdraw should settle via swap fallback");

        pool.setSpotSqrtPriceX96(type(uint160).max);
        uint256 withdrawnSecond = strategy.withdraw(30e18);
        uint256 minOutAfter = router.lastAmountOutMinimum();
        assertEq(withdrawnSecond, 30e18, "second withdraw should settle via swap fallback");

        assertGt(minOutBefore, 0, "expected non-zero minOut");
        assertEq(minOutAfter, minOutBefore, "spot manipulation changed minOut");
    }

    function test_withdraw_swapFallback_executes_whenAjnaBorrowIsCapped() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        pool.setTwapTick(5000);
        MockRouter router = new MockRouter();
        router.setAmountOutToReturn(50e18);

        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategyWithRouter(creator, usdc, charm, pool, router);
        MockAjnaPool ajna = new MockAjnaPool(address(creator), address(usdc));
        MockCreatorOracle oracle = new MockCreatorOracle();
        oracle.setPrice(1e18, block.timestamp, true);
        strategy.setCreatorOracle(address(oracle));
        strategy.setAjnaPool(address(ajna));
        // Cap Ajna borrow so swap fallback must cover the residual.
        strategy.setAjnaBorrowConfig(true, type(uint256).max, 30e18, 12_500, 0, 0);
        strategy.initializeApprovals();

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 1_000_000e6);
        charm.setWithdrawAmounts(20e18, 2_000_000e6);

        creator.mint(address(charm), 100e18);
        creator.mint(address(ajna), 1_000_000e18);
        creator.mint(address(router), 1_000_000e18);
        usdc.mint(address(charm), 5_000_000e6);

        uint256 withdrawn = strategy.withdraw(100e18);
        assertEq(withdrawn, 100e18, "full withdraw should succeed via Ajna+swap composition");
        assertTrue(router.called(), "swap fallback should run when Ajna cap leaves residual");
    }

    function test_withdraw_ajnaBorrow_usesExistingCollateral_whenNoIdleUsdc() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        pool.setTwapTick(5000);
        MockRouter router = new MockRouter();
        router.setShouldRevert(true);

        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategyWithRouter(creator, usdc, charm, pool, router);
        MockAjnaPool ajna = new MockAjnaPool(address(creator), address(usdc));
        MockCreatorOracle oracle = new MockCreatorOracle();
        oracle.setPrice(1e18, block.timestamp, true);
        strategy.setCreatorOracle(address(oracle));
        strategy.setAjnaPool(address(ajna));
        strategy.setAjnaBorrowConfig(true, type(uint256).max, type(uint256).max, 12_500, 0, 0);
        strategy.initializeApprovals();

        // Pre-existing pledged collateral with zero idle USDC.
        ajna.seedPosition(address(strategy), 0, 40e6);
        creator.mint(address(ajna), 1_000_000e18);

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 0);
        charm.setWithdrawAmounts(20e18, 0);

        creator.mint(address(charm), 100e18);

        uint256 withdrawn = strategy.withdraw(50e18);
        assertEq(withdrawn, 50e18, "borrow against existing collateral should satisfy residual");
        assertFalse(router.called(), "swap should not be needed");
    }

    function test_deposit_repaysAjnaDebtBeforeCharmAllocation() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        MockRouter router = new MockRouter();
        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategyWithRouter(creator, usdc, charm, pool, router);
        MockAjnaPool ajna = new MockAjnaPool(address(creator), address(usdc));
        charm.setPool(address(pool));

        strategy.setAjnaPool(address(ajna));
        strategy.initializeApprovals();

        ajna.seedPosition(address(strategy), 10e18, 100_000e6);
        usdc.mint(address(ajna), 100_000e6);

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 500_000e6);

        creator.mint(address(this), 30e18);
        creator.approve(address(strategy), type(uint256).max);

        uint256 deposited = strategy.deposit(30e18);
        assertEq(deposited, 30e18, "deposit should preserve strict vault accounting");

        (uint256 debtAfter, uint256 collateralAfterWad,) = ajna.borrowerInfo(address(strategy));
        assertEq(debtAfter, 0, "Ajna debt should be repaid first");
        assertEq(collateralAfterWad, 0, "repaid debt should release pledged collateral");

        assertEq(charm.lastDepositAmount0(), 20e18, "remaining creator should flow to Charm");
        assertEq(charm.lastDepositAmount1(), 100_000e6, "released collateral should contribute USDC leg");
    }

    function test_deposit_autoLimitIndex_repaysAjnaDebt_andAccountsReleasedUsdcInCharmLeg() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        MockRouter router = new MockRouter();
        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategyWithRouter(creator, usdc, charm, pool, router);
        MockAjnaPool ajna = new MockAjnaPool(address(creator), address(usdc));
        MockCreatorOracle oracle = new MockCreatorOracle();
        oracle.setPrice(1e18, block.timestamp, true);
        oracle.setAjnaBucketFromV3Twap(6_100, false);
        charm.setPool(address(pool));

        strategy.setCreatorOracle(address(oracle));
        strategy.setAjnaPool(address(ajna));
        strategy.setAjnaBorrowConfig(true, type(uint256).max, type(uint256).max, 12_500, 0, 0);
        strategy.initializeApprovals();

        ajna.seedPosition(address(strategy), 10e18, 100_000e6);
        usdc.mint(address(ajna), 100_000e6);

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 500_000e6);

        creator.mint(address(this), 30e18);
        creator.approve(address(strategy), type(uint256).max);

        uint256 deposited = strategy.deposit(30e18);
        assertEq(deposited, 30e18, "deposit should preserve strict vault accounting");

        (uint256 debtAfter, uint256 collateralAfterWad,) = ajna.borrowerInfo(address(strategy));
        assertEq(debtAfter, 0, "Ajna debt should be repaid first");
        assertEq(collateralAfterWad, 0, "repaid debt should release pledged collateral");
        assertEq(ajna.lastRepayLimitIndex(), 6_150, "repay should use oracle bucket plus ratio safety steps");

        assertEq(charm.lastDepositAmount0(), 20e18, "remaining creator should flow to Charm");
        assertEq(charm.lastDepositAmount1(), 100_000e6, "released collateral should contribute USDC leg");
    }

    function test_deposit_repay_usdcAccountingIdentity_holds() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        MockRouter router = new MockRouter();
        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategyWithRouter(creator, usdc, charm, pool, router);
        MockAjnaPool ajna = new MockAjnaPool(address(creator), address(usdc));
        charm.setPool(address(pool));

        strategy.setAjnaPool(address(ajna));
        strategy.setAjnaBorrowConfig(true, type(uint256).max, type(uint256).max, 12_500, 1, 1);
        strategy.initializeApprovals();

        // Seed existing Ajna debt/collateral and some pre-existing idle USDC on strategy.
        ajna.seedPosition(address(strategy), 10e18, 100_000e6);
        usdc.mint(address(ajna), 100_000e6);
        usdc.mint(address(strategy), 5_000e6);

        // Charm ratio tuned so repay-released USDC is mostly deployed, while preserving idle residue.
        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 500_000e6);

        creator.mint(address(this), 30e18);
        creator.approve(address(strategy), type(uint256).max);

        uint256 preIdleUsdc = usdc.balanceOf(address(strategy));
        (uint256 debtBefore, uint256 collateralBeforeWad,) = ajna.borrowerInfo(address(strategy));

        uint256 deposited = strategy.deposit(30e18);
        assertEq(deposited, 30e18, "deposit should preserve strict vault accounting");
        assertFalse(router.called(), "no swap expected for this deterministic ratio setup");

        (uint256 debtAfter, uint256 collateralAfterWad,) = ajna.borrowerInfo(address(strategy));
        uint256 collateralPulledUsdc = (collateralBeforeWad - collateralAfterWad) / 1e12;
        uint256 charmUsdcUsed = charm.lastDepositAmount1(); // token1 is USDC in this harness
        uint256 postIdleUsdc = usdc.balanceOf(address(strategy));

        assertEq(debtBefore, 10e18, "precondition: seeded Ajna debt");
        assertEq(debtAfter, 0, "deposit should repay Ajna debt first");
        assertEq(collateralAfterWad, 0, "repay should pull all seeded collateral");

        // Core accounting identity:
        // pre-idle USDC + pulled-collateral USDC == USDC sent into Charm + post-idle USDC.
        assertEq(
            preIdleUsdc + collateralPulledUsdc,
            charmUsdcUsed + postIdleUsdc,
            "USDC identity mismatch across repay+deposit path"
        );

        // Sanity on CREATOR leg after debt repayment.
        assertEq(charm.lastDepositAmount0(), 20e18, "creator leg should be reduced by repay amount");
    }

    function test_setAjnaPool_reverts_whenPositionOpen() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategy(creator, usdc, charm, pool);
        MockAjnaPool ajna = new MockAjnaPool(address(creator), address(usdc));

        strategy.setAjnaPool(address(ajna));
        ajna.seedPosition(address(strategy), 5e18, 10e6);

        vm.expectRevert(abi.encodeWithSelector(CreatorCharmStrategy.AjnaPositionOpen.selector, 5e18, 10e6));
        strategy.setAjnaPool(address(0));
    }

    function test_withdraw_reverts_whenAjnaAndSwapUnavailable() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        pool.setObservationCardinality(1); // force swap path unavailable
        MockRouter router = new MockRouter();

        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategyWithRouter(creator, usdc, charm, pool, router);
        MockAjnaPool ajna = new MockAjnaPool(address(creator), address(usdc));
        MockCreatorOracle oracle = new MockCreatorOracle();
        oracle.setPrice(1e18, block.timestamp, true);
        strategy.setCreatorOracle(address(oracle));
        strategy.setAjnaPool(address(ajna));
        strategy.setAjnaBorrowConfig(true, type(uint256).max, type(uint256).max, 12_500, 0, 0);
        strategy.initializeApprovals();
        ajna.setShouldRevertDraw(true);

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 1_000_000e6);
        charm.setWithdrawAmounts(20e18, 2_000_000e6);

        creator.mint(address(charm), 50e18);
        usdc.mint(address(charm), 5_000_000e6);

        vm.expectRevert(
            abi.encodeWithSelector(CreatorCharmStrategy.WithdrawLiquidityUnavailable.selector, 100e18, 20e18)
        );
        strategy.withdraw(100e18);
    }

    function test_deposit_bootstrap_noTwap_defersWithoutUsdcLeg() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        pool.setObservationCardinality(1); // no TWAP history yet

        MockRouter router = new MockRouter();
        router.setAmountOutToReturn(1_000_000e6);

        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        charm.setPool(address(pool));
        CreatorCharmStrategy strategy = _deployStrategyWithRouter(creator, usdc, charm, pool, router);
        strategy.initializeApprovals();

        creator.mint(address(this), 100e18);
        creator.approve(address(strategy), type(uint256).max);

        strategy.deposit(100e18);

        assertFalse(router.called(), "router should not be called without TWAP");
        assertEq(charm.lastDepositAmount0(), 0, "bootstrap should defer deposit without usdc leg");
        assertEq(charm.lastDepositAmount1(), 0, "bootstrap should defer deposit without usdc leg");
        assertEq(charm.lastDepositTo(), address(0), "charm deposit should not be called");
        assertEq(creator.balanceOf(address(strategy)), 100e18, "creator should remain in strategy");
        assertEq(usdc.balanceOf(address(strategy)), 0, "usdc should remain zero");
    }

    function test_rebalance_reverts_forUnauthorizedCaller() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        MockRouter router = new MockRouter();
        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));

        address vaultAddr = address(0xBEEF);
        address ownerAddr = address(0xABCD);
        CreatorCharmStrategy strategy = new CreatorCharmStrategy(
            vaultAddr, address(creator), address(usdc), address(router), address(charm), address(pool), ownerAddr
        );

        vm.prank(address(0xDEAD));
        vm.expectRevert("Only owner or vault");
        strategy.rebalance();
    }

    function test_rebalance_ownerAndVault_emitNetAssets_withoutTouchingCharm() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        MockRouter router = new MockRouter();
        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));

        address vaultAddr = address(0xBEEF);
        address ownerAddr = address(0xABCD);
        CreatorCharmStrategy strategy = new CreatorCharmStrategy(
            vaultAddr, address(creator), address(usdc), address(router), address(charm), address(pool), ownerAddr
        );

        // 25% share of 80 CREATOR in Charm => 20 CREATOR, plus 5 CREATOR idle.
        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 25e18);
        charm.setTotalAmounts(80e18, 0);
        creator.mint(address(strategy), 5e18);

        uint256 expectedAssets = 25e18;

        vm.prank(ownerAddr);
        vm.expectEmit(address(strategy));
        emit StrategyRebalanced(expectedAssets);
        strategy.rebalance();

        vm.prank(vaultAddr);
        vm.expectEmit(address(strategy));
        emit StrategyRebalanced(expectedAssets);
        strategy.rebalance();

        assertEq(charm.depositCallCount(), 0, "rebalance should not call charm deposit");
        assertEq(charm.withdrawCallCount(), 0, "rebalance should not call charm withdraw");
    }

}

