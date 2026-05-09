import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions } from '../../../packages/server-core/src/index.js'
import { getCanonicalOrigin } from '../../../server/_lib/infra/origin.js'

type CanonicalRouteConfig = {
  path: string
  changefreq: 'daily' | 'weekly'
  priority: string
}

const CANONICAL_PUBLIC_ORIGIN = 'https://4626.fun'
const CANONICAL_PUBLIC_HOSTS = new Set(['4626.fun', 'www.4626.fun'])
const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1'])

const INDEXABLE_ROUTES: CanonicalRouteConfig[] = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/creator-vaults', changefreq: 'weekly', priority: '0.9' },
  { path: '/erc-4626', changefreq: 'weekly', priority: '0.9' },
  { path: '/risks', changefreq: 'weekly', priority: '0.8' },
  { path: '/security', changefreq: 'weekly', priority: '0.7' },
  { path: '/about', changefreq: 'weekly', priority: '0.7' },
  { path: '/vs/yearn', changefreq: 'weekly', priority: '0.6' },
  { path: '/glossary/', changefreq: 'weekly', priority: '0.6' },
  { path: '/glossary/creator-vault', changefreq: 'weekly', priority: '0.5' },
  { path: '/glossary/erc-4626', changefreq: 'weekly', priority: '0.5' },
  { path: '/glossary/eip-7540', changefreq: 'weekly', priority: '0.5' },
  { path: '/glossary/cca', changefreq: 'weekly', priority: '0.5' },
  { path: '/terms', changefreq: 'weekly', priority: '0.5' },
  { path: '/privacy', changefreq: 'weekly', priority: '0.5' },
]

const HEADER_BLOCKED_PATTERNS: readonly string[] = [
  '/explore/',
  '/swap',
  '/positions',
  '/portfolio',
  '/vault/',
  '/deploy',
  '/leaderboard',
  '/waitlist',
  '/accounts',
  '/faq',
  '/auction/',
  '/coin/',
  '/status',
  '/agents',
  '/admin',
]

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function resolveSiteOrigin(req: VercelRequest): string {
  try {
    const origin = new URL(getCanonicalOrigin(req))
    const host = origin.hostname.toLowerCase()
    if (CANONICAL_PUBLIC_HOSTS.has(host)) return CANONICAL_PUBLIC_ORIGIN
    const isDev = String(process.env.NODE_ENV ?? '').trim().toLowerCase() !== 'production'
    if (isDev && LOCALHOST_HOSTS.has(host)) return origin.origin
    return CANONICAL_PUBLIC_ORIGIN
  } catch {
    return CANONICAL_PUBLIC_ORIGIN
  }
}

function toAbsoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).toString()
}

function buildSitemapXml(origin: string): string {
  const lastmod = new Date().toISOString()
  const urls = INDEXABLE_ROUTES
    .map((route) => {
      const loc = escapeXml(toAbsoluteUrl(origin, route.path))
      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${route.changefreq}</changefreq>`,
        `    <priority>${route.priority}</priority>`,
        '  </url>',
      ].join('\n')
    })
    .join('\n')

  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', urls, '</urlset>'].join('\n')
}

function buildRobotsTxt(origin: string): string {
  const allowPaths = INDEXABLE_ROUTES.map((route) => route.path)
  const disallowRules = HEADER_BLOCKED_PATTERNS.map((pattern) => `Disallow: ${pattern}`)

  return [
    'User-agent: *',
    ...allowPaths.map((path) => `Allow: ${path}`),
    ...disallowRules,
    '',
    `Sitemap: ${toAbsoluteUrl(origin, '/sitemap.xml')}`,
    '',
  ].join('\n')
}

function setCacheHeaders(res: VercelResponse) {
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
}

function setSecurityHeaders(res: VercelResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
}

export async function handleSitemap(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setSecurityHeaders(res)
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }
  const origin = resolveSiteOrigin(req)
  setCacheHeaders(res)
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.status(200).send(buildSitemapXml(origin))
}

export async function handleRobots(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setSecurityHeaders(res)
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }
  const origin = resolveSiteOrigin(req)
  setCacheHeaders(res)
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.status(200).send(buildRobotsTxt(origin))
}
