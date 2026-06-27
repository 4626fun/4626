import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import {redirects} from './redirects';
import remarkWrapTables from './src/remark/wrapTables';

const enableGitLastUpdate = process.env.DOCS_USE_GIT_LAST_UPDATE === '1';

const config: Config = {
  title: '4626.fun Docs',
  tagline: '4626 creator vault documentation',
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

  themes: [
    '@docusaurus/theme-mermaid',
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        language: ['en'],
        indexDocs: true,
        indexBlog: false,
        indexPages: false,
        docsRouteBasePath: '/',
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        searchBarShortcut: true,
        searchBarShortcutHint: true,
        searchBarPosition: 'right',
        // Prefer curated hubs over deep generated symbol pages in result titles.
        searchResultLimits: 12,
        searchResultContextMaxLength: 80,
      },
    ],
  ],

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
          breadcrumbs: true,
          editUrl: 'https://github.com/wenakita/4626/tree/main/docs/',
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
    docs: {
      sidebar: {
        autoCollapseCategories: true,
        hideable: true,
      },
    },
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
          type: 'docSidebar',
          sidebarId: 'docs',
          label: 'Menu',
          position: 'left',
        },
        {
          to: '/getting-started',
          label: 'Learn',
          position: 'right',
        },
        {
          to: '/guides/greenfield-checklist',
          label: 'Launch',
          position: 'right',
        },
        {
          to: '/contracts',
          label: 'Contracts',
          position: 'right',
        },
        {
          to: '/reference/addresses',
          label: 'Addresses',
          position: 'right',
        },
        {
          href: 'https://app.4626.fun',
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
            {label: 'What is 4626?', to: '/getting-started'},
            {label: 'Launch checklist', to: '/guides/greenfield-checklist'},
            {label: 'Fees & lottery', to: '/overview/how-it-works'},
            {label: 'Glossary', to: '/reference/glossary'},
            {label: 'Addresses', to: '/reference/addresses'},
            {label: 'Contracts', to: '/contracts'},
          ],
        },
        {
          title: 'Legal',
          items: [
            {label: 'Terms', to: '/terms'},
            {label: 'Privacy', to: '/privacy'},
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
