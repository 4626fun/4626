# Post Solana hook upgrade checklist (2026-07-09)

> **Historical post-upgrade record.** The Twin mapping and KPR entry/winner
> relay instructions below are retired and must not be configured.

## Upgrade confirmed live

| Field | Value |
|-------|--------|
| Program | `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU` |
| Last Deployed Slot | **`431796316`** (was `430461604`) |
| Deploy signature | `39udr1opeY1q26GLS3uP2GznqacYvHEMvGKhynge3JgKkZ4oKG9ahsRyKSxNgf6yhxuxZA5tZ1SNBnWNHgmnyT7w` |
| Binary SHA-256 | `43e99ee693962d92bfc42fe897d79bb496066d8c2270adcec0eeea0566754c22` |
| Features | M2-12 `win_id`, M2-13 settle threshold/auth, C-01 gates |

Detail: [solana-hook-upgrade-2026-07-09.md](./solana-hook-upgrade-2026-07-09.md)

---

## 1. Redeploy KPR / Solana orchestrator (required)

Repo `main` already has winner-relay with `win_id`. **Production must run this code** or winner recording fails against the new program.

### What to ship

- Host: Vultr Solana orchestrator (`solana-keeper-orchestrator`) and/or any machine running `keepr-solana-winner-relay`
- Code: `kpr/` from `main` @ `f6c9fa93f` or later
- Env must include (unchanged keys, new behavior):

```bash
# MUST stay off
SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0

# Canonical ix names (not legacy drain/flush)
SOLANA_HOOK_IX_SCHEMA=canonical

# M2-09 single plane: leave local cron off if Vercel→sidecar is primary
# SOLANA_ORCHESTRATOR_LOCAL_CRON_ENABLED=0

SOLANA_PROGRAM_ID=EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU
SOLANA_KEEPER_KEYPAIR=...
SOLANA_CREATOR_COIN_TO_MINT_MAPPING=...
SOLANA_TWIN_TO_PUBKEY_MAPPING=...
```

### Redeploy (Vultr systemd example)

```bash
# On orchestrator host (paths per team runbook — not committed)
cd /opt/4626   # or your checkout
git fetch origin && git checkout main && git pull
cd kpr && pnpm install --frozen-lockfile
# restart service
sudo systemctl restart solana-keeper-orchestrator
sudo systemctl status solana-keeper-orchestrator --no-pager
```

Confirm process env after restart:

```bash
# Expect empty/false for relay
systemctl show solana-keeper-orchestrator -p Environment | tr ' ' '\n' | rg RELAY_ENTRIES || true
```

---

## 2. Smoke tests

### A. Program still upgradeable / slot sticky

```bash
solana program show EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU \
  --url https://api.mainnet-beta.solana.com
# Last Deployed In Slot must remain 431796316 (or later intentional upgrade)
```

### B. Winner relay (production mappings)

1. Ensure a Base win exists with mapped `creatorCoin` + twin pubkey.
2. Run one `winner_relay` cycle (orchestrator reconcile or `pnpm -C kpr` workflow with secrets).
3. Expect Solana `record_winner` success and new `WinIdRecord` PDA.
4. Re-run same event → duplicate / already-recorded path (no double UX corruption).

### C. settle_fees

- Keeper keypair **must** be mint `withdraw_withheld_authority`.
- Batched harvest OK below threshold; withdraw when mint withheld ≥ config threshold.

---

## 3. Still off / still pending (not this upgrade)

| Item | Status |
|------|--------|
| B2 `relay_entries` | **Keep disabled** |
| Base LotteryManager R-H05 / M2-07 bytecode | Not deployed on Base yet (live LM may lack new selectors) |
| `armBoostSourceTimelock` | Owner Base tx |
| Hub ShareOFT forwarders | Owner Base tx |
| PayoutRouter → Safe | Owner Base tx |

---

## 4. Sign-off

- [x] Solana program upgraded (slot `431796316`)
- [ ] KPR/orchestrator redeployed from main with win_id path
- [ ] `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0` confirmed in prod
- [ ] Winner smoke (optional canary)
- [ ] Base lottery readiness ops (separate track)
