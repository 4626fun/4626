---
title: Fable session index
sidebar_label: Session index
sidebar_position: 3
last_updated: '2026-06-28'
audience:
  - developers
stage: use
owner: docs-team
last_reviewed: '2026-06-28'
status: current
---

# Fable session index — June 2026

**Model billed:** `claude-fable-5-thinking-high` (Cursor on-demand)
**Source of truth:** Cursor usage export `usage-events-2026-06-28.csv`
**Published transcripts:** [Readable archive](/audits/fable/transcripts) · [Raw JSONL ZIP](/audits/fable-chats-4626-2026-06.zip)
**Generated:** 2026-06-28 (correlated from billing + local agent transcripts)

---

## Summary

| Period | Fable events | Tokens (approx.) | On-demand cost |
| --- | ---: | ---: | ---: |
| 2026-06-09 | 28 | 131.3M | **$182.32** |
| 2026-06-10 | 70 | 363.2M | **$588.71** |
| 2026-06-11 | 11 | 53.0M | **$88.52** |
| 2026-06-12 | 165 | 590.7M | **$995.37** |
| 2026-06-13–15 | 3 | — | $0.00 (errored, post-suspension) |
| **Total** | **277** | **~1.14B** | **$1,854.92** |

Subagents in the same sessions typically billed as `composer-2.5-fast` (not included above).

**Related deliverable:** [Full-codebase review](/audits/fable/full-repo-review-2026-06) (session `0a513245…`).

---

## Reading sessions

Each session ID links to a **readable transcript page**. For machine-readable logs, download [fable-chats-4626-2026-06.zip](/audits/fable-chats-4626-2026-06.zip). The full table of all 99 sessions is on the [transcript archive](/audits/fable/transcripts) page.

---

## Top Fable spend (by billing cluster)

| Est. Fable | Window (PT) | Primary chat(s) |
| ---: | --- | --- |
| ~$869 | Jun 11 10:32 PM – Jun 12 9:09 AM | `7afad2db…`, `d6b4e576…`, `93c08966…`, + parallel Jun 12 threads |
| ~$203 | Jun 9 10:18 PM – 11:54 PM | `6318a55b-12e4-4cd3-8b37-fd29f819e9a3` |
| ~$180 | Jun 10 10:35 AM – 12:34 PM | `ab4dea2d…`, `961d9888…` (AveryRX project) |
| ~$157 | Jun 9 11:06 AM – 12:33 PM | `0a513245…`, `c603521c…` |
| ~$85 | Jun 10 5:52 AM – 6:02 AM | `059adbec…` (incl. ~$61 single event) |

---

## 2026-06-09 — $182.32

### Repo review (main audit)

| Chat | Msgs | Subagents | Opening prompt |
| --- | ---: | ---: | --- |
| [0a513245…](/audits/fable/transcripts/full-codebase-review-primary-audit-0a513245) | 155 | 8 | Full-codebase review prompt (Fable 5 / Claude Code template) → `full-repo-review-2026-06.md` |
| [c603521c…](/audits/fable/transcripts/security-pass-on-full-codebase-review-c603521c) | 88 | 0 | Security pass of full-codebase review |

**Repo review subagents** (parent `0a513245…`):

| Subagent | ID |
| --- | --- |
| Architecture | [b8ddd1b3…](/audits/fable/transcripts/b8ddd1b3-72ff-4e86-a662-31bbc98fa14f) |
| CI/CD | [c1a231e1…](/audits/fable/transcripts/c1a231e1-de11-411d-9fae-9dd6981163e4) |
| Frontend | [6c9354f7…](/audits/fable/transcripts/6c9354f7-23f9-4069-8ad6-106b0e138461) |
| Data layer | [5a3eda06…](/audits/fable/transcripts/5a3eda06-c544-4d15-b56a-16f6c832cc10) |
| Security | [c603521c…](/audits/fable/transcripts/security-pass-on-full-codebase-review-c603521c) |
| Contracts | [071ad150…](/audits/fable/transcripts/071ad150-5d45-4752-a7e4-bb06af78f8b8) |
| Other | [11502b9b…](/audits/fable/transcripts/11502b9b-3fec-4e23-b352-9f81c31f7aa5) |
| Other | [fba285d6…](/audits/fable/transcripts/fba285d6-1444-4d1a-a56c-0a74fb4deeaf) |

