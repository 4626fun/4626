# Repo Skills

These are the bundled repo-native skills under `script/agent-runtime/skills/`.

## Skills

| Skill | Use For | Protects |
| --- | --- | --- |
| `frontend-change` | `frontend/src`, `frontend/api`, `frontend/server` | Route/provider topology, static API registration, shared auth/session behavior |
| `contracts-change` | `contracts/`, `script/`, `test/` | Contract invariants, deployment assumptions, Foundry validation |
| `telegram-linking` | Telegram Mini App, OTP, Privy sync, canonical account linking | Inline OTP, explicit sync states, Telegram proof, no popup auth |
| `security-sensitive-api` | `frontend/api`, `frontend/server/_lib` | Trust boundaries, deny-by-default auth, allow/deny test coverage |
| `solana-provisioner` | Solana provisioner, bridge setup, keeper-adjacent Solana changes | Read-only preflight, machine-auth mutations, Solana integration posture |
| `docs-and-rules` | `AGENTS.md`, `.cursor/`, `docs/`, `README.md` | Rule precedence, documentation accuracy, non-goal clarity |

## Selection Rules

- Skills are helpers, not policy authorities.
- Use the skill whose `scope` best matches the changed paths.
- If multiple skills match, keep all relevant manual reviews and run the combined verification plan.
- If no skill matches cleanly, fall back to `AGENTS.md` plus the closest path-scoped rule and add a doc note if a new recurring workflow deserves a skill.

## Non-Goals

- This catalog is intentionally small.
- Do not add generic “do everything” skills.
- Do not recreate ECC-style agent fleets or workflow sprawl inside this repo.
