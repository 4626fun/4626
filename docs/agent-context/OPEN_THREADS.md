# Open threads & next prompts

Generated 2026-07-15 from transcript scan + repo state. **Refreshed 2026-07-28** — status annotations added per item (rotations executed, deploy-guards resolved, stash count grew). **Start a new Agent chat** for each item below — do not continue this optimization thread.

## Conversation hygiene

| Metric | Your pattern |
|--------|----------------|
| Stored transcripts | ~873 |
| Paid events/day | ~71 |
| Median cache/event | ~878k tokens |

**Rule:** new chat when switching domain (cutover ↔ swap ↔ waitlist ↔ meta/ops). Close thread after `commit + push`.

---

## Resolved (this optimization arc)

- [x] User Rules shortened
- [x] Third-party skill import off
- [x] Phases 4–7 committed and pushed (`main` = `origin/main`)
- [x] `usage-events*.csv` → `.gitignore` (local billing export only)

---

## Open — product / ops

### 1. v1.19.3 / v1.19.4 Creator `/deploy` canary (highest priority)

> **2026-07-28 status: rotations EXECUTED.** `RotateLiveBatcherPhase1ModulesV193` 5/5 txs (Jul 19), `RotateLiveBatcherCreatorCoreV194` 2/2 txs (Jul 24), 0 failed (broadcast `run-latest.json` receipts, Base 8453). `releases/current.md` already names v1.19.3 + v1.19.4 as current. **Still open:** record the Creator production `/deploy` canary outcome, then close.

**Repo truth:** `docs/reference/addresses.md` — **v1.19.1 greenfield shell** with
**v1.19.3 bytecode** and **v1.19.4 Creator-core Phase1Module** `0x8C1C6C10…`
(Registry `0x1365e9…`, batcher `0xa18169…`, store `0xF96226…`, aux `0xaA9229…`,
AMOE `0x630c37…`). Pipe-A shell readiness **PASS**.

**Outstanding (Creator first):** one Creator production canary via `/deploy`
after the Vercel build that includes this epoch is Ready. Confirm no
`auxiliary_batcher_selector_not_allowed`, `batcher_aux_codeids_mismatch`,
`CodeIdKindMismatch`, `InvalidCodeId`, `InvalidModuleAddress`, or `CODE_NOT_FOUND`.
Agent canary remains a follow-up after Creator passes.

**Paste into new chat:**

```
/deploy-cutover

RELEASE: v1.19.3 (Phase1Module v1.19.4 Creator-core repair)
Goal: Run Creator production canary against greenfield batcher 0xa18169caf37fa0347285B16aAFC2B09eCB43F145, Phase1Module 0x8C1C6C10442F9bC7F8C50B196cF14812b2BB12F3, and aux 0xaA9229c1649a7eC6DA85a76097E0910B24F9408e.

@docs/reference/addresses.md
@docs/_internal/deployment-releases-legacy/v1.19.3.md
@docs/_internal/operations/operations/deployment/releases/current.md
@docs/_internal/operations/deployment/deploy-capable-batcher-rotation.md

Load archive: docs/agent-context/archives/deploy-cutovers-vault.md

Validate: bash test/current-release-target-guard.sh
Report every exit code.
```


### 2. `validate:deploy-guards` (pre-existing)

> **2026-07-28 status: RESOLVED.** `pnpm -C frontend validate:deploy-guards` EXIT=0 — `guard:registry4626-naming` and `guard:canonical-csw` both pass. Item can be removed on next regeneration.

`pnpm -C frontend validate:deploy-guards` fails on **`guard:registry4626-naming`** — legacy `bribeDepot` / `setVe4626*` naming in tests/server. Not introduced by context optimization.

**Paste:**

```
/fast-bugfix

Symptom: validate:deploy-guards fails guard:registry4626-naming (pre-existing).

Inspect: scripts/guard-registry4626-naming output + listed files only.
Validate: pnpm -C frontend validate:deploy-guards
Smallest safe diff — rename to canonical *4626 forms only where guard requires.
```

### 3. Stale git stash

> **2026-07-28 status: WORSE — 38 stashes** (34 when written; 9 are lint-staged automatic backups). Automation arc adds ~2/day. Triage deferred until the branch-cycling session settles.

`git stash list` shows `wip-unrelated-before-room-chat-auth` and older lint-staged backups. Review or drop if obsolete:

```bash
git stash show -p stash@{0} | head -40
```

---

## Open — likely stale threads (safe to archive in Cursor UI)

Scanned **505** transcripts matching cutover/swap/waitlist/wallet keywords. **Start fresh** if you revisit — especially rows marked ⚠ (last message was `continue` / `yes` / open-ended):

| Date | ID | Domain | Lines | Note |
|------|-----|--------|-------|------|
| Jul 14 | `ebdc207e` | cutover | 123 | ⚠ ended `continue` |
| Jul 13 | `70d97825` | cutover | 558 | ⚠ ended `continue` (large) |
| Jul 13 | `726ebdcd` | cutover | 231 | ⚠ ended `yess` |
| Jul 12 | `14636675` | cutover | 207 | ⚠ ended `continue` |
| Jul 12 | `752d97fa` | swap | 322 | ⚠ AlfaClub 401 on friend-key-holdings |
| Jul 13 | `8d8feec4` | waitlist | 234 | tray regression report |
| Jul 14 | `6e72f633` | waitlist | 25 | ⚠ ended `yes` |

**This thread** (`2119df28`, 290+ lines) — close after reading; use paste prompts below for execution.

---

## Prompt cheat sheet

| Task | Command / template |
|------|-------------------|
| Small fix | `/fast-bugfix` |
| Swap | `/swap-bug` + `validate:swap` |
| Waitlist | `/waitlist-auth-debug` + `validate:waitlist:smoke` |
| Wallet CSW | `/wallet-csw` + `validate:wallet` |
| Deploy cutover | `/deploy-cutover` |
| Meta-block | `docs/agent-context/prompt-templates.md` |

Full index: `docs/agent-context/INDEX.md`
