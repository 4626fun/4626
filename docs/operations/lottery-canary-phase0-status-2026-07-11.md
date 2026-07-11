# Lottery canary Phase 0 status — 2026-07-11

Live probe of canonical `LotteryManager4626` after Aristotle D1–D3 CONFIRM and `main` sync through #687/#688/#689.

**Probe command:** `pnpm -C frontend ops:verify-lottery-canary-phase0`

**LM:** `0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1` (addresses.md / `LOTTERY_MANAGER`)

---

## Phase 0 snapshot (read-only)

| Check | Live | Required |
|-------|------|----------|
| `boostManager()` | `0x0` | `0x0` until Phase 3 |
| `vaultGaugeVoting()` | `0x0` | `0x0` until Phase 3 |
| Boost source timelock armed (slot 64) | `false` | stay unarmed until boost addresses frozen |
| `oracleMaxStaleness` | `7200` (2h) | > 0 |
| `oracleMaxDeviationBps` | `2000` (20%) | > 0 |
| `oracleDeviationWindow` | `1800` (30m) | > 0 (windowed; no permanent lockout) |
| `paused` | `false` | product |
| `lotteryConfig.isActive` | `true` | product (base-odds canary allowed) |
| `minSwapAmount` | `1_000_000` (USD 1e6) | — |
| `singleVaultJackpotOnly()` | **reverts** | needs post-#687 LM bytecode |
| `deferredVrfQueueLength()` | **reverts** | needs post-#687 LM bytecode |

**Verdict:** Phase 0 **boost-off is satisfied**. Full remediation bytecode (R-H05 single-vault + deferred VRF queue) is **not** on this address yet — CREATE2 / registry cutover to post-#687 LM is still required before claiming complete Phase 0 harden.

`verifyLotteryProductionReadiness(..., requireBoostTimelockArmed: false)` → **0 criticals** (timelock intentionally unarmed for Phase 0).

---

## Env harden (done this session)

| Surface | Change |
|---------|--------|
| Local `frontend/.env` | Set `DEPLOY_ENFORCE_PHASE2_INVARIANTS=true`, `KEEPER_ENFORCE_COMPLETION_INVARIANTS=true`, `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0` |
| Vercel **Production** | Added the same three keys (were missing). **Redeploy required** for runtime pickup. |
| Vercel | `X402_RELAYER_PRIVATE_KEY` / `LOTTERY_MANAGER` already present |

---

## What is stable now vs next

**Stable enough for base-odds observation (with eyes open):**

- Personal boost and gauge sources are off (`0x0`)
- Oracle staleness + windowed deviation configured
- Aristotle cleared PricingLib / boost-floor / coverage-blend math on the *repo* shipping snapshot

**Not stable / blocked for “full green” Phase 0:**

1. **Deploy post-#687 `LotteryManager4626` + `LotteryManager4626PricingLib`** (CREATE2 link), point registry / `LOTTERY_MANAGER` at it, then re-run this probe until `singleVaultJackpotOnly==true` and `deferredVrfQueueLength` readable.
2. Confirm production redeploy picked up enforce + relay-deny env.
3. Keep Solana B2 `relay_entries` denied until pool verify.
4. Phase 2 soak (one lane, small notionals) before any `boostManager` wiring / `armBoostSourceTimelock()`.

---

## Do not do yet

- Wire `boostManager` / `vaultGaugeVoting`
- Call `armBoostSourceTimelock()`
- Enable `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=1`

Companion: [lottery-canary-checklist-2026-07.md](./lottery-canary-checklist-2026-07.md), [PRE_LOTTERY_OPS_CHECKLIST.md](../audits/PRE_LOTTERY_OPS_CHECKLIST.md).
