---
name: frontend-change
description: Handles frontend SPA, UI, local API, and app-server changes in the Vite/React surface.
triggers:
  - frontend/src/
  - frontend/api/
  - frontend/server/
  - vite/react/ui
scope:
  - frontend/src/
  - frontend/api/
  - frontend/server/
verification:
  - pnpm -C frontend lint
  - pnpm -C frontend typecheck
  - pnpm -C frontend test
---

# frontend-change

Use this skill when work touches the Vite app, local/Vercel API handlers, or frontend server helpers.

Guardrails:

- Preserve the existing route and provider topology from `AGENTS.md`.
- Reuse existing waitlist, auth, and account providers instead of adding parallel session polling.
- Keep frontend/API changes aligned with the static route registration model in `frontend/api/_handlers/_routes.ts`.
