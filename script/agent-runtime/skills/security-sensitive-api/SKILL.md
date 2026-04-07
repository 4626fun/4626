---
name: security-sensitive-api
description: Protects trust-boundary code in frontend API handlers and shared server libraries.
triggers:
  - security
  - trust boundary
  - api auth
scope:
  - frontend/api/
  - frontend/server/_lib/
verification:
  - pnpm -C frontend lint
  - pnpm -C frontend typecheck
  - pnpm security:local
---

# security-sensitive-api

Use this skill when work touches request authentication, deploy/session authorization, secrets handling, or other trust-boundary logic.

Guardrails:

- Keep deploy preflight/status paths read-only.
- Require machine auth for internal Solana mutation paths.
- Add or update allow/deny tests whenever the trust boundary changes.
