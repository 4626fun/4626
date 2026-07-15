---
name: deploy-vault-operator
description: Operator runbook for 4626 deploy-session automation and cutover scripts.
paths: frontend/api/_handlers/deploy/**, frontend/scripts/ops/**, contracts/helpers/batchers/**
---

# Deploy vault operator (4626)

**Archive:** `docs/agent-context/archives/deploy-vault-operator.md`  
**CSW track:** `.cursor/rules/csw-agent-lifecycle.mdc`

Autopilot: `pnpm -C frontend run deploy:autopilot -- --origin … --plan ./deploy-plan.json --auth-bearer "$CV_AUTH_SESSION_TOKEN"`

Never `continue` before owner-install confirms. Report `sessionId`, `step`, `lastUserOpHash`, `lastError`.
