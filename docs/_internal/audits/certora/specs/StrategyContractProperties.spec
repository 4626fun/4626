methods {
    function check_bridgeReturnRequiresTokenConsumption(bool,uint64,uint64,uint64) external;
    function check_solanaNavReportGate(bool,bool,uint64,uint64,uint16) external;
    function check_erc4626IdleBufferSplit(uint64,uint16) external;
    function check_ccaOracleFreshnessGate(uint64,uint64,uint64,uint64,int128,int128,bool) external;
    function check_slippageBpsMonotonicity(uint64,uint16,uint16) external;
}

rule bridgeReturnRequiresTokenConsumption(bool adapterReturned, uint64 balanceBefore, uint64 balanceAfter, uint64 amount) {
    env e;
    check_bridgeReturnRequiresTokenConsumption(e, adapterReturned, balanceBefore, balanceAfter, amount);
    assert true;
}

rule solanaNavReportGate(bool reportIdUsed, bool reportIdZero, uint64 previousNav, uint64 newNav, uint16 maxDeltaBps) {
    env e;
    check_solanaNavReportGate(e, reportIdUsed, reportIdZero, previousNav, newNav, maxDeltaBps);
    assert true;
}

rule erc4626IdleBufferSplit(uint64 amount, uint16 idleBufferBps) {
    env e;
    check_erc4626IdleBufferSplit(e, amount, idleBufferBps);
    assert true;
}

rule ccaOracleFreshnessGate(
    uint64 nowTs,
    uint64 creatorTimestamp,
    uint64 ethTimestamp,
    uint64 maxStaleness,
    int128 creatorPrice,
    int128 ethPrice,
    bool currencySupported
) {
    env e;
    check_ccaOracleFreshnessGate(
        e,
        nowTs,
        creatorTimestamp,
        ethTimestamp,
        maxStaleness,
        creatorPrice,
        ethPrice,
        currencySupported
    );
    assert true;
}

rule slippageBpsMonotonicity(uint64 amount, uint16 tightBps, uint16 looseBps) {
    env e;
    check_slippageBpsMonotonicity(e, amount, tightBps, looseBps);
    assert true;
}
