---
name: vault-deployment
description: Deploy 4626 vault infra — CreatorOVault, ShareOFT, gauge, CCA, DeploymentBatcher.
paths: contracts/**, frontend/src/pages/deploy/**, script/**
---

# Vault deployment (4626)

**Archive:** `docs/agent-context/archives/vault-deployment-ops.md`  
**Product invariants:** `docs/agent-context/archives/deploy-cutovers-vault.md`  
**Rule:** `.cursor/rules/deploy-ops.mdc`

Preflight read-only first. Never paste private keys. Multi-phase path: `DeploymentBatcher.sol` Phase 1–3.
