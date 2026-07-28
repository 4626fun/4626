# Contract size CI gate (EIP-170)

## Policy

Deployable runtime bytecode must stay ≤ **24,576 bytes** (EIP-170) unless the contract is
on the **bounded allowlist** in `scripts/check-eip170-size-gate.mjs`.

| Class | CI behaviour |
|-------|----------------|
| Under 24,576 B | Pass |
| Over 24,576 B, **not** allowlisted | **Fail** (new overflow) |
| Over 24,576 B, allowlisted, ≤ `maxRuntimeBytes` | **Pass with WARN** (known debt) |
| Allowlisted but **grew** past `maxRuntimeBytes` | **Fail** (must split or intentionally raise cap) |

Compile failures always fail the gate.

Multi-solc builds (`auto_detect_solc` + exact-pinned import graphs) emit
`<Contract>.<solcVersion>` artifact variants; these share the base contract's allowlist entry.

## Known oversize (allowlisted)

Measured under `FOUNDRY_PROFILE=ci` (2026-07). These need a dedicated split PR; they are
**not** introduced by the ve/surface/bribes work.

| Contract | Approx runtime | Notes |
|----------|----------------|-------|
| `AgentOracle` | ~28.4 KB | Agent lane oracle |
| `AgentShareOFT` | ~28.1 KB | Agent OFT |
| `CreatorShareOFT` | ~27.6 KB | Creator OFT |
| `CharmStrategy4626Factory` | ~25.3 KB | Strategy factory |
| `CreatorOracle` | ~24.6 KB | Creator oracle |

`LotteryManager4626` is under the hard cap after module split; keep
`amoe/tools/ci/check_manager_size_warn.sh` as the early-warning lane.

## Local / CI commands

```bash
# Preferred (same as CI)
FOUNDRY_PROFILE=ci node scripts/check-eip170-size-gate.mjs

# Raw forge table (exits non-zero if *any* contract > 24,576, including allowlisted)
forge build --skip test --sizes
```

## Raising an allowlist cap

1. Prefer **splitting** the contract instead.
2. If you must raise `maxRuntimeBytes`, include a **size budget review** note in the PR
   (why growth, remaining headroom to the new cap, follow-up split ticket).
3. Never add a new allowlist entry for a contract that was previously under the hard cap
   without an explicit product decision.

## Wiring

- `.github/workflows/test.yml` — forge job step *EIP-170 size gate*
- `.github/workflows/security-scanning.yml` — Slither prep build (same script)
