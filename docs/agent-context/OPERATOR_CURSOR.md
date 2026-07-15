# Operator Cursor setup (4626)

Repo-local optimizations live in tracked files; machine-local toggles live under `.cursor/` (gitignored except rules/skills).

## One-time (Cursor UI)

1. **User Rules** — replace with paste block in `.cursor/USER_RULES_REPLACEMENT.md` (~5 lines).
2. **Rules → User** — delete `proactive-telemetry`, `plugin-quality-gates`, `workers`. Keep `no-inline-imports`, `typescript-exhaustive-switch`.
3. **Rules, Skills, Subagents** — turn **OFF** “Include third-party Plugins, Skills, and other configs”.
4. **Developer: Reload Window**

## Applied in `.cursor/settings.json` (project)

| Plugin | State |
|--------|-------|
| supabase, cursor-team-kit | on |
| vercel, tierzero, continual-learning, create-plugin, figma, notion, shadcn, parallel, slack, compound-engineering | off |

`agent.importThirdPartyConfigs: false` — blocks Codex/Agents auto-import.

## Scripts

```bash
bash scripts/apply-operator-cursor-efficiency.sh   # MCP prune + skill prune
bash scripts/prune-cursor-skills.sh --restore      # undo global skill disables
```

## Global MCP (`~/.cursor/mcp.json`)

Pruned to **railway + supabase**. Backup: `~/.cursor/mcp.json.backup-*`.

Optional project MCP: copy from `.cursor/mcp.optional.json` → `.cursor/mcp.json`.

## Skills

- **Project:** `.cursor/skills/CURATED_SKILLS.md` — path-scoped or slash-only.
- **Disabled:** `moltbook`, `farcaster-agent` (`SKILL.md.disabled`); generic Uniswap blob archived under `swap-integration/references/`.
- **Global allowlist:** gh-fix-ci, gh-address-comments, supabase, supabase-postgres-best-practices, use-railway.

## Re-enable when needed

- **Vercel deploy week:** `"vercel": { "enabled": true }` in settings.json
- **TierZero incident:** enable tierzero plugin + reload
- **Zora CLI:** `/zora-cli` in chat (slash-only skill)
