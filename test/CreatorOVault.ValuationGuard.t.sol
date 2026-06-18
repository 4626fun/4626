// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

import "../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultAdminModule} from "../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";
import {ERC4626StrategyAdapter} from "../contracts/vault/strategies/ERC4626StrategyAdapter.sol";
import "../contracts/interfaces/IStrategy.sol";
import "../contracts/interfaces/IStrategyValuation.sol";

contract MockCreatorCoinForValuationGuard is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockValuationStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;

    bool public active = true;
    bool public valuationReady = true;
    uint256 public trackedAssets;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function setValuationReady(bool ready) external {
        valuationReady = ready;
    }

    function setTrackedAssets(uint256 assets) external {
        trackedAssets = assets;
    }

    function isValuationReady() external view override returns (bool) {
        return valuationReady;
    }

    function isActive() external view override returns (bool) {
        return active;
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
        withdrawn = amount > trackedAssets ? trackedAssets : amount;
        if (withdrawn == 0) return 0;
        trackedAssets -= withdrawn;
        require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
    }

    function emergencyWithdraw() external override returns (uint256 withdrawn) {
        withdrawn = trackedAssets;
        trackedAssets = 0;
        if (withdrawn > 0) {
            require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
        }
    }

    function harvest() external pure override returns (uint256 profit) {
        return 0;
    }

    function rebalance() external override {}
}

contract MockValuationReadyButAssetsRevertStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    bool public active = true;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function isValuationReady() external pure override returns (bool) {
        return true;
    }

    function isActive() external view override returns (bool) {
        return active;
    }

    function asset() external view override returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external pure override returns (uint256) {
        revert("ASSETS_REVERT");
    }

    function deposit(uint256 amount) external pure override returns (uint256 deposited) {
        deposited = amount;
    }

    function withdraw(uint256 amount) external pure override returns (uint256 withdrawn) {
        withdrawn = amount;
    }

    function emergencyWithdraw() external pure override returns (uint256 withdrawn) {
        withdrawn = 0;
    }

    function harvest() external pure override returns (uint256 profit) {
        profit = 0;
    }

    function rebalance() external pure override {}
}

contract MockNoValuationInterfaceStrategy is IStrategy {
    IERC20 public immutable TOKEN;
    bool public active = true;
    uint256 public trackedAssets;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function isActive() external view override returns (bool) {
        return active;
    }

    function asset() external view override returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external view override returns (uint256) {
        return trackedAssets;
    }

    function deposit(uint256 amount) external pure override returns (uint256 deposited) {
        deposited = amount;
    }

    function withdraw(uint256 amount) external pure override returns (uint256 withdrawn) {
        withdrawn = amount;
    }

    function emergencyWithdraw() external pure override returns (uint256 withdrawn) {
        withdrawn = 0;
    }

    function harvest() external pure override returns (uint256 profit) {
        profit = 0;
    }

    function rebalance() external pure override {}
}

contract MockCcaLifecycleForVaultGuard {
    uint8 public phase;

    struct LifecycleStatus {
        uint8 phase;
    }

    function setPhase(uint8 nextPhase) external {
        phase = nextPhase;
    }

    function getLifecycleStatus() external view returns (LifecycleStatus memory status) {
        status.phase = phase;
    }
}

contract ManipulableInnerERC4626 is ERC4626 {
    uint256 public assetsMultiplier = 1e18;
    bool public revertOnConvert;

    constructor(IERC20 asset_) ERC20("Manipulable 4626 Vault", "x4626") ERC4626(asset_) {}

    function setAssetsMultiplier(uint256 multiplier) external {
        assetsMultiplier = multiplier;
    }

    function setRevertOnConvert(bool shouldRevert) external {
        revertOnConvert = shouldRevert;
    }

    function convertToAssets(uint256 shares) public view override returns (uint256) {
        if (revertOnConvert) revert("convertToAssets reverted");
        uint256 baseAssets = super.convertToAssets(shares);
        return (baseAssets * assetsMultiplier) / 1e18;
    }
}

