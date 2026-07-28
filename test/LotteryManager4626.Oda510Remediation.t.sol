// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {
    LotteryManager4626,
    LotteryManager4626AdminModule
} from "@4626/shared/lottery/manager/LotteryManager4626.sol";
import {LotteryManager4626PricingLib} from "@4626/shared/lottery/manager/LotteryManager4626PricingLib.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Oda510MockOracle {
    int256 public price = 1e18;
    uint256 public ts;

    constructor() {
        ts = block.timestamp;
    }

    function getAssetPrice() external view returns (int256, uint256) {
        return (price, ts);
    }

    function set(int256 p, uint256 t) external {
        price = p;
        ts = t;
    }
}

contract Oda510MockRegistry {
    address public immutable endpoint;
    address public immutable token;
    address public immutable shareOFT;
    address public immutable oracle;
    address public gauge;
    address[] internal _tokens;
    mapping(address => address) public gaugeByToken;
    mapping(address => address) public oracleByToken;
    mapping(address => bool) public active;

    constructor(address endpoint_, address token_, address shareOFT_, address oracle_) {
        endpoint = endpoint_;
        token = token_;
        shareOFT = shareOFT_;
        oracle = oracle_;
        _tokens.push(token_);
        oracleByToken[token_] = oracle_;
        active[token_] = true;
    }

    function setGauge(address g) external {
        gauge = g;
        gaugeByToken[token] = g;
    }

    function addLane(address token_, address oracle_, address gauge_) external {
        _tokens.push(token_);
        oracleByToken[token_] = oracle_;
        gaugeByToken[token_] = gauge_;
        active[token_] = true;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function getOracleForToken(address t) external view returns (address) {
        return oracleByToken[t];
    }

    function getShareOFTForToken(address) external view returns (address) {
        return shareOFT;
    }

    function getVaultForToken(address) external pure returns (address) {
        return address(uint160(0xA11CE));
    }

    function getGaugeControllerForToken(address t) external view returns (address) {
        return gaugeByToken[t];
    }

    function isTokenActive(address t) external view returns (bool) {
        return active[t];
    }

    function getAllTokens() external view returns (address[] memory) {
        return _tokens;
    }

    function getTokenForShareOFT(address) external view returns (address) {
        return token;
    }
}

contract Oda510MockGauge {
    uint256 public reserve = 1_000e18;
    uint256 public lastPay;
    uint256 public totalPaid;

    function availableJackpotReserve() external view returns (uint256) {
        return reserve;
    }

    function payJackpot(address, uint256 shares) external {
        lastPay = shares;
        if (shares > reserve) shares = reserve;
        reserve -= shares;
        totalPaid += shares;
    }
}

contract Oda510MockVrf {
    function requestRandomWords(address, uint256, uint256, uint32) external pure returns (uint256) {
        return 1;
    }
}

contract Oda510PayoutHarness is LotteryManager4626 {
    constructor(address registry_, address owner_) LotteryManager4626(registry_, owner_) {}

    function exposedPayoutWithEv(
        address triggeringCoin,
        address winner,
        uint256 amountUSD,
        uint256 winChancePPM,
        uint16 payoutBps
    ) external returns (uint256) {
        _jackpotEvContext = amountUSD | (winChancePPM << 128);
        return _payoutLocalJackpot(triggeringCoin, winner, payoutBps);
    }
}

/// @notice ODA-510 High/Medium/Low remediation checks.
contract LotteryManager4626Oda510RemediationTest is Test {
    address internal constant LZ = 0x1a44076050125825900e736c501f859c50fE728c;

    Oda510PayoutHarness internal manager;
    Oda510MockOracle internal oracle;
    Oda510MockGauge internal gauge;
    Oda510MockRegistry internal registry;
    address internal owner = address(this);
    address internal token = address(0xC01);
    address internal share = address(0x5F7);
    address internal winner = address(0xBEEF);

    function setUp() public {
        vm.mockCall(LZ, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        oracle = new Oda510MockOracle();
        registry = new Oda510MockRegistry(LZ, token, share, address(oracle));
        gauge = new Oda510MockGauge();
        registry.setGauge(address(gauge));

        manager = new Oda510PayoutHarness(address(registry), owner);
        manager.setLocalVRFConsumer(address(new Oda510MockVrf()));
        manager.setUseLocalVRF(true);
    }

    function _enableMultiVault() internal {
        manager.setSingleVaultJackpotOnly(false);
        vm.warp(block.timestamp + manager.LOCAL_VRF_CONSUMER_TIMELOCK());
        manager.adminModuleCall(
            abi.encodeWithSelector(LotteryManager4626AdminModule.executeSingleVaultJackpotOnlyChange.selector)
        );
    }

    function test_oda510_4_singleVaultToggleIsTimelocked() public {
        assertTrue(manager.singleVaultJackpotOnly());
        manager.setSingleVaultJackpotOnly(false);
        assertTrue(manager.singleVaultJackpotOnly());

        bytes memory execSel =
            abi.encodeWithSelector(LotteryManager4626AdminModule.executeSingleVaultJackpotOnlyChange.selector);
        vm.expectRevert(LotteryManager4626AdminModule.SingleVaultJackpotOnlyTimelockActive.selector);
        manager.adminModuleCall(execSel);

        vm.warp(block.timestamp + manager.LOCAL_VRF_CONSUMER_TIMELOCK());
        manager.adminModuleCall(execSel);
        assertFalse(manager.singleVaultJackpotOnly());
    }

    function test_oda510_8_adminModuleCallCannotRenounce() public {
        vm.expectRevert(LotteryManager4626.Unauthorized.selector);
        manager.adminModuleCall(abi.encodeWithSelector(Ownable.renounceOwnership.selector));
    }

    function test_oda510_19_pricingLibFairMaxMatchesInlineSemantics() public pure {
        uint256 libShares = LotteryManager4626PricingLib.fairMaxJackpotShares(1e6, 4, 30, 1e18);
        // amount=$1, p=4ppm, fee=30bps → maxPrizeUSD1e6 = 750_000_000 ($750)
        // EV = $750 * 4ppm = $0.003 = 30bps of $1. shares @ $1 = 750e18
        assertEq(libShares, 750e18);
        assertEq(LotteryManager4626PricingLib.fairMaxJackpotPrizeUSD(1e6, 4, 30), 750_000_000);
    }

    function test_oda510_15_gasConstantRaised() public view {
        assertEq(manager.JACKPOT_PAYOUT_CALL_GAS(), 500_000);
    }

    /// @notice Multi-vault must share one ticket-level EV budget (not N× per-vault caps).
    function test_oda510_1_multiVaultSharesTicketLevelEvBudget() public {
        Oda510MockOracle oracle2 = new Oda510MockOracle();
        Oda510MockGauge gauge2 = new Oda510MockGauge();
        address token2 = address(0xC02);
        registry.addLane(token2, address(oracle2), address(gauge2));

        _enableMultiVault();
        // Timelock warp ages constructor timestamps past oracleMaxStaleness — refresh.
        oracle.set(1e18, block.timestamp);
        oracle2.set(1e18, block.timestamp);

        // $1 ticket, winChance=4ppm → fair prize $750. Per-vault clamp would pay
        // $750 × 2 vaults; shared budget must pay $750 total (690e18 from first vault
        // at 69% of 1000e18 reserve, under the $750 cap).
        uint256 paid = manager.exposedPayoutWithEv(token, winner, 1e6, 4, 6900);
        uint256 totalPaidShares = gauge.totalPaid() + gauge2.totalPaid();
        assertEq(paid, totalPaidShares, "return must match gauge drains");
        assertEq(gauge.totalPaid(), 690e18, "first vault pays 69% reserve under EV budget");
        assertEq(gauge2.totalPaid(), 60e18, "second vault receives only remaining EV budget");
        assertEq(totalPaidShares, 750e18, "basket must not exceed ticket-level EV");
    }

    /// @notice Missing fair-EV price must revert (retryable) instead of finalizing a 0 payout.
    function test_oda510_3_missingFairEvPriceRevertsForRetry() public {
        oracle.set(0, block.timestamp); // non-positive → cold-lane price stays 0
        vm.expectRevert(LotteryManager4626AdminModule.FairEvCapUnavailable.selector);
        manager.exposedPayoutWithEv(token, winner, 1e6, 4, 6900);
        assertEq(gauge.totalPaid(), 0);
    }

    /// @notice Multi-vault must also fail closed when payable vaults are unpriced.
    /// AMOE-only / stale cold-lane oracles previously skipped every vault and finalized at 0.
    function test_oda510_3_multiVaultUnpricedReserveRevertsForRetry() public {
        Oda510MockOracle oracle2 = new Oda510MockOracle();
        Oda510MockGauge gauge2 = new Oda510MockGauge();
        address token2 = address(0xC02);
        registry.addLane(token2, address(oracle2), address(gauge2));

        _enableMultiVault();
        // Non-positive prices → no lastAcceptedPrice and cold-lane fallback stays 0.
        oracle.set(0, block.timestamp);
        oracle2.set(0, block.timestamp);

        vm.expectRevert(LotteryManager4626AdminModule.FairEvCapUnavailable.selector);
        manager.exposedPayoutWithEv(token, winner, 1e6, 4, 6900);
        assertEq(gauge.totalPaid() + gauge2.totalPaid(), 0, "unpriced basket must not finalize a drain");
    }

}
