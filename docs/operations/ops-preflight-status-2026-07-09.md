# Ops preflight status — 2026-07-09

Read-only preflight after code remediations landed on `main` (`f6c9fa93f` includes #680+#681).

**Environment:** this agent host has **no** production secrets (no `.env`, no `SOLANA_PRIVATE_KEY` / `PRIVATE_KEY` / `KPR_PRIVATE_KEY`). Mainnet **mutations cannot be executed here**. Below is the readiness matrix for a human/ops runner with keys.

---

## Done in this session (agent)

| Step | Result |
|------|--------|
| Sync `main` | Fast-forwarded to `f6c9fa93f` |
| Solana SBF build | **OK** — `programs/creator-share-hook/target/deploy/creator_share_hook.so` **329 632 bytes** |
| On-chain program size | Data length **372 488** — headroom **+42 856** (no `program extend` needed) |
| Upgrade authority | `7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY` |
| Authority balance | **0.0125 SOL** — **insufficient** for upgrade buffer (~2.4 SOL) |
| Public Base RPC lottery probe | Manager `0xbE87AD…` responds; see gaps below |

---

## Solana program upgrade (M2-12 / M2-13) — blocked on funding + key

```text
Program:   EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU
ProgramData: DojrYy5obEk2w9ZMpX1bLFHU4rrZqYQsZJZaXFxFGKFU
Authority: 7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY
.so size:  329632  (fits in 372488)
```

**Ops must:**

1. Fund upgrade authority with **≥ 2.5 SOL** (buffer + fees; buffer refunded after deploy).
2. Provide `SOLANA_PRIVATE_KEY` (base58) on a secure runner; convert to CLI keypair JSON (AGENTS.md).
3. Deploy:
   ```bash
   solana program deploy \
     programs/creator-share-hook/target/deploy/creator_share_hook.so \
     --program-id EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU \
     --url https://api.mainnet-beta.solana.com \
     --keypair <deployer.json>
   ```
4. Redeploy KPR / Solana orchestrator with winner-relay that uses `win_id`.
5. Keep `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0`.

Full runbook: [solana-creator-share-hook-upgrade-m2-12-13.md](./solana-creator-share-hook-upgrade-m2-12-13.md).

---

## Base lottery manager (public RPC)

| Check | Result | Notes |
|-------|--------|--------|
| Address | `0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1` | Repo `BASE_DEFAULTS.lotteryManager` |
| Code size | ~24 568 B | Deployed |
| `paused()` | `false` | Live |
| `owner()` | `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD` | Operator EOA (not Safe) |
| `lotteryConfig()` | active; reward 6900 bps | Partial read OK |
| `singleVaultJackpotOnly()` | **reverts** | Likely **pre-remediation** bytecode (R-H05 flag not on chain) |
| `deferredVrfQueueLength()` | **reverts** | M2-07 views not on live bytecode |

**Implication:** LotteryManager remediation (R-H05 default, M2-07 FIFO batch, etc.) is in **repo only** until a Base deploy/upgrade of LotteryManager (+ admin module) is performed. `armBoostSourceTimelock` and hub forwarder auth still require owner txs from `0xB05Cf0…` (or after transfer to Safe).

---

## Checklist status

### 1. Lottery production readiness

| Step | Status |
|------|--------|
| 1.1 armBoostSourceTimelock | **Pending ops** (needs owner key) |
| 1.2 hub ShareOFT forwarders | **Pending ops** |
| 1.3 R-H05 single-vault on chain | **Not live** until LM redeploy; code default is true in repo |
| 1.4 deferred VRF drain | **N/A / pending** until M2-07 bytecode live |

### 2. PayoutRouter / treasury

| Step | Status |
|------|--------|
| 2.1 owners → Safe/timelock | **Pending ops** |
| 2.2 keeper spend caps | **Pending ops** before external swaps |
| 2.3 allowlist hygiene | **Policy** |

### 3. Solana upgrade

| Step | Status |
|------|--------|
| 3.1 build | **Done** (this host) |
| 3.1 upgrade | **Blocked** — no key; authority underfunded |
| 3.2 KPR redeploy | **Pending** after program upgrade |
| 3.3 relay_entries default-deny | **Confirm in prod env** (unset here) |
| 3.4 single trigger plane | **Confirm in prod env** |

### 4–5. Vault burn stream / env fail-closed

| Step | Status |
|------|--------|
| setBurnStream / queuer | Per-vault ops |
| Production env flags | **No env files on this host** — verify Vercel/Railway/Vultr manually |

---

## Recommended ops order (human with secrets)

1. **Fund** Solana upgrade authority → **deploy** new `.so` → redeploy KPR.  
2. **Deploy/upgrade Base LotteryManager** stack with remediation bytecode (or accept live is still pre-R-H05/M2-07).  
3. From LM owner: `armBoostSourceTimelock`, hub forwarders, optionally transfer ownership to Safe.  
4. PayoutRouter owner transfers + spend caps.  
5. Confirm envs; leave B2 relay off.  
6. Sign off [PRE_LOTTERY_OPS_CHECKLIST.md](../audits/PRE_LOTTERY_OPS_CHECKLIST.md).

---

## Agent cannot do without secrets

- Any Base `cast send` / Safe tx  
- Solana `program deploy`  
- Vercel/Railway env verification  
- KPR production redeploy  

Provide `SOLANA_PRIVATE_KEY` (and fund authority) + Base `PRIVATE_KEY`/Safe access on a secure runner to continue automated execution.
