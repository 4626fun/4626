# 4626 Synthesis Submission Runbook

## Scope

Ship one flagship submission and reuse it across these core tracks:

- `Synthesis Open Track`
- `Let the Agent Cook — No Humans Required`
- `Agents With Receipts — ERC-8004`
- `Agentic Finance (Uniswap)`
- `ENS Identity`
- `ENS Open Integration`
- `ENS Communication`

Stretch tracks stay opt-in:

- `Agent Services on Base`
- `Autonomous Trading Agent`

## What Already Exists In Repo

### Autonomous evidence pipeline

- Canonical deploy runner with structured audit output: `frontend/scripts/deploy-autopilot.mjs`
- Submission bundle generator: `frontend/scripts/generate-synthesis-artifacts.mjs`
- Current ERC-8004 registration: `frontend/public/.well-known/agent-registration.json`
- Current ERC-8004 domain proof: `frontend/public/.well-known/erc8004.json`

### ERC-8004 and Base service surface

- Public agent spec with x402 review endpoint: `frontend/api/_handlers/v1/_spec.ts`
- Real x402-gated ERC-8004 review handler: `frontend/api/_handlers/v1/agents/feedback/_review.ts`
- Public discoverability report across onchain state, mirrors, and service health: `frontend/api/_handlers/v1/agents/identity/_verification.ts`
- Operator CLI verification loop: `frontend/scripts/check-agent-discoverability.mjs`
- x402 payment service helpers: `frontend/server/_lib/x402Service.ts`
- Runtime registration defaults keep the paid review surface discoverable: `frontend/server/_lib/agentRegistration.ts`

### Uniswap surface

- Upstream Trading API client: `frontend/server/uniswap/trading.ts`
- Quote/swap builders and advanced routes:
  - `frontend/api/_handlers/uniswap/_quote.ts`
  - `frontend/api/_handlers/uniswap/_swap.ts`
  - `frontend/api/_handlers/uniswap/_swap5792.ts`
  - `frontend/api/_handlers/uniswap/_swap7702.ts`
  - `frontend/api/_handlers/uniswap/_checkDelegation.ts`
- Shared agent skill execution: `frontend/server/uniswap/agentSkills.ts`
- Agent runtime command surface: `frontend/server/agent/eliza/plugins/uniswap/index.ts`
- Judge-friendly command doc: `frontend/docs/eliza-openclaw-uniswap.md`

### ENS / Basename surface

- Browser Basename resolution + profile fetch: `frontend/src/lib/basename-api.ts`
- Server ENS resolution: `frontend/server/_lib/ensResolver.ts`
- Combined onchain identity resolver: `frontend/server/_lib/onchainIdentityProfile.ts`
- Public wallet intelligence route: `frontend/api/_handlers/v1/agents/_wallet-intelligence.ts`
- Portfolio identity hydration:
  - `frontend/api/_handlers/portfolio/_me.ts`
  - `frontend/src/pages/Portfolio.tsx`
- Basename-first DM routing and display:
  - `frontend/src/lib/xmtp/socialIdentity.ts`
  - `frontend/src/components/chat/ChatWidget.tsx`
  - `frontend/src/components/chat/ChatBar.tsx`
  - `frontend/src/components/chat/ChatWindow.tsx`
- Supporting whois command: `frontend/server/keepr/whoisCommand.ts`

Framing note:

- The communication story is strongest as `Basename-first communication on Base`.
- Do not claim fully generic `.eth` recipient composition unless that path is added and demoed.

## Live Proofs Still Required

The repo is implementation-complete enough for the core story, but final submissions still need live artifacts:

- One successful `deploy-run.json`
- One successful `check:agent-discoverability` run against the deployed verification route
- One explorer-visible Uniswap tx hash
- One ENS/Basename-first demo capture:
  - portfolio auto-discovery
  - wallet intelligence output
  - or DM recipient resolution
- One paid x402 settlement proof if you want `Agent Services on Base`
- One defensible profitability proof if you want `Autonomous Trading Agent`

Stretch-track note:

- `Agent Services on Base` is now technically credible because the x402 review route is real and publicly discoverable.
- It should still be dropped unless you attach one real `402 -> settle -> 200` proof from the deployed service.

## Required Environment

Current bundle generation is blocked until these are available:

- `CV_AUTH_SESSION_TOKEN` for deploy autopilot
- `UNISWAP_API_KEY` for live Uniswap proof
- `BASE_RPC_URL`

The checked-in environment already appears to contain the ERC-8004 registry values in `frontend/.env`.

## Evidence File

Fill a local evidence file based on `docs/hackathon/synthesis-evidence.example.json`.

Recommended local path:

- `frontend/artifacts/synthesis-evidence.json`

The bundle generator consumes that file if present and marks each track as either:

- `ready`
- `ready_bonus_gap`
- `needs_live_proof`

## Commands

Run a canonical deploy and capture the audit log:

```bash
pnpm -C frontend run deploy:autopilot -- \
  --origin https://4626.fun \
  --plan ./tmp/deploy-plan-v1.4.7-canary.json \
  --auth-bearer "$CV_AUTH_SESSION_TOKEN" \
  --audit-log ./artifacts/deploy-run.json
```

Generate the submission bundle:

```bash
pnpm -C frontend run synthesis:artifacts -- \
  --audit-log ./artifacts/deploy-run.json \
  --registration ./public/.well-known/agent-registration.json \
  --evidence ./artifacts/synthesis-evidence.json \
  --out-dir ./artifacts/synthesis
```

Validate the repo before packaging:

```bash
pnpm -C frontend check:agent-discoverability
pnpm -C frontend typecheck
pnpm -C frontend test
```

## Generated Bundle

The bundle generator now emits:

- `deploy-run.json`
- `agent-registration.json`
- `erc8004.json`
- `agent.json`
- `agent_log.json`
- `tracks.json`
- `submission-metadata.json`
- `judge-note.md`
- `README.md`

If an evidence file is provided, it also copies:

- `evidence.json`

## Honest Submission Rules

- Submit all core tracks only when their row in `tracks.json` is `ready` or `ready_bonus_gap`.
- Drop `Agent Services on Base` unless a real paid x402 request is captured.
- Drop `Autonomous Trading Agent` unless there is real profitability evidence.
- Do not invent new product narratives for different sponsors. Reuse the same flagship demo and swap only the framing.

## Recommended Demo Order

Use one short judge flow:

1. Show the public registration and API spec.
2. Show the discoverability report and the `check:agent-discoverability` pass.
3. Run or replay the deploy autopilot evidence.
4. Show the generated `agent.json` and `agent_log.json`.
5. Show one live Uniswap proof.
6. Show ENS/Basename-first identity or messaging.
7. If available, show one paid x402 review proof.
