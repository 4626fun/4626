# Curated skills for 4626 (12)

Only these project skills under `.cursor/skills/` are intended for routine 4626 work. Global skills were pruned by `scripts/prune-cursor-skills.sh`.

**Auto-prune:** `bash scripts/prune-cursor-skills.sh` (disables global `SKILL.md` outside allowlist)  
**Restore:** `bash scripts/prune-cursor-skills.sh --restore`

## Project skills (always on for 4626)

| Skill | Use when |
|-------|----------|
| deploy-vault-operator | Vault deploy orchestration |
| vault-deployment | Creator vault lifecycle |
| swap-integration | Uniswap / swap wiring |
| creator-profile-enrichment | Creator metadata |
| agents-memory-updater | Transcript → agent-context updates |
| oft-chain-config | LayerZero ShareOFT peers |
| lottery-vrf-ops | Jackpot / VRF |
| yield-strategy-management | Vault strategies |
| farcaster-agent | Farcaster surfaces |
| moltbook | Moltbook integration |
| zora-cli | Zora CLI |
| modern-python | Python tooling in repo |

## Global skills kept (7)

`gh-fix-ci`, `gh-address-comments`, `supabase`, `supabase-postgres-best-practices`, `swap-integration`, `use-railway`, `vercel-deploy`

All other global Codex/Agents skills are `SKILL.md.disabled` (re-run prune script after adding new global skills).

`agents-memory-updater` is a **cursor-team-kit subagent** (not a skill file) — use for transcript → agent-context updates.
