import type {SidebarItemConfig} from '@docusaurus/plugin-content-docs';

function doc(id: string, label?: string): SidebarItemConfig {
  return label ? {type: 'doc', id, label} : {type: 'doc', id};
}

function category(
  label: string,
  items: SidebarItemConfig[],
  linkId?: string,
): SidebarItemConfig {
  return {
    type: 'category',
    label,
    collapsed: true,
    ...(linkId ? {link: {type: 'doc', id: linkId}} : {}),
    items,
  };
}

/** Curated operator runbooks — full tree lives under docs/operations/ (searchable). */
export function buildOperationsSidebarItems(): SidebarItemConfig[] {
  return [
    doc('operations/index', 'Overview'),

    category(
      'Deploy & release',
      [
        doc('operations/deployment/index'),
        doc('operations/deployment/releases/current', 'Current release (v1.14.1)'),
        doc('operations/deployment/pre-launch'),
        doc('operations/deployment/deploy-dry-run-local-fork-invariants', 'Local fork dry-run'),
        doc('operations/deployment/infra-epoch-redeploy'),
        doc('operations/deployment/multisig/guide', 'Multisig (Safe)'),
      ],
      'operations/deployment/index',
    ),

    category(
      'Vault & greenfield',
      [
        doc('operations/vault/greenfield-launch-readiness'),
        doc('operations/vault/creator-strategy-features'),
        doc('operations/vault/oracle-post-deploy-qa'),
        doc('operations/vault/impairment-side-pocket-lifecycle-drill', 'Impairment drill'),
      ],
      'operations/vault/greenfield-launch-readiness',
    ),

    category(
      'Automation & keepers',
      [
        doc('operations/automation/index'),
        doc('operations/automation/keeper-http-api'),
        doc('operations/automation/keeper-job-coordination'),
        doc('operations/automation/vercel-cron-production-fixes', 'Vercel cron'),
      ],
      'operations/automation/index',
    ),

    category('Wallet & signing', [
      doc('operations/wallet/csw-recovery-playbook'),
      doc('operations/wallet/sponsored-canonical-swap-pattern'),
      doc('operations/wallet/privy-wallet-lanes'),
      doc('operations/wallet/relay-owner-mutation-kit-guide', 'Relay owner mutations'),
    ]),

    category('Solana & share mesh', [
      doc('operations/solana/solana-share-mesh-lottery-policy'),
      doc('operations/solana/solana-bridge-naming-invariant'),
      doc('operations/solana/solana-share-mesh-creator-provisioning', 'Creator provisioning'),
    ]),

    category('Platform', [
      doc('operations/platform/supabase-setup'),
      doc('operations/platform/domain-setup'),
      doc('operations/platform/supabase-schema-condensation', 'Schema migrations'),
    ]),

    doc('operations/messaging/telegram-canonical-link-preservation', 'Telegram linking'),
    doc('operations/deployment/eliza-runtime', 'XMTP / Eliza runtime'),
  ];
}
