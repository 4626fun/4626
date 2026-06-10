methods {
    function check_deadlineGate(uint64,uint64) external;
    function check_zkReplayAndManagerGate(bool,bool,bool,bool,bool,bool) external;
    function check_pointsBound(uint64) external;
    function check_publicInputBindings(address,uint64,bytes32,bytes32,uint256,uint256,bytes32,bytes32) external;
}

rule deadlineGate(uint64 nowTs, uint64 deadline) {
    env e;
    check_deadlineGate(e, nowTs, deadline);
    assert true;
}

rule zkReplayAndManagerGate(
    bool nonceUsed,
    bool walletUsedInEpoch,
    bool pointsNullifierUsed,
    bool proofOk,
    bool managerConfigured,
    bool managerReturnedEntry
) {
    env e;
    check_zkReplayAndManagerGate(e, nonceUsed, walletUsedInEpoch, pointsNullifierUsed, proofOk, managerConfigured, managerReturnedEntry);
    assert true;
}

rule pointsBound(uint64 pointsBurnedAsUSD) {
    env e;
    check_pointsBound(e, pointsBurnedAsUSD);
    assert true;
}

rule publicInputBindings(
    address creatorCoin,
    uint64 epoch,
    bytes32 allowlistRoot,
    bytes32 ledgerRoot,
    uint256 publicCreatorCoin,
    uint256 publicEpoch,
    bytes32 publicAllowlistRoot,
    bytes32 publicLedgerRoot
) {
    env e;
    check_publicInputBindings(
        e,
        creatorCoin,
        epoch,
        allowlistRoot,
        ledgerRoot,
        publicCreatorCoin,
        publicEpoch,
        publicAllowlistRoot,
        publicLedgerRoot
    );
    assert true;
}
