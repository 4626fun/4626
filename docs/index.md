---
title: 4626
sidebar_position: 1
slug: /
hide_table_of_contents: true
audience:
  - developers
stage: use
owner: docs-team
last_reviewed: '2026-06-22'
status: current
---

<div class="docs-home">
  <section class="home-hero">
    <span class="home-hero__eyebrow"><span class="home-hero__dot"></span>Built on Base · ERC-4626</span>
    <h1 class="home-hero__title">The technical manual for <span class="home-hero__title-accent">4626 creator vaults</span>.</h1>
    <p class="home-hero__subtitle">Architecture, contracts, operations, and API references for creator-owned ERC-4626 vault infrastructure on Base. One click deploys the vault, omnichain shares, oracle, and fair-launch auction.</p>
    <div class="home-hero__actions">
      <a class="home-btn home-btn--primary" href="/getting-started">Start with the protocol overview<span class="home-btn__arrow" aria-hidden="true">→</span></a>
      <a class="home-btn home-btn--ghost" href="/contracts">View contract reference</a>
    </div>
    <dl class="home-hero__stats">
      <div class="home-stat"><dt>Base-native</dt><dd>ERC-4626 vaults</dd></div>
      <div class="home-stat"><dt>LayerZero V2</dt><dd>Omnichain OFT shares</dd></div>
      <div class="home-stat"><dt>EIP-4337</dt><dd>Account abstraction</dd></div>
      <div class="home-stat"><dt>Chainlink VRF</dt><dd>Verifiable lottery</dd></div>
    </dl>
  </section>
</div>

## Choose your path

<div class="home-cards">
  <a class="home-card" href="/getting-started">
    <span class="home-card__icon" aria-hidden="true">◗</span>
    <span class="home-card__tag">Start here</span>
    <span class="home-card__title">Getting started</span>
    <span class="home-card__desc">First-time orientation. What 4626 is, how the pieces fit, and where to go next.</span>
  </a>
  <a class="home-card" href="/protocols">
    <span class="home-card__icon" aria-hidden="true">◳</span>
    <span class="home-card__tag">Concepts</span>
    <span class="home-card__title">Protocol overview</span>
    <span class="home-card__desc">The system model — four compressions, three primitives, and how value is captured.</span>
  </a>
  <a class="home-card" href="/architecture">
    <span class="home-card__icon" aria-hidden="true">◈</span>
    <span class="home-card__tag">Mechanics</span>
    <span class="home-card__title">Vault mechanics</span>
    <span class="home-card__desc">Vault, wrapper, OFT shares, strategies, and the gauge/lottery value loop.</span>
  </a>
  <a class="home-card" href="/operators">
    <span class="home-card__icon" aria-hidden="true">⬡</span>
    <span class="home-card__tag">Operations</span>
    <span class="home-card__title">Deployment & ops</span>
    <span class="home-card__desc">Deploy runbooks, release targets, multisig, and reliability procedures.</span>
  </a>
  <a class="home-card" href="/contracts">
    <span class="home-card__icon" aria-hidden="true">⌑</span>
    <span class="home-card__tag">Reference</span>
    <span class="home-card__title">Contracts API</span>
    <span class="home-card__desc">Core, governance, strategy, and utility contracts with Solidity NatSpec.</span>
  </a>
  <a class="home-card" href="/api">
    <span class="home-card__icon" aria-hidden="true">⌥</span>
    <span class="home-card__tag">Reference</span>
    <span class="home-card__title">Frontend / API</span>
    <span class="home-card__desc">TypeScript library, config, wallet, and auth surfaces from TSDoc.</span>
  </a>
  <a class="home-card" href="/security">
    <span class="home-card__icon" aria-hidden="true">⛨</span>
    <span class="home-card__tag">Trust</span>
    <span class="home-card__title">Security & audits</span>
    <span class="home-card__desc">Threat surfaces, mitigations, and external + internal review reports.</span>
  </a>
  <a class="home-card" href="/operations/automation">
    <span class="home-card__icon" aria-hidden="true">⟲</span>
    <span class="home-card__tag">Automation</span>
    <span class="home-card__title">KPR / keepers</span>
    <span class="home-card__desc">Keeper workflows, automation tiers, and completion options.</span>
  </a>
