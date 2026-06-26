# 4626 Skills: Integrations

## When To Use

Use this context for external integration workflows in active 4626 scope:

- creator profile enrichment and reputation aggregation
- Zora CLI assisted read workflows and operator-side tooling

## Intake Checklist (Required Before Work)

Capture these inputs first:

1. target surface (`frontend/src`, `frontend/server`, or `frontend/api`)
2. read-only vs write behavior
3. desired failure behavior (degrade gracefully vs block flow)
4. freshness requirement (cached vs near-realtime)
5. user-facing copy expectations for partial/unavailable data

## Canonical Invariants

- Treat integration dependencies as optional and failure-tolerant.
- Keep API keys server-side; never expose credentials in client bundles or prompts.
- Do not bypass canonical auth/wallet policy for production user flows.
- Never let external profile signals override canonical wallet identity.

## Integration Execution Method

### Phase 1: Scope + Data Contract

- Define expected output fields and provenance metadata.
- Return explicit source metadata (`source`, `resolvedAt`, `isStale`) with each integration payload.
- Separate these result states:
  - success with complete data
  - success with partial data
  - no data found
  - transport/provider failure

### Phase 2: Failure and Fallback Design

- Provider failure must not break unrelated setup/auth flows.
- Use stale-but-valid cached data where acceptable.
- Provide deterministic fallback copy (avoid ambiguous "success" states).

### Phase 3: Implementation Rules

- Creator enrichment:
  - use aggregator entrypoints and proxy-backed sources
  - source failures should reduce confidence, not crash the surface
- Zora CLI:
  - use `npx @zoralabs/cli ... --json`
  - treat write usage as local/operator tooling unless product policy changes

### Phase 4: Verification

- `pnpm -C frontend lint`
- `pnpm -C frontend typecheck`
- `pnpm -C frontend test`
- include at least one regression test for degraded-provider behavior when practical

## Output Format (Recommended)

When reporting or returning results, include:

1. integrations touched
2. fallback behavior implemented
3. provenance fields added/updated
4. verification commands run
5. residual risks

## Common Pitfalls

- Treating source outages as hard blockers.
- Mixing canonical account state with external profile metadata.
- Leaking provider-specific internals directly into user copy.

## Sources

- `.cursor/skills/creator-profile-enrichment/SKILL.md`
- `.cursor/skills/zora-cli/SKILL.md`
- `AGENTS.md`
