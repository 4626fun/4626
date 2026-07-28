# Solo Cleanup Starter

You're working alone and the repo feels heavy. That's normal. This document exists so you have a place to come back to when you don't know where to start.

**Core rule while solo:** Only do small, reversible, low-regret changes. One tiny win at a time. No heroic refactors.

## How to use this

1. Pick **one** item below when you have 15-60 minutes of energy.
2. Do only that item.
3. Stop. Don't keep going because "you're on a roll".
4. Commit the small change with a clear message.
5. Come back here next time.

---

## Tier 0 – Easiest possible wins (start here when you're unsure)

### 1. Clean up "legacy" language in one file (15-30 min)

The word "legacy" appears 164+ times in server code. Many are just old comments from architecture changes.

**How to do it safely:**
- Pick one file you already understand.
- Replace confusing "legacy X" comments with clearer language or delete the comment if it's no longer relevant.
- Never change behavior, only comments.

Example files that are relatively safe right now:
- `frontend/server/_lib/identity/accountsIdentity.ts`
- Files in `frontend/server/_lib/wallet/` that we touched during the server-core promotion

**Exact command to find candidates:**
```bash
grep -n "legacy" frontend/server/_lib/identity/accountsIdentity.ts
```

Do 5-10 comments max. Then stop.

### 2. Delete obvious dead comments (10-20 min)

Look for big blocks of commented-out code that have been there for months.

Search in one folder:
```bash
grep -rn "^\s*//.*function\|^//.*const\|^//.*if " --include="*.ts" frontend/server/_lib/onboarding/ | head -30
```

If something looks like dead experiment code, delete the commented block. Git history keeps it.

### 3. Update one stale runbook title or intro (5 min)

Pick any file in `docs/operations/`. Read the first 10 lines. If the title or first paragraph is clearly outdated, fix just that. Nothing else.

---

## Tier 1 – Slightly bigger but still safe

- Add a few more high-value files to the new `scripts/check-sc-hygiene.mjs` (the one we created during the audit).
- Do a single-folder "remove unused imports" pass using your editor's tooling (only on files you touched recently).
- Write one short "why this folder exists" comment at the top of the biggest confusing folder you keep getting lost in.

---

## What NOT to do while solo

- Do not touch deployment batcher logic, keeper coordination, or anything with money movement unless you have a clear test plan.
- Do not reorganize folders (server/_lib, scripts, etc.).
- Do not delete large numbers of files in one go.
- Do not try to "fix the whole docs situation" in one sitting.

---

## When you feel stuck again

Open this file.

Pick the smallest item.

Do only that.

Then close the laptop or switch tasks.

Small consistent progress beats big overwhelming plans when you're the only one.

---

Last updated: right after the server-core promotion work. The biggest structural hygiene win of 2026 so far is already done. Everything from here is incremental relief.
