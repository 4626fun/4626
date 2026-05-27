// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorOVault} from "../../../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultCoreModule} from "../../../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../../../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";
import {CreatorOVaultAdminModule} from "../../../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {IStrategy} from "../../../contracts/interfaces/IStrategy.sol";
import {IStrategyValuation} from "../../../contracts/interfaces/IStrategyValuation.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockRebalanceCoin is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

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
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}

contract WeightedMockStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    uint256 public trackedAssets;
    uint256 public withdrawCalls;
    uint256 public maxWithdrawCap;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function setTrackedAssetsForTest(uint256 amount) external {
        trackedAssets = amount;
    }

    function setMaxWithdrawCap(uint256 cap) external {
        maxWithdrawCap = cap;
    }

    function isValuationReady() external pure override returns (bool) {
        return true;
    }

    function isActive() external pure override returns (bool) {
        return true;
    }

    function asset() external view override returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external view override returns (uint256) {
        return trackedAssets;
    }

    function deposit(uint256 amount) external override returns (uint256 deposited) {
        if (amount == 0) return 0;
        require(TOKEN.transferFrom(msg.sender, address(this), amount), "transferFrom failed");
        trackedAssets += amount;
        return amount;
    }

    function withdraw(uint256 amount) external override returns (uint256 withdrawn) {
        withdrawCalls += 1;
        if (maxWithdrawCap > 0 && amount > maxWithdrawCap) {
            amount = maxWithdrawCap;
        }
        withdrawn = amount > trackedAssets ? trackedAssets : amount;
        if (withdrawn == 0) return 0;
        trackedAssets -= withdrawn;
        require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
    }

    function emergencyWithdraw() external override returns (uint256 withdrawn) {
        withdrawn = trackedAssets;
        trackedAssets = 0;
        if (withdrawn > 0) require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
    }

    function harvest() external pure override returns (uint256) {
        return 0;
    }

    function rebalance() external override {}
}

