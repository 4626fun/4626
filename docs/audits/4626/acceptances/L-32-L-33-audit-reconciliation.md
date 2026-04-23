# L-32 / L-33 — `docs/audits/codex/AUDIT_RECONCILIATION.md` claims

- Findings: L-32 (Linear: 4626-380), L-33 (Linear: 4626-381)
- Severity: Low
- Disposition: **Stale findings — acceptance only**. Neither claim applies to the current state of the document.

## L-32 verification — "All CLM Findings Fixed" banner

L-32 claimed the document contains a summary-table header reading `All CLM Findings Fixed: ✅`, contradicted by the body listing CLM findings as "Deferred" or "Accepted Risk".

`grep -n "All CLM\|CLM" docs/audits/codex/AUDIT_RECONCILIATION.md` returns **zero matches**. There is no CLM section, no CLM banner, and no "Fixed ✅" summary. The document is a per-finding reconciliation worksheet with columns `ID | Contract | Audit Verdict | Source Reality | Action`. Every row lists a specific next action (patch, escalate, audit different contract), not a fixed/deferred disposition. The contradiction L-32 describes is not reachable from the current file.

## L-33 verification — Vault Core / Governance "Fixed" entries

L-33 claimed several vault-core and governance findings are marked "Fixed" in the reconciliation but the corresponding code still shows the vulnerable pattern (cross-referenced H-06, H-15, MED-007, INFO-004).

Reviewing the document:

- There is **no** "Vault Core" or "Governance" section header. Sections are CRITICAL / HIGH / MEDIUM — organized by severity, not by component.
- The only entry marked as fixed is **C-05 (`LBPStrategyWithTaxHook`)** — "ALREADY FIXED — constructor reverts on zero hook". C-05 is a strategy finding, not a vault-core or governance one.
- H-06 in the current doc is `SolanaBridgeStrategy.sol — Unchecked Bridge Return Value`, not the H-06 L-33 references.
- H-15, MED-007, INFO-004 are **not present** in the document.

The IDs L-33 cross-references do not exist in the current reconciliation. The finding appears to be carried over from an earlier draft of the reconciliation doc that has since been rewritten.

## Why no change

- L-32's claim text ("All CLM Findings Fixed: ✅") does not exist; adding a correction for a non-existent banner would introduce confusion.
- L-33's cross-references point at IDs that are not in the current doc.
- The document's existing per-row `Action` column is already the "accurate reflection of state" that both findings ask for. Each row names the exact follow-up (e.g., `Patch: usedReportIds mapping`, `Audit CreatorOVault.sol`, `No action — false positive`).

## Follow-ups

- When the reconciliation worksheet is next updated, preserve the per-row `Action` column convention; do not replace it with a blanket "Fixed" banner.
- If a consolidated dashboard is added later (e.g. "X/19 critical findings patched as of commit SHA"), pin it to a concrete commit hash to avoid future drift.
