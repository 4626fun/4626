# 4626 Perplexity Skills Index

## How To Use

- Preferred: upload `skills.master.md` when Perplexity expects one context file.
- Better retrieval quality: upload all domain files and let Perplexity retrieve by topic.
- Sensitivity level: balanced (includes invariants and commands; omits high-risk operational internals and secrets).

## Files In This Pack

- `skills.master.md` - consolidated project context for single-file use.
- `skills.product-and-frontend.md` - product model, auth invariants, frontend/API guardrails.
- `skills.onchain-and-vaults.md` - contracts, vault deployment, OFT, VRF, strategy ops.
- `skills.solana-and-kpr.md` - Solana provisioning model, bridge setup flow, KPR bots.
- `skills.agent-runtime-guardrails.md` - runtime routing skills and verification commands.
- `skills.integrations.md` - creator profile enrichment + Zora CLI integration patterns.

## Canonical Precedence

1. `AGENTS.md` is repo-level authority.
2. Path-scoped `.cursor/rules/*.mdc` override inside their scope.
3. Skill precedence for this pack: `.cursor/skills` over `frontend/skills` when names overlap.
4. `script/agent-runtime/skills` provides compact routing and verification guardrails.

## Dedupe Notes

- Duplicates removed between `.cursor/skills` and `frontend/skills` for:
  - `deploy-vault-operator`
  - `vault-deployment`
  - `lottery-vrf-ops`
  - `yield-strategy-management`
  - `zora-cli`
  - `oft-chain-config`
  - `modern-python`
- `.cursor/skills` retained as canonical source for the above.

## Sources

- `AGENTS.md`
- `.cursor/skills/*/SKILL.md`
- `frontend/skills/*/SKILL.md`
- `script/agent-runtime/skills/*/SKILL.md`
