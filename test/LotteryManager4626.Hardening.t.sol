// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {LotteryManager4626, LotteryManager4626AdminModule} from "@4626/shared/lottery/manager/LotteryManager4626.sol";
import {LotteryManager4626PricingLib} from "@4626/shared/lottery/manager/LotteryManager4626PricingLib.sol";

/// @dev Minimal registry/oracle for pricing-lib unit checks.
contract MockOracleHardening {
    int256 public price = 1e18;
    uint256 public ts;

    constructor() {
        ts = block.timestamp;
    }

    function set(int256 p, uint256 t) external {
        price = p;
        ts = t;
    }

    function getAssetPrice() external view returns (int256, uint256) {
        return (price, ts);
    }
}

contract MockRegistryHardening {
    address public oracle;
    address public shareOft;
    address public token = address(0xA11CE);

    constructor(address oracle_, address shareOft_) {
        oracle = oracle_;
        shareOft = shareOft_;
    }

    function getOracleForToken(address) external view returns (address) {
        return oracle;
    }

    function getShareOFTForToken(address) external view returns (address) {
        return shareOft;
    }
}

contract MockErc20Decimals6 {
    function decimals() external pure returns (uint8) {
        return 6;
    }
}

contract MockRegistryHardeningDecimals {
    address public oracle;
    address public token;

    constructor(address oracle_, address token_) {
        oracle = oracle_;
        token = token_;
    }

    function getOracleForToken(address) external view returns (address) {
        return oracle;
    }

    function getShareOFTForToken(address) external view returns (address) {
        return token;
    }
}

