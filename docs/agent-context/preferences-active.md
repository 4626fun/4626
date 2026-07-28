# Active Agent Preferences (Tier 1)

<!-- Synced as COMPACT into .cursor/rules/agent-context-budget.mdc via scripts/sync-agent-context-rule.mjs -->

Always-on cross-cutting operator preferences. For domain depth, load matching archives from [INDEX.md](./INDEX.md).

**Cap:** 80 lines. Continual-learning appends here only when a preference affects most sessions; otherwise use `archives/`.

## Execution discipline

- Execute attached plans, pre-created todos, or deployment runbooks **without editing them**; preserve branch/version/checkpoint state across pauses.
- Prefer **smallest safe diff**; presentation-only passes (Deploy UI styling) must not touch logic.
- After shipping requested changes, user expects **`commit` + `push`** (and often PR follow-through) unless told otherwise.
- Broad sweeps: sustained autonomous execution with subagents; minimal pause-and-confirm loops.
- When stopping dev servers in Cursor: **"kill background jobs"** (or name processes) — not "kill all terminals".
- When asked to restart local dev or complete local ops, **run commands directly** — do not only paste them.

## Validation

- Scoped tests: `pnpm -C frontend exec vitest run <file>` — **not** `pnpm test -- --run <file>` (runs full suite).
- Report every validation command with exit code; never claim pass on failure.
- `forge test` has pre-existing Rebalance failures — scope with `--match-path` when unrelated.

## Product copy & terminology

- **waitlist** = app-access queue; **whitelist** = vault-deployment eligibility.
- Never mention Base/Coinbase **sub-accounts** in docs, UI, or explanations.
- Identity resolution order everywhere: **Zora profile → Basename → ENS → 0x**; never `@0x…` from embedded EOA.
- Avoid "scrape" / "crawl" in user-facing copy unless user asks for those terms.

## Credentials & env hygiene

- **`ALFACLUB_API_KEY`** is the sole AlfaClub bot credential — no shadow `ALFACLUB_BOT_TOKEN` / `WENAKITA_*` lines.
- Production env inspection: **scoped keys only**; no unredacted `railway variables --json`; rotate if secrets printed.
- Local Hugging Face Router (`OPENAI_API_BASE=https://router.huggingface.co/v1`) is **Cursor/Aider only** — never replace production `OPENAI_API_KEY` or Hermit/Eliza lanes.

## Deploy & infra posture

- **No Vercel PR previews** — `main` production only; canceled Preview rows from `vercel-ignore.sh` are intentional.
- User may prefer **hard cutover** over staged coexistence when saying "continue" / "fix all" on cutover work.
- Lane-neutral contract naming over deployment compatibility when **no live vaults** — regenerate manifests, re-seed bytecode store.
- **Share-mesh LZ:** before Pipe A / share bridge, `pnpm -C frontend ops:verify-share-mesh-lz` must exit 0 — template `[15, 32]` confirmations (never Base default 10 vs Solana inbound 15). Detail: `oft-chain-config` archive/skill.
- **Vault taxonomy:** legs = yield strategies (Charm, Ajna); arms = ShareOFT mesh (CCA, LP) — never call arms "strategies".

## UI & docs (active constraints)

- Waitlist/account UI: shadcn `@/components/ui/*`, brand blue palette, no purple accents unless design asks.
- Do not redesign `/swap` IA — improve hierarchy, a11y, states within Uniswap-like layout.
- Do not rewrite premium token icon renderer — targeted refinements only; subject breakout over bezel.
- Public docs: product + contracts only; wallet internals and operator runbooks stay in `docs/_internal/`.

## Continual learning

- High-signal transcript deltas → **`docs/agent-context/`** (Tier 1 or domain archive), **not** AGENTS.md bloat.
- If Tier 1 exceeds 80 lines, move oldest/lowest-signal bullet to the matching archive.

## Prompt templates

Copy-paste task shapes: [prompt-templates.md](./prompt-templates.md).
