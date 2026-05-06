// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @dev Standalone AMOE property harness for Foundry, Halmos, Echidna, Medusa,
/// and Certora local typechecking. No forge-std or cheatcodes.
contract LotteryAmoeProperties {
    uint256 internal constant MIN_DEADLINE_BUFFER = 60;
    uint256 internal constant MAX_POINTS_AS_USD = 10_000 * 1_000_000;

    function check_deadlineGate(uint64 nowTs, uint64 deadline) public pure {
        bool accepted = _deadlineAccepted(nowTs, deadline);

        assert(!accepted || deadline >= nowTs);
        assert(!accepted || uint256(deadline) - nowTs >= MIN_DEADLINE_BUFFER);
        assert(deadline >= nowTs || !accepted);
        assert(deadline < nowTs || uint256(deadline) - nowTs >= MIN_DEADLINE_BUFFER || !accepted);
    }

    function check_zkReplayAndManagerGate(
        bool nonceUsed,
        bool walletUsedInEpoch,
        bool pointsNullifierUsed,
        bool proofOk,
        bool managerConfigured,
        bool managerReturnedEntry
    ) public pure {
        bool accepted = _zkAccepted(
            nonceUsed, walletUsedInEpoch, pointsNullifierUsed, proofOk, managerConfigured, managerReturnedEntry
        );

        assert(!accepted || !nonceUsed);
        assert(!accepted || !walletUsedInEpoch);
        assert(!accepted || !pointsNullifierUsed);
        assert(!accepted || proofOk);
        assert(!accepted || !managerConfigured || managerReturnedEntry);
        assert(!(nonceUsed || walletUsedInEpoch || pointsNullifierUsed || !proofOk) || !accepted);
    }

    function check_pointsBound(uint64 pointsBurnedAsUSD) public pure {
        bool accepted = _pointsAccepted(pointsBurnedAsUSD);

        assert(!accepted || pointsBurnedAsUSD > 0);
        assert(!accepted || pointsBurnedAsUSD <= MAX_POINTS_AS_USD);
        assert(pointsBurnedAsUSD != 0 || !accepted);
        assert(pointsBurnedAsUSD <= MAX_POINTS_AS_USD || !accepted);
    }

    function check_publicInputBindings(
        address creatorCoin,
        uint64 epoch,
        bytes32 allowlistRoot,
        bytes32 ledgerRoot,
        uint256 publicCreatorCoin,
        uint256 publicEpoch,
        bytes32 publicAllowlistRoot,
        bytes32 publicLedgerRoot
    ) public pure {
        bool accepted = _bindingsAccepted(
            creatorCoin,
            epoch,
            allowlistRoot,
            ledgerRoot,
            publicCreatorCoin,
            publicEpoch,
            publicAllowlistRoot,
            publicLedgerRoot
        );

        assert(!accepted || publicCreatorCoin == uint256(uint160(creatorCoin)));
        assert(!accepted || publicEpoch == uint256(epoch));
        assert(!accepted || publicAllowlistRoot == allowlistRoot);
        assert(!accepted || publicLedgerRoot == ledgerRoot);
        assert(!accepted || allowlistRoot != bytes32(0));
        assert(!accepted || ledgerRoot != bytes32(0));
    }

    function _deadlineAccepted(uint256 nowTs, uint256 deadline) internal pure returns (bool) {
        if (nowTs > deadline) return false;
        return deadline - nowTs >= MIN_DEADLINE_BUFFER;
    }

    function _zkAccepted(
        bool nonceUsed,
        bool walletUsedInEpoch,
        bool pointsNullifierUsed,
        bool proofOk,
        bool managerConfigured,
        bool managerReturnedEntry
    ) internal pure returns (bool) {
        if (nonceUsed || walletUsedInEpoch || pointsNullifierUsed || !proofOk) return false;
        return !managerConfigured || managerReturnedEntry;
    }

    function _pointsAccepted(uint256 pointsBurnedAsUSD) internal pure returns (bool) {
        return pointsBurnedAsUSD > 0 && pointsBurnedAsUSD <= MAX_POINTS_AS_USD;
    }

    function _bindingsAccepted(
        address creatorCoin,
        uint64 epoch,
        bytes32 allowlistRoot,
        bytes32 ledgerRoot,
        uint256 publicCreatorCoin,
        uint256 publicEpoch,
        bytes32 publicAllowlistRoot,
        bytes32 publicLedgerRoot
    ) internal pure returns (bool) {
        if (allowlistRoot == bytes32(0) || ledgerRoot == bytes32(0)) return false;
        if (publicCreatorCoin != uint256(uint160(creatorCoin))) return false;
        if (publicEpoch != uint256(epoch)) return false;
        if (publicAllowlistRoot != allowlistRoot) return false;
        if (publicLedgerRoot != ledgerRoot) return false;
        return true;
    }
}