/// @notice Hardening checks for size-extraction: EIP-170, pricing lib fail-closed, storage mirror notes.
contract LotteryManager4626HardeningTest is Test {
    function test_mainAndAdmin_underEip170() public view {
        bytes memory mainRt =
            vm.getDeployedCode("contracts/shared/lottery/manager/LotteryManager4626.sol:LotteryManager4626");
        bytes memory adminRt =
            vm.getDeployedCode("contracts/shared/lottery/manager/LotteryManager4626.sol:LotteryManager4626AdminModule");
        assertLe(mainRt.length, 24_576, "main over EIP-170");
        assertLe(adminRt.length, 24_576, "admin over EIP-170");
        // Soft budget after ODA-496 remediations (gate + EV context + 1h grace). Hard EIP-170
        // remains enforced by SizeLimit. Prefer ≥150B so the next feature still has room.
        assertGe(24_576 - mainRt.length, 150, "main headroom under 150B - size budget review required");
    }

    function test_pricingLib_failClosed_onBadInputs() public {
        MockOracleHardening oracle = new MockOracleHardening();
        MockRegistryHardening reg = new MockRegistryHardening(address(oracle), address(0xBEEF));

        (uint256 usd,,) = LotteryManager4626PricingLib.calculateTokenUSD(
            address(0), reg.token(), reg.token(), 1e18, 0, 0, 0, 0, 0, 0
        );
        assertEq(usd, 0, "zero registry");

        (usd,,) = LotteryManager4626PricingLib.calculateTokenUSD(
            address(reg), reg.token(), address(0xBAD), 1e18, 0, 0, 0, 0, 0, 0
        );
        assertEq(usd, 0, "wrong tokenIn");

        (usd,,) = LotteryManager4626PricingLib.calculateTokenUSD(
            address(reg), reg.token(), reg.token(), 0, 0, 0, 0, 0, 0, 0
        );
        assertEq(usd, 0, "zero amount");

        oracle.set(0, block.timestamp);
        (usd,,) = LotteryManager4626PricingLib.calculateTokenUSD(
            address(reg), reg.token(), reg.token(), 1e18, 0, 0, 0, 0, 0, 0
        );
        assertEq(usd, 0, "non-positive price");
    }

    function test_pricingLib_fairMaxJackpotShares_boundsWashEv() public pure {
        // $100 entry, 400 PPM win chance, 30 bps fee proxy, $1/share → max prize $750.
        uint256 maxShares =
            LotteryManager4626PricingLib.fairMaxJackpotShares(100e6, 400, 30, 1e18);
        assertEq(maxShares, 750e18);
        assertEq(
            LotteryManager4626PricingLib.fairMaxJackpotShares(100e6, 400, 30, 0),
            0,
            "missing payout price must fail closed"
        );
    }

    function test_pricingLib_happyPath_andDeviation() public {
        MockOracleHardening oracle = new MockOracleHardening();
        MockRegistryHardening reg = new MockRegistryHardening(address(oracle), address(0xBEEF));
        oracle.set(1e18, block.timestamp);

        (uint256 usd, uint256 price,) = LotteryManager4626PricingLib.calculateTokenUSD(
            address(reg), reg.token(), reg.token(), 1e18, 3600, 0, 0, 0, 0, 0
        );
        assertEq(price, 1e18);
        assertEq(usd, 1_000_000); // $1 in 1e6

        // 50% deviation vs last 1e18 with max 10% inside 1h window → reject
        oracle.set(15e17, block.timestamp);
        (usd,,) = LotteryManager4626PricingLib.calculateTokenUSD(
            address(reg), reg.token(), reg.token(), 1e18, 3600, 1000, 1 hours, 1e18, block.timestamp, 0
        );
        assertEq(usd, 0, "deviation should fail closed inside window");

        // ODA-496-6: after enough windows the allowed band widens to cover a 50% move
        // (base 10% × 5 windows = 50%) without disabling the circuit breaker outright.
        vm.warp(block.timestamp + 4 hours + 1);
        oracle.set(15e17, block.timestamp);
        (usd, price,) = LotteryManager4626PricingLib.calculateTokenUSD(
            address(reg), reg.token(), reg.token(), 1e18, 3600, 1000, 1 hours, 1e18, block.timestamp - 4 hours - 1, 0
        );
        assertEq(price, 15e17, "aged reference must widen band enough to accept");
        assertGt(usd, 0, "aged reference must widen band enough to accept");

        // Still inside a too-narrow aged band: reject.
        oracle.set(3e18, block.timestamp);
        (usd,,) = LotteryManager4626PricingLib.calculateTokenUSD(
            address(reg), reg.token(), reg.token(), 1e18, 3600, 1000, 1 hours, 1e18, block.timestamp - 4 hours - 1, 0
        );
        assertEq(usd, 0, "extreme jump must still fail under widened band");
    }

    function test_pricingLib_respectsTokenDecimals() public {
        MockOracleHardening oracle = new MockOracleHardening();
        MockRegistryHardening reg = new MockRegistryHardening(address(oracle), address(0xBEEF));
        oracle.set(1e18, block.timestamp);

        MockErc20Decimals6 token6 = new MockErc20Decimals6();
        // Point registry token/share at the 6-decimal mock via a custom registry.
        MockRegistryHardeningDecimals reg6 = new MockRegistryHardeningDecimals(address(oracle), address(token6));

        // 1e6 units of a 6-decimal token at $1 → $1 (1e6 USD).
        (uint256 usd,,) = LotteryManager4626PricingLib.calculateTokenUSD(
            address(reg6), address(token6), address(token6), 1e6, 0, 0, 0, 0, 0, 0
        );
        assertEq(usd, 1_000_000, "6-decimal token must normalize by 1e6 not 1e18");

        // Pathological amount fails closed (ODA-461-22).
        (usd,,) = LotteryManager4626PricingLib.calculateTokenUSD(
            address(reg),
            reg.token(),
            reg.token(),
            uint256(type(uint128).max) + 1,
            0,
            0,
            0,
            0,
            0,
            0
        );
        assertEq(usd, 0, "amount above uint128 max must fail closed");
    }

    function test_adminModule_payoutSelector_exists() public pure {
        // Ensures size extraction entrypoint does not get renamed without a test break.
        bytes4 sel = LotteryManager4626AdminModule.payoutLocalJackpot.selector;
        assertTrue(sel != bytes4(0));
    }
}
