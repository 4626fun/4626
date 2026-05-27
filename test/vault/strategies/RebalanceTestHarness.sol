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

    function withdraw(uint256 amount) external virtual override returns (uint256 withdrawn) {
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

/// @dev Charm sleeve mock with optional Ajna borrow-backstop (pulls liquidity from linked Ajna mock on shortfall).
contract SynergyCharmMockStrategy is WeightedMockStrategy {
    WeightedMockStrategy public ajnaBackstop;
    bool public ajnaBorrowEnabled;
    uint256 public backstopPulls;
    uint256 public backstopVolume;

    constructor(address token_) WeightedMockStrategy(token_) {}

    function configureBackstop(address ajna, bool enabled) external {
        ajnaBackstop = WeightedMockStrategy(ajna);
        ajnaBorrowEnabled = enabled;
    }

    function withdraw(uint256 amount) external override returns (uint256 withdrawn) {
        withdrawCalls += 1;

        uint256 localCap = trackedAssets;
        if (maxWithdrawCap > 0 && localCap > maxWithdrawCap) {
            localCap = maxWithdrawCap;
        }

        withdrawn = amount > localCap ? localCap : amount;
        if (withdrawn > trackedAssets) {
            withdrawn = trackedAssets;
        }
        if (withdrawn > 0) {
            trackedAssets -= withdrawn;
            require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
        }

        uint256 shortfall = amount > withdrawn ? amount - withdrawn : 0;
        if (shortfall > 0 && ajnaBorrowEnabled && address(ajnaBackstop) != address(0)) {
            uint256 pulled = ajnaBackstop.withdraw(shortfall);
            if (pulled > 0) {
                backstopPulls += 1;
                backstopVolume += pulled;
                require(TOKEN.transfer(msg.sender, pulled), "backstop forward failed");
                withdrawn += pulled;
            }
        }

        return withdrawn;
    }
}

struct ScenarioVaultCtx {
    MockRebalanceCoin coin;
    CreatorOVault vault;
    WeightedMockStrategy charm;
    WeightedMockStrategy ajna;
    WeightedMockStrategy third;
    bool hasThird;
}

struct VaultTimelineSnapshot {
    uint256 totalAssets;
    uint256 idle;
    uint256 charmNav;
    uint256 ajnaNav;
    uint256 charmTarget;
    uint256 ajnaTarget;
    uint256 maxDriftBps;
    uint256 charmDebt;
    uint256 ajnaDebt;
    uint256 shareSupply;
    uint256 assetsPerShare; // 1e18-scaled
}

struct TimelineStepConfig {
    uint16 charmNavBps;
    uint16 ajnaNavBps;
    uint8 keeperPasses;
    uint16 keeperBandBps;
    uint16 redeemShareBps;
    uint256 depositAmount;
    uint256 marketCapUsd6;
}

struct TimelineSimOutcome {
    VaultTimelineSnapshot start;
    VaultTimelineSnapshot end;
    uint256 totalRedeemed;
    uint256 totalDeposited;
    uint256 charmWithdrawCallsStart;
    uint256 charmWithdrawCallsEnd;
}

/// @dev Running cash-flow ledger for a single vault participant.
struct DepositorLedger {
    address user;
    uint256 totalDeposited;
    uint256 totalRedeemed;
}

/// @dev Point-in-time economic snapshot for one depositor (redeemed + mark-to-market).
struct DepositorSnapshot {
    uint256 shares;
    uint256 markToMarket;
    uint256 totalEconomic;
    int256 roiBps;
}

/// @dev Shared setup/helpers for rebalance scenario + invariant suites.
abstract contract RebalanceTestHarness is Test {
    address internal constant KEEPER = address(0x0000000000000000000000000000000000000101);
    address internal constant ALICE = address(0x000000000000000000000000000000000000a11c);
    uint256 internal constant MIN_IDLE = 100e18;

    uint8 internal constant FLAG_CONSERVE_TOTAL = 1 << 0;
    uint8 internal constant FLAG_NO_OP = 1 << 1;
    uint8 internal constant FLAG_CHARM_DOWN = 1 << 2;
    uint8 internal constant FLAG_CHARM_UP = 1 << 3;
    uint8 internal constant FLAG_AJNA_DOWN = 1 << 4;
    uint8 internal constant FLAG_AJNA_UP = 1 << 5;
    uint8 internal constant FLAG_THIRD_UP = 1 << 6;
    uint8 internal constant FLAG_DRIFT_SHRINK = 1 << 7;

    struct RebalanceScenario {
        uint16 charmNavBps;
        uint16 ajnaNavBps;
        uint16 thirdNavBps;
        uint32 idleMintE18;
        uint16 minDeviationBps;
        uint8 passes;
        uint16 charmWeightBps;
        uint16 ajnaWeightBps;
        uint16 thirdWeightBps;
        address caller;
        bytes4 revertSelector;
        uint8 expectFlags;
    }

    function _deployScenarioVault(
        uint16 charmWeightBps,
        uint16 ajnaWeightBps,
        uint16 thirdWeightBps
    ) internal returns (ScenarioVaultCtx memory ctx) {
        return _deployScenarioVaultWithDeposit(100_000_000e18, charmWeightBps, ajnaWeightBps, thirdWeightBps);
    }

    function _initVaultDefaults(CreatorOVault vault, uint256 minIdle) internal {
        vault.setKeeper(KEEPER);
        vault.setMinimumTotalIdle(minIdle);
        vault.setFlashLoanProtection(0, type(uint256).max, 1);
        vault.setMaxTotalSupply(type(uint256).max);
    }

    function _deployScenarioVaultWithDeposit(
        uint256 depositAmount,
        uint16 charmWeightBps,
        uint16 ajnaWeightBps,
        uint16 thirdWeightBps
    ) internal returns (ScenarioVaultCtx memory ctx) {
        ctx.coin = new MockRebalanceCoin();
        ctx.vault = new CreatorOVault(address(ctx.coin), address(this), "Scenario Vault", "ovSCN");
        ctx.vault.setModulesOnce(
            address(new CreatorOVaultCoreModule()),
            address(new CreatorOVaultStrategiesModule()),
            address(new CreatorOVaultAdminModule())
        );
        _initVaultDefaults(ctx.vault, MIN_IDLE);

        ctx.charm = new WeightedMockStrategy(address(ctx.coin));
        ctx.ajna = new WeightedMockStrategy(address(ctx.coin));

        if (charmWeightBps == 0 && ajnaWeightBps == 0 && thirdWeightBps == 0) {
            charmWeightBps = 4_500;
            ajnaWeightBps = 4_500;
        }

        if (charmWeightBps > 0) {
            ctx.vault.addStrategy(address(ctx.charm), charmWeightBps, true);
        }
        if (ajnaWeightBps > 0) {
            ctx.vault.addStrategy(address(ctx.ajna), ajnaWeightBps, true);
        }

        if (thirdWeightBps > 0) {
            ctx.third = new WeightedMockStrategy(address(ctx.coin));
            ctx.vault.addStrategy(address(ctx.third), thirdWeightBps, true);
            ctx.hasThird = true;
        }

        if (depositAmount > 0) {
            ctx.coin.mint(ALICE, depositAmount + 1_000_000e18);
            vm.prank(ALICE);
            ctx.coin.approve(address(ctx.vault), type(uint256).max);
            vm.prank(ALICE);
            ctx.vault.deposit(depositAmount, ALICE);
            ctx.vault.forceDeployToStrategies();
        }
    }

    function _deployScenarioVaultWithDepositAndMinIdle(
        uint256 depositAmount,
        uint16 charmWeightBps,
        uint16 ajnaWeightBps,
        uint16 thirdWeightBps,
        uint256 minIdle
    ) internal returns (ScenarioVaultCtx memory ctx) {
        ctx.coin = new MockRebalanceCoin();
        ctx.vault = new CreatorOVault(address(ctx.coin), address(this), "Scenario Vault", "ovSCN");
        ctx.vault.setModulesOnce(
            address(new CreatorOVaultCoreModule()),
            address(new CreatorOVaultStrategiesModule()),
            address(new CreatorOVaultAdminModule())
        );
        _initVaultDefaults(ctx.vault, minIdle);

        ctx.charm = new WeightedMockStrategy(address(ctx.coin));
        ctx.ajna = new WeightedMockStrategy(address(ctx.coin));

        if (charmWeightBps == 0 && ajnaWeightBps == 0 && thirdWeightBps == 0) {
            charmWeightBps = 4_500;
            ajnaWeightBps = 4_500;
        }

        if (charmWeightBps > 0) {
            ctx.vault.addStrategy(address(ctx.charm), charmWeightBps, true);
        }
        if (ajnaWeightBps > 0) {
            ctx.vault.addStrategy(address(ctx.ajna), ajnaWeightBps, true);
        }

        if (thirdWeightBps > 0) {
            ctx.third = new WeightedMockStrategy(address(ctx.coin));
            ctx.vault.addStrategy(address(ctx.third), thirdWeightBps, true);
            ctx.hasThird = true;
        }

        if (depositAmount > 0) {
            ctx.coin.mint(ALICE, depositAmount + 1_000_000e18);
            vm.prank(ALICE);
            ctx.coin.approve(address(ctx.vault), type(uint256).max);
            vm.prank(ALICE);
            ctx.vault.deposit(depositAmount, ALICE);
            ctx.vault.forceDeployToStrategies();
        }
    }

    function _deployBackstopScenarioVaultWithDeposit(
        uint256 depositAmount,
        bool backstopEnabled
    ) internal returns (ScenarioVaultCtx memory ctx, SynergyCharmMockStrategy synergyCharm) {
        ctx.coin = new MockRebalanceCoin();
        ctx.vault = new CreatorOVault(address(ctx.coin), address(this), "Synergy Vault", "ovSYN");
        ctx.vault.setModulesOnce(
            address(new CreatorOVaultCoreModule()),
            address(new CreatorOVaultStrategiesModule()),
            address(new CreatorOVaultAdminModule())
        );
        _initVaultDefaults(ctx.vault, MIN_IDLE);

        synergyCharm = new SynergyCharmMockStrategy(address(ctx.coin));
        ctx.charm = WeightedMockStrategy(address(synergyCharm));
        ctx.ajna = new WeightedMockStrategy(address(ctx.coin));

        ctx.vault.addStrategy(address(ctx.charm), 4_500, true);
        ctx.vault.addStrategy(address(ctx.ajna), 4_500, true);
        synergyCharm.configureBackstop(address(ctx.ajna), backstopEnabled);

        ctx.coin.mint(ALICE, depositAmount + 1_000_000e18);
        vm.prank(ALICE);
        ctx.coin.approve(address(ctx.vault), type(uint256).max);
        vm.prank(ALICE);
        ctx.vault.deposit(depositAmount, ALICE);
        ctx.vault.forceDeployToStrategies();
    }

    function _deployCharmOnlyBackstopVaultWithDeposit(
        uint256 depositAmount,
        bool backstopEnabled,
        uint16 ajnaPoolWeightBps
    ) internal returns (ScenarioVaultCtx memory ctx, SynergyCharmMockStrategy synergyCharm) {
        ctx.coin = new MockRebalanceCoin();
        ctx.vault = new CreatorOVault(address(ctx.coin), address(this), "Charm Backstop Vault", "ovCB");
        ctx.vault.setModulesOnce(
            address(new CreatorOVaultCoreModule()),
            address(new CreatorOVaultStrategiesModule()),
            address(new CreatorOVaultAdminModule())
        );
        _initVaultDefaults(ctx.vault, MIN_IDLE);

        synergyCharm = new SynergyCharmMockStrategy(address(ctx.coin));
        ctx.charm = WeightedMockStrategy(address(synergyCharm));
        ctx.ajna = new WeightedMockStrategy(address(ctx.coin));

        ctx.vault.addStrategy(address(ctx.charm), 9_000, true);
        synergyCharm.configureBackstop(address(ctx.ajna), backstopEnabled);

        // Off-vault Ajna liquidity pool (borrow lane only — not registered as a vault strategy).
        uint16 poolBps = ajnaPoolWeightBps == 0 ? 5_000 : ajnaPoolWeightBps;
        uint256 ajnaPoolLiquidity = (depositAmount * poolBps) / 10_000;
        ctx.coin.mint(address(ctx.ajna), ajnaPoolLiquidity);
        ctx.ajna.setTrackedAssetsForTest(ajnaPoolLiquidity);

        ctx.coin.mint(ALICE, depositAmount + 1_000_000e18);
        vm.prank(ALICE);
        ctx.coin.approve(address(ctx.vault), type(uint256).max);
        vm.prank(ALICE);
        ctx.vault.deposit(depositAmount, ALICE);
        ctx.vault.forceDeployToStrategies();
    }

    function _strategyTarget(CreatorOVault targetVault, address strategy) internal view returns (uint256) {
        uint256 weight = targetVault.strategyWeights(strategy);
        uint256 totalWeight = targetVault.totalStrategyWeight();
        if (weight == 0 || totalWeight == 0) return 0;

        uint256 minIdle = targetVault.minimumTotalIdle();
        uint256 total = targetVault.totalAssets();
        uint256 deployableBase = total > minIdle ? total - minIdle : 0;
        return (deployableBase * weight) / totalWeight;
    }

    function _setStrategyNav(MockRebalanceCoin coin, WeightedMockStrategy strategy, uint256 nav) internal {
        uint256 current = strategy.getTotalAssets();
        if (nav > current) {
            coin.mint(address(strategy), nav - current);
        }
        strategy.setTrackedAssetsForTest(nav);
    }

    function _applyNavSkew(
        ScenarioVaultCtx memory ctx,
        RebalanceScenario memory scenario
    ) internal {
        uint256 charmTarget = _strategyTarget(ctx.vault, address(ctx.charm));
        uint256 ajnaTarget = _strategyTarget(ctx.vault, address(ctx.ajna));

        if (scenario.charmNavBps > 0 && charmTarget > 0) {
            _setStrategyNav(ctx.coin, ctx.charm, (charmTarget * scenario.charmNavBps) / 10_000);
        }
        if (scenario.ajnaNavBps > 0 && ajnaTarget > 0) {
            _setStrategyNav(ctx.coin, ctx.ajna, (ajnaTarget * scenario.ajnaNavBps) / 10_000);
        }
        if (ctx.hasThird && scenario.thirdNavBps > 0) {
            uint256 thirdTarget = _strategyTarget(ctx.vault, address(ctx.third));
            if (thirdTarget > 0) {
                _setStrategyNav(ctx.coin, ctx.third, (thirdTarget * scenario.thirdNavBps) / 10_000);
            }
        }
    }

    function _maxPairDriftBps(ScenarioVaultCtx memory ctx) internal view returns (uint256 maxDrift) {
        maxDrift = _driftBps(_strategyTarget(ctx.vault, address(ctx.charm)), ctx.charm.getTotalAssets());
        uint256 ajnaDrift = _driftBps(_strategyTarget(ctx.vault, address(ctx.ajna)), ctx.ajna.getTotalAssets());
        if (ajnaDrift > maxDrift) maxDrift = ajnaDrift;

        if (ctx.hasThird) {
            uint256 thirdDrift =
                _driftBps(_strategyTarget(ctx.vault, address(ctx.third)), ctx.third.getTotalAssets());
            if (thirdDrift > maxDrift) maxDrift = thirdDrift;
        }
    }

    function _driftBps(uint256 targetAssets, uint256 actualAssets) internal pure returns (uint256) {
        if (targetAssets == 0) return actualAssets == 0 ? 0 : 10_000;
        uint256 drift = actualAssets > targetAssets ? actualAssets - targetAssets : targetAssets - actualAssets;
        return (drift * 10_000) / targetAssets;
    }

    function _runScenario(uint256 index, RebalanceScenario memory scenario) internal {
        ScenarioVaultCtx memory ctx = _deployScenarioVault(
            scenario.charmWeightBps, scenario.ajnaWeightBps, scenario.thirdWeightBps
        );

        _applyNavSkew(ctx, scenario);

        if (scenario.idleMintE18 > 0) {
            ctx.coin.mint(address(ctx.vault), uint256(scenario.idleMintE18) * 1e18);
        }

        uint256 charmBefore = ctx.charm.getTotalAssets();
        uint256 ajnaBefore = ctx.ajna.getTotalAssets();
        uint256 thirdBefore = ctx.hasThird ? ctx.third.getTotalAssets() : 0;
        uint256 idleBefore = ctx.coin.balanceOf(address(ctx.vault));
        uint256 totalBefore = idleBefore + charmBefore + ajnaBefore + thirdBefore;
        uint256 driftBefore = _maxPairDriftBps(ctx);

        address caller = scenario.caller == address(0) ? KEEPER : scenario.caller;
        uint8 passes = scenario.passes == 0 ? 1 : scenario.passes;

        if (scenario.revertSelector != bytes4(0)) {
            vm.prank(caller);
            vm.expectRevert(scenario.revertSelector);
            ctx.vault.rebalanceStrategies(scenario.minDeviationBps);
            return;
        }

        for (uint8 i = 0; i < passes; i++) {
            vm.prank(caller);
            ctx.vault.rebalanceStrategies(scenario.minDeviationBps);
        }

        uint256 charmAfter = ctx.charm.getTotalAssets();
        uint256 ajnaAfter = ctx.ajna.getTotalAssets();
        uint256 thirdAfter = ctx.hasThird ? ctx.third.getTotalAssets() : 0;
        uint256 idleAfter = ctx.coin.balanceOf(address(ctx.vault));
        uint256 totalAfter = idleAfter + charmAfter + ajnaAfter + thirdAfter;
        uint256 driftAfter = _maxPairDriftBps(ctx);

        if (scenario.expectFlags & FLAG_CONSERVE_TOTAL != 0) {
            assertApproxEqAbs(totalAfter, totalBefore, 1e16, _scenarioLabel(index, "total assets conserved"));
        }

        if (scenario.expectFlags & FLAG_NO_OP != 0) {
            assertEq(charmAfter, charmBefore, _scenarioLabel(index, "charm no-op"));
            assertEq(ajnaAfter, ajnaBefore, _scenarioLabel(index, "ajna no-op"));
            if (ctx.hasThird) {
                assertEq(thirdAfter, thirdBefore, _scenarioLabel(index, "third no-op"));
            }
        }

        if (scenario.expectFlags & FLAG_CHARM_DOWN != 0) {
            assertLt(charmAfter, charmBefore, _scenarioLabel(index, "charm down"));
        }
        if (scenario.expectFlags & FLAG_CHARM_UP != 0) {
            assertGt(charmAfter, charmBefore, _scenarioLabel(index, "charm up"));
        }
        if (scenario.expectFlags & FLAG_AJNA_DOWN != 0) {
            assertLt(ajnaAfter, ajnaBefore, _scenarioLabel(index, "ajna down"));
        }
        if (scenario.expectFlags & FLAG_AJNA_UP != 0) {
            assertGt(ajnaAfter, ajnaBefore, _scenarioLabel(index, "ajna up"));
        }
        if (scenario.expectFlags & FLAG_THIRD_UP != 0) {
            assertTrue(ctx.hasThird, _scenarioLabel(index, "third expected"));
            assertGt(thirdAfter, thirdBefore, _scenarioLabel(index, "third up"));
        }
        if (scenario.expectFlags & FLAG_DRIFT_SHRINK != 0) {
            assertLe(driftAfter, driftBefore, _scenarioLabel(index, "drift shrinks"));
        }
    }

    function _scenarioLabel(uint256 index, string memory detail) internal pure returns (string memory) {
        return string.concat("scenario ", vm.toString(index), ": ", detail);
    }

    function _build100Scenarios() internal pure returns (RebalanceScenario[100] memory scenarios) {
        uint256 i;

        // 0-9: deviation band sweep on charm-heavy / ajna-light skew
        {
            uint16[10] memory bands = [0, 100, 500, 750, 1_000, 2_000, 3_000, 5_000, 7_500, 10_000];
            for (uint256 b = 0; b < 10; b++) {
                scenarios[i++] = RebalanceScenario({
                    charmNavBps: 25000,
                    ajnaNavBps: 5000,
                    thirdNavBps: 0,
                    idleMintE18: 0,
                    minDeviationBps: bands[b],
                    passes: 1,
                    charmWeightBps: 4500,
                    ajnaWeightBps: 4500,
                    thirdWeightBps: 0,
                    caller: KEEPER,
                    revertSelector: bytes4(0),
                    expectFlags: uint8(FLAG_CONSERVE_TOTAL | FLAG_DRIFT_SHRINK)
                });
            }
        }

        // 10-19: charm overweight intensity sweep
        {
            uint16[10] memory charmScales = [10100, 10500, 11000, 12000, 13000, 15000, 18000, 20000, 25000, 30000];
            for (uint256 c = 0; c < 10; c++) {
                uint8 flags = uint8(FLAG_CONSERVE_TOTAL | FLAG_DRIFT_SHRINK);
                if (charmScales[c] >= 12000) {
                    flags |= FLAG_CHARM_DOWN;
                }
                scenarios[i++] = RebalanceScenario({
                    charmNavBps: charmScales[c],
                    ajnaNavBps: 10000,
                    thirdNavBps: 0,
                    idleMintE18: 0,
                    minDeviationBps: 500,
                    passes: 1,
                    charmWeightBps: 4500,
                    ajnaWeightBps: 4500,
                    thirdWeightBps: 0,
                    caller: KEEPER,
                    revertSelector: bytes4(0),
                    expectFlags: flags
                });
            }
        }

        // 20-29: ajna overweight intensity sweep (reverse skew)
        {
            uint16[10] memory ajnaScales = [10100, 10500, 11000, 12000, 13000, 15000, 18000, 20000, 25000, 30000];
            for (uint256 a = 0; a < 10; a++) {
                uint8 flags = uint8(FLAG_CONSERVE_TOTAL | FLAG_DRIFT_SHRINK);
                if (ajnaScales[a] >= 12000) {
                    flags |= FLAG_AJNA_DOWN;
                }
                scenarios[i++] = RebalanceScenario({
                    charmNavBps: 10000,
                    ajnaNavBps: ajnaScales[a],
                    thirdNavBps: 0,
                    idleMintE18: 0,
                    minDeviationBps: 500,
                    passes: 1,
                    charmWeightBps: 4500,
                    ajnaWeightBps: 4500,
                    thirdWeightBps: 0,
                    caller: KEEPER,
                    revertSelector: bytes4(0),
                    expectFlags: flags
                });
            }
        }

        // 30-39: idle-only redeploy paths (charm on target, ajna underweight)
        {
            uint32[10] memory idleMints = [uint32(1), 2, 5, 10, 20, 40, 60, 80, 120, 200];
            for (uint256 m = 0; m < 10; m++) {
                scenarios[i++] = RebalanceScenario({
                    charmNavBps: 10000,
                    ajnaNavBps: 7000,
                    thirdNavBps: 0,
                    idleMintE18: idleMints[m],
                    minDeviationBps: 5000,
                    passes: 1,
                    charmWeightBps: 4500,
                    ajnaWeightBps: 4500,
                    thirdWeightBps: 0,
                    caller: KEEPER,
                    revertSelector: bytes4(0),
                    expectFlags: uint8(FLAG_CONSERVE_TOTAL | FLAG_AJNA_UP)
                });
            }
        }

        // 40-49: multi-pass convergence on heavy skew
        {
            uint8[10] memory passCounts = [1, 1, 2, 2, 3, 3, 4, 4, 5, 6];
            for (uint256 p = 0; p < 10; p++) {
                scenarios[i++] = RebalanceScenario({
                    charmNavBps: 22000,
                    ajnaNavBps: 5000,
                    thirdNavBps: 0,
                    idleMintE18: 0,
                    minDeviationBps: 500,
                    passes: passCounts[p],
                    charmWeightBps: 4500,
                    ajnaWeightBps: 4500,
                    thirdWeightBps: 0,
                    caller: KEEPER,
                    revertSelector: bytes4(0),
                    expectFlags: uint8(FLAG_CONSERVE_TOTAL | FLAG_DRIFT_SHRINK)
                });
            }
        }

        // 50-59: asymmetric weights 60/40
        {
            uint16[10] memory charmScales = [8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000, 17000, 19000];
            for (uint256 w = 0; w < 10; w++) {
                scenarios[i++] = RebalanceScenario({
                    charmNavBps: charmScales[w],
                    ajnaNavBps: 10000,
                    thirdNavBps: 0,
                    idleMintE18: 0,
                    minDeviationBps: 500,
                    passes: 2,
                    charmWeightBps: 5400,
                    ajnaWeightBps: 3600,
                    thirdWeightBps: 0,
                    caller: KEEPER,
                    revertSelector: bytes4(0),
                    expectFlags: uint8(FLAG_CONSERVE_TOTAL | FLAG_DRIFT_SHRINK)
                });
            }
        }

        // 60-69: three-strategy 30/30/30 mixes
        {
            uint16[10] memory charm3 = [20000, 18000, 16000, 14000, 12000, 10000, 8000, 6000, 4000, 3000];
            for (uint256 t = 0; t < 10; t++) {
                scenarios[i++] = RebalanceScenario({
                    charmNavBps: charm3[t],
                    ajnaNavBps: 8000,
                    thirdNavBps: 7000,
                    idleMintE18: 0,
                    minDeviationBps: 500,
                    passes: 4,
                    charmWeightBps: 3000,
                    ajnaWeightBps: 3000,
                    thirdWeightBps: 3000,
                    caller: KEEPER,
                    revertSelector: bytes4(0),
                    expectFlags: uint8(FLAG_CONSERVE_TOTAL | FLAG_DRIFT_SHRINK)
                });
            }
        }

        // 70-79: near-target / no-op band cases
        {
            uint16[10] memory nearCharm = [10000, 10050, 10100, 10200, 10300, 9900, 9800, 9700, 9600, 9500];
            for (uint256 n = 0; n < 10; n++) {
                scenarios[i++] = RebalanceScenario({
                    charmNavBps: nearCharm[n],
                    ajnaNavBps: 10000,
                    thirdNavBps: 0,
                    idleMintE18: 0,
                    minDeviationBps: 5000,
                    passes: 1,
                    charmWeightBps: 4500,
                    ajnaWeightBps: 4500,
                    thirdWeightBps: 0,
                    caller: KEEPER,
                    revertSelector: bytes4(0),
                    expectFlags: uint8(FLAG_CONSERVE_TOTAL | FLAG_NO_OP)
                });
            }
        }

        // 80-87: unauthorized callers
        {
            address[8] memory badCallers = [
                ALICE,
                address(0xBEEF),
                address(0xCAFE),
                address(0xDEAD),
                address(0xF00D),
                address(0xB0B),
                address(0x1234),
                address(0x00000000000000000000000000000000000000AB)
            ];
            for (uint256 u = 0; u < 8; u++) {
                scenarios[i++] = RebalanceScenario({
                    charmNavBps: 15000,
                    ajnaNavBps: 8000,
                    thirdNavBps: 0,
                    idleMintE18: 0,
                    minDeviationBps: 500,
                    passes: 1,
                    charmWeightBps: 4500,
                    ajnaWeightBps: 4500,
                    thirdWeightBps: 0,
                    caller: badCallers[u],
                    revertSelector: CreatorOVault.Unauthorized.selector,
                    expectFlags: 0
                });
            }
        }

        // 88-91: invalid deviation bands
        {
            uint16[4] memory invalidBands = [10_001, 15_000, 20_000, 65_535];
            for (uint256 ib = 0; ib < 4; ib++) {
                scenarios[i++] = RebalanceScenario({
                    charmNavBps: 12000,
                    ajnaNavBps: 9000,
                    thirdNavBps: 0,
                    idleMintE18: 0,
                    minDeviationBps: invalidBands[ib],
                    passes: 1,
                    charmWeightBps: 4500,
                    ajnaWeightBps: 4500,
                    thirdWeightBps: 0,
                    caller: KEEPER,
                    revertSelector: CreatorOVaultStrategiesModule.InvalidWeight.selector,
                    expectFlags: 0
                });
            }
        }

        // 92-99: composite edge cases
        scenarios[i++] = RebalanceScenario({
            charmNavBps: 10050,
            ajnaNavBps: 9950,
            thirdNavBps: 0,
            idleMintE18: 0,
            minDeviationBps: 0,
            passes: 1,
            charmWeightBps: 4500,
            ajnaWeightBps: 4500,
            thirdWeightBps: 0,
            caller: KEEPER,
            revertSelector: bytes4(0),
            expectFlags: uint8(FLAG_CONSERVE_TOTAL | FLAG_DRIFT_SHRINK)
        });
        scenarios[i++] = RebalanceScenario({
            charmNavBps: 10000,
            ajnaNavBps: 10000,
            thirdNavBps: 0,
            idleMintE18: 200,
            minDeviationBps: 500,
            passes: 1,
            charmWeightBps: 4500,
            ajnaWeightBps: 4500,
            thirdWeightBps: 0,
            caller: KEEPER,
            revertSelector: bytes4(0),
            expectFlags: uint8(FLAG_CONSERVE_TOTAL | FLAG_CHARM_UP | FLAG_AJNA_UP)
        });
        scenarios[i++] = RebalanceScenario({
            charmNavBps: 13000,
            ajnaNavBps: 13000,
            thirdNavBps: 0,
            idleMintE18: 0,
            minDeviationBps: 500,
            passes: 1,
            charmWeightBps: 4500,
            ajnaWeightBps: 4500,
            thirdWeightBps: 0,
            caller: KEEPER,
            revertSelector: bytes4(0),
            expectFlags: uint8(FLAG_CONSERVE_TOTAL | FLAG_DRIFT_SHRINK)
        });
        scenarios[i++] = RebalanceScenario({
            charmNavBps: 5000,
            ajnaNavBps: 5000,
            thirdNavBps: 0,
            idleMintE18: 0,
            minDeviationBps: 500,
            passes: 3,
            charmWeightBps: 4500,
            ajnaWeightBps: 4500,
            thirdWeightBps: 0,
            caller: KEEPER,
            revertSelector: bytes4(0),
            expectFlags: uint8(FLAG_CONSERVE_TOTAL | FLAG_DRIFT_SHRINK)
        });
        scenarios[i++] = RebalanceScenario({
            charmNavBps: 25000,
            ajnaNavBps: 2500,
            thirdNavBps: 8000,
            idleMintE18: 0,
            minDeviationBps: 250,
            passes: 3,
            charmWeightBps: 3000,
            ajnaWeightBps: 3000,
            thirdWeightBps: 3000,
            caller: KEEPER,
            revertSelector: bytes4(0),
            expectFlags: uint8(FLAG_CONSERVE_TOTAL | FLAG_CHARM_DOWN | FLAG_DRIFT_SHRINK)
        });
        scenarios[i++] = RebalanceScenario({
            charmNavBps: 10000,
            ajnaNavBps: 6000,
            thirdNavBps: 6000,
            idleMintE18: 0,
            minDeviationBps: 10000,
            passes: 1,
            charmWeightBps: 3000,
            ajnaWeightBps: 3000,
            thirdWeightBps: 3000,
            caller: KEEPER,
            revertSelector: bytes4(0),
            expectFlags: uint8(FLAG_CONSERVE_TOTAL | FLAG_NO_OP)
        });
        scenarios[i++] = RebalanceScenario({
            charmNavBps: 11500,
            ajnaNavBps: 8500,
            thirdNavBps: 0,
            idleMintE18: 10,
            minDeviationBps: 1500,
            passes: 2,
            charmWeightBps: 5400,
            ajnaWeightBps: 3600,
            thirdWeightBps: 0,
            caller: KEEPER,
            revertSelector: bytes4(0),
            expectFlags: uint8(FLAG_CONSERVE_TOTAL | FLAG_DRIFT_SHRINK)
        });
        scenarios[i++] = RebalanceScenario({
            charmNavBps: 10000,
            ajnaNavBps: 5000,
            thirdNavBps: 15000,
            idleMintE18: 0,
            minDeviationBps: 500,
            passes: 4,
            charmWeightBps: 3000,
            ajnaWeightBps: 3000,
            thirdWeightBps: 3000,
            caller: KEEPER,
            revertSelector: bytes4(0),
            expectFlags: uint8(FLAG_CONSERVE_TOTAL | FLAG_DRIFT_SHRINK)
        });

        assertEq(i, 100, "scenario matrix must contain exactly 100 entries");
    }

    function _snapshotTimeline(ScenarioVaultCtx memory ctx)
        internal
        view
        returns (VaultTimelineSnapshot memory snap)
    {
        snap.totalAssets = ctx.vault.totalAssets();
        snap.idle = ctx.coin.balanceOf(address(ctx.vault));
        snap.charmNav = ctx.charm.getTotalAssets();
        snap.ajnaNav = ctx.ajna.getTotalAssets();
        snap.charmTarget = _strategyTarget(ctx.vault, address(ctx.charm));
        snap.ajnaTarget = _strategyTarget(ctx.vault, address(ctx.ajna));
        snap.maxDriftBps = _maxPairDriftBps(ctx);
        snap.charmDebt = ctx.vault.strategyDebt(address(ctx.charm));
        snap.ajnaDebt = ctx.vault.strategyDebt(address(ctx.ajna));
        snap.shareSupply = ctx.vault.totalSupply();
        snap.assetsPerShare = snap.shareSupply > 0 ? (snap.totalAssets * 1e18) / snap.shareSupply : 0;
    }

    function _economicTotal(ScenarioVaultCtx memory ctx) internal view returns (uint256) {
        return ctx.coin.balanceOf(address(ctx.vault)) + ctx.charm.getTotalAssets() + ctx.ajna.getTotalAssets();
    }

    function _applyRelativeNav(
        ScenarioVaultCtx memory ctx,
        uint16 charmNavBps,
        uint16 ajnaNavBps
    ) internal {
        uint256 charmTarget = _strategyTarget(ctx.vault, address(ctx.charm));
        uint256 ajnaTarget = _strategyTarget(ctx.vault, address(ctx.ajna));
        if (charmNavBps > 0 && charmTarget > 0) {
            _setStrategyNav(ctx.coin, ctx.charm, (charmTarget * charmNavBps) / 10_000);
        }
        if (ajnaNavBps > 0 && ajnaTarget > 0) {
            _setStrategyNav(ctx.coin, ctx.ajna, (ajnaTarget * ajnaNavBps) / 10_000);
        }
    }

    function _keeperRebalance(ScenarioVaultCtx memory ctx, uint16 minDeviationBps, uint8 passes) internal {
        for (uint8 i = 0; i < passes; i++) {
            vm.prank(KEEPER);
            ctx.vault.rebalanceStrategies(minDeviationBps);
        }
    }

    function _depositTokens(ScenarioVaultCtx memory ctx, address user, uint256 amount) internal {
        ctx.coin.mint(user, amount);
        vm.prank(user);
        ctx.coin.approve(address(ctx.vault), amount);
        vm.prank(user);
        ctx.vault.deposit(amount, user);
    }

    function _redeemShareBps(ScenarioVaultCtx memory ctx, address user, uint256 shareBps) internal returns (uint256 assets) {
        uint256 shares = (ctx.vault.balanceOf(user) * shareBps) / 10_000;
        if (shares == 0) return 0;
        vm.prank(user);
        assets = ctx.vault.redeem(shares, user, user);
    }

    function _freshLedger(address user) internal pure returns (DepositorLedger memory ledger) {
        ledger.user = user;
    }

    function _ledgerFromPrefundedDeposit(address user, uint256 amount)
        internal
        pure
        returns (DepositorLedger memory ledger)
    {
        ledger = _freshLedger(user);
        ledger.totalDeposited = amount;
    }

    function _depositorRoiBps(uint256 deposited, uint256 economic) internal pure returns (int256) {
        if (deposited == 0) return 0;
        return int256((economic * 10_000) / deposited) - 10_000;
    }

    function _depositorSnapshot(
        ScenarioVaultCtx memory ctx,
        DepositorLedger memory ledger
    ) internal view returns (DepositorSnapshot memory snap) {
        snap.shares = ctx.vault.balanceOf(ledger.user);
        snap.markToMarket = snap.shares > 0 ? ctx.vault.previewRedeem(snap.shares) : 0;
        snap.totalEconomic = ledger.totalRedeemed + snap.markToMarket;
        snap.roiBps = _depositorRoiBps(ledger.totalDeposited, snap.totalEconomic);
    }

    function _depositTracked(
        ScenarioVaultCtx memory ctx,
        DepositorLedger memory ledger,
        uint256 amount
    ) internal returns (DepositorLedger memory) {
        _depositTokens(ctx, ledger.user, amount);
        ledger.totalDeposited += amount;
        return ledger;
    }

    function _redeemShareBpsTracked(
        ScenarioVaultCtx memory ctx,
        DepositorLedger memory ledger,
        uint256 shareBps
    ) internal returns (DepositorLedger memory, uint256 assets) {
        assets = _redeemShareBps(ctx, ledger.user, shareBps);
        ledger.totalRedeemed += assets;
        return (ledger, assets);
    }

    function _logDepositorSnapshot(string memory label, DepositorLedger memory ledger, DepositorSnapshot memory snap)
        internal
        view
    {
        console2.log("");
        console2.log(">>> Depositor: %s (%s)", label, ledger.user);
        console2.log("    deposited (tokens): %s", ledger.totalDeposited / 1e18);
        console2.log("    redeemed (tokens): %s", ledger.totalRedeemed / 1e18);
        console2.log("    shares remaining: %s", snap.shares / 1e18);
        console2.log("    mark-to-market (tokens): %s", snap.markToMarket / 1e18);
        console2.log("    total economic (tokens): %s", snap.totalEconomic / 1e18);
        if (snap.roiBps >= 0) {
            console2.log("    ROI (bps): %s", uint256(snap.roiBps));
        } else {
            console2.log("    ROI (bps): -%s", uint256(-snap.roiBps));
        }
    }

    function _logDepositorE2ESummary(
        string memory title,
        VaultTimelineSnapshot memory vaultStart,
        VaultTimelineSnapshot memory vaultEnd,
        DepositorLedger memory ledger,
        DepositorSnapshot memory snap
    ) internal view {
        console2.log("");
        console2.log("===== %s =====", title);
        console2.log(
            "vault share price: %s -> %s",
            vaultStart.assetsPerShare,
            vaultEnd.assetsPerShare
        );
        _logDepositorSnapshot("participant", ledger, snap);
    }

    /// @dev Approximate USD mark using MC / 1B supply (6-decimal USD scale in logs).
    function _usdFromMc(uint256 marketCapUsd6, uint256 tokenAmount) internal pure returns (uint256) {
        return (tokenAmount * marketCapUsd6) / 1_000_000_000e18;
    }

    function _logTimelineSnapshot(
        string memory label,
        uint256 marketCapUsd6,
        VaultTimelineSnapshot memory snap
    ) internal pure {
        console2.log("");
        console2.log("--- %s ---", label);
        console2.log("market cap (USD): %s", marketCapUsd6 / 1e6);
        console2.log("total assets (tokens): %s", snap.totalAssets / 1e18);
        console2.log("total assets (USD est): %s", _usdFromMc(marketCapUsd6, snap.totalAssets) / 1e6);
        console2.log("idle (tokens): %s", snap.idle / 1e18);
        console2.log("charm NAV / target: %s / %s", snap.charmNav / 1e18, snap.charmTarget / 1e18);
        console2.log("ajna NAV / target: %s / %s", snap.ajnaNav / 1e18, snap.ajnaTarget / 1e18);
        console2.log("max drift (bps): %s", snap.maxDriftBps);
        console2.log("assets per share (1e18): %s", snap.assetsPerShare);
    }

    function _runTimelineSimulation(
        ScenarioVaultCtx memory ctx,
        TimelineStepConfig[] memory steps,
        address depositor,
        address redeemer,
        uint256 initialMcUsd6,
        string memory title
    ) internal returns (TimelineSimOutcome memory outcome) {
        console2.log("");
        console2.log("======== %s ========", title);

        outcome.start = _snapshotTimeline(ctx);
        outcome.charmWithdrawCallsStart = ctx.charm.withdrawCalls();
        _logTimelineSnapshot("T0 baseline", initialMcUsd6, outcome.start);

        for (uint256 i = 0; i < steps.length; i++) {
            TimelineStepConfig memory step = steps[i];
            if (step.charmNavBps > 0 || step.ajnaNavBps > 0) {
                _applyRelativeNav(ctx, step.charmNavBps, step.ajnaNavBps);
            }
            if (step.keeperPasses > 0) {
                _keeperRebalance(ctx, step.keeperBandBps, step.keeperPasses);
            }
            if (step.depositAmount > 0) {
                _depositTokens(ctx, depositor, step.depositAmount);
                outcome.totalDeposited += step.depositAmount;
            }
            if (step.redeemShareBps > 0) {
                outcome.totalRedeemed += _redeemShareBps(ctx, redeemer, step.redeemShareBps);
            }
            VaultTimelineSnapshot memory snap = _snapshotTimeline(ctx);
            _logTimelineSnapshot(
                string.concat("Step ", vm.toString(i + 1)),
                step.marketCapUsd6 > 0 ? step.marketCapUsd6 : initialMcUsd6,
                snap
            );
        }

        outcome.end = _snapshotTimeline(ctx);
        outcome.charmWithdrawCallsEnd = ctx.charm.withdrawCalls();
        console2.log("Summary TVL tokens: %s -> %s", outcome.start.totalAssets / 1e18, outcome.end.totalAssets / 1e18);
        console2.log(
            "Summary drift bps: %s -> %s", outcome.start.maxDriftBps, outcome.end.maxDriftBps
        );
        console2.log(
            "Summary share price: %s -> %s", outcome.start.assetsPerShare, outcome.end.assetsPerShare
        );
        console2.log(
            "Flows deposited=%s redeemed=%s charmWithdrawCalls=%s",
            outcome.totalDeposited / 1e18,
            outcome.totalRedeemed / 1e18,
            outcome.charmWithdrawCallsEnd - outcome.charmWithdrawCallsStart
        );
    }
}
