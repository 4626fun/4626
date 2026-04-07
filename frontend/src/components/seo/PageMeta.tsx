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

import { PAGE_META } from '@/lib/pageMetaContent'
import { SITE_APP_NAME } from '@/lib/siteMeta'

function getPageOrigin(): string {
  if (typeof window === 'undefined') return 'https://v1.4626.fun'
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

export function PageMeta({
  title,
  description,
  robots = 'noindex,follow',
  canonicalPath,
  ogImage,
}: PageMetaProps) {
  useEffect(() => {
    // Title
    const fullTitle = title ? `${title} | ${SITE_APP_NAME}` : SITE_APP_NAME
    document.title = fullTitle

    // Robots
    setOrCreateMeta('robots', robots)

    // Description
    if (description) {
      setOrCreateMeta('description', description)
      setOrCreateMeta('og:description', description, 'property')
      setOrCreateMeta('twitter:description', description, 'name')
    }

    // OG tags
    setOrCreateMeta('og:title', fullTitle, 'property')
    setOrCreateMeta('og:site_name', SITE_APP_NAME, 'property')
    setOrCreateMeta('og:type', 'website', 'property')
    setOrCreateMeta('twitter:card', 'summary_large_image', 'name')
    setOrCreateMeta('twitter:title', fullTitle, 'name')

    if (ogImage) {
      setOrCreateMeta('og:image', ogImage, 'property')
      setOrCreateMeta('twitter:image', ogImage, 'name')
    }

    // Canonical
    if (canonicalPath) {
      const canonical = `${getPageOrigin()}${canonicalPath}`
      setOrCreateLink('canonical', canonical)
      setOrCreateMeta('og:url', canonical, 'property')
    }
  }, [title, description, robots, canonicalPath, ogImage])

  return null
}

/**
 * Common page metadata presets
 */
export const META = PAGE_META
