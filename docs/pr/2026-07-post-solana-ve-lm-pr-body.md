# PR body (copy for GitHub)

**Branch:** `docs/post-solana-hook-upgrade`  
**Base:** `main` (or current integration base)

---

## Title

```
feat(ve+lottery): dual-decay utilities, Curve quoted boost, LM size under EIP-170
```

---

## Summary

This branch continues post–Solana-hook-upgrade work with:

1. **ve■4626 utilities** — dual-decay totals, `ve4626Utility` (veVote / veChance), sync + effective balances; gauge/boost prefer utility  
2. **Curve-correct personal boost (C5)** — `working = min(l, 0.4l+0.6L·ve/Ve)`; returns **quoted** boost BPS `[10_000, 25_000]` (tokenless-neutral 1.0× → full 2.5× when ve share ≥ LP share)  
3. **LotteryManager4626** — rename CI/tests off `CreatorLotteryManager`; extract pricing lib + jackpot payout to AdminModule; harden coverage/pricing/payout  
4. **Docs** — ve naming, design plan, lottery canary checklist  

**Launch posture:** leave LM `boostManager` / `vaultGaugeVoting` at **0** until canary. Ops: [lottery-canary-checklist-2026-07.md](../operations/lottery-canary-checklist-2026-07.md).

---

## Size budget review (required for LM)

| Contract | Runtime (approx) | EIP-170 headroom |
|----------|-----------------:|-----------------:|
| **LotteryManager4626** | **~23.8 KB** | **~0.8 KB** |
| LotteryManager4626AdminModule | ~19.5 KB | ok |
| LotteryManager4626PricingLib | ~1.3 KB | linked |

Was ~26.8 KB over the 24,576 cap before extraction. New main-surface features need an explicit size note.

---

## Test plan

- [x] `forge test --match-contract 'LotteryManager4626|Ve4626BoostManagerMath|Ve4626RightsSplit'`
- [x] SizeLimit + Hardening suites
- [x] PauseGuards / FeeSponsorship / BoostSource / AmoeLinear (prior runs green)
- [ ] CI green on PR
- [ ] Ops: Phase 0–1 of canary checklist (read-only on-chain checks) before any prod flag flip

---

## Explicit non-goals / do not enable

- Personal boost / gauge voting on live LM  
- `armBoostSourceTimelock` until boost addresses frozen  
- Solana B2 `relay_entries`  
- Multi-vault jackpot without disclosure (`singleVaultJackpotOnly` stays true)

---

## Commits (high level)

- ve dual-decay + utility + Curve boost path  
- docs: Curve algebra correction; C5 quoted boost  
- lottery: coverage harden, LM rename, pricing lib, payout DELEGATECALL, security harden  
- ops: lottery canary checklist  

---

## Reviewer focus

1. AdminModule storage mirror for `jackpotPayoutCursor` (same relative order as main)  
2. C5 return is **quoted** boost, not raw `working/l`  
3. CI size script points at `LotteryManager4626`, not legacy CreatorLotteryManager path  
