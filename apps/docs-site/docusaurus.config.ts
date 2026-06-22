import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import {redirects} from './redirects';

const enableGitLastUpdate = process.env.DOCS_USE_GIT_LAST_UPDATE === '1';

const config: Config = {
  title: '4626.fun Docs',
  tagline: 'ERC-4626 creator vaults on Base',
  favicon: 'brand/favicon.svg',

  url: 'https://docs.4626.fun',
  baseUrl: '/',

  organizationName: '4626',
  projectName: 'docs',

  onBrokenLinks: 'warn',  // Relaxed for auto-generated docs
  

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
    format: 'md',  // Use standard markdown, not MDX
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  themes: ['@docusaurus/theme-mermaid'],

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        redirects,
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          // Prefer synced frontmatter `last_updated`; Git metadata is optional.
          showLastUpdateTime: enableGitLastUpdate,
          showLastUpdateAuthor: false,
          // Keep generated API docs with leading-underscore filenames visible.
          exclude: ['**/*.test.{js,jsx,ts,tsx,md,mdx}', '**/__tests__/**'],
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'brand/logo.svg',
    navbar: {
      hideOnScroll: true,
      title: '4626.fun',
      logo: {
        alt: '4626.fun Logo',
        src: 'brand/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/wallet-architecture',
          label: 'Wallet Architecture',
          position: 'left',
        },
        {
          to: '/contracts',
          label: 'Contracts',
          position: 'left',
        },
        {
          to: '/api',
          label: 'API',
          position: 'left',
        },
        {
          to: '/operations/deployment/releases',
          label: 'Change Log',
          position: 'right',
        },
        {
          href: 'https://4626.fun',
          label: 'App',
          position: 'right',
        },
        {
          href: 'https://github.com/wenakita/4626',
          label: 'GitHub',
          'aria-label': 'GitHub repository',
          className: 'header-github-link',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      logo: {
        alt: '4626.fun',
        src: 'brand/logo.svg',
        href: 'https://4626.fun',
        width: 36,
        height: 36,
      },
      links: [
        {
          title: 'Build',
          items: [
            {
              label: 'Getting Started',
              to: '/getting-started',
            },
            {
              label: 'Wallet Architecture',
              to: '/wallet-architecture',
            },
            {
              label: 'Contracts',
              to: '/contracts',
            },
            {
              label: 'API Reference',
              to: '/api',
            },
          ],
        },
        {
          title: 'Operate',
          items: [
            {
              label: 'Deployment & Ops',
              to: '/operators',
            },
            {
              label: 'Automation / KPR',
              to: '/operations/automation',
            },
            {
              label: 'Security',
              to: '/security',
            },
            {
              label: 'Audits',
              to: '/audits',
            },
          ],
        },
        {
          title: 'Network',
          items: [
            {
              label: 'Built on Base',
              href: 'https://base.org',
            },
            {
              label: 'Base Block Explorer',
              href: 'https://basescan.org',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: '4626.fun',
              href: 'https://4626.fun',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/wenakita/4626',
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} 4626.fun · Built on Base`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['solidity', 'bash', 'json'],
    },
    mermaid: {
      theme: {
        light: 'default',
        dark: 'dark',
      },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
