# Agent Workflow

This repo uses a small repo-native agent layer. It is intentionally narrower than larger orchestration frameworks.

## Precedence

Use the following order when shaping or reviewing work:

1. `AGENTS.md` defines repo-wide architecture, invariants, and trust-boundary rules.
2. Path-scoped `.cursor/rules/*.mdc` files override the generic builder workflow inside their scope.
3. The relevant repo skill under `script/agent-runtime/skills/` supplies workflow guidance and expected validation commands for that class of change.
4. `node script/agent-runtime/verify-change.js <paths...>` or `pnpm agent:verify-change -- <paths...>` selects the required verification commands and manual review flags from the touched paths.

## What This Layer Does

- Bundles a small set of high-signal repo skills for common high-risk work.
- Keeps skill metadata local to the repo instead of depending on an external marketplace or control plane.
- Maps changed paths to explicit validation commands so contributors do not need to guess which checks matter.

## What This Layer Does Not Do

- No multi-agent orchestration or task delegation framework.
- No persistent memory, instincts, or automatic learning loop.
- No cross-tool compatibility abstraction beyond the repo’s existing Cursor/Codex posture.
- No automatic write-time hooks that mutate files or block commits.

## Contributor Workflow

1. Read `AGENTS.md` and any path-scoped rule files that cover the files you are changing.
2. Check the matching skill in `script/agent-runtime/skills/` for risk-specific guidance.
3. Run `pnpm agent:verify-change -- <paths...>` with repo-relative changed paths.
4. Execute the listed commands and address any manual review flags before opening a PR.

## Skill Metadata Contract

Each `SKILL.md` file under `script/agent-runtime/skills/` must include frontmatter with these required fields:

- `name`
- `description`
- `triggers`
- `scope`
- `verification`

Malformed or duplicate skill metadata fails discovery tests on purpose. Silent degradation is not allowed.
