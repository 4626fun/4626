import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/** Product + contracts only — operator/engineering docs live in docs/_internal/. */
const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'category',
      label: 'Product',
      collapsed: false,
      link: {type: 'doc', id: 'index'},
      items: ['getting-started/index', 'overview/how-it-works'],
    },
    {
      type: 'category',
      label: 'Deploy',
      collapsed: false,
      link: {type: 'doc', id: 'guides/index'},
      items: ['guides/launch-token', 'guides/activate-vault'],
    },
    {
      type: 'category',
      label: 'Contracts',
      collapsed: false,
      link: {type: 'doc', id: 'contracts/index'},
      items: [
        'reference/addresses',
        'contracts/core/creator-ovault',
        'contracts/core/creator-share-oft',
        'contracts/core/creator-ovault-wrapper',
        'contracts/governance/gauge-controller',
        'contracts/strategies/cca-launch',
        'contracts/utilities/lottery-manager',
        'reference/glossary',
      ],
    },
    {
      type: 'category',
      label: 'Legal',
      collapsed: true,
      items: ['legal/terms', 'legal/privacy'],
    },
  ],
};

export default sidebars;
