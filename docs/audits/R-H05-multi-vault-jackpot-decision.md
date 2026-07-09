# R-H05 — Multi-vault jackpot product decision

**Status:** Control shipped; **launch default is single-vault (Option B)** as of 2026-07-09.  
**Date:** 2026-07-09 (default flipped for safer launch)  
**Code:** `LotteryManager4626.singleVaultJackpotOnly` + `setSingleVaultJackpotOnly(bool)`

## Current behavior (default)

On each win, when `singleVaultJackpotOnly == true` (launch default), only the **triggering** coin’s gauge pays its jackpot slice.

When set to `false`, `_payoutLocalJackpotInner` iterates **all active** registry vaults and pays `payoutBps` (default **6900 = 69%**) of each vault’s `availableJackpotReserve` to the winner (multi-vault / shared pot).

Multi-vault is intentional product design, not a bug — but it has economic risk: cheap entries on a thin vault can skim jackpots from rich vaults (cross-subsidy).

## Options

| Option | Behavior | Pros | Cons |
|--------|----------|------|------|
| **A. Multi-vault** | Every active vault pays 69% of its pot | Shared prize pool UX; “win the ecosystem” story | Cross-subsidy / extraction risk |
| **B. Single-vault only (launch default)** | Only triggering coin’s gauge pays | Isolates economics; no cheap-entry skim | Smaller prizes; less multi-token excitement |
| **C. Weighted / proportional** | Pay multiple vaults but weight by entry origin or TVL | Fairer middle ground | Needs more design + gas |

## Control shipped (2026-07-09)

```solidity
// launch default true = Option B (single-vault)
bool public singleVaultJackpotOnly = true;

function setSingleVaultJackpotOnly(bool onlyTrigger) external onlyOwner;
```

- **true (default):** only `triggeringCoin` pays (Option B) — safer until multi-vault is disclosed.  
- **false:** multi-vault prize (Option A) — requires explicit owner flip + public disclosure.

Ops can flip post-deploy without a new bytecode epoch for the manager **if** the deployed manager includes this flag.

## Launch posture

1. **Pre-lottery traffic:** leave `singleVaultJackpotOnly == true` (bytecode default).  
2. **Post-disclosure:** product may set `false` and document multi-vault skimming in public lottery docs.  
3. Do **not** claim multi-vault shared pot while default single-vault is on.

## Out of scope here

- Changing the immutable gauge BPS split (69% jackpot lane).  
- Per-vault opt-out of the shared pot (would need registry metadata).  
- Weighted Option C.
