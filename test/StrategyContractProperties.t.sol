// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @dev Standalone property harness for Echidna/Medusa. Keep this free of
/// forge-std and cheatcodes so non-Foundry fuzzers can compile and call it.
contract StrategyContractProperties {
    uint256 internal constant MAX_BPS = 10_000;

    function check_bridgeReturnRequiresTokenConsumption(
        bool adapterReturned,
        uint64 balanceBefore,
        uint64 balanceAfter,
        uint64 amount
    ) public pure {
        bool accepted = _bridgeAccepted(adapterReturned, balanceBefore, balanceAfter, amount);

        assert(!accepted || adapterReturned);
        assert(!accepted || balanceBefore >= amount);
        assert(!accepted || balanceAfter <= balanceBefore - amount);
        assert(adapterReturned || !accepted);
        assert(amount <= balanceBefore || !accepted);
        assert(balanceAfter <= balanceBefore || !accepted);
    }

    function check_solanaNavReportGate(
        bool reportIdUsed,
        bool reportIdZero,
        uint64 previousNav,
        uint64 newNav,
        uint16 maxDeltaBps
    ) public pure {
        if (maxDeltaBps > MAX_BPS) return;

        bool accepted = _navReportAccepted(reportIdUsed, reportIdZero, previousNav, newNav, maxDeltaBps);

        assert(!accepted || !reportIdUsed);
        assert(!accepted || !reportIdZero);
        assert(!accepted || _deltaWithinCap(previousNav, newNav, maxDeltaBps));
        assert(!(reportIdUsed || reportIdZero) || !accepted);
    }

    function check_erc4626IdleBufferSplit(uint64 amount, uint16 idleBufferBps) public pure {
        if (idleBufferBps > MAX_BPS) return;

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

        assert(!accepted || currencySupported);
        assert(!accepted || creatorPrice > 0);
        assert(!accepted || ethPrice > 0);
        assert(!accepted || nowTs >= creatorTimestamp);
        assert(!accepted || nowTs >= ethTimestamp);
        assert(!accepted || nowTs - creatorTimestamp <= maxStaleness);
        assert(!accepted || nowTs - ethTimestamp <= maxStaleness);
    }

    function check_slippageBpsMonotonicity(uint64 amount, uint16 tightBps, uint16 looseBps) public pure {
        if (tightBps > MAX_BPS || looseBps > MAX_BPS || tightBps > looseBps) return;

        uint256 tightMin = _minOut(amount, tightBps);
        uint256 looseMin = _minOut(amount, looseBps);

        assert(tightMin >= looseMin);
        assert(tightMin <= amount);
        assert(looseMin <= amount);
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
