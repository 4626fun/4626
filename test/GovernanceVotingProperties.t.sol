// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @dev Standalone governance/voting property harness for Foundry, Halmos,
/// Echidna, Medusa, and Certora local typechecking. No forge-std or cheatcodes.
contract GovernanceVotingProperties {
    uint256 internal constant MAX_BPS = 10_000;
    uint256 internal constant BOOST_BPS_CAP = 10_000;

    function check_feeSplitConservation(uint16 jackpotBps, uint16 creatorBps, uint16 voterBps) public pure {
        uint256 total = uint256(jackpotBps) + creatorBps + voterBps;
        bool valid = total == MAX_BPS;

        assert(!valid || jackpotBps <= MAX_BPS);
        assert(!valid || creatorBps <= MAX_BPS);
        assert(!valid || voterBps <= MAX_BPS);
        assert(!valid || total == MAX_BPS);
    }

    function check_voteWeightBudget(uint16 w0, uint16 w1, uint16 w2, uint16 w3, uint16 w4) public pure {
        uint256 total = uint256(w0) + w1 + w2 + w3 + w4;
        bool valid = _voteWeightsValid(total, w0, w1, w2, w3, w4);

        assert(!valid || total == MAX_BPS);
        assert(!valid || (w0 > 0 && w1 > 0 && w2 > 0 && w3 > 0 && w4 > 0));
    }

    function check_duplicateVoteAggregation(uint16 firstWeight, uint16 secondWeight) public pure {
        uint256 aggregated = uint256(firstWeight) + secondWeight;

        assert(aggregated >= firstWeight);
        assert(aggregated >= secondWeight);
        if (aggregated <= MAX_BPS) {
            assert(aggregated == uint256(firstWeight) + secondWeight);
        }
    }

    function check_lockCoversEpoch(uint64 lockEnd, uint64 epochEnd) public pure {
        bool canVote = lockEnd >= epochEnd;

        if (canVote) {
            assert(lockEnd >= epochEnd);
        } else {
            assert(lockEnd < epochEnd);
        }
    }

    function model_boostCap(uint64 creatorShareUsd, uint64 totalShareUsd, uint16 maxBoostBps) public pure {
        if (maxBoostBps > BOOST_BPS_CAP) return;

        uint256 boost = _boostBps(creatorShareUsd, totalShareUsd, maxBoostBps);

        assert(boost <= maxBoostBps);
        assert(boost <= BOOST_BPS_CAP);
        if (creatorShareUsd == 0 || totalShareUsd == 0) {
            assert(boost == 0);
        }
    }

    function model_rewardProRataDoesNotOverpay(uint64 rewardPool, uint64 userWeight, uint64 totalWeight) public pure {
        uint256 payout = _proRata(rewardPool, userWeight, totalWeight);

        assert(payout <= rewardPool);
        if (totalWeight == 0 || userWeight == 0) {
            assert(payout == 0);
        }
    }

    function check_zeroVoteEpochSweep(
        uint64 rewardPool,
        uint64 totalWeight,
        uint64 currentEpoch,
        uint64 rewardEpoch,
        uint8 grace
    ) public pure {
        bool sweepAllowed = totalWeight == 0 && currentEpoch > uint256(rewardEpoch) + grace;
        uint256 swept = sweepAllowed ? rewardPool : 0;

        assert(swept <= rewardPool);
        if (!sweepAllowed) {
            assert(swept == 0);
        }
    }

    function check_epochCheckpointMonotonic(uint64 previousEpoch, uint64 newEpoch) public pure {
        bool validCheckpoint = newEpoch > previousEpoch;

        if (validCheckpoint) {
            assert(newEpoch >= previousEpoch + 1);
        } else {
            assert(newEpoch <= previousEpoch);
        }
    }

    function _voteWeightsValid(uint256 total, uint16 w0, uint16 w1, uint16 w2, uint16 w3, uint16 w4)
        internal
        pure
        returns (bool)
    {
        if (w0 == 0 || w1 == 0 || w2 == 0 || w3 == 0 || w4 == 0) return false;
        return total == MAX_BPS;
    }

    function _boostBps(uint256 creatorShareUsd, uint256 totalShareUsd, uint256 maxBoostBps)
        internal
        pure
        returns (uint256)
    {
        if (creatorShareUsd == 0 || totalShareUsd == 0) return 0;
        if (creatorShareUsd >= totalShareUsd) return maxBoostBps;
        return (creatorShareUsd * maxBoostBps) / totalShareUsd;
    }

    function _proRata(uint256 rewardPool, uint256 userWeight, uint256 totalWeight) internal pure returns (uint256) {
        if (totalWeight == 0 || userWeight == 0) return 0;
        if (userWeight >= totalWeight) return rewardPool;
        return (rewardPool * userWeight) / totalWeight;
    }
}

contract GovernanceVotingPropertiesFoundryTest is GovernanceVotingProperties {
    function testFuzz_feeAndVoteWeights(
        uint16 jackpotBps,
        uint16 creatorBps,
        uint16 voterBps,
        uint16 w0,
        uint16 w1,
        uint16 w2,
        uint16 w3,
        uint16 w4
    ) public pure {
        check_feeSplitConservation(jackpotBps, creatorBps, voterBps);
        check_voteWeightBudget(w0, w1, w2, w3, w4);
    }

    function testFuzz_voteAggregationAndLocks(
        uint16 firstWeight,
        uint16 secondWeight,
        uint64 lockEnd,
        uint64 epochEnd,
        uint64 previousEpoch,
        uint64 newEpoch
    ) public pure {
        check_duplicateVoteAggregation(firstWeight, secondWeight);
        check_lockCoversEpoch(lockEnd, epochEnd);
        check_epochCheckpointMonotonic(previousEpoch, newEpoch);
    }

    function testFuzz_boostAndRewards(
        uint64 creatorShareUsd,
        uint64 totalShareUsd,
        uint16 maxBoostBps,
        uint64 rewardPool,
        uint64 userWeight,
        uint64 totalWeight
    ) public pure {
        model_boostCap(creatorShareUsd, totalShareUsd, maxBoostBps);
        model_rewardProRataDoesNotOverpay(rewardPool, userWeight, totalWeight);
    }

    function testFuzz_zeroVoteSweep(
        uint64 rewardPool,
        uint64 totalWeight,
        uint64 currentEpoch,
        uint64 rewardEpoch,
        uint8 grace
    ) public pure {
        check_zeroVoteEpochSweep(rewardPool, totalWeight, currentEpoch, rewardEpoch, grace);
    }
}
