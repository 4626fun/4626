import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/** Product + contracts only — operator/engineering docs live in docs/_internal/. */
const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'doc',
      id: 'index',
      label: 'Home',
    },
    {
      type: 'category',
      label: 'Learn',
      collapsed: false,
      items: [
        'getting-started/index',
        'overview/how-it-works',
        'overview/solana-share-mesh',
      ],
    },
    {
      type: 'category',
      label: 'Launch a vault',
      collapsed: false,
      link: {type: 'doc', id: 'guides/index'},
      items: [
        'guides/greenfield-checklist',
        'guides/strategy-bundle',
        'guides/launch-token',
        'guides/activate-vault',
        'guides/after-activation',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'Quick reference',
          collapsed: false,
          items: [
            'reference/index',
            'reference/addresses',
            'reference/glossary',
            'reference/impairment-v1-disclosures',
          ],
        },
        {
          type: 'category',
          label: 'Smart contracts',
          collapsed: true,
          link: {type: 'doc', id: 'contracts/index'},
          items: [
            'contracts/core/creator-registry',
            'contracts/core/creator-ovault',
            'contracts/core/creator-share-oft',
            'contracts/core/creator-ovault-wrapper',
            'contracts/governance/gauge-controller',
            'contracts/strategies/cca-launch',
            'contracts/utilities/lottery-manager',
            'contracts/utilities/creator-oracle',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Legal',
      collapsed: true,
      items: ['legal/terms', 'legal/privacy'],
    },
    {
      type: 'category',
      label: 'Audits',
      collapsed: false,
      link: {type: 'doc', id: 'audits/index'},
      items: [
        'audits/fable/index',
        'audits/fable/full-repo-review-2026-06',
        'audits/fable/sessions-index',
        'audits/fable/transcripts/index',
      ],
    },
  ],
};

export default sidebars;