### Other 4626 chats (same day)

| Chat | Msgs | Opening prompt |
| --- | ---: | --- |
| [2f3a0cb7…](/audits/fable/transcripts/static-scan-deeper-review-2f3a0cb7) | 332 | Static scan / deeper review question |
| [db706ee8…](/audits/fable/transcripts/security-txt-program-db706ee8) | 249 | Program has no security.txt |
| [8c6a3f58…](/audits/fable/transcripts/8c6a3f58-f844-434f-9504-951aefd5fb85) | 242 | Hyperliquid markets research |
| [4adf41a3…](/audits/fable/transcripts/premium-waitlist-page-4adf41a3) | 224 | Premium waitlist page |
| [f00a1d5f…](/audits/fable/transcripts/f00a1d5f-d667-4034-96c7-ee2e5af55776) | 86 | Re-order chats (Agents on top) |
| [146c9c1a…](/audits/fable/transcripts/146c9c1a-96c0-43f3-bdc2-8c0e369cfd8d) | 30 | Waitlist chat fix |
| [c7859baf…](/audits/fable/transcripts/c7859baf-dfb7-44b0-9a35-3fb692519584) | 26 | Vanity WASM TS fixes |
| [d9895cc0…](/audits/fable/transcripts/d9895cc0-8426-4918-9b67-7c504afa28f5) | 9 | Describe project 4626 |

### Other project (same day)

| Chat | Project | Msgs | Opening prompt |
| --- | --- | ---: | --- |
| `a9c4ea57…` | AveryRXTerminal | 239 | AWS sample-cre-pricefeeds repo usefulness |

**Transcript paths (4626):** `~/projects/4626` → `~/.cursor/projects/home-akitav2-projects-4626/agent-transcripts/`

---

## 2026-06-10 — $588.71

| Chat | Msgs | Sub | Opening prompt |
| --- | ---: | ---: | --- |
| [6318a55b…](/audits/fable/transcripts/production-readiness-planning-6318a55b) | 1233 | 6 | **How do I get from where we are now, to full production?** |
| [059adbec…](/audits/fable/transcripts/full-repo-review-follow-up-059adbec) | 461 | 6 | Follow-up on `@docs/audits/full-repo-review-2026-06.md` |
| [ab4dea2d…](/audits/fable/transcripts/erc-4337-userop-swap-routing-debug-ab4dea2d) | 382 | 1 | ERC-4337 UserOp failed / swap routing |
| [7936fbaa…](/audits/fable/transcripts/7936fbaa-22e7-4755-ae6c-63fe1065b057) | 265 | 1 | Reset local XMTP state |
| [15788875…](/audits/fable/transcripts/15788875-3f6f-4ac9-9576-997ef749f267) | 39 | 0 | Watch GitHub Actions CI |
| [293bb214…](/audits/fable/transcripts/293bb214-a298-4283-93d8-5c856c433a01) | 29 | 1 | Zora auth failed |
| [a137354e…](/audits/fable/transcripts/a137354e-3778-4401-9e5e-2bd4be691a10) | 28 | 0 | requestProvider.js ethereum error |
| [511645df…](/audits/fable/transcripts/511645df-9bc6-46ac-9f16-a6efa81fbf1e) | 15 | 0 | CI report — main @ wenakita/4626 |
| [f83f9e53…](/audits/fable/transcripts/f83f9e53-e4c5-481d-801c-a16939d00efa) | 10 | 0 | Fix swap please |

