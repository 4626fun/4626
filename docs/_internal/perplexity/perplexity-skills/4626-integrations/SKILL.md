---
name: 4626-integrations
description: External integration skill for 4626. Use for creator profile enrichment and Zora CLI workflows with explicit fallback contracts, provenance metadata, key-handling constraints, and canonical account safety even when repo context is partially unavailable.
---

# 4626 Integrations

## When to Use This Skill

Use for integration tasks involving third-party APIs/services and creator discovery surfaces.
Trigger when the user asks for creator profile enrichment, reputation signals, Zora CLI-assisted discovery, or any feature that depends on partial third-party data.

## System Model

- **Integration type A:** creator reputation enrichment from multiple providers.
- **Integration type B:** Zora CLI-assisted discovery and operator workflows.
- **Trust model:** external providers are non-authoritative and failure-prone.
- **Identity model:** canonical account identity is internal and must not be replaced by external profile data.

Core invariants:

1. Integration outages must not break unrelated core flows.
2. API credentials remain server-side only.
3. External profile signals cannot override canonical account identity.
4. Write operations are operator-confirmed and never assumed.

## Required Inputs

1. Target surface (`frontend/src`, `frontend/server`, `frontend/api`) or equivalent subsystem.
2. Read-only vs write intent.
3. Expected failure behavior (degrade gracefully vs block).
4. Data freshness requirement.
5. Provider priority order if multiple sources are used.

## Instructions

1. Treat integrations as optional and failure-tolerant.
2. Keep API keys and private credentials server-side only.
3. Do not bypass canonical wallet/auth policy in production user flows.
4. Define an explicit response contract before implementation:
   - complete data
   - partial data
   - no data found
   - upstream failure
5. Integration-specific guidance:
   - creator enrichment: use aggregator entrypoints and proxy-backed sources
   - Zora CLI: use `--json`; treat write usage as local/operator tooling unless product policy changes
6. Define fallback contract:
   - missing upstream data must return partial payloads plus explicit provenance flags
   - rate-limited providers must not hard-fail unrelated account setup paths
7. Validate impacted app surfaces:
   - `pnpm -C frontend lint`
   - `pnpm -C frontend typecheck`
   - `pnpm -C frontend test`

8. Always include provenance metadata in payloads:

- `source`
- `resolvedAt`
- `isStale`
- `errorCategory` (if failed/partial)
9. Use explicit result states:
   - `status: complete`
   - `status: partial`
   - `status: empty`
   - `status: failed`
10. Report:
   - integrations touched
   - fallback behavior
   - validation evidence
   - residual risk

## Examples

### Example: Creator Reputation Card With Partial Data

- Input:
  - provider A rate-limited, provider B/C healthy
- Expected output:
  - `status: partial`
  - provenance per field
  - UX-safe fallback copy without hard failure

### Example: Zora Discovery Query

- Input:
  - user asks for trending creator-coin discovery using CLI
- Expected output:
  - command uses `--json`
  - parsed response structure
  - confirmation that no production write path was introduced

### Example: No-Repo Fallback

- Input:
  - only desired payload shape and provider list supplied
- Expected output:
  - fallback schema with result states
  - provenance fields per data source
  - no dependence on repository file paths

## Common Errors

- Wrong: Treat provider outages as hard blockers for unrelated flows.
  Correct: Return partial states with explicit fallback behavior.
- Wrong: Blend canonical account identity with external profile signals.
  Correct: Keep canonical identity as system-of-record.
- Wrong: Expose raw provider errors directly to users.
  Correct: Map provider failures to safe, user-appropriate error states.
- Wrong: Return generic success without provenance markers.
  Correct: Include source, freshness, and error-category metadata.

## Sources

- `AGENTS.md`
- `.cursor/skills/creator-profile-enrichment/SKILL.md`
- `.cursor/skills/zora-cli/SKILL.md`
