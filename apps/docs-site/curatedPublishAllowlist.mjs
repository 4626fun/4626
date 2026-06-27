/**
 * Public docs allowlist — paths under `docs/` copied when DOCS_PUBLISH_CURATED=1.
 * Keep aligned with `sidebars.ts` + `src/lib/operationsSidebar.ts`.
 */
export const CURATED_PUBLISH_GLOBS = [
  'index.md',
  'PUBLISHING.md',
  '4626-connection-methods.md',
  'ACCOUNT_MODEL.md',
  'wallet-architecture.md',

  'getting-started/**',

  'overview/reading-order.md',
  'overview/architecture.md',
  'overview/token-model.md',
  'overview/fee-flow.md',

  'guides/index.md',
  'guides/launch-token.md',
  'guides/activate-vault.md',
  'guides/troubleshooting/index.md',
  'guides/troubleshooting/activate-account-signing.md',
  'guides/troubleshooting/userop-signature-errors.md',
  'guides/troubleshooting/delayed-completion.md',

  'users/explore-analytics.md',
  'frontend/creator-workspace.md',

  'reference/index.md',
  'reference/addresses.md',
  'reference/current-contract-inventory.md',
  'reference/glossary.md',
  'reference/chains.md',
  'reference/erc4337-debugging.md',

  'contracts/index.md',
  'contracts/core/creator-ovault.md',
  'contracts/core/creator-share-oft.md',
  'contracts/core/creator-ovault-wrapper.md',
  'contracts/governance/gauge-controller.md',
  'contracts/strategies/cca-launch.md',
  'contracts/utilities/lottery-manager.md',

  'concepts/vault.md',
  'concepts/lottery.md',
  'concepts/auction.md',

  'developers/api-reference.md',

  'operators/index.md',

  'operations/index.md',
  'operations/deployment/index.md',
  'operations/deployment/pre-launch.md',
  'operations/deployment/deploy-dry-run-local-fork-invariants.md',
  'operations/deployment/infra-epoch-redeploy.md',
  'operations/deployment/multisig/guide.md',
  'operations/deployment/eliza-runtime.md',
  'operations/deployment/releases/index.md',
  'operations/deployment/releases/current.md',

  'operations/vault/greenfield-launch-readiness.md',
  'operations/vault/creator-strategy-features.md',
  'operations/vault/oracle-post-deploy-qa.md',
  'operations/vault/impairment-side-pocket-lifecycle-drill.md',

  'operations/automation/index.md',
  'operations/automation/keeper-http-api.md',
  'operations/automation/keeper-job-coordination.md',
  'operations/automation/vercel-cron-production-fixes.md',

  'operations/wallet/csw-recovery-playbook.md',
  'operations/wallet/sponsored-canonical-swap-pattern.md',
  'operations/wallet/privy-wallet-lanes.md',
  'operations/wallet/relay-owner-mutation-kit-guide.md',

  'operations/solana/solana-share-mesh-lottery-policy.md',
  'operations/solana/solana-bridge-naming-invariant.md',
  'operations/solana/solana-share-mesh-creator-provisioning.md',

  'operations/platform/supabase-setup.md',
  'operations/platform/domain-setup.md',
  'operations/platform/supabase-schema-condensation.md',

  'operations/messaging/telegram-canonical-link-preservation.md',

  'security/index.md',
  'security/4626-agent-security-model.md',
  'security/mutable-surface-inventory.md',

  'audits/README.md',
  'audits/x-ray/contract-audit-pass-2026-06.md',

  'legal/terms.md',
  'legal/privacy.md',
];
