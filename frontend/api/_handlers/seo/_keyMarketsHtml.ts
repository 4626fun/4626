import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions } from '@4626/server-core'

export const KEY_MARKETS_PATH = '/explore/pools'
export const KEY_MARKETS_CANONICAL = 'https://4626.fun/explore/pools'
export const KEY_MARKETS_APP_URL = 'https://app.4626.fun/explore/pools'
export const KEY_MARKETS_TITLE = 'AlfaClub Key Markets | FriendKey ERC-1155 on Sudoswap'
export const KEY_MARKETS_DESCRIPTION =
  'Browse official AlfaClub FriendKey secondary markets on Base. ERC-1155 keys trade in-app against Creator Coins on Sudoswap v2 pairs — not Uniswap token swap.'

const OG_IMAGE = 'https://4626.fun/assets/og-image.png?v=21'
const TWITTER_IMAGE = 'https://4626.fun/assets/twitter-card.png?v=21'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function hasIndexBlockingQuery(req: VercelRequest): boolean {
  const query = req.query ?? {}
  const keys = Object.keys(query).filter((key) => key !== '')
  return keys.some((key) => ['q', 'sort', 'side', 'pool', 'tab', 'keyId', 'utm_source', 'utm_medium', 'utm_campaign', 'gclid'].includes(key))
}

export function renderKeyMarketsHtml(options?: { indexable?: boolean }): string {
  const indexable = options?.indexable !== false
  const robots = indexable ? 'index,follow,max-image-preview:large' : 'noindex,follow'
  const title = escapeHtml(KEY_MARKETS_TITLE)
  const description = escapeHtml(KEY_MARKETS_DESCRIPTION)
  const canonical = escapeHtml(KEY_MARKETS_CANONICAL)
  const appUrl = escapeHtml(KEY_MARKETS_APP_URL)
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'AlfaClub Key Markets',
        url: KEY_MARKETS_CANONICAL,
        description: KEY_MARKETS_DESCRIPTION,
        isPartOf: { '@type': 'WebSite', name: '4626.fun', url: 'https://4626.fun/' },
        about: [
          { '@type': 'Thing', name: 'FriendKey ERC-1155' },
          { '@type': 'Thing', name: 'Sudoswap v2' },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What are AlfaClub key markets?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'AlfaClub key markets are official secondary markets where FriendKey ERC-1155 tokens trade against Creator Coins on Sudoswap v2 pairs through the 4626 in-app router on Base.',
            },
          },
          {
            '@type': 'Question',
            name: 'Is this a Uniswap ERC-20 swap?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'No. Uniswap AMM pools are ERC-20 based. FriendKey secondary trading settles on official Sudoswap ERC-1155/ERC-20 pairs inside the AlfaClub market console.',
            },
          },
          {
            '@type': 'Question',
            name: 'Which key has an official market today?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'The official configured market is FriendKey #1659. Additional official markets may be assigned later through the AlfaClub Sudoswap adapter.',
            },
          },
        ],
      },
    ],
  }

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${title}</title>`,
    `  <meta name="description" content="${description}" />`,
    `  <meta name="robots" content="${robots}" />`,
    `  <link rel="canonical" href="${canonical}" />`,
    '  <meta property="og:type" content="website" />',
    '  <meta property="og:site_name" content="4626.fun" />',
    `  <meta property="og:title" content="${title}" />`,
    `  <meta property="og:description" content="${description}" />`,
    `  <meta property="og:url" content="${canonical}" />`,
    `  <meta property="og:image" content="${OG_IMAGE}" />`,
    '  <meta name="twitter:card" content="summary_large_image" />',
    '  <meta name="twitter:site" content="@4626fun" />',
    `  <meta name="twitter:title" content="${title}" />`,
    `  <meta name="twitter:description" content="${description}" />`,
    `  <meta name="twitter:image" content="${TWITTER_IMAGE}" />`,
    `  <script type="application/ld+json">${JSON.stringify(structuredData)}</script>`,
    '  <style>',
    '    :root { color-scheme: dark; }',
    '    body { margin: 0; background: #07080a; color: #eef0f4; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }',
    '    main { width: min(840px, 92vw); margin: 0 auto; padding: 48px 0 72px; }',
    '    .eyebrow { margin: 0; color: #7dd3fc; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; }',
    '    h1 { margin: 12px 0 16px; font-size: clamp(28px, 4vw, 40px); line-height: 1.15; }',
    '    p, li { color: #b4bac6; line-height: 1.55; }',
    '    a.cta { display: inline-flex; margin-top: 20px; padding: 10px 16px; border-radius: 999px; background: #0ea5e9; color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; }',
    '    section { margin-top: 36px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.08); }',
    '    h2 { margin: 0 0 12px; font-size: 18px; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main>',
    '    <p class="eyebrow">AlfaClub</p>',
    '    <h1>Official FriendKey markets on Sudoswap</h1>',
    `    <p>${description}</p>`,
    `    <a class="cta" href="${appUrl}">Open key markets</a>`,
    '    <section>',
    '      <h2>What you can do here</h2>',
    '      <ul>',
    '        <li>Browse the official Creator Coin / FriendKey Sudoswap v2 market.</li>',
    '        <li>Buy or sell FriendKey ERC-1155 inventory through the AlfaClub in-app router.</li>',
    '        <li>Use Buy with ETH when the funding path is available for Key #1659.</li>',
    '      </ul>',
    '    </section>',
    '    <section>',
    '      <h2>Why not Uniswap Swap?</h2>',
    '      <p>Uniswap V2/V3/V4 pools hold fungible ERC-20 liquidity. FriendKeys are ERC-1155 tokens, so secondary trading uses official Sudoswap ERC-1155/ERC-20 pairs rather than the Uniswap token swap UI.</p>',
    '    </section>',
    '    <section>',
    '      <h2>FAQ</h2>',
    '      <p><strong>What is a FriendKey?</strong> An ERC-1155 access key for AlfaClub rooms, with bonding-curve primary pricing and optional Sudoswap secondary markets.</p>',
    '      <p><strong>Which market is live?</strong> The reviewed official market is currently assigned to FriendKey #1659.</p>',
    '      <p><strong>Where do trades settle?</strong> In-app against the configured Sudoswap pair and AlfaClub adapter on Base.</p>',
    '    </section>',
    '  </main>',
    '</body>',
    '</html>',
  ].join('\n')
}

export async function handleKeyMarketsHtml(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const indexable = !hasIndexBlockingQuery(req)
  const html = renderKeyMarketsHtml({ indexable })

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Robots-Tag', indexable ? 'index, follow' : 'noindex, follow')
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  )
  res.status(200).send(html)
}
