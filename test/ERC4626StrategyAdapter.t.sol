// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/vault/strategies/ERC4626StrategyAdapter.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockERC4626Vault is ERC4626 {
    constructor(IERC20 _asset) ERC20("Mock 4626 Vault", "m4626") ERC4626(_asset) {}
}

contract ManipulableERC4626Vault is ERC4626 {
    uint256 public assetsMultiplier = 1e18;
    bool public revertOnConvert;

    constructor(IERC20 _asset) ERC20("Manipulable 4626 Vault", "x4626") ERC4626(_asset) {}

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

contract RevertingWithdrawERC4626Vault is ERC4626 {
    constructor(IERC20 _asset) ERC20("Reverting 4626 Vault", "r4626") ERC4626(_asset) {}

    function withdraw(uint256, address, address) public pure override returns (uint256) {
        revert("withdraw disabled");
    }

    function redeem(uint256, address, address) public pure override returns (uint256) {
        revert("redeem disabled");
    }
}

contract MockCreatorOVault {
    IERC20 public immutable CREATOR_COIN;

    constructor(IERC20 _creatorCoin) {
        CREATOR_COIN = _creatorCoin;
    }
}

contract ERC4626StrategyAdapterTest is Test {
    MockERC20 public asset;
    MockCreatorOVault public vault;
    MockERC4626Vault public inner;
    ERC4626StrategyAdapter public strategy;

    uint256 internal constant DEPOSIT_AMOUNT = 100e18;

    function setUp() public {
        asset = new MockERC20("ASSET", "ASSET");
        vault = new MockCreatorOVault(IERC20(address(asset)));
        inner = new MockERC4626Vault(IERC20(address(asset)));

        strategy = new ERC4626StrategyAdapter(address(vault), address(inner), address(this));

        // Fund the vault and approve the strategy to pull funds.
        asset.mint(address(vault), 1000e18);
        vm.prank(address(vault));
        asset.approve(address(strategy), type(uint256).max);
    }

    function testDeployment() public {
        assertEq(strategy.vault(), address(vault));
        assertEq(strategy.asset(), address(asset));
        assertEq(address(strategy.ERC4626_VAULT()), address(inner));
        assertTrue(strategy.isActive());
        assertEq(strategy.idleBufferBps(), 1000);
    }

    function testDeposit_KeepsIdleBuffer() public {
        vm.prank(address(vault));
        uint256 deposited = strategy.deposit(DEPOSIT_AMOUNT);
        assertEq(deposited, DEPOSIT_AMOUNT);

        // Default buffer is 10% => 10e18 idle, 90e18 deposited into ERC4626.
        assertEq(asset.balanceOf(address(strategy)), 10e18);
        assertEq(inner.balanceOf(address(strategy)), 90e18);
        assertEq(strategy.getTotalAssets(), DEPOSIT_AMOUNT);
    }

    function testWithdraw_UsesIdleThenInner() public {
        testDeposit_KeepsIdleBuffer();

        uint256 beforeBal = asset.balanceOf(address(vault));
        vm.prank(address(vault));
        uint256 out = strategy.withdraw(25e18);
        uint256 afterBal = asset.balanceOf(address(vault));

        assertEq(out, 25e18);
        assertEq(afterBal - beforeBal, out);
        assertEq(strategy.getTotalAssets(), 75e18);
    }

    function testGetTotalAssets_ReflectsYield() public {
        testDeposit_KeepsIdleBuffer();

        // Simulate yield by minting assets directly to the inner vault.
        asset.mint(address(inner), 10e18);

        // inner shares (90e18) now convert to 100e18 assets; plus 10e18 idle buffer => 110e18 total.
        // OZ ERC4626 conversion math can be off by 1 wei due to rounding/offset handling.
        assertApproxEqAbs(strategy.getTotalAssets(), 110e18, 1);
    }

    function testWithdraw_BestEffortIfInnerWithdrawReverts() public {
        RevertingWithdrawERC4626Vault badInner = new RevertingWithdrawERC4626Vault(IERC20(address(asset)));
        ERC4626StrategyAdapter badStrategy =
            new ERC4626StrategyAdapter(address(vault), address(badInner), address(this));

        // Approve new strategy
        vm.prank(address(vault));
        asset.approve(address(badStrategy), type(uint256).max);

        vm.prank(address(vault));
        badStrategy.deposit(DEPOSIT_AMOUNT);

        // With 10% buffer, only the idle 10e18 should be withdrawable (inner withdraw/redeem always reverts).
        uint256 beforeBal = asset.balanceOf(address(vault));
        vm.prank(address(vault));
        uint256 out = badStrategy.withdraw(25e18);
        uint256 afterBal = asset.balanceOf(address(vault));

        assertEq(out, 10e18);
        assertEq(afterBal - beforeBal, out);
    }

    function testIsValuationReady_falseOnAtomicValuationSpike() public {
        ManipulableERC4626Vault manipulable = new ManipulableERC4626Vault(IERC20(address(asset)));
        ERC4626StrategyAdapter guarded =
            new ERC4626StrategyAdapter(address(vault), address(manipulable), address(this));

        vm.prank(address(vault));
        asset.approve(address(guarded), type(uint256).max);

        vm.prank(address(vault));
        guarded.deposit(DEPOSIT_AMOUNT);

        assertTrue(guarded.isValuationReady(), "baseline valuation should be ready");

        manipulable.setAssetsMultiplier(2e18); // +100% in one manipulation step
        assertFalse(guarded.isValuationReady(), "valuation guard should reject atomic spike");
    }

    function testIsValuationReady_trueForBoundedChange() public {
        ManipulableERC4626Vault manipulable = new ManipulableERC4626Vault(IERC20(address(asset)));
        ERC4626StrategyAdapter guarded =
            new ERC4626StrategyAdapter(address(vault), address(manipulable), address(this));

        vm.prank(address(vault));
        asset.approve(address(guarded), type(uint256).max);

        vm.prank(address(vault));
        guarded.deposit(DEPOSIT_AMOUNT);

        manipulable.setAssetsMultiplier(105e16); // +5%
        assertTrue(guarded.isValuationReady(), "small bounded move should remain ready");
    }

    function testIsValuationReady_falseWhenConvertReverts() public {
        ManipulableERC4626Vault manipulable = new ManipulableERC4626Vault(IERC20(address(asset)));
        ERC4626StrategyAdapter guarded =
            new ERC4626StrategyAdapter(address(vault), address(manipulable), address(this));

        vm.prank(address(vault));
        asset.approve(address(guarded), type(uint256).max);

        vm.prank(address(vault));
        guarded.deposit(DEPOSIT_AMOUNT);
        assertTrue(guarded.isValuationReady());

        manipulable.setRevertOnConvert(true);
        assertFalse(guarded.isValuationReady(), "reverting conversion must mark valuation not ready");
    }
}

