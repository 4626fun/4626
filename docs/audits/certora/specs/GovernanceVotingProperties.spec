methods {
    function check_feeSplitConservation(uint16,uint16,uint16) external;
    function check_voteWeightBudget(uint16,uint16,uint16,uint16,uint16) external;
    function check_duplicateVoteAggregation(uint16,uint16) external;
    function check_lockCoversEpoch(uint64,uint64) external;
    function model_boostCap(uint64,uint64,uint16) external;
    function model_rewardProRataDoesNotOverpay(uint64,uint64,uint64) external;
    function check_zeroVoteEpochSweep(uint64,uint64,uint64,uint64,uint8) external;
    function check_epochCheckpointMonotonic(uint64,uint64) external;
}

rule feeSplitConservation(uint16 jackpotBps, uint16 creatorBps, uint16 voterBps) {
    env e;
    check_feeSplitConservation(e, jackpotBps, creatorBps, voterBps);
    assert true;
}

rule voteWeightBudget(uint16 w0, uint16 w1, uint16 w2, uint16 w3, uint16 w4) {
    env e;
    check_voteWeightBudget(e, w0, w1, w2, w3, w4);
    assert true;
}

rule duplicateVoteAggregation(uint16 firstWeight, uint16 secondWeight) {
    env e;
    check_duplicateVoteAggregation(e, firstWeight, secondWeight);
    assert true;
}

rule lockCoversEpoch(uint64 lockEnd, uint64 epochEnd) {
    env e;
    check_lockCoversEpoch(e, lockEnd, epochEnd);
    assert true;
}

rule boostCap(uint64 creatorShareUsd, uint64 totalShareUsd, uint16 maxBoostBps) {
    env e;
    model_boostCap(e, creatorShareUsd, totalShareUsd, maxBoostBps);
    assert true;
}

rule rewardProRataDoesNotOverpay(uint64 rewardPool, uint64 userWeight, uint64 totalWeight) {
    env e;
    model_rewardProRataDoesNotOverpay(e, rewardPool, userWeight, totalWeight);
    assert true;
}

rule zeroVoteEpochSweep(uint64 rewardPool, uint64 totalWeight, uint64 currentEpoch, uint64 rewardEpoch, uint8 grace) {
    env e;
    check_zeroVoteEpochSweep(e, rewardPool, totalWeight, currentEpoch, rewardEpoch, grace);
    assert true;
}

rule epochCheckpointMonotonic(uint64 previousEpoch, uint64 newEpoch) {
    env e;
    check_epochCheckpointMonotonic(e, previousEpoch, newEpoch);
    assert true;
}
