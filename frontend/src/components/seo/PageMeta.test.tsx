// @vitest-environment happy-dom

import { describe, expect, it, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

import { PageMeta } from './PageMeta'
import { SITE_IMAGE_ALT } from '@/lib/seo/siteMeta'

function queryMeta(name: string, attr: 'name' | 'property' = 'name'): HTMLMetaElement | null {
  return document.querySelector(`meta[${attr}="${name}"]`)
}

describe('PageMeta', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('normalizes canonical URL and sets OG/Twitter fallback metadata', () => {
    window.history.replaceState({}, '', 'http://localhost:3000/swap?from=token#section')

    render(
      <PageMeta
        title="Swap"
        description="Swap tokens with canonical routing."
        canonicalPath="/swap/?source=campaign#frag"
      />,
    )

    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    expect(canonical).toBeTruthy()
    expect(canonical?.getAttribute('href')).toBe('http://localhost:3000/swap')

    expect(queryMeta('og:url', 'property')?.getAttribute('content')).toBe('http://localhost:3000/swap')
    expect(queryMeta('og:image', 'property')?.getAttribute('content')).toBe(
      'http://localhost:3000/assets/og-image.png',
    )
    expect(queryMeta('twitter:image', 'name')?.getAttribute('content')).toBe(
      'http://localhost:3000/assets/twitter-card.png',
    )
    expect(queryMeta('twitter:site', 'name')?.getAttribute('content')).toBe('@4626fun')
    expect(queryMeta('twitter:creator', 'name')?.getAttribute('content')).toBe('@wenakita')
    expect(queryMeta('og:image:alt', 'property')?.getAttribute('content')).toBe(SITE_IMAGE_ALT)
    expect(queryMeta('twitter:image:alt', 'name')?.getAttribute('content')).toBe(SITE_IMAGE_ALT)
  })

  it('creates, updates, and removes page JSON-LD script', () => {
    const firstSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
    }
    const secondSchema = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
    }

    const { rerender } = render(
      <PageMeta title="FAQ" description="FAQ page" canonicalPath="/faq" structuredData={firstSchema} />,
    )

    const selector = 'script[type="application/ld+json"][data-cv-jsonld="page"]'
    const firstScript = document.querySelector(selector) as HTMLScriptElement | null
    expect(firstScript).toBeTruthy()
    expect(firstScript?.textContent ? JSON.parse(firstScript.textContent) : null).toEqual(firstSchema)

    rerender(
      <PageMeta title="How It Works" description="How it works page" canonicalPath="/faq/how-it-works" structuredData={secondSchema} />,
    )

    const scriptsAfterUpdate = document.querySelectorAll(selector)
    expect(scriptsAfterUpdate.length).toBe(1)
    const updatedScript = scriptsAfterUpdate[0] as HTMLScriptElement
    expect(updatedScript.textContent ? JSON.parse(updatedScript.textContent) : null).toEqual(secondSchema)

    rerender(
      <PageMeta title="How It Works" description="How it works page" canonicalPath="/faq/how-it-works" structuredData={null} />,
    )
    expect(document.querySelector(selector)).toBeNull()
  })
})
