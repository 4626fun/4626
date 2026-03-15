# 4626 Synthesis Win Plan (5 Days)

## Goal

Ship one submission that is easy to judge, hard to dismiss, and competitive across:

1. Synthesis Open Track
2. Agents With Receipts (ERC-8004)
3. Let the Agent Cook (No Humans Required)
4. Uniswap Agentic Finance

## Core Story

"4626 Agent autonomously launches creator vaults with ERC-4337 execution, verifies launch correctness onchain, and emits receipt-grade artifacts (`agent.json`, `agent_log.json`, and tx evidence) for judges."

## Day-by-Day Plan

### Day 1 - Evidence Pipeline (Must-Have)

- Add machine-readable deploy run logging from autopilot.
- Generate submission artifacts from run logs:
  - `agent.json` (manifest)
  - `agent_log.json` (execution trace)
  - `submission-metadata.json` (track/evidence summary)
- Lock one canonical demo flow and parameters for repeatability.

### Day 2 - Autonomous Loop Quality

- Ensure visible discover -> plan -> execute -> verify loop in artifacts.
- Add explicit guardrails for irreversible actions in logs (validation before send).
- Add retry/failure traces for resilience proof (not just happy path).

### Day 3 - Uniswap + Launch Readiness Proof

- Produce one clean launch run with:
  - launch image gate confirmed
  - strategy deployment verified
  - CCA launch confirmed
- Capture and pin all tx hashes/userOp hashes and final status payload.

### Day 4 - Submission Packaging

- Prepare a judge-first README section:
  - what was built
  - why it matters
  - exact run commands
  - evidence links
- Record a 2-3 minute demo video showing end-to-end behavior.
- Prepare concise architecture diagram and guardrail explanation.

### Day 5 - Final Polish + Dry Runs

- Run full end-to-end flow 2-3 times and pick the cleanest evidence set.
- Verify all links/files/commands from a fresh environment.
- Finalize metadata and submit with no missing artifacts.

## Execution Checklist

- [ ] Autopilot run log exported to JSON
- [ ] `agent.json` generated and checked
- [ ] `agent_log.json` generated and checked
- [ ] `submission-metadata.json` generated and checked
- [ ] One successful canonical run captured with full receipts
- [ ] Demo video recorded
- [ ] Final submission text completed

## Commands

Run deploy autopilot with evidence logging:

```bash
pnpm -C frontend run deploy:autopilot -- \
  --origin http://localhost:5174 \
  --plan ./path/to/deploy-plan.json \
  --auth-bearer "$CV_AUTH_SESSION_TOKEN" \
  --audit-log ./artifacts/deploy-run.json
```

Generate Synthesis submission artifacts:

```bash
pnpm -C frontend run synthesis:artifacts -- \
  --audit-log ./artifacts/deploy-run.json \
  --registration ./public/.well-known/agent-registration.json \
  --out-dir ./artifacts/synthesis
```

## Risk Controls

- Keep scope fixed to one flagship flow.
- Prioritize observable evidence over new feature breadth.
- If a run fails, keep failure logs and recovery logs as proof of autonomous handling.

## Definition of Done

A reviewer can clone the repo, run one command sequence, and independently verify:

1. autonomous execution occurred,
2. onchain outcomes are real,
3. constraints/guardrails were enforced,
4. artifacts satisfy judge requirements.
