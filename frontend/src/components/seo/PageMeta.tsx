/**
 * PageMeta — lightweight client-side metadata for SPA pages.
 *
 * IMPORTANT (per workspace SEO rules):
 * This is a client-side-only component. Crawlers will NOT see this metadata
 * reliably. All pages default to `noindex,follow` until SSR/prerender is
 * added for SEO-critical routes (Creator, Vault pages).
 *
 * For users: sets document.title and meta description for tab/share UX.
 * For bots: sets robots to noindex,follow (safe default for SPA).
 */

import { useEffect } from 'react'

import { PAGE_META } from '@/lib/seo/pageMetaContent'
import { SITE_APP_NAME, SITE_DESCRIPTION, SITE_IMAGE_ALT } from '@/lib/seo/siteMeta'

function getPageOrigin(): string {
  if (typeof window === 'undefined') return 'https://app.4626.fun'
  return window.location.origin
}

type PageMetaProps = {
  /** Page title (will be appended with site name) */
  title?: string
  /** Meta description */
  description?: string
  /**
   * Override robots directive. Default: 'noindex,follow'
   * Only set 'index,follow' when SSR/prerender is confirmed for this route.
   */
  robots?: string
  /** Canonical path (relative, e.g. '/vault/0x...') */
  canonicalPath?: string
  /** OG image URL */
  ogImage?: string
  /** Optional JSON-LD payload for rich results */
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>> | null
}

function setOrCreateMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setOrCreateLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function setOrCreateJsonLd(id: string, payload: Record<string, unknown> | Array<Record<string, unknown>> | null | undefined) {
  const selector = `script[type="application/ld+json"][data-cv-jsonld="${id}"]`
  const existing = document.querySelector(selector) as HTMLScriptElement | null
  if (!payload) {
    existing?.remove()
    return
  }

  const script = existing ?? document.createElement('script')
  script.setAttribute('type', 'application/ld+json')
  script.setAttribute('data-cv-jsonld', id)
  script.textContent = JSON.stringify(payload)
  if (!existing) {
    document.head.appendChild(script)
  }
}

function normalizeCanonicalUrl(canonicalPath: string | undefined, origin: string): string {
  const fallbackPath = typeof window !== 'undefined' ? window.location.pathname : '/'
  const raw = String(canonicalPath ?? fallbackPath).trim()
  try {
    const base = new URL(origin)
    const next = raw ? new URL(raw, base) : new URL('/', base)
    next.search = ''
    next.hash = ''
    if (next.pathname !== '/') {
      next.pathname = next.pathname.replace(/\/+$/, '')
    }
    return next.toString()
  } catch {
    return `${origin}/`
  }
}

export function PageMeta({
  title,
  description,
  robots = 'noindex,follow',
  canonicalPath,
  ogImage,
  structuredData = null,
}: PageMetaProps) {
  useEffect(() => {
    const origin = getPageOrigin()
    const canonical = normalizeCanonicalUrl(canonicalPath, origin)
    const fallbackOgImage = `${origin}/app-hero.png?v=6`
    const resolvedDescription = String(description ?? '').trim() || SITE_DESCRIPTION
    const resolvedOgImage = String(ogImage ?? '').trim() || fallbackOgImage

    // Title
    const fullTitle = title ? `${title} | ${SITE_APP_NAME}` : SITE_APP_NAME
    document.title = fullTitle

    // Robots
    setOrCreateMeta('robots', robots)

    // Description
    setOrCreateMeta('description', resolvedDescription)
    setOrCreateMeta('og:description', resolvedDescription, 'property')
    setOrCreateMeta('twitter:description', resolvedDescription, 'name')

    // OG tags
    setOrCreateMeta('og:title', fullTitle, 'property')
    setOrCreateMeta('og:site_name', SITE_APP_NAME, 'property')
    setOrCreateMeta('og:type', 'website', 'property')
    setOrCreateMeta('og:url', canonical, 'property')
    setOrCreateMeta('twitter:card', 'summary_large_image', 'name')
    setOrCreateMeta('twitter:title', fullTitle, 'name')

    setOrCreateMeta('og:image', resolvedOgImage, 'property')
    setOrCreateMeta('og:image:secure_url', resolvedOgImage, 'property')
    setOrCreateMeta('og:image:alt', SITE_IMAGE_ALT, 'property')
    setOrCreateMeta('twitter:image', resolvedOgImage, 'name')
    setOrCreateMeta('twitter:image:alt', SITE_IMAGE_ALT, 'name')

    // Canonical
    setOrCreateLink('canonical', canonical)

    // JSON-LD
    setOrCreateJsonLd('page', structuredData)
  }, [title, description, robots, canonicalPath, ogImage, structuredData])

  return null
}

/**
 * Common page metadata presets
 */
export const META = PAGE_META
