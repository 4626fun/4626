# Onchain Reputation And Wallet Intelligence

This document describes the current reputation/intelligence surfaces in `frontend/`.
It replaces older scoring-model docs that referenced removed modules.

## Canonical API surfaces

- `GET|POST /api/lens/reputation-graph`
  - Handler: `frontend/api/_handlers/lens/_reputation-graph.ts`
  - Builds an ERC-8004 reputation graph from onchain feedback.
  - Optional Grove upload is available when `store=true` and the caller is authenticated.
- `GET|POST /api/v1/agents/wallet-intelligence`
  - Handler: `frontend/api/_handlers/v1/agents/_wallet-intelligence.ts`
  - Builds a wallet-intelligence graph (funder trace, labels, ENS/basename/lens, portfolio).
  - Supports optional cache bypass (`noCache=true`) and optional Grove upload (`store=true`).
- `GET|POST /api/v1/agents/feedback/*`
  - Handlers:
    - `frontend/api/_handlers/v1/agents/feedback/_read.ts`
    - `frontend/api/_handlers/v1/agents/feedback/_submit.ts`
    - `frontend/api/_handlers/v1/agents/feedback/_review.ts`
  - Provides read/submit/review flows around ERC-8004 feedback.

## Core server modules

- Reputation graph builder: `frontend/server/_lib/lens/reputationGraph.ts`
- Wallet intelligence builder: `frontend/server/_lib/wallet/walletIntelligence.ts`
- Wallet intelligence cache: `frontend/server/_lib/wallet/walletIntelligenceCache.ts`
- ERC-8004 operator/review helpers:
  - `frontend/server/_lib/agent/erc8004.ts`
  - `frontend/server/_lib/agent/erc8004Review.ts`
  - `frontend/server/_lib/agent/erc8004OperatorStatus.ts`

## Data sources and enrichment paths

- Talent enrichment (optional, proxied server-side):
  - Client: `frontend/src/lib/talent-api.ts`
  - API proxy: `frontend/api/_handlers/social/_talent.ts`
- DeBank enrichment (optional, proxied server-side):
  - Client: `frontend/src/lib/debank/client.ts`
  - API proxies:
    - `frontend/api/_handlers/debank/_totalBalanceBatch.ts`
    - `frontend/api/_handlers/debank/_tokenList.ts`
- Basename resolution:
  - Client helper: `frontend/src/lib/basename-api.ts`
  - Server resolver: `frontend/server/_lib/identity/basenameResolver.ts`

## Runtime guardrails

- Reputation and wallet-intelligence routes are treated as agent API surfaces and pass through shared request guards/rate limiting.
- Wallet-intelligence `chainIds` are normalized and constrained by the endpoint implementation.
- Talent/DeBank enrichment is best-effort; failures should degrade gracefully instead of blocking core flows.

## Notes for updates

- If you add new intelligence/reputation fields, update both:
  - the server graph builder(s), and
  - the corresponding API discovery metadata in handlers.
- Keep this doc aligned to existing file paths and endpoints only; avoid speculative architecture sections.
