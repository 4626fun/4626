import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import {redirects} from './redirects';
import remarkWrapTables from './src/remark/wrapTables';

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

  stylesheets: [
    {
      href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
      rel: 'stylesheet',
    },
  ],

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
          editUrl:
            'https://github.com/wenakita/4626/tree/main/apps/docs-site/docs/',
          remarkPlugins: [remarkWrapTables],
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
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      hideOnScroll: true,
      title: '4626.fun',
      logo: {
        alt: '4626.fun Logo',
        src: 'brand/logo.svg',
      },
      items: [
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
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Getting started', to: '/getting-started'},
            {label: 'Wallet architecture', to: '/wallet-architecture'},
            {label: 'Contracts', to: '/contracts'},
            {label: 'API reference', to: '/api'},
          ],
        },
        {
          title: 'Trust',
          items: [
            {label: 'Security', to: '/security'},
            {label: 'Audits', to: '/audits/README'},
            {label: 'Change log', to: '/operations/deployment/releases'},
          ],
        },
        {
          title: 'Links',
          items: [
            {label: '4626.fun', href: 'https://4626.fun'},
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
      darkTheme: prismThemes.oneDark,
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
