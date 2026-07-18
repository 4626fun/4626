# ODA job 429 — DeploymentBatcher triage (correct scope)

**Status:** complete · **Track:** https://onedollaraudit.com/audit/429  
**Source:** litterbox `lrsfsn.md` — **usable**.

| ID | Sev | One-liner | Disposition |
|----|-----|-----------|-------------|
| **1** | Critical | `_deployOrExisting` adopts occupied CREATE2 addr without integrity; `setPendingInitCodeHashes` writable by external factory allowlist | **Fixed** — always verify published/resolved hash vs store `codeId`; hash writer = `protocolTreasury` only |
| **2** | Medium | Repeated `deployPhase3Strategies` can exceed 100% weight | **Fixed** — `phase3AllocatedWeightBps[vault]` cumulative cap |
| **3** | Medium | Vault/wrapper CREATE2 no adopt-existing (front-run DoS) | **Fixed** — `_deployOrAdopt` with init-code hash verify |
