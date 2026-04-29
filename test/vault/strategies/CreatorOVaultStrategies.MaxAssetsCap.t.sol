// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../../../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultAdminModule} from "../../../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../../../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../../../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";
import "../../../contracts/interfaces/IStrategy.sol";
import "../../../contracts/interfaces/IStrategyValuation.sol";

// ============================================================================
// strategyMaxAssets governance cap — clamps `_getStrategyAssetsSafe()` so a
// strategy reporting an inflated valuation cannot push `totalAssets()` past
// the cap governance has approved.
//
// References (background on the attack class this defends against):
//   - OpenZeppelin: A novel defense against ERC-4626 inflation attacks
//     https://www.openzeppelin.com/news/a-novel-defense-against-erc4626-inflation-attacks
//   - Euler: ERC-4626 donation attack vectors
//     https://docs.euler.finance/security/attack-vectors/donation-attacks/
//
// Cases pinned by this test:
//   1. uncapped (cap == 0): vault recognises full reported assets.
//   2. cap below reported: clamp applies; totalAssets() cannot exceed
//      idle + cap, even if the strategy reports a much larger number.
//   3. cap equal to reported: clamp is a no-op.
//   4. cap above reported: clamp is a no-op.
//   5. setter is access-controlled: a non-management caller reverts.
//   6. setter rejects zero address.
//   7. event emitted with old/new cap values on successful update.
// ============================================================================

contract MockCoin is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// @dev Minimal strategy that reports whatever the test sets via `setReported`.
///      It does not need to actually hold the assets — `_getStrategyAssetsSafe`
///      reads `getTotalAssets()` directly. This isolates the cap clamp behaviour
///      from any strategy-side accounting.
contract LyingValuationStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    uint256 public reported;
    uint256 public trackedDebt; // shadow of vault deposits for sanity

    constructor(address token_) { TOKEN = IERC20(token_); }

    function setReported(uint256 v) external { reported = v; }

    function isValuationReady() external pure override returns (bool) { return true; }
    function isActive() external pure override returns (bool) { return true; }
    function asset() external view override returns (address) { return address(TOKEN); }
    function getTotalAssets() external view override returns (uint256) { return reported; }

    function deposit(uint256 amount) external override returns (uint256 deposited) {
        if (amount == 0) return 0;
        require(TOKEN.transferFrom(msg.sender, address(this), amount), "tf");
        trackedDebt += amount;
        // By default mirror the deposit into reported so the strategy looks
        // healthy at deploy time. Tests inflate `reported` afterwards.
        reported += amount;
        return amount;
    }

    function withdraw(uint256 amount) external override returns (uint256 withdrawn) {
        withdrawn = amount > trackedDebt ? trackedDebt : amount;
        if (withdrawn == 0) return 0;
        trackedDebt -= withdrawn;
        if (reported >= withdrawn) reported -= withdrawn;
        else reported = 0;
        require(TOKEN.transfer(msg.sender, withdrawn), "t");
    }

    function emergencyWithdraw() external override returns (uint256 withdrawn) {
        withdrawn = trackedDebt;
        trackedDebt = 0;
        reported = 0;
        if (withdrawn > 0) require(TOKEN.transfer(msg.sender, withdrawn), "t");
    }

    function harvest() external pure override returns (uint256) { return 0; }
    function rebalance() external override {}
}

contract MaxAssetsCapTest is Test {
    MockCoin internal coin;
    CreatorOVault internal vault;
    LyingValuationStrategy internal strat;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    event UpdateStrategyMaxAssets(address indexed strategy, uint256 oldCap, uint256 newCap);

    function setUp() public {
        coin = new MockCoin();
        vault = new CreatorOVault(address(coin), address(this), "Creator OVault", "ovCR8R");
        vault.setModulesOnce(
            address(new CreatorOVaultCoreModule()),
            address(new CreatorOVaultStrategiesModule()),
            address(new CreatorOVaultAdminModule())
        );

        strat = new LyingValuationStrategy(address(coin));
        vault.addStrategy(address(strat), 10_000, true);
        vault.setFlashLoanProtection(0, type(uint256).max, 1);

        uint256 depositAmount = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        coin.mint(alice, depositAmount + 500_000e18);
        vm.prank(alice);
        coin.approve(address(vault), type(uint256).max);
        vm.prank(alice);
        vault.deposit(depositAmount, alice);

        vault.forceDeployToStrategies();
    }

    /// @notice 1. uncapped (cap == 0): full reported assets are recognised.
    function test_uncapped_recognisesFullReportedAssets() public {
        // Strategy lies that it doubled its assets.
        uint256 deployed = strat.reported();
        strat.setReported(deployed * 2);

        uint256 idle = vault.coinBalance();
        assertEq(vault.totalAssets(), idle + deployed * 2, "uncapped should accept inflated report");
    }

    /// @notice 2. cap below reported: totalAssets() is clamped to idle + cap.
    function test_cap_clampsInflatedReport() public {
        uint256 deployed = strat.reported();
        // Inflate the strategy's report 10x.
        strat.setReported(deployed * 10);

        // Set cap at the honest deployed amount.
        vault.setStrategyMaxAssets(address(strat), deployed);

        uint256 idle = vault.coinBalance();
        assertEq(vault.totalAssets(), idle + deployed, "cap should clamp inflated valuation");
    }

    /// @notice 3. cap equal to reported: no-op clamp.
    function test_capEqualToReported_isNoOp() public {
        uint256 deployed = strat.reported();
        vault.setStrategyMaxAssets(address(strat), deployed);

        uint256 idle = vault.coinBalance();
        assertEq(vault.totalAssets(), idle + deployed, "cap == reported is a no-op");
    }

    /// @notice 4. cap above reported: no-op clamp.
    function test_capAboveReported_isNoOp() public {
        uint256 deployed = strat.reported();
        vault.setStrategyMaxAssets(address(strat), deployed * 100);

        uint256 idle = vault.coinBalance();
        assertEq(vault.totalAssets(), idle + deployed, "cap > reported is a no-op");
    }

    /// @notice 5. only management/owner may set the cap.
    function test_setStrategyMaxAssets_onlyManagement() public {
        vm.prank(bob);
        vm.expectRevert();
        vault.setStrategyMaxAssets(address(strat), 1);
    }

    /// @notice 6. setter rejects zero strategy address.
    function test_setStrategyMaxAssets_rejectsZeroAddress() public {
        vm.expectRevert();
        vault.setStrategyMaxAssets(address(0), 1);
    }

    /// @notice 7. update emits old/new cap.
    function test_setStrategyMaxAssets_emitsEvent() public {
        vm.expectEmit(true, false, false, true, address(vault));
        emit UpdateStrategyMaxAssets(address(strat), 0, 1_000e18);
        vault.setStrategyMaxAssets(address(strat), 1_000e18);

        // And updating again surfaces the previous cap.
        vm.expectEmit(true, false, false, true, address(vault));
        emit UpdateStrategyMaxAssets(address(strat), 1_000e18, 0);
        vault.setStrategyMaxAssets(address(strat), 0);
    }
}
