// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AgentGaugeController} from "@4626/agent/revenue/AgentGaugeController.sol";
import {AgentOVaultWrapper} from "@4626/agent/vault/AgentOVaultWrapper.sol";

/// @dev Mapping-based ERC20 with optional fee-on-transfer (L-2) and re-settable decimals (L-9).
contract MockToken508 {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public transferFeeBps;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function setDecimals(uint8 d) external {
        decimals = d;
    }

    function setTransferFeeBps(uint256 bps) external {
        transferFeeBps = bps;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        balanceOf[from] -= amount;
        uint256 fee = (amount * transferFeeBps) / 10000;
        balanceOf[to] += amount - fee;
        totalSupply -= fee;
    }
}

/// @dev WETH stand-in with the payable `deposit()` the gauge's receive() wraps into.
contract MockWeth508 {
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function deposit() external payable {
        totalSupply += msg.value;
        balanceOf[msg.sender] += msg.value;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @dev Vault mock: share token + the `gaugeController()` getter the ODA-508-5 checks read.
contract MockVault508 is MockToken508 {
    IERC20 public immutable assetToken;
    uint256 public pps = 1e18;
    address public gaugeController;
    uint256 public largeWithdrawalThreshold;

    constructor(address _asset) MockToken508("Mock Vault Share", "mVS") {
        assetToken = IERC20(_asset);
    }

    function setGaugeController(address g) external {
        gaugeController = g;
    }

    function setPricePerShare(uint256 _pps) external {
        pps = _pps;
    }

    function setLargeWithdrawalThreshold(uint256 t) external {
        largeWithdrawalThreshold = t;
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return (shares * pps) / 1e18;
    }

    function pricePerShare() external view returns (uint256) {
        return pps;
    }

    function totalAssets() external view returns (uint256) {
        return assetToken.balanceOf(address(this));
    }

    function asset() external view returns (address) {
        return address(assetToken);
    }

    function burnSharesForPriceIncrease(uint256 shares) external {
        balanceOf[msg.sender] -= shares;
        totalSupply -= shares;
    }
}

/// @dev Wrapper mock with revert modes matching the real wrapper's error surface.
contract MockWrapper508 {
    error InsufficientLocked();
    error BurnExceedsTotalMinted(uint256 totalMinted, uint256 burnAmount);
    error CooldownBlocked(uint256 currentBlock, uint256 requiredBlock);

    uint256 public constant NORMALIZATION = 1000;
    MockToken508 public immutable vaultToken;
    MockToken508 public immutable oftToken;
    uint8 public unwrapMode; // 0=ok, 1=InsufficientLocked, 2=BurnExceedsTotalMinted, 3=other

    constructor(address vault_, address oft_) {
        vaultToken = MockToken508(vault_);
        oftToken = MockToken508(oft_);
    }

    function setUnwrapMode(uint8 mode) external {
        unwrapMode = mode;
    }

    function vaultShares() external view returns (address) {
        return address(vaultToken);
    }

    function previewWrap(uint256 amount, address) external pure returns (uint256) {
        return amount / NORMALIZATION;
    }

    function wrap(uint256 amount) external returns (uint256) {
        vaultToken.transferFrom(msg.sender, address(this), amount);
        uint256 out = amount / NORMALIZATION;
        oftToken.mint(msg.sender, out);
        return out;
    }

    function unwrap(uint256 amount) external returns (uint256) {
        if (unwrapMode == 1) revert InsufficientLocked();
        if (unwrapMode == 2) revert BurnExceedsTotalMinted(0, amount);
        if (unwrapMode == 3) revert CooldownBlocked(block.number, block.number + 1);
        oftToken.transferFrom(msg.sender, address(this), amount);
        uint256 out = amount * NORMALIZATION;
        vaultToken.mint(msg.sender, out);
        return out;
    }
}

contract MockOracle508 {
    bool public shouldRevert;
    bool public priceFresh = true;
    uint256 public assetPerEth;

    function setShouldRevert(bool v) external {
        shouldRevert = v;
    }

    function setPriceFresh(bool v) external {
        priceFresh = v;
    }

    function setAssetPerEth(uint256 v) external {
        assetPerEth = v;
    }

    function getAssetPrice() external view returns (int256, uint256) {
        return (1e8, block.timestamp);
    }

    function getAssetEthTWAP(uint32) external view returns (uint256) {
        if (shouldRevert) revert("oracle unavailable");
        return assetPerEth;
    }

    function isPriceFresh() external view returns (bool) {
        return priceFresh;
    }
}

/// @dev Allowlisted buyback router; optionally sends native ETH to the caller mid-swap (L-1).
contract MockRouter508 {
    MockWeth508 public immutable wethToken;
    MockToken508 public immutable shareToken;
    uint256 public amountOut;
    uint256 public ethRefund;
    bool public shouldRevert;

    constructor(address weth_, address share_) {
        wethToken = MockWeth508(weth_);
        shareToken = MockToken508(share_);
    }

    function setAmountOut(uint256 v) external {
        amountOut = v;
    }

    function setEthRefund(uint256 v) external {
        ethRefund = v;
    }

    function setShouldRevert(bool v) external {
        shouldRevert = v;
    }

    function buyback(uint256 wethIn) external {
        if (shouldRevert) revert("router reverted");
        wethToken.transferFrom(msg.sender, address(this), wethIn);
        shareToken.transfer(msg.sender, amountOut);
        uint256 refund = ethRefund;
        if (refund > 0) {
            ethRefund = 0;
            (bool ok,) = payable(msg.sender).call{value: refund}("");
            require(ok, "refund failed");
        }
    }

    receive() external payable {}
}

/// @dev Voter-rewards distributor with pull/revert/bonus-credit modes (L-3).
contract MockDistributor508 {
    uint8 public mode; // 0=pull all, 1=pull half, 2=pull none, 3=revert, 4=pull half + mint half to gauge

    function setMode(uint8 m) external {
        mode = m;
    }

    function notifyRewards(address, address token, uint256 amount) external {
        if (mode == 3) revert("distributor reverted");
        if (mode == 2) return;
        uint256 pull = mode == 0 ? amount : amount / 2;
        IERC20(token).transferFrom(msg.sender, address(this), pull);
        if (mode == 4) {
            // A ◆ credit landing in the gauge during notifyRewards: balance-delta accounting
            // (pre-ODA-508-L3) misread this as spent == 0 and paid the slice a second time.
            MockToken508(token).mint(msg.sender, pull);
        }
    }
}

/// @dev Force-feeds native ETH via SELFDESTRUCT (L-5 / F6 native sweep).
contract SelfDestructFunder508 {
    constructor() payable {}

    function boom(address payable target) external {
        selfdestruct(target);
    }
}

interface IWrapperCooldownHook508 {
    function propagateCooldownOnTransfer(address from, address to, uint256 amount) external;
}

/// @dev ShareOFT stand-in mirroring AgentShareOFT's _update cooldown hook (F1 e2e).
contract MockShareOftHook508 is ERC20 {
    address public wrapper;

    constructor() ERC20("Agent Share", "ASHARE") {}

    function setWrapper(address w) external {
        wrapper = w;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        address w = wrapper;
        if (w == address(0)) return;
        if (from == address(0) || to == address(0)) return;
        if (from == to) return;
        IWrapperCooldownHook508(w).propagateCooldownOnTransfer(from, to, value);
    }
}

contract AgentGaugeControllerOda508RemediationTest is Test {
    address internal constant WETH_ADDR = 0x4200000000000000000000000000000000000006;

    event BurnSliceDegraded(uint256 oftAmount);
    event DistributionIntervalUpdated(uint256 newInterval);

    AgentGaugeController internal gauge;
    MockWeth508 internal weth;
    MockToken508 internal agentToken;
    MockToken508 internal shareOFT;
    MockVault508 internal vault;
    MockWrapper508 internal wrapper;
    MockOracle508 internal oracle;
    MockRouter508 internal router;
    MockDistributor508 internal distributor;

    address internal alice = makeAddr("alice");
    address internal keeper = makeAddr("keeper");
    address internal agentTreasury = makeAddr("agentTreasury");
    address internal protocolTreasury = makeAddr("protocolTreasury");
    address internal lottery = makeAddr("lottery");

    function setUp() public {
        vm.chainId(8453);
        vm.etch(WETH_ADDR, address(new MockWeth508()).code);
        weth = MockWeth508(WETH_ADDR);

        agentToken = new MockToken508("Agent Token", "AGNT");
        shareOFT = new MockToken508("Share OFT", "SHARE");
        vault = new MockVault508(address(agentToken));
        wrapper = new MockWrapper508(address(vault), address(shareOFT));
        oracle = new MockOracle508();
        router = new MockRouter508(WETH_ADDR, address(shareOFT));
        distributor = new MockDistributor508();

        gauge = new AgentGaugeController(address(shareOFT), agentTreasury, protocolTreasury, address(this));
        gauge.setVault(address(vault));
        gauge.setAgentToken(address(agentToken));
        gauge.setWrapper(address(wrapper));
        vault.setGaugeController(address(gauge));

        gauge.setAllowedSwapRouter(address(router), true); // ODA-508-L4: queues
        gauge.setWethFeeKeeper(keeper);
        gauge.setWethProcessingConfig(100 ether, false);
        gauge.setOracle(address(oracle)); // first-ever set: immediate
        oracle.setAssetPerEth(2e18);

        vm.warp(1 days + 1); // past the default distribution interval for first-cycle tests
        gauge.executeRouterAllowlist(address(router)); // timelock elapsed → router active
    }

    function _fundGaugeOft(uint256 amount) internal {
        shareOFT.mint(alice, amount);
        vm.startPrank(alice);
        shareOFT.approve(address(gauge), amount);
        gauge.deposit(amount); // deposit never auto-distributes
        vm.stopPrank();
    }

    function _fundWeth(uint256 amount) internal {
        weth.mint(alice, amount);
        vm.startPrank(alice);
        weth.approve(address(gauge), amount);
        gauge.receiveWETHFees(amount);
        vm.stopPrank();
    }

    function _split200(uint256 oftAmount)
        internal
        pure
        returns (uint256 toLottery, uint256 toVoters, uint256 toBurnOft)
    {
        toLottery = (oftAmount * 6900) / 10000;
        toVoters = (oftAmount * 2139) / 10000;
        toBurnOft = oftAmount - toLottery - toVoters; // treasuryShareBps == 0
    }

    // ---------------- F1 (High) — narrowed burn-slice catch ----------------

    function test_f1_bridgedRevertDegradesAndRetriesNextCycle() public {
        _fundGaugeOft(200 ether);
        wrapper.setUnwrapMode(1); // InsufficientLocked — the legitimate bridged-accounting case

        (uint256 toLottery, uint256 toVoters, uint256 toBurnOft) = _split200(200 ether);

        vm.expectEmit(false, false, false, true, address(gauge));
        emit BurnSliceDegraded(toBurnOft);
        gauge.distribute();

        assertEq(gauge.pendingFees(), toBurnOft, "burn slice re-queued for retry");
        assertEq(gauge.jackpotReserve(), toLottery, "no silent jackpot reclassification");
        assertEq(gauge.accountedOFTBalance(), toLottery + toBurnOft);
        assertEq(shareOFT.balanceOf(protocolTreasury), toVoters, "voter slice still routed");
        assertEq(gauge.totalSharesBurned(), 0);

        // Next cycle with a healthy wrapper: the re-queued slice re-splits and burns.
        gauge.setDistributionThreshold(1 ether);
        wrapper.setUnwrapMode(0);
        vm.warp(block.timestamp + 1 hours + 1);
        (uint256 toLottery2,, uint256 toBurnOft2) = _split200(toBurnOft);
        gauge.distribute();

        assertEq(gauge.totalSharesBurned(), toBurnOft2 * 1000, "retry burns the slice");
        assertEq(gauge.pendingFees(), 0);
        assertEq(gauge.jackpotReserve(), toLottery + toLottery2);
    }

    function test_f1_nonBridgedRevertFailsLoud() public {
        _fundGaugeOft(200 ether);
        wrapper.setUnwrapMode(3); // arbitrary wrapper failure — NOT a bridged-accounting revert

        bytes memory inner =
            abi.encodeWithSelector(MockWrapper508.CooldownBlocked.selector, block.number, block.number + 1);
        vm.expectRevert(abi.encodeWithSelector(AgentGaugeController.BurnSliceUnwrapFailed.selector, inner));
        gauge.distribute();

        // Whole distribution rolled back; nothing diverted to jackpot.
        assertEq(gauge.pendingFees(), 200 ether);
        assertEq(gauge.jackpotReserve(), 0);
    }

    function test_f1_realWrapper_hotDustDoesNotBlockGaugeBurn() public {
        // Real AgentOVaultWrapper (with the shipped ODA-507-1 hot-balance fix) over the mock vault.
        MockShareOftHook508 realShare = new MockShareOftHook508();
        AgentOVaultWrapper realWrapper = new AgentOVaultWrapper(address(agentToken), address(vault), address(this));
        realWrapper.setShareOFT(address(realShare));
        realShare.setWrapper(address(realWrapper));

        AgentGaugeController realGauge =
            new AgentGaugeController(address(realShare), agentTreasury, protocolTreasury, address(this));
        realGauge.setVault(address(vault));
        realGauge.setAgentToken(address(agentToken));
        realGauge.setWrapper(address(realWrapper));
        vault.setGaugeController(address(realGauge));
        // Keep the intake sweep from auto-distributing; the attack must precede the burn.
        realGauge.setDistributionThreshold(1000 ether);

        // alice wraps through the real wrapper (builds wrapper-tracked locked/minted backing).
        uint256 wrapShares = 300_000 ether;
        vault.mint(alice, wrapShares);
        vm.startPrank(alice);
        vault.approve(address(realWrapper), wrapShares);
        realWrapper.wrap(wrapShares); // 300 ether ◆ → alice
        vm.stopPrank();

        // Bridged fees land directly on the gauge (mint → hook skips cooldown on mints).
        uint256 bridged = 200 ether;
        realShare.mint(address(realGauge), bridged);
        realGauge.receiveBridgedFees();
        assertEq(realGauge.pendingFees(), bridged);

        // Attack (audit finding 1): 1-wei hot transfer poisons the gauge's cooldown stamp.
        vm.prank(alice);
        realShare.transfer(address(realGauge), 1);
        assertEq(realWrapper.cooldownShareOFTBalance(address(realGauge)), 1, "hot dust propagated");

        // Same block.number (cooldown active), but amount-scoped accounting leaves the
        // bridged ◆ cooled: the burn slice unwraps and burns instead of degrading/reverting.
        (,, uint256 toBurnOft) = _split200(bridged);
        realGauge.forceDistribute(); // owner path: threshold raised above, interval irrelevant

        assertEq(realGauge.totalSharesBurned(), toBurnOft * 1000, "burn executed despite hot dust");
        assertEq(realGauge.pendingFees(), 0, "no degrade re-queue");
    }

    function test_f1_realWrapper_registeredGauge_bypassesAsyncGate_forBurnSlice() public {
        // Same real-stack harness as the hot-dust test, but the mock vault advertises a
        // largeWithdrawalThreshold, so the wrapper's async-redemption gate is ACTIVE.
        MockShareOftHook508 realShare = new MockShareOftHook508();
        AgentOVaultWrapper realWrapper = new AgentOVaultWrapper(address(agentToken), address(vault), address(this));
        realWrapper.setShareOFT(address(realShare));
        realShare.setWrapper(address(realWrapper));

        AgentGaugeController realGauge =
            new AgentGaugeController(address(realShare), agentTreasury, protocolTreasury, address(this));
        realGauge.setVault(address(vault));
        realGauge.setAgentToken(address(agentToken));
        realGauge.setWrapper(address(realWrapper));
        vault.setGaugeController(address(realGauge));
        realGauge.setDistributionThreshold(1000 ether);

        // Any unwrap whose previewRedeem meets 1 ether of assets is "large"...
        vault.setLargeWithdrawalThreshold(1 ether);

        uint256 wrapShares = 300_000 ether;
        vault.mint(alice, wrapShares);
        vm.startPrank(alice);
        vault.approve(address(realWrapper), wrapShares);
        realWrapper.wrap(wrapShares); // 300 ether ◆ → alice
        vm.stopPrank();

        // ...so a NON-gauge large unwrap reverts (ODA-498-4 behavior preserved).
        vm.roll(block.number + 2); // default wrapper delay = 1 block
        uint256 aliceOft = realShare.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(AgentOVaultWrapper.AsyncRedemptionRequired.selector, aliceOft * 1000, 1 ether)
        );
        realWrapper.unwrap(aliceOft);

        // The registered gauge's burn slice still unwraps and burns — no redemption occurs.
        uint256 bridged = 200 ether;
        realShare.mint(address(realGauge), bridged);
        realGauge.receiveBridgedFees();
        (,, uint256 toBurnOft) = _split200(bridged);
        realGauge.forceDistribute();

        assertEq(realGauge.totalSharesBurned(), toBurnOft * 1000, "gauge burn slice exempt from async gate");
        assertEq(realGauge.pendingFees(), 0, "no degrade re-queue");
    }

    // ---------------- F2 — stranded-WETH escape hatch + oracle-disable semantics ----------------

    function test_f2_writeDownThenRescueSurplus() public {
        _fundWeth(100 ether);
        assertEq(gauge.pendingWETHFees(), 100 ether);

        // The emergency path refuses protected (earmarked) WETH.
        gauge.emergencyWithdraw(WETH_ADDR, 40 ether, protocolTreasury);
        vm.warp(block.timestamp + 1 days);
        vm.expectRevert(AgentGaugeController.PendingWethFeesProtected.selector);
        gauge.executeEmergencyWithdraw();

        // Write down 60 of the earmark: early execute reverts; after the delay it lands.
        gauge.queueWriteDownPendingWETHFees(60 ether);
        uint256 executeAfter = gauge.pendingWethWriteDownAt();
        vm.expectRevert(abi.encodeWithSelector(AgentGaugeController.WethWriteDownTooEarly.selector, executeAfter));
        gauge.executeWriteDownPendingWETHFees();
        vm.warp(executeAfter);
        gauge.executeWriteDownPendingWETHFees();
        assertEq(gauge.pendingWETHFees(), 40 ether);

        // The written-down WETH is now surplus, rescueable via the emergency path.
        // Warp to the queued executeAfter (absolute target — relative `block.timestamp + 1 days`
        // gets CSE'd with the earlier occurrence across cheatcode warps by the optimizer).
        gauge.emergencyWithdraw(WETH_ADDR, 60 ether, protocolTreasury);
        vm.warp(gauge.pendingEmergencyWithdrawAt());
        gauge.executeEmergencyWithdraw();
        assertEq(weth.balanceOf(protocolTreasury), 60 ether);
        assertEq(gauge.pendingWETHFees(), 40 ether);
    }

    function test_f2_writeDownCancel() public {
        _fundWeth(50 ether);
        gauge.queueWriteDownPendingWETHFees(50 ether);
        gauge.cancelWriteDownPendingWETHFees();
        assertEq(gauge.pendingWethWriteDownAmount(), 0);
        assertEq(gauge.pendingWethWriteDownAt(), 0);
        vm.expectRevert(AgentGaugeController.NoPendingWethWriteDown.selector);
        gauge.executeWriteDownPendingWETHFees();
        assertEq(gauge.pendingWETHFees(), 50 ether, "cancel preserves the earmark");
    }

    function test_f2_oracleDisabledUsesCallerSuppliedFloor() public {
        _fundWeth(100 ether);
        gauge.setWethKeeperCooldown(0); // isolate from F8
        oracle.setShouldRevert(true);
        gauge.setOracleConfig(1800, false); // disable oracle slippage entirely

        uint256 floor = 40e15;
        router.setAmountOut(50e15);
        shareOFT.mint(address(router), 50e15);
        vm.prank(keeper);
        gauge.processWETHFeesWithRoute(50 ether, address(router), abi.encodeCall(MockRouter508.buyback, (50 ether)), floor);

        assertEq(gauge.pendingWETHFees(), 50 ether);
        assertEq(gauge.pendingFees(), 50e15, "buyback credited with dead oracle when disabled");

        // Re-enabled + dead oracle still fails closed.
        gauge.setOracleConfig(1800, true);
        vm.prank(keeper);
        vm.expectRevert(AgentGaugeController.MinOutputUnavailable.selector);
        gauge.processWETHFeesWithRoute(50 ether, address(router), abi.encodeCall(MockRouter508.buyback, (50 ether)), floor);
    }

    // ---------------- F3 — lottery-manager timelock bypass ----------------

    function test_f3_revokeThenResetRoutesThroughTimelock() public {
        gauge.setLotteryManager(lottery);
        assertEq(gauge.lotteryManager(), lottery, "first-ever set is immediate");
        assertTrue(gauge.lotteryManagerInitialized());

        gauge.setLotteryManager(address(0)); // immediate revoke
        assertEq(gauge.lotteryManager(), address(0));

        // Pre-fix this re-set applied instantly (the bypass); now it must queue.
        address next = makeAddr("nextManager");
        gauge.setLotteryManager(next);
        assertEq(gauge.lotteryManager(), address(0), "re-set must not apply instantly");
        assertEq(gauge.pendingLotteryManager(), next);
        uint256 executeAfter = gauge.pendingLotteryManagerAt();
        assertGt(executeAfter, block.timestamp);

        vm.expectRevert(
            abi.encodeWithSelector(AgentGaugeController.LotteryManagerUpdateTimelockActive.selector, executeAfter)
        );
        gauge.executeLotteryManagerUpdate();

        vm.warp(executeAfter);
        gauge.executeLotteryManagerUpdate();
        assertEq(gauge.lotteryManager(), next);
    }

    // ---------------- F5 — atomic core wiring + registration check ----------------

    function test_f5_atomicMigrationBreaksDeadlock() public {
        MockVault508 vault2 = new MockVault508(address(agentToken));
        MockWrapper508 wrapper2 = new MockWrapper508(address(vault2), address(shareOFT));

        // Individual setters deadlock: each validates the mixed (new, old) pair.
        vm.expectRevert(AgentGaugeController.InvalidWrapperVaultBinding.selector);
        gauge.setVault(address(vault2));
        vm.expectRevert(AgentGaugeController.InvalidWrapperVaultBinding.selector);
        gauge.setWrapper(address(wrapper2));

        // Atomic setter validates the complete triple once.
        vault2.setGaugeController(address(gauge));
        gauge.setCoreWiring(address(vault2), address(wrapper2), address(agentToken));
        assertEq(address(gauge.vault()), address(vault2));
        assertEq(address(gauge.wrapper()), address(wrapper2));

        // ...and the migrated stack still distributes end to end.
        _fundGaugeOft(200 ether);
        gauge.distribute();
        assertGt(gauge.totalSharesBurned(), 0);
    }

    function test_f5_setCoreWiringRejectsUnregisteredVault() public {
        MockVault508 vault2 = new MockVault508(address(agentToken));
        MockWrapper508 wrapper2 = new MockWrapper508(address(vault2), address(shareOFT));
        // vault2.gaugeController != gauge (never registered).
        vm.expectRevert(AgentGaugeController.GaugeNotRegisteredOnVault.selector);
        gauge.setCoreWiring(address(vault2), address(wrapper2), address(agentToken));
    }

    function test_f5_burnPreflightClearErrorWhenRepointed() public {
        _fundGaugeOft(200 ether);
        vault.setGaugeController(makeAddr("otherGauge")); // vault owner repoints the gauge
        vm.expectRevert(AgentGaugeController.GaugeNotRegisteredOnVault.selector);
        gauge.distribute();
        assertEq(gauge.pendingFees(), 200 ether, "state rolled back for recovery");
    }

    // ---------------- F6 — emergency-withdraw timelock ----------------

    function test_f6_queueCancelExecuteAndExecuteTimeGuards() public {
        _fundGaugeOft(200 ether);
        gauge.distribute();
        assertEq(gauge.jackpotReserve(), 138 ether);

        // Queue-only: nothing moves.
        (, uint256 toVoters,) = _split200(200 ether);
        uint256 treasuryBefore = shareOFT.balanceOf(protocolTreasury);
        assertEq(treasuryBefore, toVoters, "voter slice from the distribution");
        gauge.emergencyWithdraw(address(shareOFT), 1 ether, protocolTreasury);
        assertEq(shareOFT.balanceOf(protocolTreasury), treasuryBefore, "queue transfers nothing");

        // Jackpot guard fires at execute time.
        vm.warp(block.timestamp + 1 days);
        vm.expectRevert(AgentGaugeController.JackpotReserveProtected.selector);
        gauge.executeEmergencyWithdraw();

        // Cancel path.
        gauge.emergencyWithdraw(address(shareOFT), 1 ether, protocolTreasury);
        gauge.cancelEmergencyWithdraw();
        assertEq(gauge.pendingEmergencyWithdrawAmount(), 0);
        vm.expectRevert(AgentGaugeController.NoPendingEmergencyWithdraw.selector);
        gauge.executeEmergencyWithdraw();

        // ZeroAmount on queue.
        vm.expectRevert(AgentGaugeController.ZeroAmount.selector);
        gauge.emergencyWithdraw(address(shareOFT), 0, protocolTreasury);

        // Successful execute of an unrelated stray token after the delay.
        MockToken508 stray = new MockToken508("Stray", "STRAY");
        stray.mint(address(gauge), 10 ether);
        gauge.emergencyWithdraw(address(stray), 10 ether, protocolTreasury);
        uint256 executeAfter = gauge.pendingEmergencyWithdrawAt();
        vm.expectRevert(
            abi.encodeWithSelector(AgentGaugeController.EmergencyWithdrawTooEarly.selector, executeAfter)
        );
        gauge.executeEmergencyWithdraw();
        vm.warp(executeAfter);
        gauge.executeEmergencyWithdraw();
        assertEq(stray.balanceOf(protocolTreasury), 10 ether);
    }

    function test_f6_nativeEthSweep() public {
        SelfDestructFunder508 funder = new SelfDestructFunder508{value: 2 ether}();
        funder.boom(payable(address(gauge)));
        assertEq(address(gauge).balance, 2 ether, "selfdestruct force-feed bypasses receive()");

        gauge.emergencyWithdraw(address(0), 2 ether, protocolTreasury);
        vm.warp(block.timestamp + 1 days);
        uint256 before = protocolTreasury.balance;
        gauge.executeEmergencyWithdraw();
        assertEq(protocolTreasury.balance, before + 2 ether);
        assertEq(address(gauge).balance, 0);
    }

    // ---------------- F7 — permissionless cadence control ----------------

    function test_f7_thresholdBindsPermissionlessDistribute() public {
        _fundGaugeOft(50 ether); // below the 100 ether default threshold
        vm.warp(block.timestamp + 1 hours + 1);
        assertFalse(gauge.canDistribute());
        vm.expectRevert(AgentGaugeController.BelowDistributionThreshold.selector);
        gauge.distribute();
        assertEq(gauge.lastDistribution(), 0, "dust cannot reset the cadence clock");

        _fundGaugeOft(60 ether); // 110 ether total
        assertTrue(gauge.canDistribute());
        gauge.distribute();
        assertGt(gauge.totalSharesBurned(), 0);
    }

    function test_f7_intervalFloorAndEvent() public {
        vm.expectRevert(AgentGaugeController.InvalidDistributionInterval.selector);
        gauge.setDistributionInterval(0);
        vm.expectRevert(AgentGaugeController.InvalidDistributionInterval.selector);
        gauge.setDistributionInterval(4 minutes);
        vm.expectRevert(AgentGaugeController.InvalidDistributionInterval.selector);
        gauge.setDistributionInterval(31 days);

        vm.expectEmit(false, false, false, true, address(gauge));
        emit DistributionIntervalUpdated(5 minutes);
        gauge.setDistributionInterval(5 minutes);
        assertEq(gauge.distributionInterval(), 5 minutes);
    }

    // ---------------- F8 — loopable keeper cap ----------------

    function test_f8_keeperCooldownBoundsThroughput() public {
        _fundWeth(200 ether);
        uint256 floor = 40e15;
        router.setAmountOut(1e17); // ≥ oracle sanity bound (9.9e16 for 50 WETH at 2:1)
        shareOFT.mint(address(router), 1e18);

        vm.prank(keeper);
        gauge.processWETHFeesWithRoute(50 ether, address(router), abi.encodeCall(MockRouter508.buyback, (50 ether)), floor);
        assertEq(gauge.pendingWETHFees(), 150 ether);

        // Pre-fix the per-call cap looped within one transaction; now cooldown-bound.
        vm.prank(keeper);
        vm.expectRevert(AgentGaugeController.KeeperCooldownActive.selector);
        gauge.processWETHFeesWithRoute(50 ether, address(router), abi.encodeCall(MockRouter508.buyback, (50 ether)), floor);

        // Owner path is never gated.
        gauge.processWETHFeesWithRoute(50 ether, address(router), abi.encodeCall(MockRouter508.buyback, (50 ether)), floor);

        vm.warp(block.timestamp + 1 hours);
        vm.prank(keeper);
        gauge.processWETHFeesWithRoute(50 ether, address(router), abi.encodeCall(MockRouter508.buyback, (50 ether)), floor);
        assertEq(gauge.pendingWETHFees(), 50 ether);
    }

    // ---------------- Lows ----------------

    function test_l1_nativeRefundMidSwapDoesNotRevertOrDoubleCredit() public {
        _fundWeth(100 ether);
        router.setAmountOut(1e17);
        shareOFT.mint(address(router), 1e17);
        vm.deal(address(router), 1 ether);
        router.setEthRefund(0.5 ether); // Universal-Router-style native refund mid-swap

        uint256 receivedBefore = gauge.totalWETHFeesReceived();
        vm.prank(keeper);
        gauge.processWETHFeesWithRoute(50 ether, address(router), abi.encodeCall(MockRouter508.buyback, (50 ether)), 40e15);

        // Pre-fix: receive() re-credited the refund → exact-consumption check reverted the swap.
        assertEq(gauge.pendingWETHFees(), 50 ether, "refund not double-credited");
        assertEq(gauge.totalWETHFeesReceived(), receivedBefore, "no phantom WETH income");
        assertEq(weth.balanceOf(address(gauge)), 50.5 ether, "refund sits as untracked surplus");
        assertEq(gauge.pendingFees(), 1e17, "buyback credited");
    }

    function test_l2_feeOnTransferIntakeCreditsDelta() public {
        shareOFT.setTransferFeeBps(1000); // 10%
        shareOFT.mint(alice, 100 ether);
        vm.startPrank(alice);
        shareOFT.approve(address(gauge), 100 ether);
        gauge.deposit(100 ether);
        vm.stopPrank();

        assertEq(gauge.pendingFees(), 90 ether, "credits arrived amount, not requested");
        assertEq(gauge.totalFeesReceived(), 90 ether);
        assertEq(gauge.accountedOFTBalance(), 90 ether);
    }

    function test_l3_partialPullRemainderFromAllowance() public {
        gauge.setve4626VoterRewardsDistributor(address(distributor));
        distributor.setMode(1); // pull half
        _fundGaugeOft(200 ether);
        gauge.distribute();

        (, uint256 toVoters,) = _split200(200 ether);
        assertEq(shareOFT.balanceOf(address(distributor)), toVoters / 2, "distributor pulled half");
        assertEq(shareOFT.balanceOf(protocolTreasury), toVoters - toVoters / 2, "remainder forwarded");
        assertEq(gauge.totalProtocolEarned(), toVoters);
        assertEq(gauge.jackpotReserve(), 138 ether, "jackpot untouched");
    }

    function test_l3_bonusCreditDuringNotifyDoesNotDoublePay() public {
        gauge.setve4626VoterRewardsDistributor(address(distributor));
        distributor.setMode(4); // pull half AND mint half to the gauge mid-call
        _fundGaugeOft(200 ether);
        gauge.distribute();

        (, uint256 toVoters,) = _split200(200 ether);
        // Balance-delta accounting (pre-fix) read spent == 0 and forwarded the full slice again.
        assertEq(shareOFT.balanceOf(protocolTreasury), toVoters - toVoters / 2, "no double pay");
        assertEq(gauge.jackpotReserve(), 138 ether, "jackpot backing not spent");
        // The minted bonus stays as untracked surplus, sweepable by receiveBridgedFees.
        assertEq(shareOFT.balanceOf(address(gauge)) - gauge.accountedOFTBalance(), toVoters / 2);
    }

    function test_l7_previewSwapGatesOnStalePrice() public {
        (,, bool active) = gauge.previewSwap(50 ether);
        assertTrue(active);

        oracle.setPriceFresh(false);
        (uint256 expectedOut, uint256 minOut, bool activeAfter) = gauge.previewSwap(50 ether);
        assertFalse(activeAfter);
        assertEq(expectedOut, 0);
        assertEq(minOut, 0);
    }

    function test_l9_non18AgentTokenRejected() public {
        MockToken508 sixDecimal = new MockToken508("Six", "SIX");
        sixDecimal.setDecimals(6);

        vm.expectRevert(
            abi.encodeWithSelector(AgentGaugeController.Non18DecimalAgentToken.selector, address(sixDecimal), 6)
        );
        gauge.setAgentToken(address(sixDecimal));

        MockVault508 vault2 = new MockVault508(address(sixDecimal));
        MockWrapper508 wrapper2 = new MockWrapper508(address(vault2), address(shareOFT));
        vault2.setGaugeController(address(gauge));
        vm.expectRevert(
            abi.encodeWithSelector(AgentGaugeController.Non18DecimalAgentToken.selector, address(sixDecimal), 6)
        );
        gauge.setCoreWiring(address(vault2), address(wrapper2), address(sixDecimal));
    }

    // ---------------- Second-pass lows/info (L-4, L-5 gas half, L-8, I-9) ----------------

    function test_l5_stipendSendKeepsRawEthSweepable() public {
        StipendSender508 sender = new StipendSender508();
        vm.deal(address(sender), 1 ether);

        // `.transfer` stipend (2,300 gas): pre-fix this reverted in receive(); now the ETH
        // is accepted raw (no wrap, no earmark) and recoverable via the native sweep.
        sender.send(payable(address(gauge)), 1 ether);
        assertEq(address(gauge).balance, 1 ether, "raw ETH accepted");
        assertEq(gauge.pendingWETHFees(), 0, "stipend send not earmarked");
        assertEq(weth.balanceOf(address(gauge)), 0, "stipend send not wrapped");

        // A full-gas send still wraps and credits normally.
        (bool ok,) = payable(address(gauge)).call{value: 2 ether}("");
        assertTrue(ok);
        assertEq(gauge.pendingWETHFees(), 2 ether, "full-gas send wraps + credits");

        gauge.emergencyWithdraw(address(0), 1 ether, protocolTreasury);
        vm.warp(gauge.pendingEmergencyWithdrawAt());
        uint256 before = protocolTreasury.balance;
        gauge.executeEmergencyWithdraw();
        assertEq(protocolTreasury.balance, before + 1 ether);
        assertEq(address(gauge).balance, 0);
    }

    function test_l4_oracleChangeTimelocked() public {
        // setUp's first set was immediate; later changes must queue.
        assertTrue(gauge.oracleInitialized());
        MockOracle508 oracle2 = new MockOracle508();

        gauge.setOracle(address(oracle2));
        assertEq(address(gauge.oracle()), address(oracle), "change not applied instantly");
        assertEq(gauge.pendingOracle(), address(oracle2));
        uint256 executeAfter = gauge.pendingOracleAt();
        assertGt(executeAfter, block.timestamp);

        vm.expectRevert(abi.encodeWithSelector(AgentGaugeController.OracleUpdateTooEarly.selector, executeAfter));
        gauge.executeOracleUpdate();

        vm.warp(executeAfter);
        gauge.executeOracleUpdate();
        assertEq(address(gauge.oracle()), address(oracle2));
        assertEq(gauge.pendingOracle(), address(0));
        assertEq(gauge.pendingOracleAt(), 0);

        // Cancel path.
        MockOracle508 oracle3 = new MockOracle508();
        gauge.setOracle(address(oracle3));
        gauge.cancelOracleUpdate();
        assertEq(gauge.pendingOracle(), address(0));
        vm.expectRevert(AgentGaugeController.NoPendingOracleUpdate.selector);
        gauge.executeOracleUpdate();
        assertEq(address(gauge.oracle()), address(oracle2), "cancel preserves current oracle");
    }

    function test_l4_routerAllowlistTimelockedRemovalInstant() public {
        MockRouter508 router2 = new MockRouter508(WETH_ADDR, address(shareOFT));

        gauge.setAllowedSwapRouter(address(router2), true);
        assertFalse(gauge.allowedSwapRouters(address(router2)), "addition not applied instantly");
        uint256 executeAfter = gauge.pendingRouterAllowlist(address(router2));
        assertGt(executeAfter, block.timestamp);

        vm.expectRevert(abi.encodeWithSelector(AgentGaugeController.RouterAllowlistTooEarly.selector, executeAfter));
        gauge.executeRouterAllowlist(address(router2));

        vm.warp(executeAfter);
        gauge.executeRouterAllowlist(address(router2));
        assertTrue(gauge.allowedSwapRouters(address(router2)));
        assertEq(gauge.pendingRouterAllowlist(address(router2)), 0);

        // Removal is immediate (kick a compromised router without delay).
        gauge.setAllowedSwapRouter(address(router2), false);
        assertFalse(gauge.allowedSwapRouters(address(router2)));

        // Removal also clears a pending addition.
        gauge.setAllowedSwapRouter(address(router2), true);
        gauge.setAllowedSwapRouter(address(router2), false);
        vm.expectRevert(AgentGaugeController.NoPendingRouterAllowlist.selector);
        gauge.executeRouterAllowlist(address(router2));

        // The router allowlisted in setUp survived untouched.
        assertTrue(gauge.allowedSwapRouters(address(router)));
    }

    function test_l8_twoStepOwnershipTransfer() public {
        address stranger = makeAddr("stranger");
        gauge.transferOwnership(stranger);
        assertEq(gauge.owner(), address(this), "mistyped/unaccepted target keeps current owner");
        assertEq(gauge.pendingOwner(), stranger);

        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", address(this)));
        gauge.acceptOwnership();

        vm.prank(stranger);
        gauge.acceptOwnership();
        assertEq(gauge.owner(), stranger);
        assertEq(gauge.pendingOwner(), address(0));

        vm.prank(stranger);
        vm.expectRevert(AgentGaugeController.OwnershipRenounceDisabled.selector);
        gauge.renounceOwnership();
    }

    function test_i9_wrapperPpsMatchesVaultVirtualOffset() public {
        AgentOVaultWrapper realWrapper = new AgentOVaultWrapper(address(agentToken), address(vault), address(this));
        agentToken.mint(address(vault), 500 ether); // totalAssets
        vault.mint(alice, 250 ether); // totalSupply

        uint256 assets = 500 ether;
        uint256 supply = 250 ether;
        uint256 expected = ((assets + 1) * 1e18) / (supply + 1000);
        assertEq(realWrapper.pricePerShare(), expected, "wrapper PPS uses the vault virtual-offset formula");
        assertLt(expected, (assets * 1e18) / supply, "offset tightens the naive ratio");

        // Empty-vault sentinel unchanged.
        MockVault508 emptyVault = new MockVault508(address(agentToken));
        AgentOVaultWrapper emptyWrapper =
            new AgentOVaultWrapper(address(agentToken), address(emptyVault), address(this));
        assertEq(emptyWrapper.pricePerShare(), 1e18);
    }
}

/// @dev Sends ETH via `.transfer` (2,300-gas stipend) — L-5 gas-stipend repro.
contract StipendSender508 {
    function send(address payable to, uint256 amount) external {
        to.transfer(amount);
    }

    receive() external payable {}
}
