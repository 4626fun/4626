---
title: Deployment
sidebar_position: 1
---

# Deployment

Guides for deploying 4626 protocol contracts.

---

## Guides

| Guide | Description |
|-------|-------------|
| [Pre-launch](./pre-launch) | Checklist before deployment |
| [CREATE2 Registry](./create2-registry) | Deterministic addresses |
| [CCA Verification](./cca-verification) | Verify CCA deployments |
| [Approvals Checklist](./approvals-checklist) | Required approvals |
| [Launch Verification](./launch/verification) | Post-launch verification |

---

## Multisig

| Guide | Description |
|-------|-------------|
| [Multisig Guide](./multisig/guide) | Overview of multisig setup |
| [Multisig Deployment](./multisig/deployment) | Deploy multisig |
| [Owner Setup](./multisig/owner-setup) | Configure owners |

---

## Deployment flow

```
1. Pre-launch checks
    │
    ▼
2. Deploy core contracts (CREATE2)
    │
    ▼
3. Configure multisig ownership
    │
    ▼
4. Set approvals and permissions
    │
    ▼
5. Verify all contracts
    │
    ▼
6. Launch CCA (if applicable)
    │
    ▼
7. Post-launch verification
```

---

## Quick links

- [Deploy Vault Guide](/guides/deploy-vault)
- [Activate Vault Guide](/guides/activate-vault)
- [Launch Token Guide](/guides/launch-token)

---

## Related

- [Automation](/operations/automation) - Keeper setup
- [Reference](/reference) - Contract addresses
