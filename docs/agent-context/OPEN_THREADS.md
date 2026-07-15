# Open threads & next prompts

Generated 2026-07-15 from transcript scan + repo state. **Start a new Agent chat** for each item below — do not continue this optimization thread.

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

### 1. v1.19.1 Creator + Agent canaries (highest priority)

**Repo truth:** `docs/reference/addresses.md` — **v1.19.1 live** (aux helper
`0xde93…D99b` authorized; bytecode store fully seeded; `VITE_DEPLOYMENT_VERSION=v1.19.1`).

**Outstanding:** one Creator and one Agent canary via `/deploy`. Confirm no
`auxiliary_batcher_selector_not_allowed`, `batcher_aux_codeids_mismatch`,
`CodeIdKindMismatch`, `InvalidCodeId`, or `CODE_NOT_FOUND`.

**Paste into new chat:**

```
/deploy-cutover

RELEASE: v1.19.1
Goal: Run Creator + Agent production canaries against hardened VaultAuxiliaryDeployBatcher 0xde93AecaAd5A61dFC179703d522fBE9a5747D99b.

@docs/reference/addresses.md
@docs/_internal/operations/deployment/deploy-capable-batcher-rotation.md

Load archive: docs/agent-context/archives/deploy-cutovers-core.md

Validate: bash test/current-release-target-guard.sh
Report every exit code. Do not rotate DeploymentBatcher.
```

### 2. `validate:deploy-guards` (pre-existing)

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
