---
name: ajna-vault-ops
description: Nested Ajna sleeve ops — inspect buffer vs pool LP, prepare moveFromBuffer, Keepr/KPR execute, v1.20.0 launch expectations.
paths: contracts/**/strategies/ajna/**, contracts/**/ERC4626StrategyAdapter**, frontend/server/_lib/ajnaVaultManager/**, frontend/api/_handlers/keeper/_ajnaRebalance**, kpr/**/ajna*
---

# Ajna vault ops (4626)

**Archive:** `docs/agent-context/archives/ajna-vault-ops.md`  
**Skill (repo):** `.cursor/skills/ajna-vault-ops/`

Inspect buffer vs bucket LP before any lend. Empty Ajna UI after Phase 3 is usually buffer-not-lent, not a failed deploy.

Execute only via adapter owner / protocol Safe — never raw pool lend with a skill-local key. For cutover planning, load the archive section **v1.20.0 launch expectations**.

Parent weights skill: `yield-strategy-management`.
