# ODA job 428 — CreatorShareOFT + Wrapper triage (correct scope)

**Status:** complete · **Track:** https://onedollaraudit.com/audit/428  
**Source:** litterbox `8guk8b.md` — **usable**.

| ID | Sev | One-liner | Disposition |
|----|-----|-----------|-------------|
| **1** | Medium | Winner-callback admission vs handler peer mismatch | **Fixed** — `_handleWinnerCallback` accepts lottery peer **or** OFT hub peer |
| **2** | Medium | `_payNative` traps overpayment | **Fixed** (Creator + Agent) — return `msg.value` so LZ refunds excess |
| **3** | High | Dust transfer griefs withdrawal cooldown | **Fixed** (Creator + Agent wrappers) — propagate only onto fresh recipients (`balanceOf(to) <= amount`) |
| **4** | Medium | Owner can re-point vault/wrapper to defeat mint-backing | **Fixed** — one-shot `setVault`/`setWrapper` (Creator + Agent) |
| **5** | Medium | Hardcoded `REMOTE_PROTOCOL_WIRE_AUTHORITY` | **Fixed** — mutable `remoteProtocolWireAuthority` + `setRemoteProtocolWireAuthority` (0 revokes) |
| **6–14** | Low | FoT delta, flushFees, Ownable2Step, etc. | Backlog |
