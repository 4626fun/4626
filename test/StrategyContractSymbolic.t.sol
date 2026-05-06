// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";

/// @dev Halmos-friendly strategy contract models. These pin the small arithmetic
/// and gate decisions behind the larger strategy integration tests without
/// deploying Uniswap/Ajna/Solana fixtures in symbolic execution.
contract StrategyContractSymbolicTest is Test {
    uint256 internal constant MAX_BPS = 10_000;

    function check_bridgeReturnRequiresTokenConsumption(
        bool adapterReturned,
        uint64 balanceBefore,
        uint64 balanceAfter,
        uint64 amount
    ) public pure {
        bool accepted = _bridgeAccepted(adapterReturned, balanceBefore, balanceAfter, amount);

        if (accepted) {
            assert(adapterReturned);
            assert(balanceBefore >= amount);
            assert(balanceAfter <= balanceBefore - amount);
        }
        if (!adapterReturned || amount > balanceBefore || balanceAfter > balanceBefore - amount) {
            assert(!accepted);
        }
    }

    function check_solanaNavReportGate(
        bool reportIdUsed,
        bool reportIdZero,
        uint64 previousNav,
        uint64 newNav,
        uint16 maxDeltaBps
    ) public pure {
        vm.assume(maxDeltaBps <= uint16(MAX_BPS));

        bool accepted = _navReportAccepted(reportIdUsed, reportIdZero, previousNav, newNav, maxDeltaBps);

        if (accepted) {
            assert(!reportIdUsed);
            assert(!reportIdZero);
            assert(_deltaWithinCap(previousNav, newNav, maxDeltaBps));
        }
        if (reportIdUsed || reportIdZero) {
            assert(!accepted);
        }
    }

    function check_erc4626IdleBufferSplit(uint64 amount, uint16 idleBufferBps) public pure {
        vm.assume(idleBufferBps <= uint16(MAX_BPS));

        uint256 idle = (uint256(amount) * idleBufferBps) / MAX_BPS;
        uint256 deployed = uint256(amount) - idle;

        assert(idle + deployed == amount);
        assert(idle <= amount);
        assert(deployed <= amount);
    }

    function check_ccaOracleFreshnessGate(
        uint64 nowTs,
        uint64 creatorTimestamp,
        uint64 ethTimestamp,
        uint64 maxStaleness,
        int128 creatorPrice,
        int128 ethPrice,
        bool currencySupported
    ) public pure {
        bool accepted = _oracleInputsAccepted(
            nowTs, creatorTimestamp, ethTimestamp, maxStaleness, creatorPrice, ethPrice, currencySupported
        );

        if (accepted) {
            assert(currencySupported);
            assert(creatorPrice > 0);
            assert(ethPrice > 0);
            assert(nowTs >= creatorTimestamp);
            assert(nowTs >= ethTimestamp);
            assert(nowTs - creatorTimestamp <= maxStaleness);
            assert(nowTs - ethTimestamp <= maxStaleness);
        }
    }

    function model_slippageBpsMonotonicity(uint64 amount, uint16 tightBps, uint16 looseBps) public pure {
        vm.assume(tightBps <= uint16(MAX_BPS));
        vm.assume(looseBps <= uint16(MAX_BPS));
        vm.assume(tightBps <= looseBps);

        uint256 tightMin = _minOut(amount, tightBps);
        uint256 looseMin = _minOut(amount, looseBps);

        assert(tightMin >= looseMin);
        assert(tightMin <= amount);
        assert(looseMin <= amount);
    }

    function testFuzz_strategyContractModels(
        bool adapterReturned,
        uint64 balanceBefore,
        uint64 balanceAfter,
        uint64 bridgeAmount,
        bool reportIdUsed,
        bool reportIdZero,
        uint64 previousNav,
        uint64 newNav,
        uint16 maxDeltaBps,
        uint64 depositAmount,
        uint16 idleBufferBps,
        uint64 nowTs,
        uint64 creatorTimestamp,
        uint64 ethTimestamp,
        uint64 maxStaleness,
        int128 creatorPrice,
        int128 ethPrice,
        bool currencySupported,
        uint64 slippageAmount,
        uint16 tightBps,
        uint16 looseBps
    ) public pure {
        check_bridgeReturnRequiresTokenConsumption(adapterReturned, balanceBefore, balanceAfter, bridgeAmount);
        check_solanaNavReportGate(reportIdUsed, reportIdZero, previousNav, newNav, maxDeltaBps);
        check_erc4626IdleBufferSplit(depositAmount, idleBufferBps);
        check_ccaOracleFreshnessGate(
            nowTs, creatorTimestamp, ethTimestamp, maxStaleness, creatorPrice, ethPrice, currencySupported
        );
        model_slippageBpsMonotonicity(slippageAmount, tightBps, looseBps);
    }

    function _bridgeAccepted(bool adapterReturned, uint256 balanceBefore, uint256 balanceAfter, uint256 amount)
        internal
        pure
        returns (bool)
    {
        if (!adapterReturned) return false;
        if (amount > balanceBefore) return false;
        return balanceAfter <= balanceBefore - amount;
    }

    function _navReportAccepted(
        bool reportIdUsed,
        bool reportIdZero,
        uint256 previousNav,
        uint256 newNav,
        uint256 maxDeltaBps
    ) internal pure returns (bool) {
        if (reportIdUsed || reportIdZero) return false;
        return _deltaWithinCap(previousNav, newNav, maxDeltaBps);
    }

    function _deltaWithinCap(uint256 previousNav, uint256 newNav, uint256 maxDeltaBps) internal pure returns (bool) {
        if (previousNav == 0) return true;
        uint256 delta = newNav > previousNav ? newNav - previousNav : previousNav - newNav;
        return delta * MAX_BPS <= previousNav * maxDeltaBps;
    }

    function _oracleInputsAccepted(
        uint256 nowTs,
        uint256 creatorTimestamp,
        uint256 ethTimestamp,
        uint256 maxStaleness,
        int256 creatorPrice,
        int256 ethPrice,
        bool currencySupported
    ) internal pure returns (bool) {
        if (!currencySupported) return false;
        if (creatorPrice <= 0 || ethPrice <= 0) return false;
        if (creatorTimestamp > nowTs || ethTimestamp > nowTs) return false;
        if (nowTs - creatorTimestamp > maxStaleness) return false;
        if (nowTs - ethTimestamp > maxStaleness) return false;
        return true;
    }

    function _minOut(uint256 amount, uint256 slippageBps) internal pure returns (uint256) {
        return (amount * (MAX_BPS - slippageBps)) / MAX_BPS;
    }
}
