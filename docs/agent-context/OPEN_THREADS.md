# Open threads & next prompts

Generated 2026-07-15 from transcript scan + repo state. **Refreshed 2026-07-28 (post v1.20.0)** — infra cutover + AMOE root republish complete; Creator/Agent paid canaries still open. **Start a new Agent chat** for each item below.

## Conversation hygiene

| Metric | Your pattern |
|--------|----------------|
| Stored transcripts | ~873 |
| Paid events/day | ~71 |
| Median cache/event | ~878k tokens |

**Rule:** new chat when switching domain (cutover ↔ swap ↔ waitlist ↔ meta/ops). Close thread after `commit + push`.

---

## Resolved (this optimization arc + v1.20.0 cutover)

- [x] User Rules shortened
- [x] Third-party skill import off
- [x] Phases 4–7 committed and pushed (`main` = `origin/main`)
- [x] `usage-events*.csv` → `.gitignore` (local billing export only)
- [x] v1.20.0 bytecode store sealed + product pins hard-cut (`#859`, `#860`)
- [x] AMOE roots republished on router `0xf07D4811…` (allowlist 86–88, ledger 68) + DB confirm
- [x] `validate:deploy-guards` (`guard:registry4626-naming` + `guard:canonical-csw`) EXIT=0

---

## Open — product / ops

### 1. v1.20.0 Creator `/deploy` canary (highest priority)

> **2026-07-28 status:** greenfield infra live (batcher `0x83A9b248…`, store `0x8599CA87…`, registry `0xF60a1490…`, LM `0x0fC6f30a…`, AMOE `0xf07D4811…`). AMOE roots confirmed. **Still open:** one Creator production canary via `/deploy`, then Agent canary.

**Outstanding (Creator first):** one Creator production canary via `/deploy`
after the Vercel build that includes this epoch is Ready. Confirm no
`auxiliary_batcher_selector_not_allowed`, `batcher_aux_codeids_mismatch`,
`CodeIdKindMismatch`, `InvalidCodeId`, `InvalidModuleAddress`, or `CODE_NOT_FOUND`.
Agent canary remains a follow-up after Creator passes.

**Paste into new chat:**

```
/deploy-cutover

RELEASE: v1.20.0
Goal: Run Creator production canary against greenfield batcher 0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032, Phase1Module 0x416FA15e40caA51C20d1795db946c6806C946aC5, aux 0x15eE1D03a5556C28E5079E68763F8231ad68dAdD, store 0x8599CA87b28320158941C59CB3cd9a3f12083530.

@docs/reference/addresses.md
@docs/_internal/deployment-releases-legacy/v1.20.0-greenfield.md
@docs/_internal/operations/operations/deployment/releases/current.md

Load archive: docs/agent-context/archives/deploy-cutovers-vault.md

Validate: bash test/current-release-target-guard.sh
Report every exit code.
```

### 2. Stale git stash

> **2026-07-28 status: WORSE — 38 stashes** (34 when written; 9 are lint-staged automatic backups). Automation arc adds ~2/day. Triage deferred until the branch-cycling session settles.

`git stash list` shows `wip-unrelated-before-room-chat-auth` and older lint-staged backups. Review or drop if obsolete:

```bash
git stash show -p stash@{0} | head -40
```

### 3. Historical vanity preseed plans (non-blocking)

AKITA / older `deployments/base/akita-*-per-vault-vanity-manifest.json` files still cite
retired batchers (e.g. `0xa18169…`). That is expected for pre-v1.20.0 vaults — do **not**
rewrite those manifests onto the new batcher unless grinding a fresh vanity plan for a
new launch. New launches use `VITE_DEPLOYMENT_VERSION=v1.20.0` + current batcher.

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
