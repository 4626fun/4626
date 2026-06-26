---
title: Operations
sidebar_position: 8
doc_template: runbook
applies_to_release: v1.13.x
---

# Operations

Operator runbooks for deploy, keepers, wallet/signing, Solana, and platform infra.

**Start at [Operators / SRE](/operators)** for the eight-link on-ramp, then use the sidebar lanes below.

## Lanes

| Lane | Folder | Start here |
|------|--------|------------|
| **Deploy & release** | `deployment/` | [Deployment](/operations/deployment) · [Releases](/operations/deployment/releases) |
| **Automation & keepers** | `automation/`, `kpr/` | [Automation](/operations/automation) · [Keeper HTTP API](/operations/automation/keeper-http-api) |
| **Wallet & signing** | `wallet/` | [Owner-install methods](/operations/wallet/owner-install-reference-methods) · [CSW recovery](/operations/wallet/csw-recovery-playbook) |
| **Vault & greenfield** | `vault/` | [Greenfield launch readiness](/operations/vault/greenfield-launch-readiness) · [Oracle post-deploy QA](/operations/vault/oracle-post-deploy-qa) |
| **Solana & share mesh** | `solana/` | [Share mesh policy](/operations/solana/solana-share-mesh-lottery-policy) · [Creator provisioning](/operations/solana/solana-share-mesh-creator-provisioning) |
| **AKITA (grandfathered)** | `akita/` | [Full-stack prelaunch](/operations/akita/akita-full-stack-prelaunch) |
| **AlfaClub & agents** | `alfaclub/` | [Counter-trade runbook](/operations/alfaclub/alfaclub-counter-trade-production-runbook) |
| **Analytics & Explore** | `analytics/` | [Explore metrics](/operations/analytics/explore-metrics-operations) · [Dune runbook](/operations/analytics/dune-analytics-runbook) |
| **Platform & database** | `platform/` | [Domain setup](/operations/platform/domain-setup) · [Supabase setup](/operations/platform/supabase-setup) |
| **Telegram & XMTP** | `messaging/` | [Telegram link preservation](/operations/messaging/telegram-canonical-link-preservation) |
| **Archive & retired** | `archive/` | [Archive index](/operations/archive) |

## Agent runtime

XMTP / Eliza production operations: **[Eliza runtime](/operations/deployment/eliza-runtime)**.

## Browse

Runbooks live under lane subfolders (`wallet/`, `vault/`, `solana/`, etc.). The sidebar autogenerates each folder. Use search (⌘K) for one-off lookup.

Legacy flat URLs (`/operations/<name>`) redirect to the new lane paths.

Runbooks tagged `status: historical` are kept for audit context — do not treat them as current production procedure.
