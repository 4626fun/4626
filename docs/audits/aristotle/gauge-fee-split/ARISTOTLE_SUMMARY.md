# Gauge fee-split conservation (TARGET 4)

Date: 2026-07-11

Aristotle project: `28ab1f5d-2e57-4131-86d2-128ba0f458ab`
Task: `43082c39-4908-4ef5-9210-c0a2b6092842`

| Task | Role | Status |
|------|------|--------|
| `43082c39-4908-4ef5-9210-c0a2b6092842` | Fee-split conservation | COMPLETE |

## Plain claim

Every trade fee is split 69% jackpot / 9.61% burn / 21.39% voters. Those three BPS add to 100%. Integer flooring does not create an unpaid dust wallet: residual goes to burn (ShareOFT path) or voters (vault-share path).

## Formula

```text
6900 + 961 + 2139 = 10000
-- ShareOFT: L,P floored; B = F − L − P
-- Vault:    B,L floored; P = F − B − L
```

## What Lean proved

Build succeeds with no `sorry`/`admit`. Namespace `CreatorGaugeController`:

- `lanes_sum_maxBps`
- `shareOft_conservation` / `shareOft_example` → `(47610, 6631, 14759)` for F=69000
- `vault_conservation` / `vault_example` → `(47610, 6630, 14760)` for F=69000
- `shareOft_B_bounded` / `vault_P_bounded` (residual ≤ 3 above naive floor)
- `shareOft_no_dust` / `vault_no_dust`

Burn = 9.61%, protocol/voters = 21.39% (not swapped). Artifact: `result.tar.gz`.

## Local validation

- `lake exe cache get` + `lake build` (Lean 4.28.0, `LEAN_NUM_THREADS=2`): **exit 0**
- No `sorry` / `admit` in sources
- Built `RequestProject.CreatorGaugeController` successfully
