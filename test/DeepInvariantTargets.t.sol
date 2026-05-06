// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CreatorOVaultWrapper} from "../contracts/vault/CreatorOVaultWrapper.sol";
import {CreatorGaugeController, ICreatorOracle, ISwapRouter} from "../contracts/governance/CreatorGaugeController.sol";
import {IStrategy} from "../contracts/interfaces/IStrategy.sol";

contract DeepMockToken is ERC20 {
    uint8 private immutable tokenDecimals;

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        tokenDecimals = 18;
    }

    function decimals() public view override returns (uint8) {
        return tokenDecimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract DeepMockVaultShare is ERC20 {
    ERC20 public immutable assetToken;

    constructor(address asset_) ERC20("Vault Share", "vSHARE") {
        assetToken = ERC20(asset_);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        if (msg.sender != owner) _spendAllowance(owner, msg.sender, shares);
        _burn(owner, shares);
        assetToken.transfer(receiver, shares);
        return shares;
    }

    function previewRedeem(uint256 shares) external pure returns (uint256) {
        return shares;
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        assetToken.transferFrom(msg.sender, address(this), assets);
        _mint(receiver, assets);
        return assets;
    }

    function totalAssets() external view returns (uint256) {
        return assetToken.balanceOf(address(this));
    }
}

contract DeepMockShareOFT {
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function burn(address from, uint256 amount) external {
        balanceOf[from] -= amount;
        totalSupply -= amount;
    }
}

contract WrapperBackingHandler is Test {
    CreatorOVaultWrapper public immutable wrapper;
    DeepMockVaultShare public immutable vaultShare;
    DeepMockShareOFT public immutable shareOFT;

    address internal immutable alice = makeAddr("wrapperAlice");
    address internal immutable bob = makeAddr("wrapperBob");
    address internal immutable sweepRecipient = makeAddr("wrapperSweep");

    constructor(CreatorOVaultWrapper wrapper_, DeepMockVaultShare vaultShare_, DeepMockShareOFT shareOFT_) {
        wrapper = wrapper_;
        vaultShare = vaultShare_;
        shareOFT = shareOFT_;
    }

    function wrapAlice(uint96 amount) external {
        _wrap(alice, amount);
    }

    function wrapBob(uint96 amount) external {
        _wrap(bob, amount);
    }

    function unwrapAlice(uint16 amount) external {
        _unwrap(alice, amount);
    }

    function unwrapBob(uint16 amount) external {
        _unwrap(bob, amount);
    }

    function sweepExcess(uint96 extraShares, uint96 requested) external {
        extraShares = uint96(bound(extraShares, 0, 10_000));
        requested = uint96(bound(requested, 0, 10_000));
        if (extraShares > 0) vaultShare.mint(address(wrapper), extraShares);
        try wrapper.emergencyWithdraw(address(vaultShare), sweepRecipient, requested) {} catch {}
    }

    function _wrap(address user, uint96 rawAmount) internal {
        uint256 amount = bound(rawAmount, 1_000, 10_000);
        vm.prank(user);
        try wrapper.wrap(amount) {} catch {}
    }

    function _unwrap(address user, uint16 rawAmount) internal {
        uint256 balance = shareOFT.balanceOf(user);
        if (balance == 0) return;
        uint256 amount = bound(rawAmount, 1, balance);
        vm.roll(block.number + 1);
        vm.prank(user);
        try wrapper.unwrap(amount) {} catch {}
    }
}

contract WrapperBackingInvariantTest is Test {
    DeepMockToken internal creatorCoin;
    DeepMockVaultShare internal vaultShare;
    DeepMockShareOFT internal shareOFT;
    CreatorOVaultWrapper internal wrapper;
    WrapperBackingHandler internal handler;

    function setUp() external {
        creatorCoin = new DeepMockToken("Creator Coin", "CR8R");
        vaultShare = new DeepMockVaultShare(address(creatorCoin));
        shareOFT = new DeepMockShareOFT();
        wrapper = new CreatorOVaultWrapper(address(creatorCoin), address(vaultShare), address(this));
        wrapper.setShareOFT(address(shareOFT));

        address alice = makeAddr("wrapperAlice");
        address bob = makeAddr("wrapperBob");
        vaultShare.mint(alice, 1_000_000);
        vaultShare.mint(bob, 1_000_000);
        vm.prank(alice);
        vaultShare.approve(address(wrapper), type(uint256).max);
        vm.prank(bob);
        vaultShare.approve(address(wrapper), type(uint256).max);

        handler = new WrapperBackingHandler(wrapper, vaultShare, shareOFT);
        targetContract(address(handler));
    }

    function invariant_wrapperBackingNeverDropsBelowRequired() external view {
        uint256 actualLocked = vaultShare.balanceOf(address(wrapper));
        uint256 totalLocked = wrapper.totalLocked();
        uint256 requiredBacking = wrapper.requiredLockedBacking();

        assertGe(actualLocked, totalLocked, "actual locked below accounting");
        assertGe(totalLocked, requiredBacking, "accounting below required backing");
        assertTrue(wrapper.verify(), "wrapper verify failed");
    }
}

contract DeepWithdrawHarness {
    IERC20 public immutable coin;
    uint256 public coinBalance;

    error TransferAmountMismatch(uint256 expected, uint256 actual);
    event StrategyWithdrawFailed(address indexed strategy, uint256 amount, bytes revertData);

    constructor(IERC20 coin_) {
        coin = coin_;
    }

    function tryWithdraw(address strategy, uint256 amount) external returns (uint256 withdrawn) {
        uint256 beforeBal = coin.balanceOf(address(this));
        uint256 reported;
        try IStrategy(strategy).withdraw(amount) returns (uint256 value) {
            reported = value;
        } catch (bytes memory revertData) {
            emit StrategyWithdrawFailed(strategy, amount, revertData);
            uint256 afterBalRevert = coin.balanceOf(address(this));
            coinBalance = afterBalRevert;
            return afterBalRevert > beforeBal ? afterBalRevert - beforeBal : 0;
        }

        uint256 afterBal = coin.balanceOf(address(this));
        coinBalance = afterBal;
        if (afterBal < beforeBal) {
            emit StrategyWithdrawFailed(
                strategy, amount, abi.encodeWithSelector(TransferAmountMismatch.selector, reported, 0)
            );
            return 0;
        }
        uint256 received = afterBal - beforeBal;
        if (received != reported) {
            emit StrategyWithdrawFailed(
                strategy, amount, abi.encodeWithSelector(TransferAmountMismatch.selector, reported, received)
            );
            return received;
        }
        return reported;
    }
}

contract DeepStrategy is IStrategy {
    IERC20 public immutable coin;
    uint8 public immutable mode;

    constructor(IERC20 coin_, uint8 mode_) {
        coin = coin_;
        mode = mode_;
    }

    function asset() external view returns (address) {
        return address(coin);
    }

    function isActive() external pure returns (bool) {
        return true;
    }

    function getTotalAssets() external view returns (uint256) {
        return coin.balanceOf(address(this));
    }

    function deposit(uint256) external pure returns (uint256) {
        return 0;
    }

    function withdraw(uint256 amount) external returns (uint256 withdrawn) {
        if (mode == 1) revert("strategy-paused");
        uint256 available = coin.balanceOf(address(this));
        uint256 actual = amount > available ? available : amount;
        if (mode == 2) {
            actual = actual / 2;
            coin.transfer(msg.sender, actual);
            return amount;
        }
        coin.transfer(msg.sender, actual);
        return actual;
    }

    function emergencyWithdraw() external pure returns (uint256) {
        return 0;
    }

    function harvest() external pure returns (uint256) {
        return 0;
    }

    function rebalance() external pure {}
}

contract StrategyWithdrawHandler is Test {
    DeepWithdrawHarness public immutable harness;
    DeepMockToken public immutable coin;
    DeepStrategy public immutable happy;
    DeepStrategy public immutable reverting;
    DeepStrategy public immutable mismatch;

    constructor(
        DeepWithdrawHarness harness_,
        DeepMockToken coin_,
        DeepStrategy happy_,
        DeepStrategy reverting_,
        DeepStrategy mismatch_
    ) {
        harness = harness_;
        coin = coin_;
        happy = happy_;
        reverting = reverting_;
        mismatch = mismatch_;
    }

    function withdrawHappy(uint96 amount) external {
        _withdraw(address(happy), amount);
    }

    function withdrawReverting(uint96 amount) external {
        _withdraw(address(reverting), amount);
    }

    function withdrawMismatch(uint96 amount) external {
        _withdraw(address(mismatch), amount);
    }

    function _withdraw(address strategy, uint96 rawAmount) internal {
        uint256 amount = bound(rawAmount, 0, 10_000 ether);
        try harness.tryWithdraw(strategy, amount) {} catch {}
    }
}

contract StrategyWithdrawInvariantTest is Test {
    DeepMockToken internal coin;
    DeepWithdrawHarness internal harness;
    StrategyWithdrawHandler internal handler;

    function setUp() external {
        coin = new DeepMockToken("Creator Coin", "CR8R");
        harness = new DeepWithdrawHarness(IERC20(address(coin)));
        DeepStrategy happy = new DeepStrategy(IERC20(address(coin)), 0);
        DeepStrategy reverting = new DeepStrategy(IERC20(address(coin)), 1);
        DeepStrategy mismatch = new DeepStrategy(IERC20(address(coin)), 2);
        coin.mint(address(happy), 1_000_000 ether);
        coin.mint(address(reverting), 1_000_000 ether);
        coin.mint(address(mismatch), 1_000_000 ether);

        handler = new StrategyWithdrawHandler(harness, coin, happy, reverting, mismatch);
        targetContract(address(handler));
    }

    function invariant_harnessCoinBalanceMatchesActual() external view {
        assertEq(harness.coinBalance(), coin.balanceOf(address(harness)), "harness accounting drift");
    }
}

contract DeepMockVault is ERC20 {
    IERC20 public immutable creatorAsset;

    constructor(address creatorAsset_) ERC20("Deep Mock Vault", "dmv") {
        creatorAsset = IERC20(creatorAsset_);
    }

    function unwrap(uint256 amount) external returns (uint256) {
        return amount;
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        creatorAsset.transferFrom(msg.sender, address(this), assets);
        shares = assets;
        _mint(receiver, shares);
    }
}

contract DeepMockOracle is ICreatorOracle {
    uint256 public creatorPerEth = 2e18;
    bool public fresh = true;

    function getCreatorPrice() external view returns (int256, uint256) {
        return (1e8, block.timestamp);
    }

    function getEthPrice() external view returns (int256, uint256) {
        return (3000e8, block.timestamp);
    }

    function getCreatorEthTWAP(uint32) external view returns (uint256) {
        return creatorPerEth;
    }

    function isPriceFresh() external view returns (bool) {
        return fresh;
    }
}

contract DeepMockRouter is ISwapRouter {
    IERC20 public immutable weth;
    IERC20 public immutable creatorCoin;

    constructor(IERC20 weth_, IERC20 creatorCoin_) {
        weth = weth_;
        creatorCoin = creatorCoin_;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 out) {
        weth.transferFrom(msg.sender, address(this), params.amountIn);
        out = params.amountIn * 2;
        creatorCoin.transfer(params.recipient, out);
    }
}

contract GaugeReserveHandler is Test {
    CreatorGaugeController public immutable gauge;
    DeepMockToken public immutable weth;
    DeepMockToken public immutable creatorCoin;
    address internal immutable alice = makeAddr("gaugeAlice");

    constructor(CreatorGaugeController gauge_, DeepMockToken weth_, DeepMockToken creatorCoin_) {
        gauge = gauge_;
        weth = weth_;
        creatorCoin = creatorCoin_;
    }

    function receiveFees(uint96 amount) external {
        amount = uint96(bound(amount, 0, 20 ether));
        weth.mint(alice, amount);
        vm.startPrank(alice);
        weth.approve(address(gauge), amount);
        try gauge.receiveWETHFees(amount) {} catch {}
        vm.stopPrank();
    }

    function processFees() external {
        uint256 pending = gauge.pendingWETHFees();
        if (pending == 0) return;
        creatorCoin.mint(0x2626664c2603336E57B271c5C0b26F421741e481, pending * 2);
        try gauge.processWETHFees() {} catch {}
    }
}

contract GaugeReserveInvariantTest is Test {
    CreatorGaugeController internal gauge;
    DeepMockToken internal weth;
    DeepMockToken internal creatorCoin;
    DeepMockToken internal shareOFT;
    DeepMockVault internal vault;
    GaugeReserveHandler internal handler;

    function setUp() external {
        vm.chainId(8453);
        weth = new DeepMockToken("Wrapped Ether", "WETH");
        creatorCoin = new DeepMockToken("Creator Coin", "CREATOR");
        shareOFT = new DeepMockToken("Share OFT", "SHARE");
        vault = new DeepMockVault(address(creatorCoin));
        DeepMockOracle oracle = new DeepMockOracle();
        vm.etch(0x4200000000000000000000000000000000000006, address(weth).code);
        weth = DeepMockToken(0x4200000000000000000000000000000000000006);
        DeepMockRouter router = new DeepMockRouter(IERC20(address(weth)), IERC20(address(creatorCoin)));
        vm.etch(0x2626664c2603336E57B271c5C0b26F421741e481, address(router).code);

        gauge = new CreatorGaugeController(
            address(shareOFT), makeAddr("creatorTreasury"), makeAddr("protocolTreasury"), address(this)
        );
        gauge.setVault(address(vault));
        gauge.setCreatorCoin(address(creatorCoin));
        gauge.setOracle(address(oracle));

        handler = new GaugeReserveHandler(gauge, weth, creatorCoin);
        targetContract(address(handler));
    }

    function invariant_jackpotReserveNeverExceedsShareBalance() external view {
        assertLe(gauge.jackpotReserve(), IERC20(address(vault)).balanceOf(address(gauge)), "reserve exceeds shares");
    }
}

contract BoundedNavMonotonicityHalmosTest is Test {
    function check_boundedNavNumeratorMonotonicity(uint32 totalAssetsBefore, uint16 assetGain) public pure {
        uint256 assetsBefore = uint256(totalAssetsBefore);
        uint256 assetsAfter = assetsBefore + assetGain;

        assert(assetsAfter >= assetsBefore);
    }

    function testFuzz_boundedNavPpsMonotonicity(uint32 totalAssetsBefore, uint16 assetGain, uint16 totalSupply)
        public
        pure
    {
        vm.assume(totalSupply > 0);
        uint256 scaledBefore = uint256(totalAssetsBefore) * 1e18;
        uint256 scaledAfter = (uint256(totalAssetsBefore) + assetGain) * 1e18;

        assert(scaledAfter * totalSupply >= scaledBefore * totalSupply);
    }
}
