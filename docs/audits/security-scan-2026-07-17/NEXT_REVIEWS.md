# Additional security reviews we can run

Status after #718 merge + ODA v2 lottery job **426** complete (2026-07-18).

## Already running / in flight

| Review | Status |
|--------|--------|
| ODA v2 **426** Lottery | **Complete** — [426-TRIAGE.md](./oda-reports/426-TRIAGE.md) |
| ODA v1 **424** CreatorGaugeController | **Complete + patched** — [424-TRIAGE.md](./oda-reports/424-TRIAGE.md) (M-1…M-3 + key lows) |
| ODA v1 **425** ve4626 | Complete but **source unavailable** — wait for v2 **433** |
| ODA v2 **427** CreatorOVault | **Complete + patched** — [427-TRIAGE.md](./oda-reports/427-TRIAGE.md) (F1–F4/F7–F9; F5 valuation gate open) |
| ODA v2 **428** ShareOFT + Wrapper | **Complete + patched** — [428-TRIAGE.md](./oda-reports/428-TRIAGE.md) (F1–F5) |
| ODA v2 **429** DeploymentBatcher | **Complete + patched** — [429-TRIAGE.md](./oda-reports/429-TRIAGE.md) (Critical F1 + F2) |
| ODA v2 **430** Registry | **Complete + patched** — [430-TRIAGE.md](./oda-reports/430-TRIAGE.md) |
| ODA v2 **432** Gauge (v2) | Complete — overlaps 424; F3/`lastWethDistribution` patched with 424-L4 |
| ODA v2 **433** ve4626 | **Complete + patched** — [433-TRIAGE.md](./oda-reports/433-TRIAGE.md) (F1–F4/F6; F5 Ownable2Step open) |
| ODA v2 **431** Strategies | in_progress (overlaps 423; M-01…M-07 patched on follow-up) |
| ODA **422** Registry / **423** Strategies | Complete + triaged earlier (usable) |

## Recommended next (highest leverage)

| # | Review | How | Why |
|---|--------|-----|-----|
| 1 | ~~Implement ODA 426 #1–#2~~ **done** (+ #4/#5/#6 done; #3 timelock cluster open) | LM try/catch + forwarder auth/replay | Correct-scope High/Medium on live lottery path |
| 2 | ~~Implement ODA 423 H-01~~ **done** (`rescueTokens` → vault only) | Strategy adapter patch | Highest-severity correct-scope strategy finding |
| 3 | ~~Implement ODA 424 M-1…M-3~~ **done** (gauge Creator+Agent) | Fail-closed slippage, LM timelock, zero sqrtLimit | Correct-scope Mediums on fee→swap path |
| 4 | ~~Implement ODA 429 Critical + 428 High~~ **done** | CREATE2 integrity; cooldown grief; callback/`_payNative` | Highest new Critical/High |
| 5 | ~~**Registry F1/F3/F4** + ODA **430**~~ **done** | Reverse-map / remote OFT / creator / meta | See 430-TRIAGE |
| 6 | ~~Remaining **427-F1**~~ **done** (+ claim soulbound / valuation gate still open) | Bond + per-epoch cap + reject path | Do not refresh `trippedAt` |
| 6b | ~~**433-F1/F4/F6**~~ **done** (+ 426-F6, 427-F3/F7–F9) | Vote escrow + utility timelock + bribe balance | Remaining: 426-F3, 427-F5, 423-M08–M10, ODA 431 |
| 7 | **Halmos CI** on `test/halmos/CreatorOVaultMath.t.sol` | `halmos --contract CreatorOVaultMath --function check_` with cached `out/` | Symbolic math already modeled; Foundry fuzz green |
| 8 | **Pashov `skills/solidity-auditor`** on lottery delta after 426 patches | In-repo skill | Depth pass without another $1 |
| 9 | **Mythril** on `_processWin` / jackpot payout / AMOE ZK submit | `myth analyze` or SolidSecs wrapper | Symbolic/bytecode on economic paths |
| 10 | **Re-`lake build` Aristotle** topics if Lean available | `docs/audits/aristotle/*` | Only needed when odds/boost formulas change |
| 11 | **CI `security-scanning.yml`** manual dispatch | GitHub Actions | Full Slither + Semgrep + gitleaks allowlist |

## Lower priority / optional

- **Medusa / Echidna** — no first-party config in tree today; Foundry invariants cover much of this surface  
- **SolidSecs** — orchestrates same free tools we already ran (Aderyn/Slither)  
- **Human audit** (Code4rena / Spearbit) — still the bar before large TVL (`docs/_internal/security/index.md`)  
- **Re-commission ODA** — only if litterboxes expire (72h) before 430–433 finish; bundles still live as of this note  

## Do not re-pay

v1 jobs **418–421** (and any CreatorVault-scoped report) — wrong tree. Prefer v2 litterbox jobs and already-usable **422/423/424/426/427/428/429**. Job **425** had no source.
