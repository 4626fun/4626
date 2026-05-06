// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {LotteryAmoeProperties} from "./LotteryAmoeProperties.t.sol";

contract LotteryAmoePropertiesFoundryTest is LotteryAmoeProperties {
    function testFuzz_lotteryAmoeDeadlineAndReplay(
        uint64 nowTs,
        uint64 deadline,
        bool nonceUsed,
        bool walletUsedInEpoch,
        bool pointsNullifierUsed,
        bool proofOk,
        bool managerConfigured,
        bool managerReturnedEntry,
        uint64 pointsBurnedAsUSD
    ) public pure {
        check_deadlineGate(nowTs, deadline);
        check_zkReplayAndManagerGate(
            nonceUsed, walletUsedInEpoch, pointsNullifierUsed, proofOk, managerConfigured, managerReturnedEntry
        );
        check_pointsBound(pointsBurnedAsUSD);
    }

    function testFuzz_lotteryAmoePublicInputBindings(
        address creatorCoin,
        uint64 epoch,
        bytes32 allowlistRoot,
        bytes32 ledgerRoot,
        uint256 publicCreatorCoin,
        uint256 publicEpoch,
        bytes32 publicAllowlistRoot,
        bytes32 publicLedgerRoot
    ) public pure {
        check_publicInputBindings(
            creatorCoin,
            epoch,
            allowlistRoot,
            ledgerRoot,
            publicCreatorCoin,
            publicEpoch,
            publicAllowlistRoot,
            publicLedgerRoot
        );
    }
}
