import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Sidebar configuration for CreatorVault docs.
 * 
 * Structure follows reader intent:
 * - Overview: What is this?
 * - Concepts: Core mechanics
 * - Contracts: Technical deep dives
 * - Governance: ve(3,3) system
 * - Guides: How to do X
 * - Operations: Deployment & maintenance
 * - Reference: Lookup tables
 * - API: Auto-generated
 */
const sidebars: SidebarsConfig = {
  docs: [
    // Landing
    {
      type: 'doc',
      id: 'index',
      label: 'Welcome',
    },

    // Four Compressions
    {
      type: 'category',
      label: 'Four Compressions',
      collapsed: false,
      link: { type: 'doc', id: 'compressions/index' },
      items: [
        'compressions/deployment',
        'compressions/geography',
        'compressions/distribution',
        'compressions/engagement',
        'compressions/reading-order',
      ],
    },

    // Three Primitives
    {
      type: 'category',
      label: 'Three Primitives',
      collapsed: false,
      link: { type: 'doc', id: 'primitives/index' },
      items: [
        'primitives/account',
        {
          type: 'category',
          label: 'Market',
          link: { type: 'doc', id: 'primitives/market/index' },
          items: [
            'primitives/market/vault',
            'primitives/market/auction',
          ],
        },
        {
          type: 'category',
          label: 'Game Loop',
          link: { type: 'doc', id: 'primitives/game-loop/index' },
          items: [
            'primitives/game-loop/lottery',
          ],
        },
      ],
    },

    // Contracts section
    {
      type: 'category',
      label: "What's Deployed",
      collapsed: false,
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
          label: 'Services',
          link: { type: 'doc', id: 'contracts/services/index' },
          items: [
            'contracts/services/lottery-manager',
            'contracts/services/creator-oracle',
          ],
        },
      ],
    },

    // Governance section (user-facing)
    {
      type: 'category',
      label: 'Governance',
      collapsed: true,
      link: { type: 'doc', id: 'governance/index' },
      items: [
        'governance/ve33-progress',
      ],
    },

    // Guides section
    {
      type: 'category',
      label: 'Guides',
      collapsed: true,
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

    // Integrations section
    {
      type: 'category',
      label: 'Integrations',
      collapsed: true,
      link: { type: 'doc', id: 'integrations/index' },
      items: [
        'integrations/oft',
        'integrations/solana-integration',
      ],
    },

    // Operations section
    {
      type: 'category',
      label: 'Operations',
      collapsed: true,
      link: { type: 'doc', id: 'operations/index' },
      items: [
        {
          type: 'category',
          label: 'Deployment',
          link: { type: 'doc', id: 'operations/deployment/index' },
          items: [
            'operations/deployment/pre-launch',
            'operations/deployment/cca-verification',
            'operations/deployment/approvals-checklist',
            'operations/deployment/create2-registry',
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
          ],
        },
        'operations/domain-setup',
        'operations/supabase-setup',
      ],
    },

    // Reference section
    {
      type: 'category',
      label: 'Reference',
      collapsed: true,
      link: { type: 'doc', id: 'reference/index' },
      items: [
        'reference/addresses',
        'reference/glossary',
        'reference/diagram-style-guide',
        'reference/erc4337-debugging',
      ],
    },

    // Frontend section
    {
      type: 'category',
      label: 'Frontend',
      collapsed: true,
      link: { type: 'doc', id: 'frontend/index' },
      items: [],
    },

    // API Reference (auto-generated)
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

    // Legacy sections (kept for old doc IDs + internal links; redirects handle navigation)
    // Remove once the site no longer references these IDs.
    {
      type: 'category',
      label: 'Legacy (Redirected)',
      collapsed: true,
      link: { type: 'doc', id: 'overview/index' },
      items: [
        'overview/introduction',
        'overview/architecture',
        'overview/token-model',
        'overview/fee-flow',
        'overview/reading-order',
        'concepts/index',
        'concepts/vault',
        'concepts/auction',
        'concepts/lottery',
      ],
    },
  ],
};

export default sidebars;
