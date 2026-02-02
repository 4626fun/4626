import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'CreatorVault Docs',
  tagline: 'Documentation for the 4626 protocol',
  favicon: 'brand/favicon.svg',

  url: 'https://docs.4626.fun',
  baseUrl: '/',

  organizationName: '4626',
  projectName: 'docs',

  onBrokenLinks: 'warn',  // Relaxed for auto-generated docs
  onBrokenMarkdownLinks: 'warn',  // Will migrate to markdown.hooks in Docusaurus v4
  

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
    format: 'md',  // Use standard markdown, not MDX
  },

  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'brand/social-card.svg',
    navbar: {
      title: 'CreatorVault',
      logo: {
        alt: 'CreatorVault Logo',
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
          href: 'https://github.com/4626',
          label: 'GitHub',
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
            {
              label: 'Overview',
              to: '/overview',
            },
            {
              label: 'Contracts',
              to: '/contracts',
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
              label: 'GitHub',
              href: 'https://github.com/wenakita/4626',
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} CreatorVault · Built on Base`,
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
