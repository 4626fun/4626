// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LotteryManager4626} from "@4626/shared/lottery/manager/LotteryManager4626.sol";
import {ve4626} from "@4626/shared/governance/ve4626.sol";
import {ve4626BoostManager} from "@4626/shared/governance/ve4626BoostManager.sol";
import {ve4626Utility} from "@4626/shared/governance/ve4626Utility.sol";

contract CurveBoostToken is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CurveBoostOracle {
    function getAssetPrice() external view returns (int256 price, uint256 updatedAt) {
        return (1e18, block.timestamp);
    }
}

contract CurveBoostRegistry {
    address public immutable endpoint;
    address public immutable creatorCoin;
    address public immutable shareOFT;
    address public immutable oracle;

    constructor(address endpoint_, address creatorCoin_, address shareOFT_, address oracle_) {
        endpoint = endpoint_;
        creatorCoin = creatorCoin_;
        shareOFT = shareOFT_;
        oracle = oracle_;
    }

    function getVaultForToken(address) external pure returns (address) {
        return address(0);
    }

    function getShareOFTForToken(address token) external view returns (address) {
        return token == creatorCoin ? shareOFT : address(0);
    }

    function getTokenForShareOFT(address token) external view returns (address) {
        return token == shareOFT ? creatorCoin : address(0);
    }

    function getOracleForToken(address token) external view returns (address) {
        return token == creatorCoin ? oracle : address(0);
    }

    function getGaugeControllerForToken(address) external pure returns (address) {
        return address(0);
    }

    function isTokenActive(address token) external view returns (bool) {
        return token == creatorCoin;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function getAllTokens() external view returns (address[] memory tokens) {
        tokens = new address[](1);
        tokens[0] = creatorCoin;
    }
}

contract CurveBoostGauge {
    uint256 public boostPPM;

    function setBoostPPM(uint256 boostPPM_) external {
        boostPPM = boostPPM_;
    }

    function getVaultGaugeProbabilityBoostPPM(address) external view returns (uint256) {
        return boostPPM;
    }
}

contract LotteryManager4626CurveBoostHarness is LotteryManager4626 {
    constructor(address registry_, address owner_) LotteryManager4626(registry_, owner_) {}

    function applyBoost(
        address user,
        address token,
        address shareBalanceToken,
        uint256 shareBalanceUSD,
        uint256 swapAmountUSD,
        uint256 baseWinChance
    ) external view returns (uint256) {
        return _applyBoost(
            user, token, shareBalanceToken, shareBalanceUSD, address(0xBEEF), swapAmountUSD, baseWinChance
        );
    }
}

contract LotteryManager4626CurveBoostIntegrationTest is Test {
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    address internal owner = makeAddr("owner");
    address internal user = makeAddr("user");
    address internal creatorCoin = makeAddr("creatorCoin");

    CurveBoostToken internal wrapped;
    CurveBoostToken internal share;
    ve4626 internal ve;
    ve4626Utility internal utility;
    ve4626BoostManager internal boost;
    CurveBoostGauge internal gauge;
    LotteryManager4626CurveBoostHarness internal manager;

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        wrapped = new CurveBoostToken("Wrapped Share", "wSHARE");
        share = new CurveBoostToken("Creator Share", "cSHARE");
        CurveBoostOracle oracle = new CurveBoostOracle();
        CurveBoostRegistry registry =
            new CurveBoostRegistry(LZ_ENDPOINT, creatorCoin, address(share), address(oracle));

        ve = new ve4626("ve4626", "ve4626", address(wrapped), owner);
        utility = new ve4626Utility(address(ve), owner);
        boost = new ve4626BoostManager(address(ve), owner);
        gauge = new CurveBoostGauge();

        vm.startPrank(owner);
        boost.setUtility(address(utility));
        ve.setBoostManager(address(boost));
        manager = new LotteryManager4626CurveBoostHarness(address(registry), owner);
        manager.setBoostManager(address(boost));
        manager.setVe4626GaugeVoting(address(gauge));
        vm.stopPrank();

        wrapped.mint(user, 100e18);
        share.mint(makeAddr("shareSupply"), 1_000e18);

        vm.startPrank(user);
        wrapped.approve(address(ve), 100e18);
        ve.lock(address(wrapped), 100e18, ve.MAX_LOCK_DURATION());
        utility.claimVeLottery(utility.capacityOf(user));
        vm.stopPrank();

        vm.roll(block.number + boost.MIN_HOLDING_BLOCKS() + 1);
    }

    function test_zeroCoverageLeavesBaseOddsNeutral() public view {
        assertEq(manager.applyBoost(user, creatorCoin, address(share), 0, 100e6, 10_000), 10_000);
    }

    function test_fullCoverageAppliesFullTwoPointFiveX() public view {
        assertEq(manager.applyBoost(user, creatorCoin, address(share), 100e6, 100e6, 10_000), 25_000);
    }

    function test_partialCoverageBlendsOnlyCoveredUplift() public view {
        // Raw Curve boost is 2.5×; 10% coverage applies 10% of the 1.5× uplift.
        assertEq(manager.applyBoost(user, creatorCoin, address(share), 10e6, 100e6, 10_000), 11_500);
    }

    function test_tinyCoverageCannotAmplifyEntireSwap() public view {
        assertEq(manager.applyBoost(user, creatorCoin, address(share), 1e6, 100e6, 10_000), 10_150);
    }

    function test_maxWinChanceStillCapsBoostedOdds() public view {
        assertEq(manager.applyBoost(user, creatorCoin, address(share), 100e6, 100e6, 100_000), 150_000);
    }

    function test_gaugeProbabilityRemainsAdditive() public {
        gauge.setBoostPPM(10_000);
        // At the $10k scale ceiling, the full 10,000 PPM gauge allocation is additive.
        assertEq(manager.applyBoost(user, creatorCoin, address(share), 0, 10_000e6, 10_000), 20_000);
    }
}
