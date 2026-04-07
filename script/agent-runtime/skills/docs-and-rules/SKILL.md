---
name: docs-and-rules
description: Keeps AGENTS, Cursor rules, and contributor docs aligned without drifting authority or scope.
triggers:
  - docs
  - rules
  - AGENTS
scope:
  - AGENTS.md
  - .cursor/
  - docs/
  - README.md
verification:
  - pnpm docs:check
  - node --test script/agent-runtime/__tests__/skills.test.js
---

# docs-and-rules

Use this skill when work changes operator docs, Cursor rules, or the repo-level instructions that govern agent behavior.

Guardrails:

- `AGENTS.md` remains the repo authority.
- Path-scoped `.cursor/rules/*.mdc` keep precedence inside their scope.
- Do not describe ECC-style orchestration systems as if they are present in this repo.
