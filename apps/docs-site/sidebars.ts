import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Sidebar configuration for 4626 docs.
 *
 * Primary navigation is persona-first:
 * Users, Creators, Developers, Protocol Integrators, Operators/SRE.
 * Security/Audits remain top-level trust surfaces and API stays standalone.
 */
const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'doc',
      id: 'index',
      label: 'Welcome',
    },

    {
      type: 'category',
      label: 'Users',
      collapsed: false,
      link: { type: 'doc', id: 'users/index' },
      items: [
        'getting-started/index',
        {
          type: 'category',
          label: 'Guides',
          link: { type: 'doc', id: 'guides/index' },
          items: [
            'guides/launch-token',
            'guides/deploy-vault',
            'guides/activate-vault',
            {
              type: 'category',
              label: 'Troubleshooting',
              link: { type: 'doc', id: 'guides/troubleshooting/index' },
              items: [
                'guides/troubleshooting/compilation-status',
                'guides/troubleshooting/delayed-completion',
                'guides/troubleshooting/userop-signature-errors',
              ],
            },
          ],
        },
        'legal/index',
      ],
    },

    {
      type: 'category',
      label: 'Creators',
      collapsed: true,
      link: { type: 'doc', id: 'creators/index' },
      items: [
        'guides/launch-token',
        'guides/deploy-vault',
        'guides/activate-vault',
        'frontend/creator-workspace',
        {
          type: 'category',
          label: 'Featured Guidelines',
          items: [
            'guides/featured-guidelines/featured-checklist',
            'guides/featured-guidelines/product-guidelines',
            'guides/featured-guidelines/design-guidelines',
            'guides/featured-guidelines/technical-guidelines',
            'guides/featured-guidelines/notification-guidelines',
          ],
        },
        'governance/index',
        'tokenomics/index',
      ],
    },

    {
      type: 'category',
      label: 'Developers',
      collapsed: true,
      link: { type: 'doc', id: 'developers/index' },
      items: [
        'frontend/index',
        'frontend/creator-workspace-implementation-plan',
        'architecture/index',
        {
          type: 'category',
          label: 'Reference',
          link: { type: 'doc', id: 'reference/index' },
          items: [
            'reference/account-context',
            'reference/chains',
            'reference/erc4337-debugging',
            'reference/current-contract-inventory',
            'reference/diagram-style-guide',
          ],
        },
        'api/index',
      ],
    },

    {
      type: 'category',
      label: 'Protocol Integrators',
      collapsed: true,
      link: { type: 'doc', id: 'protocols/index' },
      items: [
        {
          type: 'category',
          label: 'Integrations',
          link: { type: 'doc', id: 'integrations/index' },
          items: [
            'integrations/oft',
            'integrations/lens',
            'integrations/lens-grove',
            'integrations/solana-integration',
            'integrations/solana-spoke-article',
          ],
        },
        {
          type: 'category',
          label: 'System Model',
          items: [
            'compressions/index',
            'compressions/deployment',
            'compressions/geography',
            'compressions/distribution',
            'compressions/engagement',
            'compressions/reading-order',
            'primitives/index',
            'primitives/account',
            'primitives/market/index',
            'primitives/market/vault',
            'primitives/market/auction',
            'primitives/game-loop/index',
            'primitives/game-loop/lottery',
          ],
        },
        {
          type: 'category',
          label: 'Contracts',
          link: { type: 'doc', id: 'contracts/index' },
          items: [
            {
              type: 'category',
              label: 'Core',
              link: { type: 'doc', id: 'contracts/core/index' },
              items: [
                'contracts/core/creator-registry',
                'contracts/core/creator-ovault',
                'contracts/core/creator-ovault-wrapper',
                'contracts/core/creator-share-oft',
              ],
            },
            {
              type: 'category',
              label: 'Governance',
              link: { type: 'doc', id: 'contracts/governance/index' },
              items: [
                'contracts/governance/gauge-controller',
                'contracts/governance/vault-gauge-voting',
                'contracts/governance/ve4626',
                'contracts/governance/voter-rewards-distributor',
              ],
            },
            {
              type: 'category',
              label: 'Strategies',
              link: { type: 'doc', id: 'contracts/strategies/index' },
              items: [
                'contracts/strategies/base-creator-strategy',
                'contracts/strategies/cca-launch',
              ],
            },
            {
              type: 'category',
              label: 'Utilities',
              link: { type: 'doc', id: 'contracts/utilities/index' },
              items: [
                'contracts/utilities/lottery-manager',
                'contracts/utilities/creator-oracle',
              ],
            },
          ],
        },
        'api/index',
      ],
    },

    {
      type: 'category',
      label: 'Operators/SRE',
      collapsed: true,
      link: { type: 'doc', id: 'operators/index' },
      items: [
        'operations/index',
        {
          type: 'category',
          label: 'Deployment',
          link: { type: 'doc', id: 'operations/deployment/index' },
          items: [
            'operations/deployment/pre-launch',
            'operations/deployment/cca-verification',
            'operations/deployment/approvals-checklist',
            'operations/deployment/create2-registry',
            'operations/deployment/infra-epoch-redeploy',
            {
              type: 'category',
              label: 'Releases',
              link: { type: 'doc', id: 'operations/deployment/releases/index' },
              items: [
                'operations/deployment/releases/v1.8.3-mainnet',
                'operations/deployment/releases/v1.8.2-mainnet',
                'operations/deployment/releases/v1.8.1-mainnet',
                'operations/deployment/releases/v1.8.1-pre-broadcast-checklist',
                'operations/deployment/releases/v1.7.1-mainnet',
                'operations/deployment/releases/v1.7.1-post-broadcast-checklist',
                'operations/deployment/releases/cleanup-2026-04-09',
              ],
            },
            {
              type: 'category',
              label: 'Multisig',
              items: [
                'operations/deployment/multisig/guide',
                'operations/deployment/multisig/deployment',
                'operations/deployment/multisig/owner-setup',
              ],
            },
          ],
        },
        {
          type: 'category',
          label: 'Automation',
          link: { type: 'doc', id: 'operations/automation/index' },
          items: [
            'operations/automation/quick-start',
            'operations/automation/full-automation',
            'operations/automation/completion-options',
            'operations/automation/cre-runtime-api',
            'operations/automation/cre-runtime-hardening-checklist',
          ],
        },
        {
          type: 'category',
          label: 'Services',
          items: [
            'operations/services/agent/eliza/index',
            'operations/services/solana-provisioner/index',
          ],
        },
        {
          type: 'category',
          label: 'Agent Runtime Skills',
          items: [
            {
              type: 'autogenerated',
              dirName: 'operations/agent-runtime/skills',
            },
          ],
        },
        'operations/domain-setup',
        'operations/supabase-setup',
        'operations/telegram-canonical-link-preservation',
      ],
    },

    {
      type: 'category',
      label: 'Security',
      collapsed: true,
      link: { type: 'doc', id: 'security/index' },
      items: [
        'security/agent-security-model',
        'security/agent-security-migration',
        'security/payout-router-ownership-hardening-2026-03',
      ],
    },

    {
      type: 'category',
      label: 'Audits',
      collapsed: true,
      link: { type: 'doc', id: 'audits/README' },
      items: [
        {
          type: 'category',
          label: 'Ajna',
          items: [
            'audits/ajna/executive-brief',
            'audits/ajna/adversarial-audit',
            'audits/ajna/master-qna',
          ],
        },
        {
          type: 'category',
          label: 'Charm',
          items: [
            'audits/charm/executive-brief',
            'audits/charm/adversarial-audit',
            'audits/charm/master-qa',
          ],
        },
        {
          type: 'category',
          label: 'Codex',
          items: [
            'audits/codex/security-second-pass-review',
            'audits/codex/remediation-2026-04-02',
          ],
        },
        {
          type: 'category',
          label: 'Token Image',
          items: [
            'audits/token-image/index',
          ],
        },
      ],
    },

    {
      type: 'category',
      label: 'Reference',
      collapsed: true,
      link: { type: 'doc', id: 'reference/index' },
      items: [
        'reference/addresses',
        'reference/glossary',
        'reference/chains',
        'reference/current-contract-inventory',
        'reference/diagram-style-guide',
        'reference/erc4337-debugging',
        'reference/coins-metadata',
        'reference/token-image',
        'reference/account-context',
        {
          type: 'category',
          label: 'Repository',
          items: [
            'reference/repo/index',
            'reference/repo/security',
            'reference/repo/deployments/index',
          ],
        },
      ],
    },

    {
      type: 'category',
      label: 'Legal',
      collapsed: true,
      link: { type: 'doc', id: 'legal/index' },
      items: [
        'legal/terms',
        'legal/privacy',
      ],
    },

    {
      type: 'category',
      label: 'API Reference',
      collapsed: true,
      link: { type: 'doc', id: 'api/index' },
      items: [
        {
          type: 'autogenerated',
          dirName: 'api',
        },
      ],
    },
  ],
};

export default sidebars;
