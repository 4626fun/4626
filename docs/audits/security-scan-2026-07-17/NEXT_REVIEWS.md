# Additional security reviews we can run

Status after #718 merge + ODA v2 lottery job **426** complete (2026-07-18).

## Already running / in flight

| Review | Status |
|--------|--------|
| ODA v2 **426** Lottery | **Complete** — [426-TRIAGE.md](./oda-reports/426-TRIAGE.md) |
| ODA v1 **424** CreatorGaugeController | **Complete + patched** — [424-TRIAGE.md](./oda-reports/424-TRIAGE.md) (M-1…M-3 + key lows) |
| ODA v1 **425** ve4626 | Complete but **source unavailable** — wait for v2 **433** |
| ODA v2 **427** CreatorOVault | in_progress |
| ODA v2 **428** ShareOFT | in_progress |
| ODA v2 **429–433** Batcher / Registry / Strategies / Gauge / ve4626 | pending / in_progress (litterboxes still HTTP 200) |
| ODA **422** Registry / **423** Strategies | Complete + triaged earlier (usable) |

## Recommended next (highest leverage)

| # | Review | How | Why |
|---|--------|-----|-----|
| 1 | ~~Implement ODA 426 #1–#2~~ **done** (+ optional #4/#5 still open) | LM try/catch + forwarder auth/replay | Correct-scope High/Medium on live lottery path |
| 2 | ~~Implement ODA 423 H-01~~ **done** (`rescueTokens` → vault only) | Strategy adapter patch | Highest-severity correct-scope strategy finding |
| 3 | ~~Implement ODA 424 M-1…M-3~~ **done** (gauge Creator+Agent) | Fail-closed slippage, LM timelock, zero sqrtLimit | Correct-scope Mediums on fee→swap path |
| 4 | **Registry F1/F3/F4** from ODA 422 | One-shot / reverse-map guards | Complements SCAN-M3 |
| 5 | **Halmos CI** on `test/halmos/CreatorOVaultMath.t.sol` | `halmos --contract CreatorOVaultMath --function check_` with cached `out/` | Symbolic math already modeled; Foundry fuzz green |
| 6 | **Pashov `skills/solidity-auditor`** on lottery delta after 426 patches | In-repo skill | Depth pass without another $1 |
| 7 | **Mythril** on `_processWin` / jackpot payout / AMOE ZK submit | `myth analyze` or SolidSecs wrapper | Symbolic/bytecode on economic paths |
| 8 | **Re-`lake build` Aristotle** topics if Lean available | `docs/audits/aristotle/*` | Only needed when odds/boost formulas change |
| 9 | **CI `security-scanning.yml`** manual dispatch | GitHub Actions | Full Slither + Semgrep + gitleaks allowlist |

## Lower priority / optional

- **Medusa / Echidna** — no first-party config in tree today; Foundry invariants cover much of this surface  
- **SolidSecs** — orchestrates same free tools we already ran (Aderyn/Slither)  
- **Human audit** (Code4rena / Spearbit) — still the bar before large TVL (`docs/_internal/security/index.md`)  
- **Re-commission ODA** — only if litterboxes expire (72h) before 429–433 finish; bundles still live as of this note  

## Do not re-pay

v1 jobs **418–421** (and any CreatorVault-scoped report) — wrong tree. Prefer v2 litterbox jobs and already-usable **422/423/424/426**. Job **425** had no source.
