# Deploy Cutovers (archive index)

Cross-cutting operator prefs: [preferences-active.md](../preferences-active.md).

**Load one sub-archive only.**

| Sub-archive | Load when |
|-------------|-----------|
| [deploy-cutovers-core.md](./deploy-cutovers-core.md) | Greenfield cutover scripts, epoch, bytecode store, env guards, batcher addresses |
| [deploy-cutovers-vault.md](./deploy-cutovers-vault.md) | DeployVault UI, strategy features, Phase 1–5, vanity, impairment |
| [deploy-cutovers-prefs.md](./deploy-cutovers-prefs.md) | Deploy UX/docs copy preferences |

Validate: `pnpm -C frontend validate:deploy-guards`. Template: `.cursor/commands/deploy-cutover.md`.

