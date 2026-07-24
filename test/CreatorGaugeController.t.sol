// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@4626/creator/revenue/CreatorGaugeController.sol";

contract MockToken is IERC20 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

    contract MockVault is MockToken {
        IERC20 public immutable creatorAsset;

        constructor(address _creatorAsset) MockToken("Mock Vault Share", "mVS") {
            creatorAsset = IERC20(_creatorAsset);
        }

        function burnSharesForPriceIncrease(uint256 shares) external {
            balanceOf[msg.sender] -= shares;
            totalSupply -= shares;
            emit Transfer(msg.sender, address(0), shares);
        }

        function pricePerShare() external pure returns (uint256) {
            return 1e18;
        }

        function totalAssets() external view returns (uint256) {
            return creatorAsset.balanceOf(address(this));
        }

        function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
            creatorAsset.transferFrom(msg.sender, address(this), assets);
            shares = assets;
            totalSupply += shares;
            balanceOf[receiver] += shares;
            emit Transfer(address(0), receiver, shares);
        }

        function asset() external view returns (address) {
            return address(creatorAsset);
        }
    }

    contract MockCreatorOracle {
        bool public shouldRevert;
        uint256 public creatorPerEth;
        bool public priceFresh = true;

        function setShouldRevert(bool _shouldRevert) external {
            shouldRevert = _shouldRevert;
        }

        function setCreatorPerEth(uint256 _creatorPerEth) external {
            creatorPerEth = _creatorPerEth;
        }

        function setPriceFresh(bool _fresh) external {
            priceFresh = _fresh;
        }

        function getAssetPrice() external view returns (int256, uint256) {
            return (1e8, block.timestamp);
        }

        function getEthPrice() external view returns (int256, uint256) {
            return (3000e8, block.timestamp);
        }

        function getAssetEthTWAP(uint32) external view returns (uint256) {
            if (shouldRevert) revert("oracle unavailable");
            return creatorPerEth;
        }

        function isPriceFresh() external view returns (bool) {
            return priceFresh;
        }
    }

    contract MockGaugeWrapper {
        MockToken public immutable vaultToken;
        MockToken public immutable oftToken;
        uint256 public constant NORMALIZATION = 1000;
        bool public revertUnwrap;

        constructor(address vault_, address oft_) {
            vaultToken = MockToken(vault_);
            oftToken = MockToken(oft_);
        }

        function setRevertUnwrap(bool v) external {
            revertUnwrap = v;
        }

        function vaultShares() external view returns (address) {
            return address(vaultToken);
        }

        function wrap(uint256 amount) external returns (uint256) {
            vaultToken.transferFrom(msg.sender, address(this), amount);
            uint256 out = amount / NORMALIZATION;
            oftToken.mint(msg.sender, out);
            return out;
        }

        function unwrap(uint256 amount) external returns (uint256) {
            if (revertUnwrap) revert("InsufficientLocked");
            oftToken.transferFrom(msg.sender, address(this), amount);
            uint256 out = amount * NORMALIZATION;
            vaultToken.mint(msg.sender, out);
            return out;
        }
    }

    /// @dev Allowlisted router that pulls WETH and pays ShareOFT to the caller (gauge).
    contract MockBuybackRouter {
        MockToken public immutable wethToken;
        MockToken public immutable shareToken;
        uint256 public amountOut;
        uint256 public lastAmountIn;
        bool public shouldRevert;

        constructor(address weth_, address share_) {
            wethToken = MockToken(weth_);
            shareToken = MockToken(share_);
        }

        function setAmountOut(uint256 _amountOut) external {
            amountOut = _amountOut;
        }

        function setShouldRevert(bool v) external {
            shouldRevert = v;
        }

        function buyback(uint256 wethIn) external {
            if (shouldRevert) revert("router reverted");
            lastAmountIn = wethIn;
            wethToken.transferFrom(msg.sender, address(this), wethIn);
            shareToken.transfer(msg.sender, amountOut);
        }
    }

    contract CreatorGaugeControllerTest is Test {
        address internal constant WETH_ADDR = 0x4200000000000000000000000000000000000006;

        CreatorGaugeController internal gauge;
        MockToken internal weth;
        MockToken internal creatorCoin;
        MockToken internal shareOFT;
        MockVault internal vault;
        MockCreatorOracle internal oracle;
        MockBuybackRouter internal buybackRouter;
        MockGaugeWrapper internal wrapper;

        address internal alice = makeAddr("alice");
        address internal keeper = makeAddr("keeper");
        address internal creatorTreasury = makeAddr("creatorTreasury");
        address internal protocolTreasury = makeAddr("protocolTreasury");

        function setUp() public {
            vm.chainId(8453);

            MockToken wethImpl = new MockToken("Wrapped Ether", "WETH");
            vm.etch(WETH_ADDR, address(wethImpl).code);
            weth = MockToken(WETH_ADDR);

            creatorCoin = new MockToken("Creator Coin", "CREATOR");
            shareOFT = new MockToken("Share OFT", "SHARE");
            vault = new MockVault(address(creatorCoin));
            oracle = new MockCreatorOracle();
            wrapper = new MockGaugeWrapper(address(vault), address(shareOFT));
            buybackRouter = new MockBuybackRouter(WETH_ADDR, address(shareOFT));

            gauge = new CreatorGaugeController(address(shareOFT), creatorTreasury, protocolTreasury, address(this));
            gauge.setVault(address(vault));
            gauge.setCreatorCoin(address(creatorCoin));
            gauge.setWrapper(address(wrapper));
            gauge.setAllowedSwapRouter(address(buybackRouter), true);
            gauge.setWethFeeKeeper(keeper);
            gauge.setWethProcessingConfig(100 ether, false);
        }

        function _routeCall(uint256 wethAmount) internal pure returns (bytes memory) {
            return abi.encodeCall(MockBuybackRouter.buyback, (wethAmount));
        }

        function _oracleMinOut(uint256 wethAmount, uint256 sharePerEth) internal view returns (uint256) {
            uint256 expectedOut = (wethAmount * sharePerEth) / 1e18;
            return (expectedOut * (10000 - gauge.swapSlippageBps())) / 10000;
        }

        function test_processWETHFees_legacyRevertsRoutedRequired() public {
            vm.expectRevert(CreatorGaugeController.RoutedSwapRequired.selector);
            gauge.processWETHFees();
        }

        function test_processWETHFeesWithRoute_reverts_whenOracleUnset() public {
            uint256 amount = 5 ether;
            _depositPendingWeth(amount);

            vm.expectRevert(CreatorGaugeController.MinOutputUnavailable.selector);
            gauge.processWETHFeesWithRoute(amount, address(buybackRouter), _routeCall(amount), 0);

            assertEq(gauge.pendingWETHFees(), amount);
        }

        function test_processWETHFeesWithRoute_reverts_whenOracleCallFails() public {
            uint256 amount = 5 ether;
            _depositPendingWeth(amount);

            gauge.setOracle(address(oracle));
            oracle.setShouldRevert(true);

            vm.expectRevert(CreatorGaugeController.MinOutputUnavailable.selector);
            gauge.processWETHFeesWithRoute(amount, address(buybackRouter), _routeCall(amount), 0);

            assertEq(gauge.pendingWETHFees(), amount);
        }

        function test_processWETHFeesWithRoute_reverts_whenOracleReturnsZero() public {
            uint256 amount = 5 ether;
            _depositPendingWeth(amount);

            gauge.setOracle(address(oracle));
            oracle.setCreatorPerEth(0);

            vm.expectRevert(CreatorGaugeController.MinOutputUnavailable.selector);
            gauge.processWETHFeesWithRoute(amount, address(buybackRouter), _routeCall(amount), 0);

            assertEq(gauge.pendingWETHFees(), amount);
        }

        function test_receiveWETHFees_neverAutoProcesses() public {
            uint256 amount = 20 ether;
            vm.warp(gauge.distributionInterval() + 1);
            gauge.setWethProcessingConfig(amount, true); // auto flag ignored

            weth.mint(alice, amount);
            vm.startPrank(alice);
            weth.approve(address(gauge), amount);
            gauge.receiveWETHFees(amount);
            vm.stopPrank();

            assertEq(gauge.pendingWETHFees(), amount);
            assertEq(weth.balanceOf(address(gauge)), amount);
            assertEq(gauge.autoProcessWethFees(), false);
        }

        function test_processWETHFeesWithRoute_creditsPendingFees() public {
            uint256 wethAmount = 5 ether;
            uint256 sharePerEth = 2e18;
            uint256 shareOut = 10 ether;

            _depositPendingWeth(wethAmount);

            gauge.setOracle(address(oracle));
            oracle.setCreatorPerEth(sharePerEth);

            shareOFT.mint(address(buybackRouter), shareOut);
            buybackRouter.setAmountOut(shareOut);

            uint256 expectedMinOut = _oracleMinOut(wethAmount, sharePerEth);
            assertGt(expectedMinOut, 0);

            gauge.processWETHFeesWithRoute(
                wethAmount, address(buybackRouter), _routeCall(wethAmount), expectedMinOut
            );

            assertEq(gauge.pendingWETHFees(), 0);
            assertEq(gauge.pendingFees(), shareOut);
            assertEq(buybackRouter.lastAmountIn(), wethAmount);
        }

        function test_processWETHFeesWithRoute_strangerReverts() public {
            uint256 wethAmount = 5 ether;
            uint256 sharePerEth = 2e18;
            uint256 shareOut = 10 ether;

            _depositPendingWeth(wethAmount);

            gauge.setOracle(address(oracle));
            oracle.setCreatorPerEth(sharePerEth);
            shareOFT.mint(address(buybackRouter), shareOut);
            buybackRouter.setAmountOut(shareOut);

            vm.startPrank(alice);
            vm.expectRevert(CreatorGaugeController.NotAuthorized.selector);
            gauge.processWETHFeesWithRoute(wethAmount, address(buybackRouter), _routeCall(wethAmount), 0);
            vm.stopPrank();

            assertEq(gauge.pendingWETHFees(), wethAmount);
        }

        function test_processWETHFeesWithRoute_keeperRespectsCap() public {
            uint256 totalWeth = 20 ether;
            uint256 cap = 5 ether;
            uint256 sharePerEth = 2e18;

            _depositPendingWeth(totalWeth);
            gauge.setWethProcessingConfig(cap, false);

            gauge.setOracle(address(oracle));
            oracle.setCreatorPerEth(sharePerEth);

            uint256 shareOut = cap * sharePerEth / 1e18;
            shareOFT.mint(address(buybackRouter), shareOut);
            buybackRouter.setAmountOut(shareOut);

            vm.prank(keeper);
            gauge.processWETHFeesWithRoute(totalWeth, address(buybackRouter), _routeCall(cap), 0);

            assertEq(buybackRouter.lastAmountIn(), cap);
            assertEq(gauge.pendingWETHFees(), totalWeth - cap);
            assertEq(gauge.pendingFees(), shareOut);
        }

        function test_processWETHFeesWithRoute_reverts_whenOracleStale() public {
            uint256 wethAmount = 5 ether;
            uint256 sharePerEth = 2e18;
            uint256 shareOut = 10 ether;

            _depositPendingWeth(wethAmount);

            gauge.setOracle(address(oracle));
            oracle.setCreatorPerEth(sharePerEth);
            oracle.setPriceFresh(false);

            shareOFT.mint(address(buybackRouter), shareOut);
            buybackRouter.setAmountOut(shareOut);

            vm.expectRevert(CreatorGaugeController.MinOutputUnavailable.selector);
            gauge.processWETHFeesWithRoute(wethAmount, address(buybackRouter), _routeCall(wethAmount), 0);

            assertEq(gauge.pendingWETHFees(), wethAmount);
        }

        function test_processWETHFeesWithRoute_reverts_routerNotAllowed() public {
            uint256 wethAmount = 5 ether;
            _depositPendingWeth(wethAmount);
            gauge.setOracle(address(oracle));
            oracle.setCreatorPerEth(2e18);

            address rogue = makeAddr("rogueRouter");
            vm.expectRevert(CreatorGaugeController.RouterNotAllowed.selector);
            gauge.processWETHFeesWithRoute(wethAmount, rogue, _routeCall(wethAmount), 0);
        }

        function test_setFallbackMinOutputBps_nonzeroReverts() public {
            vm.expectRevert(CreatorGaugeController.FallbackMinOutputDisabled.selector);
            gauge.setFallbackMinOutputBps(9000);
        }

        function test_renounceOwnership_disabled() public {
            vm.expectRevert(CreatorGaugeController.OwnershipRenounceDisabled.selector);
            gauge.renounceOwnership();
        }

        function test_executeEmergencyWithdraw_wethAllowsSurplusOnly() public {
            uint256 pending = 5 ether;
            uint256 surplus = 1 ether;
            _depositPendingWeth(pending);
            weth.mint(address(gauge), surplus);

            gauge.emergencyWithdraw(WETH_ADDR, surplus, address(this));
            vm.warp(block.timestamp + gauge.EMERGENCY_WITHDRAW_DELAY());
            gauge.executeEmergencyWithdraw();

            assertEq(weth.balanceOf(address(this)), surplus);
            assertEq(gauge.pendingWETHFees(), pending);
            assertEq(weth.balanceOf(address(gauge)), pending);

            // Cannot drain earmarked pending fees.
            gauge.emergencyWithdraw(WETH_ADDR, 1, address(this));
            vm.warp(block.timestamp + gauge.EMERGENCY_WITHDRAW_DELAY());
            vm.expectRevert(CreatorGaugeController.PendingWethFeesProtected.selector);
            gauge.executeEmergencyWithdraw();
        }

        /// ODA-424-L4 / 432-F3: WETH lane must not advance the ShareOFT distribution clock.
        function test_wethProcess_doesNotBlockOftDistribute() public {
            vm.warp(block.timestamp + gauge.distributionInterval());

            uint256 wethAmount = 5 ether;
            uint256 sharePerEth = 2e18;
            uint256 shareOut = 10 ether;

            _depositPendingWeth(wethAmount);
            gauge.setOracle(address(oracle));
            oracle.setCreatorPerEth(sharePerEth);
            shareOFT.mint(address(buybackRouter), shareOut);
            buybackRouter.setAmountOut(shareOut);

            uint256 beforeOftClock = gauge.lastDistribution();
            gauge.processWETHFeesWithRoute(wethAmount, address(buybackRouter), _routeCall(wethAmount), 0);

            assertEq(gauge.lastWethDistribution(), block.timestamp);
            assertEq(gauge.lastDistribution(), beforeOftClock);

            uint256 oftAmount = 100e18;
            shareOFT.mint(address(this), oftAmount);
            shareOFT.approve(address(gauge), oftAmount);
            gauge.deposit(oftAmount);

            // Same block as WETH process — WETH lane must not have set lastDistribution.
            gauge.distribute();
            assertEq(gauge.pendingFees(), 0);
            assertEq(gauge.lastDistribution(), block.timestamp);
        }

        /// ODA-467-[1]: bridged OFT burn-slice unwrap failure must not brick distribute/intake.
        function test_bridgedFees_unwrapFailureFoldsBurnSliceIntoJackpot() public {
            wrapper.setRevertUnwrap(true);
            vm.warp(block.timestamp + gauge.distributionInterval());

            uint256 bridged = 1_000e18;
            shareOFT.mint(address(gauge), bridged);

            uint256 jackpotBefore = gauge.jackpotReserve();
            gauge.receiveBridgedFees();

            // Auto-distribute ran; burn slice folded to jackpot instead of reverting.
            assertEq(gauge.pendingFees(), 0, "pending must clear");
            assertGt(gauge.jackpotReserve(), jackpotBefore, "burn slice should land in jackpot");

            // Intake remains live for a second bridged credit (no permanent brick).
            vm.warp(block.timestamp + gauge.distributionInterval());
            shareOFT.mint(address(gauge), bridged);
            gauge.receiveBridgedFees();
            assertEq(gauge.pendingFees(), 0, "second distribute must also succeed");
        }

        function test_setLotteryManager_zeroRevokesImmediatelyAndCancelsPending() public {
            address first = makeAddr("lottery1");
            address second = makeAddr("lottery2");

            gauge.setLotteryManager(first);
            gauge.setLotteryManager(second);
            assertEq(address(gauge.lotteryManager()), first);
            assertEq(address(gauge.pendingLotteryManager()), second);
            assertGt(gauge.pendingLotteryManagerAt(), 0);

            // ODA-467-2: address(0) revokes instantly and clears the queue.
            gauge.setLotteryManager(address(0));
            assertEq(address(gauge.lotteryManager()), address(0));
            assertEq(address(gauge.pendingLotteryManager()), address(0));
            assertEq(gauge.pendingLotteryManagerAt(), 0);
        }

        function test_setOracleConfig_rejectsBelowMinTwap() public {
            vm.expectRevert(CreatorGaugeController.InvalidTwapDuration.selector);
            gauge.setOracleConfig(60, true);

            gauge.setOracleConfig(1800, true);
            assertEq(gauge.oracleTwapDuration(), 1800);
        }

        function test_setSwapConfig_whitelistsFeeTiers() public {
            gauge.setSwapConfig(100, 100);
            gauge.setSwapConfig(500, 100);
            gauge.setSwapConfig(3000, 100);
            gauge.setSwapConfig(10000, 100);

            vm.expectRevert(CreatorGaugeController.InvalidFeeTier.selector);
            gauge.setSwapConfig(1234, 100);
        }

        function test_setDistributionInterval_capsAt30Days() public {
            gauge.setDistributionInterval(30 days);
            assertEq(gauge.distributionInterval(), 30 days);

            vm.expectRevert(CreatorGaugeController.InvalidDistributionInterval.selector);
            gauge.setDistributionInterval(30 days + 1);
        }

        function _depositPendingWeth(uint256 amount) internal {
            weth.mint(alice, amount);
            vm.startPrank(alice);
            weth.approve(address(gauge), amount);
            gauge.receiveWETHFees(amount);
            vm.stopPrank();
        }
    }
