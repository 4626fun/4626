# Commission prompt — One Dollar Audit jobs (live Base + public pin)

Copy/paste the section below to the next agent.

---

## Commission One Dollar Audit (LeftClaw) jobs — live Base + public pin

### Goal
Commission **targeted ODA jobs** (one tight system per job, ~$1 USDC each on Base via x402) against the **public** contracts pin, with **live Base addresses** attached so reviewers can cross-check BaseScan-verified bytecode. Persist job IDs; **do not re-pay to poll**.

### Live deploy version (what is on Base today)
Canonical doc: `docs/reference/addresses.md`.

| Layer | Version / label | Notes |
|-------|-----------------|-------|
| Infra addresses (Registry, Batcher shell, Factory, Store, LM, VRF, …) | **v1.19.1 greenfield** deploy addresses | Still the live shared stack |
| Shared/global + per-creator bytecode / CREATE2 namespace | **v1.19.3** bytecode epoch | Manifest: `deployments/base/v1.19.3-bytecode-manifest.json` |
| Creator core module binding | **v1.19.4 Creator-core repair** | Live `DeploymentBatcherPhase1Module` `0x8C1C6C10…` binds Creator core `0x0513cf24…`; Agent core stays `0xe3f7115a…` under v1.19.3 deps |
| Env target for launches | `VITE_DEPLOYMENT_VERSION=v1.19.3` | |
| Public audit pin source | `audit/oda-2026-07-28-agent-lane` @ `0c47be2` | **Not** what Base was sealed from — pin includes later remediations |

**Important:** Current private/`main` and the public pin are **ahead** of the live v1.19.3 seal for several creator/share/strategy contracts (`tmp/check-head-vs-live.py` shows CreatorOVault / Wrapper / ShareOFT / Gauge / ERC4626StrategyAdapter / AjnaERC4626Vault as `HEAD newer than live seal`). Commission against the pin for source review; only claim “matches live verified bytecode” after a per-contract codeId match.

### Source of truth (code for new jobs)
| Field | Value |
|-------|-------|
| Repo | `https://github.com/4626fun/4626` |
| Tag | `audit/oda-2026-07-28-agent-lane` |
| Commit | `0c47be2` (`0c47be24efb9f48b03f54c289e2734f4cfd50cd8`) |
| Tree | https://github.com/4626fun/4626/tree/audit/oda-2026-07-28-agent-lane/contracts |
| Remediations | https://github.com/4626fun/4626/blob/audit/oda-2026-07-28-agent-lane/contracts/REMEDIATIONS.md |
| Scope map | https://github.com/4626fun/4626/blob/audit/oda-2026-07-28-agent-lane/contracts/AUDIT.md |
| Operator brief | `docs/audits/security-scan-2026-07-28-agent-lane/index.md` |

**Do not** use `wenakita/4626`, `wenakita/CreatorVault`, or July 22/23 pins for new jobs.

### Live Base anchors (shared infra)
- Registry4626 `0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2`
- DeploymentBatcher `0xa18169caf37fa0347285B16aAFC2B09eCB43F145`
- Phase1Module (v1.19.4 Creator-core repair) `0x8C1C6C10442F9bC7F8C50B196cF14812b2BB12F3`
- Phase2Module `0x1217bA070DBf64303117939301788925030295d1`
- LotteryManager4626 `0xB45E68a5867935a5734E4185977F81c528006650`
- VRFConsumer4626 `0x98fb5e0af3120B32E2E03400B6E51d0bde433670`
- LotteryAmoeRouter `0x630c3769Cf1D80c6cb8cCB7c011f5A76904C4C1e`
- CreatorOVaultCoreModule `0x0513cf245EF2Cf54534416211F7B890405bF76D1`
- AgentOVaultCoreModule `0xe3f7115aba3658201a3be2EaF699173E5cD0d6fE`
- Factory `0xCAb65a066A4D52DD29ffB418B319819176b89610`
- Store `0xF9622613682a12E46b914c7498716F42E44c4d36`

Per-creator vault / wrapper / ShareOFT are CREATE2 at launch — pull from Registry for a specific token, or audit implementation + core module from the pin.

Payer historically: `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD`.

### Already audited (do NOT re-commission unless live seal ≠ reviewed bytecode and delta is security-relevant)
Greenfield delta jobs **494–498** (2026-07-25, older pin tip):
| System | Prior job |
|--------|-----------|
| DeploymentBatcher | 494 |
| Registry4626 | 495 |
| Lottery stack | 496 |
| CreatorOVault + CoreModule | 497 |
| CreatorShareOFT + Wrapper | 498 |

Historical July 22: 460–468 / 480–481. LeftClaw research **482** is stale — ignore.

### Commission now (priority)

**P0 — agent lane (never had a dedicated ODA job; newly public)**

| # | Job title | In-scope files under `contracts/` | Live cross-check |
|---|-----------|-----------------------------------|------------------|
| A | AgentOVault + CoreModule | `agent/vault/AgentOVault.sol`, `agent/vault/modules/AgentOVaultCoreModule.sol` (+ used `shared/vault/modules/*`) | AgentOVaultCoreModule `0xe3f7115a…` |
| B | AgentShareOFT + Wrapper | `agent/vault/AgentShareOFT.sol`, `agent/vault/AgentOVaultWrapper.sol` | per-vault CREATE2 if live; else implementation-only |
| C | AgentGaugeController | `agent/revenue/AgentGaugeController.sol` | only if live agent gauge wired; else source-only |

Note in briefs: **#788 / ODA-480-[3] agent withdraw-cooldown parity**.

**P1 — optional**
| # | Title | When |
|---|-------|------|
| D | Creator vs Agent lane parity | Budget remains; focus intentional divergences |
| E | Charm + Ajna | Only if live Charm sleeve / Ajna codeId drifted (`tmp/check-head-vs-live.py`) |
| F | CreatorGauge + ve4626/bribes | Only if material source drift vs 467/468 |

**P2 — skip by default:** re-pay Batcher / Registry / Lottery / Creator vault/ShareOFT if 494–498 still match live seal.

### Per-job brief must include
1. Repo + tag + commit  
2. Exact file list  
3. Live address(es) + BaseScan links  
4. Bytecode match: match / pin-ahead-of-live / unknown (run `python3 tmp/check-head-vs-live.py`)  
5. Prior job IDs as context only  
6. Critical/High first; known DESIGN residuals (e.g. Charm sandwich)  
7. Persist under this folder: `one-dollar-audit-jobs.md` + `oda-commission-results.json`

### Deliverables
1. Job IDs + URLs + spend  
2. File list + live addresses + bytecode match per job  
3. Small docs PR to `wenakita/4626`  
4. **No** broadcast / redeploy  

### Constraints
- Pin ≠ redeploy; don’t claim Base runs every pin remediation without codeId match  
- Creator + Agent paid canaries may still be outstanding per addresses.md  
- No private-repo paths in public job briefs  

---

## Related

- [index.md](./index.md) — auditor pointer  
- [RESEARCH-CONTEXT.md](../security-scan-2026-07-22/RESEARCH-CONTEXT.md) — synthesis brief (482 stale)  
- `docs/reference/addresses.md` — live Base addresses / version wording  
- `deployments/base/v1.19.3-bytecode-manifest.json` — live seal  
