---
title: Describe project 4626
sidebar_label: d9895cc0…
sidebar_position: 99
hide_table_of_contents: true
last_updated: '2026-06-28'
audience:
  - developers
  - protocols
stage: use
owner: docs-team
last_reviewed: '2026-06-28'
status: current
---
<div class="audit-transcript-meta">
[← Source sessions](/audits/fable/key-sessions) · [Transcript archive](/audits/fable/transcripts) · [Executive summary](/audits/fable/findings-summary)
</div>
# Describe project 4626
| Field | Value |
| --- | --- |
| Session ID | `d9895cc0-8426-4918-9b67-7c504afa28f5` |
| Record type | Lead review session export |
:::note Appendix record
Readable export of a supplementary review session. Tool outputs and system context are omitted; download the [JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.
:::
## Engagement brief

<timestamp>Tuesday, Jun 9, 2026, 8:42 AM (UTC-7)</timestamp>
how would you describe this project 4626 in a few sentences?

## Analysis

`4626` is a full-stack crypto product monorepo centered on creator vaults: creators launch ERC-4626-style vault infrastructure on Base, route value across strategies, and expose tokenized participation lanes (creator coin + share token).  
It combines a Vite/React frontend (`frontend/`), Solidity contracts (`contracts/`), and backend/automation surfaces (Vercel APIs, keeper/agent workflows, XMTP/Telegram integrations) to handle onboarding, deployment, trading/swap, and operations.  
A big architectural theme is strict account/wallet policy: a canonical Coinbase Smart Wallet per account, with carefully separated signer roles for user execution vs server automation.  
There’s also a cross-chain/ops layer (including Solana bridge/keeper paths), so it’s not just a dApp UI—it’s an opinionated production platform for deploying and running creator financial infrastructure.

## Engagement brief

<timestamp>Tuesday, Jun 9, 2026, 8:43 AM (UTC-7)</timestamp>
and u forgot the lottery aspect

## Analysis

You’re right — lottery is a core pillar here.

`4626` is a creator-vault platform on Base that combines vault deployment, tokenized creator economics, and an integrated lottery/rewards system. In practice, it spans Solidity contracts, a React/Vite app, backend automation, and keeper/agent workflows that coordinate deployment, swaps, payouts, and ongoing ops.

The lottery side is not just cosmetic: it has dedicated flows for entries, randomness/settlement infrastructure, and cross-system relay paths (including Solana-related keeper orchestration), tied into the broader creator/share-token lifecycle. So the project is best described as a production-grade vault + creator market + lottery stack, with strict wallet/account invariants and heavy operational automation.

## Engagement brief

<timestamp>Tuesday, Jun 9, 2026, 8:44 AM (UTC-7)</timestamp>
it also includes ve(3,3) type of mechanism except we use burning of share tokens rather than emissoins

## Analysis

Exactly — that’s a strong way to frame the protocol economics.

A tighter description would be: `4626` is a creator-vault + tokenized market system with a **ve(3,3)-inspired incentive architecture**, but instead of classic emissions inflation, it drives value through **share-token burn mechanics** (with lottery/reward flows layered in).  
So the flywheel is closer to: trading/activity -> fee/value capture -> burn/deflationary pressure + reward routing, rather than “mint more tokens and distribute emissions.”

That makes the project distinct from standard ve-token systems: it keeps coordination/game-theory structure, but swaps inflationary issuance for burn-based supply pressure and vault-linked value accrual.