**Production-readiness subagents** (parent `6318a55b…`):

| Subagent ID |
| --- |
| [3cbcf31b…](/audits/fable/transcripts/3cbcf31b-1c21-4d31-8061-bb9f497bd366) |
| [8890649f…](/audits/fable/transcripts/8890649f-7a9f-4a75-aa17-47844d45d5e8) |
| [8b6588a3…](/audits/fable/transcripts/8b6588a3-6506-481b-989a-b992a6be23c5) |
| [9458c1b3…](/audits/fable/transcripts/9458c1b3-4c25-4869-94aa-a174ec975220) |
| [cc8287ba…](/audits/fable/transcripts/cc8287ba-748b-437b-9ffe-4f3d02062f38) |
| [f198e761…](/audits/fable/transcripts/f198e761-0a0d-430b-89e9-582aa3bc2633) |

### AveryRXTerminal (same billing day)

| Chat | Msgs | Sub | Opening prompt |
| --- | ---: | ---: | --- |
| `961d9888…` | 351 | 6 | Repo-review prompt for `wenakita/AveryRXTerminal` |

Path: `~/.cursor/projects/home-akitav2-projects-AveryRXTerminal/agent-transcripts/`

---

## 2026-06-11 — $88.52

Few new transcripts started this day; Fable spend mostly continued **long-running sessions** from Jun 10.

| Chat | Msgs | Notes |
| --- | ---: | --- |
| [683bffa0…](/audits/fable/transcripts/counter-trading-bot-683bffa0) | 1584 | Counter-trading bot (Jun 10–13; transcript mtime Jun 13) |
| [7afad2db…](/audits/fable/transcripts/privy-csp-frame-ancestors-7afad2db) | 544 | Privy CSP / `frame-ancestors` |
| [93b5758d…](/audits/fable/transcripts/93b5758d-201f-4f3a-976a-c6613d50dd6b) | 120 | Ready to deploy vault into production? |
| [ea7889ac…](/audits/fable/transcripts/ea7889ac-d835-4a3d-b5a7-a8afa0dde164) | 88 | Hermit4626 triplicated AlfaClub messages |
| [28561396…](/audits/fable/transcripts/28561396-9d5f-4896-aabd-a3facc865cc4) | 30 | Raw digest signing / CSW |

---

## 2026-06-12 — $995.37

Largest Fable day (~54% of total spend). Global Fable access suspended later this day (Jun 12 evening PT).

