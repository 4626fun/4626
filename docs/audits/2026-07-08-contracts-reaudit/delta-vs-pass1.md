# Delta vs pass 1 (2026-07-08 full audit)

## Fixed and re-verified green

| Pass-1 ID | Status after re-audit |
|-----------|----------------------|
| **C-01** ShareOFT salt / adopt rewire | **Fixed** — salt includes `creatorToken`; `Phase1ShareOFTAlreadyBound` |
| **H-01** Recovery transferFrom without allowance | **Fixed** for vault `notifyImpairmentRecovery` path |
| **H-02** Hub same-block flash coverage | **Fixed on hub** paid path |
| **H-03** AMOE lane-coin coverage | **Fixed** — ShareOFT via registry + eligible |

**Regression suites:** `Audit20260708.P0` 9/9 · Impairment 18/18 · Escrow 5/5 · AMOE parity 29/29.

## Newly discovered (this re-audit)

| ID | Severity | Theme |
|----|----------|--------|
| **R-H01** | High | Strategy eject → escrow notify without vault `totalRecovered` |
| **R-H02** | High | Escrow free balance uses global `totalUnclaimedRecovery` vs per-asset held |
| **R-H03** | High | Remote ShareOFT queues post-buy live balance (H-02 incomplete) |
| **NEW-H** | High (privilege) | DeploymentBatcher accepts arbitrary store `codeId`s (no on-chain allowlist) |
| **M-NEW-01** | Medium | Payout router Uniswap path allows `minOut == 0` |
| **M-NEW-02** | Medium | Eject recovery asset may disagree with epoch `recoveryAsset` |

## Updated status of prior open items

| Pass-1 ID | Status |
|-----------|--------|
| **H-04** CCA migrate grief | **Still open** |
| **H-05** Charm withdraw | **Partially fixed** — main path uses ASSET NAV + minOut; emergency still 0/0 |
| **H-06** Unbacked ShareOFT mint | **Still open** (privilege) |
| **H-07** Charm owner emergency drain | **Still open** (privilege) |
| **H-08** Optional phase module codehash | **Still open** (privilege) |
| **M-01…M-15** | **Still open** (see main report) |

## Regression risk from P0 design

Push-then-notify and free-custody accounting fixed the original `ERC20InsufficientAllowance` failure mode, but:

1. Paths that previously **hard-failed** on notify (strategy eject) now **soft-succeed** without updating claim books (**R-H01**).
2. Free custody math is not multi-asset safe (**R-H02**).
3. Hub coverage fix was not mirrored to remote queue (**R-H03**).