contract CreatorOVaultStrategiesRebalanceTest is Test {
    MockRebalanceCoin internal coin;
    CreatorOVault internal vault;
    WeightedMockStrategy internal charm;
    WeightedMockStrategy internal ajna;
    address internal keeper = makeAddr("keeper");
    address internal alice = makeAddr("alice");

    function setUp() public {
        coin = new MockRebalanceCoin();
        vault = new CreatorOVault(address(coin), address(this), "Creator OVault", "ovCR8R");
        vault.setModulesOnce(
            address(new CreatorOVaultCoreModule()),
            address(new CreatorOVaultStrategiesModule()),
            address(new CreatorOVaultAdminModule())
        );
        vault.setKeeper(keeper);
        vault.setMinimumTotalIdle(100e18);
        vault.setFlashLoanProtection(0, type(uint256).max, 1);

        charm = new WeightedMockStrategy(address(coin));
        ajna = new WeightedMockStrategy(address(coin));

        vault.addStrategy(address(charm), 4_500, true);
        vault.addStrategy(address(ajna), 4_500, true);

        uint256 depositAmount = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        coin.mint(alice, depositAmount + 500_000e18);
        vm.prank(alice);
        coin.approve(address(vault), type(uint256).max);
        vm.prank(alice);
        vault.deposit(depositAmount, alice);
    }

    function test_defaultQueue_matchesPhase3AddOrder() external view {
        assertEq(vault.defaultQueue(0), address(charm), "charm should be first in default queue");
        assertEq(vault.defaultQueue(1), address(ajna), "ajna should be second in default queue");
    }

    function test_rebalanceStrategies_movesCharmExcessToAjna() external {
        CreatorOVault skewVault = _deploySkewedVault();
        WeightedMockStrategy skewCharm = WeightedMockStrategy(skewVault.strategyList(0));
        WeightedMockStrategy skewAjna = WeightedMockStrategy(skewVault.strategyList(1));

        uint256 charmBefore = skewCharm.getTotalAssets();
        uint256 ajnaBefore = skewAjna.getTotalAssets();
        assertGt(charmBefore, ajnaBefore * 5, "precondition: charm should start materially overweight");

        vm.prank(keeper);
        skewVault.rebalanceStrategies(500);

        uint256 charmAfter = skewCharm.getTotalAssets();
        uint256 ajnaAfter = skewAjna.getTotalAssets();

        assertLt(charmAfter, charmBefore, "charm should lose TVL");
        assertGt(ajnaAfter, ajnaBefore, "ajna should gain TVL");

        uint256 total = skewVault.totalAssets();
        uint256 deployableBase = total > 100e18 ? total - 100e18 : 0;
        uint256 charmTarget = (deployableBase * 4_500) / 9_000;
        uint256 ajnaTarget = (deployableBase * 4_500) / 9_000;

        assertApproxEqAbs(charmAfter, charmTarget, 1e21, "charm should converge near target");
        assertApproxEqAbs(ajnaAfter, ajnaTarget, 1e21, "ajna should converge near target");
    }

    function _deploySkewedVault() internal returns (CreatorOVault skewVault) {
        skewVault = new CreatorOVault(address(coin), address(this), "Skew Vault", "ovSKEW");
        skewVault.setModulesOnce(
            address(new CreatorOVaultCoreModule()),
            address(new CreatorOVaultStrategiesModule()),
            address(new CreatorOVaultAdminModule())
        );
        skewVault.setKeeper(keeper);
        skewVault.setMinimumTotalIdle(100e18);
        skewVault.setFlashLoanProtection(0, type(uint256).max, 1);

        WeightedMockStrategy skewCharm = new WeightedMockStrategy(address(coin));
        skewVault.addStrategy(address(skewCharm), 9_000, true);

        uint256 depositAmount = skewVault.MINIMUM_FIRST_DEPOSIT() * 2;
        coin.mint(alice, depositAmount);
        vm.prank(alice);
        coin.approve(address(skewVault), type(uint256).max);
        vm.prank(alice);
        skewVault.deposit(depositAmount, alice);

        skewVault.forceDeployToStrategies();

        WeightedMockStrategy skewAjna = new WeightedMockStrategy(address(coin));
        skewVault.updateStrategyWeight(address(skewCharm), 4_500);
        skewVault.addStrategy(address(skewAjna), 4_500, true);
    }

    function test_rebalanceStrategies_skipsWhenWithinDeviationBand() external {
        vault.forceDeployToStrategies();

        uint256 charmBefore = charm.getTotalAssets();
        uint256 ajnaBefore = ajna.getTotalAssets();

        vm.prank(keeper);
        vault.rebalanceStrategies(5_000);

        assertEq(charm.getTotalAssets(), charmBefore, "within 50% band should skip withdraw");
        assertEq(ajna.getTotalAssets(), ajnaBefore, "within 50% band should skip redeploy delta");
    }

    function test_withdraw_hitsDefaultQueueFirstWhenEnabled() external {
        vault.setUseDefaultQueue(true);
        vault.forceDeployToStrategies();

        uint256 ask = vault.coinBalance() + 50e18;
        vm.prank(alice);
        vault.withdraw(ask, alice, alice);

        assertEq(charm.withdrawCalls(), 1, "charm should be hit first on redeem");
        assertEq(ajna.withdrawCalls(), 0, "ajna should not be touched when charm covers the deficit");
    }

    function test_rebalanceStrategies_revertsWhenNotKeeper() external {
        vm.prank(alice);
        vm.expectRevert(CreatorOVault.Unauthorized.selector);
        vault.rebalanceStrategies(500);
    }

    function test_rebalanceStrategies_revertsWhenMinDeviationAboveMaxBps() external {
        vm.prank(keeper);
        vm.expectRevert(CreatorOVaultStrategiesModule.InvalidWeight.selector);
        vault.rebalanceStrategies(10_001);
    }

    function test_rebalanceStrategies_zeroDeviationBand_convergesSmallDrift() external {
        vault.forceDeployToStrategies();

        uint256 target = _strategyTarget(vault, 4_500);
        _setStrategyNav(charm, target + 5e18);
        _setStrategyNav(ajna, target - 5e18);

        vm.prank(keeper);
        vault.rebalanceStrategies(0);

        assertApproxEqAbs(charm.getTotalAssets(), target, 1e18, "zero band should trim tiny charm drift");
        assertApproxEqAbs(ajna.getTotalAssets(), target, 1e18, "zero band should fill tiny ajna deficit");
    }

    function test_rebalanceStrategies_excessIdle_depositsToUnderweightWithoutWithdraw() external {
        vault.forceDeployToStrategies();

        uint256 target = _strategyTarget(vault, 4_500);
        charm.setTrackedAssetsForTest(target);
        ajna.setTrackedAssetsForTest(target - 100e18);

        uint256 charmBefore = charm.getTotalAssets();
        uint256 ajnaBefore = ajna.getTotalAssets();
        coin.mint(address(vault), 100e18);

        vm.prank(keeper);
        vault.rebalanceStrategies(5_000);

        assertEq(charm.getTotalAssets(), charmBefore, "balanced charm should not withdraw inside band");
        assertGt(ajna.getTotalAssets(), ajnaBefore, "underweight ajna should absorb excess idle");
        assertApproxEqAbs(ajna.getTotalAssets(), target, 1e18, "ajna should reach target from idle only");
    }

    function test_rebalanceStrategies_dualUnderweight_deploysIdleProRata() external {
        vault.forceDeployToStrategies();

        coin.mint(address(vault), 200e18);

        vm.prank(keeper);
        vault.rebalanceStrategies(500);

        uint256 newTarget = _strategyTarget(vault, 4_500);
        assertApproxEqAbs(charm.getTotalAssets(), newTarget, 1e21, "charm should receive half of deployable idle");
        assertApproxEqAbs(ajna.getTotalAssets(), newTarget, 1e21, "ajna should receive half of deployable idle");
    }

    function test_rebalanceStrategies_updatesStrategyDebt() external {
        CreatorOVault skewVault = _deploySkewedVault();
        address skewCharmAddr = skewVault.strategyList(0);
        address skewAjnaAddr = skewVault.strategyList(1);

        vm.prank(keeper);
        skewVault.rebalanceStrategies(500);

        assertEq(skewVault.strategyDebt(skewCharmAddr), WeightedMockStrategy(skewCharmAddr).getTotalAssets());
        assertEq(skewVault.strategyDebt(skewAjnaAddr), WeightedMockStrategy(skewAjnaAddr).getTotalAssets());
    }

    function test_rebalanceStrategies_idempotentWhenBalanced() external {
        vault.forceDeployToStrategies();

        uint256 charmBefore = charm.getTotalAssets();
        uint256 ajnaBefore = ajna.getTotalAssets();
        uint256 idleBefore = vault.coinBalance();

        vm.prank(keeper);
        vault.rebalanceStrategies(500);

        assertEq(charm.getTotalAssets(), charmBefore, "balanced rebalance should not move charm");
        assertEq(ajna.getTotalAssets(), ajnaBefore, "balanced rebalance should not move ajna");
        assertEq(vault.coinBalance(), idleBefore, "balanced rebalance should not move idle");
    }

    function test_rebalanceStrategies_emitsStrategiesRebalanced() external {
        CreatorOVault skewVault = _deploySkewedVault();

        vm.recordLogs();
        vm.prank(keeper);
        skewVault.rebalanceStrategies(500);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 rebalancedTopic = keccak256("StrategiesRebalanced(uint256,uint256)");
        bool found;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == rebalancedTopic) {
                found = true;
                break;
            }
        }
        assertTrue(found, "expected StrategiesRebalanced event");
    }

    function test_rebalanceStrategies_threeStrategyUnevenWeights() external {
        vault.updateStrategyWeight(address(charm), 3_000);
        vault.updateStrategyWeight(address(ajna), 3_000);

        WeightedMockStrategy third = new WeightedMockStrategy(address(coin));
        vault.addStrategy(address(third), 3_000, true);
        vault.forceDeployToStrategies();

        uint256 targetEach = _strategyTarget(vault, 3_000);
        _setStrategyNav(charm, targetEach * 2);
        _setStrategyNav(ajna, targetEach / 2);
        _setStrategyNav(third, targetEach / 2);

        vm.prank(keeper);
        vault.rebalanceStrategies(500);
        vm.prank(keeper);
        vault.rebalanceStrategies(500);

        targetEach = _strategyTarget(vault, 3_000);
        assertApproxEqAbs(charm.getTotalAssets(), targetEach, 1e21, "charm should converge to 1/3 deployable base");
        assertApproxEqAbs(ajna.getTotalAssets(), targetEach, 1e21, "ajna should converge to 1/3 deployable base");
        assertApproxEqAbs(third.getTotalAssets(), targetEach, 1e21, "third strategy should converge to 1/3 deployable base");
    }

    function test_withdraw_fallsThroughToAjnaWhenCharmLiquidityCapped() external {
        charm.setMaxWithdrawCap(25e18);
        vault.forceDeployToStrategies();

        uint256 ask = vault.coinBalance() + 100e18;
        vm.prank(alice);
        vault.withdraw(ask, alice, alice);

        assertEq(charm.withdrawCalls(), 1, "charm should be attempted first");
        assertEq(ajna.withdrawCalls(), 1, "ajna should cover remaining deficit");
    }

    function test_withdraw_useDefaultQueueFalse_stillWalksStrategyList() external {
        vault.setUseDefaultQueue(false);
        vault.forceDeployToStrategies();

        uint256 ask = vault.coinBalance() + 50e18;
        vm.prank(alice);
        vault.withdraw(ask, alice, alice);

        assertEq(charm.withdrawCalls(), 1, "strategyList[0] is still charm");
        assertEq(ajna.withdrawCalls(), 0, "ajna untouched when charm covers deficit");
    }

    function _strategyTarget(CreatorOVault targetVault, uint256 weightBps) internal view returns (uint256) {
        uint256 minIdle = targetVault.minimumTotalIdle();
        uint256 total = targetVault.totalAssets();
        uint256 deployableBase = total > minIdle ? total - minIdle : 0;
        return (deployableBase * weightBps) / targetVault.totalStrategyWeight();
    }

    function _setStrategyNav(WeightedMockStrategy strategy, uint256 nav) internal {
        uint256 current = strategy.getTotalAssets();
        if (nav > current) {
            coin.mint(address(strategy), nav - current);
        }
        strategy.setTrackedAssetsForTest(nav);
    }

    function _maxDriftBps(CreatorOVault targetVault) internal view returns (uint256 maxDrift) {
        uint256 weight = targetVault.totalStrategyWeight();
        if (weight == 0) return 0;

        uint256 targetCharm = _strategyTarget(targetVault, 4_500);
        uint256 targetAjna = _strategyTarget(targetVault, 4_500);
        maxDrift = _driftBps(targetCharm, charm.getTotalAssets());
        uint256 ajnaDrift = _driftBps(targetAjna, ajna.getTotalAssets());
        if (ajnaDrift > maxDrift) maxDrift = ajnaDrift;
    }

    function _driftBps(uint256 targetAssets, uint256 actualAssets) internal pure returns (uint256) {
        if (targetAssets == 0) return actualAssets == 0 ? 0 : 10_000;
        uint256 drift = actualAssets > targetAssets ? actualAssets - targetAssets : targetAssets - actualAssets;
        return (drift * 10_000) / targetAssets;
    }

    function testFuzz_rebalanceStrategies_preservesTotalAssets(
        uint256 charmScale,
        uint256 ajnaScale,
        uint16 minDeviationBps
    ) external {
        minDeviationBps = uint16(bound(minDeviationBps, 0, 10_000));
        charmScale = bound(charmScale, 110, 250);
        ajnaScale = bound(ajnaScale, 10, 90);

        vault.forceDeployToStrategies();

        uint256 target = _strategyTarget(vault, 4_500);
        if (target < 10e18) return;

        _setStrategyNav(charm, (target * charmScale) / 100);
        _setStrategyNav(ajna, (target * ajnaScale) / 100);

        uint256 totalBefore = vault.totalAssets();

        vm.prank(keeper);
        vault.rebalanceStrategies(minDeviationBps);

        assertApproxEqAbs(vault.totalAssets(), totalBefore, 1e16, "total assets conserved");
    }

    function testFuzz_rebalanceStrategies_reducesDriftWithinPasses(
        uint256 charmScale,
        uint256 ajnaScale
    ) external {
        charmScale = bound(charmScale, 120, 220);
        ajnaScale = bound(ajnaScale, 20, 80);

        vault.forceDeployToStrategies();

        uint256 target = _strategyTarget(vault, 4_500);
        if (target < 10e18) return;

        _setStrategyNav(charm, (target * charmScale) / 100);
        _setStrategyNav(ajna, (target * ajnaScale) / 100);

        uint256 driftBefore = _maxDriftBps(vault);

        for (uint256 i = 0; i < 4; i++) {
            vm.prank(keeper);
            vault.rebalanceStrategies(500);
        }

        uint256 driftAfter = _maxDriftBps(vault);
        assertLe(driftAfter, driftBefore, "multi-pass rebalance should not increase drift");
        assertLe(driftAfter, 600, "four passes should land near 500 bps band");
    }

    function testFuzz_rebalanceStrategies_withdrawNeverExceedsExcess(
        uint256 charmScale,
        uint16 minDeviationBps
    ) external {
        minDeviationBps = uint16(bound(minDeviationBps, 0, 2_000));
        charmScale = bound(charmScale, 150, 300);

        vault.forceDeployToStrategies();

        uint256 target = _strategyTarget(vault, 4_500);
        if (target < 10e18) return;

        uint256 charmBefore = charm.getTotalAssets();
        _setStrategyNav(charm, (target * charmScale) / 100);

        vm.prank(keeper);
        vault.rebalanceStrategies(minDeviationBps);

        uint256 charmAfter = charm.getTotalAssets();
        if (charmAfter >= charmBefore) return;

        uint256 withdrawn = charmBefore - charmAfter;
        uint256 excess = charmBefore > target ? charmBefore - target : 0;
        assertLe(withdrawn, excess, "withdraw should not exceed overweight excess");
    }
}
