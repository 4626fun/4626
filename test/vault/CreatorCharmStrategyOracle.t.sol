// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { CreatorCharmStrategy, ISwapRouter } from "../../contracts/vault/strategies/univ3/CreatorCharmStrategy.sol";

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

    function deposit(uint256, uint256, uint256, uint256, address) external pure returns (uint256, uint256, uint256) {
        return (0, 0, 0);
    }

    function setWithdrawAmounts(uint256 amount0, uint256 amount1) external {
        withdrawAmount0 = amount0;
        withdrawAmount1 = amount1;
    }

    function withdraw(uint256, uint256, uint256, address to) external returns (uint256 amount0, uint256 amount1) {
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

    function slot0()
        external
        view
        returns (uint160, int24, uint16, uint16, uint16, uint8, bool)
    {
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

contract MockCreatorOracle {
    int256 public priceUsd18;
    uint256 public timestamp;
    bool public fresh;

    function setPrice(int256 _priceUsd18, uint256 _timestamp, bool _fresh) external {
        priceUsd18 = _priceUsd18;
        timestamp = _timestamp;
        fresh = _fresh;
    }

    function isPriceFresh() external view returns (bool) {
        return fresh;
    }

    function getCreatorPrice() external view returns (int256 price, uint256 ts) {
        return (priceUsd18, timestamp);
    }
}

contract CreatorCharmStrategyOracleTest is Test {
    function _deployStrategy(
        MockERC20 creator,
        MockERC20 usdc,
        MockCharmVault charm,
        MockV3Pool pool
    ) internal returns (CreatorCharmStrategy strategy) {
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

    function test_withdraw_revertsAtomically_whenRequiredSwapFails() external {
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

        vm.expectRevert(CreatorCharmStrategy.RequiredSwapFailed.selector);
        strategy.withdraw(100e18);
    }

    function test_withdraw_usesTwapQuote_notSpot_forMinOut() external {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 creator = new MockERC20("Creator", "CRT", 18);
        MockV3Pool pool = new MockV3Pool(address(creator), address(usdc));
        pool.setTwapTick(5000);
        MockRouter router = new MockRouter();
        router.setAmountOutToReturn(0);

        MockCharmVault charm = new MockCharmVault(address(creator), address(usdc));
        CreatorCharmStrategy strategy = _deployStrategyWithRouter(creator, usdc, charm, pool, router);
        strategy.initializeApprovals();

        charm.setTotalSupply(100e18);
        charm.setBalance(address(strategy), 100e18);
        charm.setTotalAmounts(100e18, 1_000_000e6);
        charm.setWithdrawAmounts(20e18, 500_000e6);

        creator.mint(address(charm), 100e18);
        usdc.mint(address(charm), 5_000_000e6);

        strategy.withdraw(100e18);
        uint256 minOutBefore = router.lastAmountOutMinimum();

        pool.setSpotSqrtPriceX96(type(uint160).max);
        strategy.withdraw(100e18);
        uint256 minOutAfter = router.lastAmountOutMinimum();

        assertGt(minOutBefore, 0, "expected non-zero minOut");
        assertEq(minOutAfter, minOutBefore, "spot manipulation changed minOut");
    }
}

