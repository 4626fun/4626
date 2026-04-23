# Acceptance: L-24 — `@elizaos/core` in production dependencies

- **Finding ID:** L-24
- **Linear:** 4626-372
- **Severity (reported):** Low
- **Confidence (reported):** Confirmed
- **Status:** Accepted — intrinsic runtime dependency of the agent feature
- **Source:** Phase 6 SEV-613

## Reported issue

The finding recommends moving `@elizaos/core@^1.7.2` to `devDependencies`
if it is only used in dev/test, or scoping it to a specific CRE workflow
package if it is required at runtime.

## Why it cannot be moved to devDependencies

The ElizaOS plugin system is the **value** import surface of the agent
runtime shipped at `frontend/server/agent/eliza/plugins/*`. Actual
value imports (not type-only) appear in at least:

- `frontend/server/agent/eliza/plugins/alfaclub/index.ts`
- `frontend/server/agent/eliza/plugins/cre/index.ts`
- `frontend/server/agent/eliza/plugins/keepr/index.ts`
- `frontend/server/agent/eliza/plugins/zora/index.ts`

These modules import the `Memory`, `Plugin`, `State`, `Action`,
`HandlerCallback`, and `IAgentRuntime` symbols without the `import type`
keyword, so the TypeScript-to-JS compilation retains them as runtime
references. The agent stream, creative-agent API handler, and keeper
AI-assessment handler (`frontend/api/_handlers/agent/_stream.ts`,
`frontend/api/_handlers/agent/_creative.ts`,
`frontend/api/_handlers/cre/keeper/_aiAssess.ts`) all transitively load
these plugins at request time.

Moving `@elizaos/core` to `devDependencies` would therefore cause a
`MODULE_NOT_FOUND` on every agent/cre request in production. A scoped
sub-package would require a multi-week re-architecture of the plugin
loader.

## What has been done in remediation scope

- The non-determinism concern that L-24 flagged as the motivating vector
  (H-13 — "Non-deterministic LLM in consensus path") is tracked under
  its own ticket. The consensus path no longer treats LLM output as
  authoritative; see Sprint 5/6 CRE commits for the deterministic
  guard rails around AI output.
- Cold-start cost: the agent plugins are loaded only inside the serverless
  routes that need them. Non-agent routes (payments, vaults, auth) do not
  import `@elizaos/core` and therefore do not pay the ONNX/SQLite cold
  start cost. Evidence:
  `grep -rln "from ['\"]@elizaos/core['\"]" frontend/api/_handlers/` —
  zero matches; only plugin modules under
  `frontend/server/agent/eliza/plugins/` import it directly, and those
  plugin modules are lazily imported through the agent runtime entry
  point rather than by unrelated routes.

## Follow-ups tracked

1. **Type-only narrowing.** Where a plugin module imports only types
   (`Action`, `Plugin`, `Memory`, `State`, `IAgentRuntime`,
   `HandlerCallback`, `Content`), rewrite the import as
   `import type { … } from '@elizaos/core'`. This does not remove the
   runtime dependency but makes the type-only surface explicit and
   unblocks future subset packaging. Example candidate files:
   `plugins/discord/index.ts`, `plugins/telegram/index.ts`,
   `plugins/twitter/index.ts`, `plugins/uniswap/index.ts`,
   `plugins/reputation/index.ts`, `plugins/knowledge/index.ts`,
   `plugins/lens/index.ts` — these already use `import type` today and
   are correctly typed; the cited value-import files above are the
   ones that should be audited.
2. **Workspace sub-package proposal.** An engineering follow-up can
   extract the agent plugins into their own workspace package that
   depends on `@elizaos/core`, and have the serverless routes import
   from that sub-package only. Non-agent serverless deployments could
   then skip the dependency graph entirely. This is out of scope for
   the audit-remediation PR train.

## Decision

Closed as acceptance. Moving the dependency to `devDependencies` would
break the production agent surface. The non-determinism/attack-surface
concerns that motivated the finding are addressed by (a) H-13's own
remediation (deterministic consensus guards) and (b) the observation
that non-agent routes do not import the package.

## References

- Phase 6 SEV-613
- H-13 (deterministic CRE consensus guards) — cross-listed remediation
- `frontend/server/agent/eliza/plugins/` — runtime plugin modules
- `frontend/api/_handlers/agent/_stream.ts`,
  `frontend/api/_handlers/agent/_creative.ts`,
  `frontend/api/_handlers/cre/keeper/_aiAssess.ts` — serverless entry points