| Chat | Msgs | Sub | Opening prompt |
| --- | ---: | ---: | --- |
| [7afad2db…](/audits/fable/transcripts/privy-csp-frame-ancestors-7afad2db) | 544 | 5 | Privy CSP framing error |
| [d6b4e576…](/audits/fable/transcripts/deploy-vault-page-redesign-d6b4e576) | 365 | 2 | Deploy Vault page redesign |
| [bf2f96cc…](/audits/fable/transcripts/solana-explorer-verified-build-bf2f96cc) | 352 | 1 | Solana explorer verified build |
| [93c08966…](/audits/fable/transcripts/supabase-ethos-tables-93c08966) | 320 | 1 | Supabase Ethos tables |
| [5596f8da…](/audits/fable/transcripts/swap-failures-investigation-5596f8da) | 176 | 1 | Swaps failing |
| [a056e98e…](/audits/fable/transcripts/a056e98e-f779-4ede-ba23-0c5ce06b8636) | 160 | 1 | Creator coin payout recipient |
| [93b5758d…](/audits/fable/transcripts/93b5758d-201f-4f3a-976a-c6613d50dd6b) | 120 | 0 | Vault production readiness |
| [ea7889ac…](/audits/fable/transcripts/ea7889ac-d835-4a3d-b5a7-a8afa0dde164) | 88 | 0 | Hermit4626 triplicated messages |
| [393f4908…](/audits/fable/transcripts/393f4908-393d-4e1c-9c1b-22df9552cdc9) | 79 | 1 | Raw digest signing still failed |
| [8eaaa66b…](/audits/fable/transcripts/8eaaa66b-7a56-4236-9907-febd642048c5) | 72 | 0 | Solana side ready for deploy |
| [044bb5cf…](/audits/fable/transcripts/044bb5cf-385e-416c-9adc-388f83a4fce9) | 62 | 0 | ElizaOS for Virtuals agent |
| [1eb64ae7…](/audits/fable/transcripts/1eb64ae7-ef02-4611-8348-168dc505c6de) | 55 | 0 | 8004scan agents confusion |
| [ef797429…](/audits/fable/transcripts/ef797429-1688-48e3-95cd-ebe632980585) | 43 | 0 | Zora auth failed |
| [9199b051…](/audits/fable/transcripts/9199b051-0b20-44b2-b326-9900e239a68c) | 36 | 0 | Privy setup struggles |
| [28561396…](/audits/fable/transcripts/28561396-9d5f-4896-aabd-a3facc865cc4) | 30 | 0 | CSW raw digest signing |
| [6d75f403…](/audits/fable/transcripts/6d75f403-a5b4-4f45-b928-bf2116a7196a) | 16 | 0 | injected is not defined |
| [c16ed264…](/audits/fable/transcripts/c16ed264-3756-401a-b489-7e5cd345462c) | 14 | 0 | chrome-error / swap page |
| [1ca6caf1…](/audits/fable/transcripts/1ca6caf1-3578-4a79-b3b5-2168fc4fa255) | 10 | 0 | Git error |
| [ca7317af…](/audits/fable/transcripts/ca7317af-9c86-4fde-a453-5b3c220ff600) | 12 | 0 | Zora auth (short) |
| [f2b45214…](/audits/fable/transcripts/f2b45214-e1b0-4d22-85f9-8a7f49492e69) | 13 | 0 | App loading overlay |
| [0490d6d1…](/audits/fable/transcripts/0490d6d1-461b-4d8a-b26a-91164453ab90) | 9 | 0 | Vite / wallet session |
| [44ac1198…](/audits/fable/transcripts/44ac1198-bead-406a-8f55-e75560150a12) | 10 | 0 | Raw digest signing |

---

## Post-suspension (errored, $0)

| Date | Notes |
| --- | --- |
| 2026-06-13 | 2× `claude-fable-5-thinking-high` — Errored, No Charge |
| 2026-06-15 | 1× — Errored, No Charge |

---

## Methodology notes

1. **Billing** — summed `Cost` for rows where `Model` contains `fable` in the usage CSV.
2. **Chat correlation** — matched Fable billing clusters (25-minute gap) to agent transcripts by file mtime and embedded `<timestamp>` tags under `~/.cursor/projects/*/agent-transcripts/`.
3. **Limits** — parent composer model is not stored in transcript JSONL; Fable slug appears only in billing. Some Fable spend (~$25 on Jun 9 ~4 PM PT) has no transcript within ±2 hours. Subagent turns bill separately as `composer-2.5-fast`.

---

## Key sessions

| Topic | Transcript |
| --- | --- |
| Full repo review | [0a513245…](/audits/fable/transcripts/full-codebase-review-primary-audit-0a513245) |
| Production readiness | [6318a55b…](/audits/fable/transcripts/production-readiness-planning-6318a55b) |
| Review follow-up | [059adbec…](/audits/fable/transcripts/full-repo-review-follow-up-059adbec) |
| ERC-4337 / swap debug | [ab4dea2d…](/audits/fable/transcripts/erc-4337-userop-swap-routing-debug-ab4dea2d) |
| Privy CSP | [7afad2db…](/audits/fable/transcripts/privy-csp-frame-ancestors-7afad2db) |
| Counter-trading bot | [683bffa0…](/audits/fable/transcripts/counter-trading-bot-683bffa0) |