contract CreatorOVaultValuationGuardTest is Test {
    bytes4 private constant STRATEGY_VALUATION_NOT_READY_SELECTOR =
        bytes4(keccak256("StrategyValuationNotReady(address)"));
    bytes4 private constant CCA_AUCTION_DEPOSIT_BLOCKED_SELECTOR = bytes4(keccak256("CcaAuctionDepositBlocked()"));

    MockCreatorCoinForValuationGuard internal creatorCoin;
    CreatorOVault internal vault;
    MockValuationStrategy internal strategy;

    address internal coreModule;
    address internal strategiesModule;
    address internal adminModule;

    address internal alice = makeAddr("alice");

    function setUp() public {
        creatorCoin = new MockCreatorCoinForValuationGuard();
        vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovCR8R");

        coreModule = address(new CreatorOVaultCoreModule());
        strategiesModule = address(new CreatorOVaultStrategiesModule());
        adminModule = address(new CreatorOVaultAdminModule());
        vault.setModulesOnce(coreModule, strategiesModule, adminModule);

        strategy = new MockValuationStrategy(address(creatorCoin));
        vault.addStrategy(address(strategy), 10_000, true);

        creatorCoin.mint(alice, vault.MINIMUM_FIRST_DEPOSIT() * 4);
        vm.prank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);
    }

    function test_maxDepositAndMaxMint_returnZero_whenStrategyValuationNotReady() external {
        strategy.setValuationReady(false);

        assertEq(vault.maxDeposit(alice), 0, "maxDeposit should be 0 when valuation not ready");
        assertEq(vault.maxMint(alice), 0, "maxMint should be 0 when valuation not ready");
    }

    function test_deposit_reverts_whenStrategyValuationNotReady() external {
        strategy.setValuationReady(false);

        uint256 assets = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(STRATEGY_VALUATION_NOT_READY_SELECTOR, address(strategy)));
        vault.deposit(assets, alice);
    }

    function test_mint_reverts_whenStrategyValuationNotReady() external {
        strategy.setValuationReady(false);

        uint256 assets = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        uint256 shares = assets * 1000; // _decimalsOffset() = 3

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(STRATEGY_VALUATION_NOT_READY_SELECTOR, address(strategy)));
        vault.mint(shares, alice);
    }

    function test_deposit_succeeds_whenStrategyValuationReady() external {
        strategy.setValuationReady(true);

        uint256 assets = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        vm.prank(alice);
        uint256 shares = vault.deposit(assets, alice);
        assertGt(shares, 0);
    }

    function test_deposit_reverts_whenStrategyGetTotalAssetsReverts_evenIfValuationReady() external {
        CreatorOVault freshVault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault 2", "ovCR8R2");
        freshVault.setModulesOnce(coreModule, strategiesModule, adminModule);
        MockValuationReadyButAssetsRevertStrategy bad =
            new MockValuationReadyButAssetsRevertStrategy(address(creatorCoin));
        freshVault.addStrategy(address(bad), 10_000, true);

        creatorCoin.mint(alice, freshVault.MINIMUM_FIRST_DEPOSIT() * 4);
        vm.prank(alice);
        creatorCoin.approve(address(freshVault), type(uint256).max);

        assertEq(freshVault.maxDeposit(alice), 0, "maxDeposit should be 0 when valuation reads revert");
        assertEq(freshVault.maxMint(alice), 0, "maxMint should be 0 when valuation reads revert");

        uint256 assets = freshVault.MINIMUM_FIRST_DEPOSIT() * 2;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(STRATEGY_VALUATION_NOT_READY_SELECTOR, address(bad)));
        freshVault.deposit(assets, alice);

        uint256 shares = assets * 1000; // _decimalsOffset() = 3
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(STRATEGY_VALUATION_NOT_READY_SELECTOR, address(bad)));
        freshVault.mint(shares, alice);
    }

    function test_deposit_reverts_whenStrategyMissingIStrategyValuation() external {
        CreatorOVault freshVault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault 3", "ovCR8R3");
        freshVault.setModulesOnce(coreModule, strategiesModule, adminModule);
        MockNoValuationInterfaceStrategy bad = new MockNoValuationInterfaceStrategy(address(creatorCoin));
        freshVault.addStrategy(address(bad), 10_000, true);

        creatorCoin.mint(alice, freshVault.MINIMUM_FIRST_DEPOSIT() * 4);
        vm.prank(alice);
        creatorCoin.approve(address(freshVault), type(uint256).max);

        assertEq(freshVault.maxDeposit(alice), 0, "maxDeposit should be 0 when valuation interface missing");
        assertEq(freshVault.maxMint(alice), 0, "maxMint should be 0 when valuation interface missing");

        uint256 assets = freshVault.MINIMUM_FIRST_DEPOSIT() * 2;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(STRATEGY_VALUATION_NOT_READY_SELECTOR, address(bad)));
        freshVault.deposit(assets, alice);

        uint256 shares = assets * 1000; // _decimalsOffset() = 3
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(STRATEGY_VALUATION_NOT_READY_SELECTOR, address(bad)));
        freshVault.mint(shares, alice);
    }

    function test_deposit_reverts_whenTrustedPpsDeviationTooHigh() external {
        _bootstrapTrustedCheckpoint();
        strategy.setTrackedAssets((strategy.trackedAssets() * 150) / 100); // +50%

        vm.prank(alice);
        vm.expectRevert();
        vault.deposit(50_000e18, alice);
    }

    function test_maxDepositAndMaxMint_returnZero_whenCcaAuctionLive() external {
        MockCcaLifecycleForVaultGuard cca = new MockCcaLifecycleForVaultGuard();
        vault.setCCALaunchStrategy(address(cca));
        cca.setPhase(1); // LifecyclePhase.AuctionLive

        assertEq(vault.maxDeposit(alice), 0, "maxDeposit should be 0 while CCA auction is live");
        assertEq(vault.maxMint(alice), 0, "maxMint should be 0 while CCA auction is live");
    }

    function test_depositAndMint_revert_whenCcaAuctionLive() external {
        MockCcaLifecycleForVaultGuard cca = new MockCcaLifecycleForVaultGuard();
        vault.setCCALaunchStrategy(address(cca));
        cca.setPhase(1); // LifecyclePhase.AuctionLive

        uint256 assets = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        uint256 shares = assets * 1000; // _decimalsOffset() = 3

        vm.prank(alice);
        vm.expectRevert(CCA_AUCTION_DEPOSIT_BLOCKED_SELECTOR);
        vault.deposit(assets, alice);

        vm.prank(alice);
        vm.expectRevert(CCA_AUCTION_DEPOSIT_BLOCKED_SELECTOR);
        vault.mint(shares, alice);
    }

    function test_deposit_allowed_whenCcaPhaseNotAuctionLive() external {
        MockCcaLifecycleForVaultGuard cca = new MockCcaLifecycleForVaultGuard();
        vault.setCCALaunchStrategy(address(cca));
        cca.setPhase(2); // LifecyclePhase.AuctionEndedPending

        uint256 assets = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        vm.prank(alice);
        uint256 shares = vault.deposit(assets, alice);
        assertGt(shares, 0);
    }

    function test_mint_reverts_whenTrustedPpsDeviationTooHigh() external {
        _bootstrapTrustedCheckpoint();
        strategy.setTrackedAssets((strategy.trackedAssets() * 150) / 100); // +50%

        vm.prank(alice);
        vm.expectRevert();
        vault.mint(10_000e18, alice);
    }

    function test_deposit_succeeds_whenTrustedPpsDeviationWithinLimit() external {
        _bootstrapTrustedCheckpoint();
        strategy.setTrackedAssets((strategy.trackedAssets() * 105) / 100); // +5%

        vm.prank(alice);
        uint256 shares = vault.deposit(50_000e18, alice);
        assertGt(shares, 0);
    }

    function test_ownerCanRelaxTrustedPpsDeviationLimit() external {
        _bootstrapTrustedCheckpoint();
        strategy.setTrackedAssets((strategy.trackedAssets() * 150) / 100); // +50%

        vm.prank(alice);
        vm.expectRevert();
        vault.deposit(50_000e18, alice);

        vault.setTrustedPpsDeviationBps(5_000);

        vm.prank(alice);
        uint256 shares = vault.deposit(50_000e18, alice);
        assertGt(shares, 0);
    }

    function test_setTrustedPpsDeviationBps_revertsAboveBpsDenominator() external {
        vm.expectRevert(CreatorOVault.InvalidAmount.selector);
        vault.setTrustedPpsDeviationBps(10_001);
    }

    function test_adapterValuationReady_falseOnAtomicSpike() external {
        (, ManipulableInnerERC4626 innerVault, ERC4626StrategyAdapter adapter) = _deployAdapterGuardHarness();

        assertTrue(adapter.isValuationReady(), "baseline valuation should be ready");
        innerVault.setAssetsMultiplier(2e18); // +100% in one manipulation step
        assertFalse(adapter.isValuationReady(), "valuation guard should reject atomic spike");
    }

    function test_adapterValuationReady_trueForBoundedChange() external {
        (, ManipulableInnerERC4626 innerVault, ERC4626StrategyAdapter adapter) = _deployAdapterGuardHarness();

        innerVault.setAssetsMultiplier(105e16); // +5%
        assertTrue(adapter.isValuationReady(), "small bounded move should remain ready");
    }

    function test_adapterValuationReady_falseWhenConvertReverts() external {
        (, ManipulableInnerERC4626 innerVault, ERC4626StrategyAdapter adapter) = _deployAdapterGuardHarness();

        assertTrue(adapter.isValuationReady(), "baseline valuation should be ready");
        innerVault.setRevertOnConvert(true);
        assertFalse(adapter.isValuationReady(), "reverting conversion must mark valuation not ready");
    }

    function _deployAdapterGuardHarness()
        internal
        returns (CreatorOVault adapterVault, ManipulableInnerERC4626 innerVault, ERC4626StrategyAdapter adapter)
    {
        adapterVault = new CreatorOVault(address(creatorCoin), address(this), "Adapter OVault", "ovADAPT");
        adapterVault.setModulesOnce(coreModule, strategiesModule, adminModule);

        innerVault = new ManipulableInnerERC4626(IERC20(address(creatorCoin)));
        adapter = new ERC4626StrategyAdapter(address(adapterVault), address(innerVault), address(this));

        creatorCoin.mint(address(adapterVault), 1_000_000e18);

        vm.prank(address(adapterVault));
        creatorCoin.approve(address(adapter), type(uint256).max);
        vm.prank(address(adapterVault));
        adapter.deposit(100e18);
    }

    function _bootstrapTrustedCheckpoint() internal {
        uint256 firstDeposit = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        vm.prank(alice);
        vault.deposit(firstDeposit, alice);
        vault.forceDeployToStrategies();
        vault.report();
    }
}