</div>

## What is 4626?

4626 is the Base-native creator finance layer that turns Zora Creator Coins (Coinbase Creator Coins) into composable, onchain creator economies. In one click, creators deploy institutional-grade **ERC-4626 vault** infrastructure (Yearn V3 architecture) with cross-chain **LayerZero V2 OFT** shares, pluggable **yield strategies**, a **6.9% trading-fee lottery** powered by **Chainlink VRF**, fair launch via **Uniswap CCA**, and execution through **EIP-4337** account abstraction optimized for Coinbase Smart Wallet.

<div class="home-features">
  <div class="home-feature">
    <span class="home-feature__title">One-click deployment</span>
    <span class="home-feature__desc">Vault, wrapper, OFT, oracle, and CCA in a single gas-free transaction.</span>
  </div>
  <div class="home-feature">
    <span class="home-feature__title">Omnichain shares</span>
    <span class="home-feature__desc">LayerZero V2 OFT enables share tokens across 8+ chains.</span>
  </div>
  <div class="home-feature">
    <span class="home-feature__title">Pluggable yield</span>
    <span class="home-feature__desc">The ERC-4626 vault supports multiple coordinated strategies.</span>
  </div>
  <div class="home-feature">
    <span class="home-feature__title">Fair launch</span>
    <span class="home-feature__desc">Uniswap Continuous Clearing Auction for transparent price discovery.</span>
  </div>
  <div class="home-feature">
    <span class="home-feature__title">Instant lottery</span>
    <span class="home-feature__desc">A 6.9% fee on trades funds a Chainlink VRF lottery.</span>
  </div>
  <div class="home-feature">
    <span class="home-feature__title">Hardened by design</span>
    <span class="home-feature__desc">Virtual-share offset, flash-loan protection, and anti-whale guards.</span>
  </div>
</div>

## Architecture lenses

The architecture stays organized around two system lenses:

- **Four compressions** — deployment, geography (multichain), distribution (launch), and engagement (game loop).
- **Three primitives** — account, market, and game loop.

If you read nothing else first, read the [wallet architecture](/wallet-architecture) — it defines the canonical CSW, sub-account, and signer roles every other surface depends on.

## Tech stack

<div class="home-chips">
  <span class="home-chip">Solidity 0.8.20</span>
  <span class="home-chip">LayerZero V2</span>
  <span class="home-chip">Chainlink VRF 2.5</span>
  <span class="home-chip">Uniswap V4 CCA</span>
  <span class="home-chip">EIP-4337 / EIP-5792</span>
  <span class="home-chip">Yearn V3 vaults</span>
  <span class="home-chip">Coinbase Smart Wallet</span>
</div>

## First deployment: akita

akita is the first Creator Coin to launch with 4626:

| Item | Value |
|------|-------|
| **Creator Coin** | akita (Base) |
| **Token Address** | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` |
| **Vault Symbol** | ▢AKITA |
| **OFT Symbol** | ■AKITA |
| **DEX Pair** | akita/ZORA (Uniswap V4, 3% fee tier) |

## Quick links

- [Account Model (canonical)](https://github.com/wenakita/4626/blob/main/docs/ACCOUNT_MODEL.md) — single source of truth for user populations, identity invariants, and existing flows
- [Wallet Architecture](/wallet-architecture) — canonical CSW, sub-account, signer roles, and trust boundaries
- [Users](/users) · [Creators](/creators) · [Developers](/developers) · [Protocol Integrators](/protocols) · [Operators/SRE](/operators)
- [Security](/security) · [Audits](/audits) · [API Reference](/api)

## Links

- **Website**: [4626.fun](https://4626.fun)
- **GitHub**: [github.com/wenakita/4626](https://github.com/wenakita/4626)
- **LayerZero**: [docs.layerzero.network](https://docs.layerzero.network)
- **Uniswap CCA**: [cca.uniswap.org](https://cca.uniswap.org)
