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

## Residual (F3 anti-grief tradeoff)

**Accepted** while F3 stands: prior-block ShareOFT pre-seed (`balanceOf(to) > 0` before a hot transfer) makes the recipient “established,” so `propagateCooldownOnTransfer` skips and the recipient does **not** inherit the sender’s wrapper cooldown.

- Re-opens same-block launder at the **wrapper** layer (`lastWrapperDepositBlock`).
- Not vault-backstopped on `wrap` → `unwrap` (no `vault.redeem`; vault `lastDepositBlock[wrapper]` is irrelevant).
- `deposit` → `withdraw` may still hit shared vault delay as a side effect only — not designed reliance (see M-01).
- Covered by `test/M08.CooldownPropagation.t.sol` → `test_ODA428_F3_preseedSkipsHotCooldownPropagation_andAllowsSameBlockUnwrap`.

**Preferred future close (if product accepts the cost):** mirror `CreatorOVault._update` — while the sender is in wrapper cooldown, revert outbound ShareOFT transfers (`TransferTooSoon`-style) instead of propagating. Preserves F3 anti-grief; blocks same-block post-deposit/wrap transfers (DEX/composability).
