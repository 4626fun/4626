#!/usr/bin/env node
/**
 * Verify production Base App icon surfaces serve the white-4 opaque tile (not stale ICO/og-image).
 * Exit 0 = OK, 1 = drift detected.
 */

const ORIGIN = process.env.VERIFY_ICON_ORIGIN ?? 'https://4626.fun'

const EXPECTED_TILE_ETAG_PREFIXES = [
  // Populated after v20 favicon.ico rebuild; update when brandAssetVersion bumps.
  '5e7d683c',
]

async function head(url) {
  const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
  return {
    ok: res.ok,
    status: res.status,
    etag: res.headers.get('etag')?.replace(/^"|"$/g, '') ?? '',
    contentType: res.headers.get('content-type') ?? '',
  }
}

async function main() {
  const errors = []
  const favicon = await head(`${ORIGIN}/favicon.ico`)
  const appIcon = await head(`${ORIGIN}/app-icon.png`)
  const tile = await head(`${ORIGIN}/assets/base-app-icon-1024.png`)
  const miniappHero = await head(`${ORIGIN}/miniapp-hero.png`)
  const og = await head(`${ORIGIN}/assets/og-image.png`)

  if (!favicon.ok) errors.push(`favicon.ico HTTP ${favicon.status}`)
  if (favicon.etag === '052129f3b02e7f47a194958bcc48aa90') {
    errors.push(
      'favicon.ico still has pre-v20 etag 052129f3… — production deploy/cache has not picked up the multi-size ICO rebuild',
    )
  }
  if (favicon.etag && EXPECTED_TILE_ETAG_PREFIXES.every((p) => !favicon.etag.startsWith(p))) {
    errors.push(`favicon.ico etag ${favicon.etag} does not match expected v20 prefix`)
  }
  if (appIcon.etag !== tile.etag) {
    errors.push(`app-icon.png etag (${appIcon.etag}) != base-app-icon-1024 (${tile.etag})`)
  }
  if (miniappHero.etag !== tile.etag) {
    errors.push(`miniapp-hero.png etag (${miniappHero.etag}) != base-app-icon-1024 (${tile.etag})`)
  }
  if (miniappHero.etag === og.etag) {
    errors.push('miniapp-hero.png still matches og-image.png (blue-glow card)')
  }

  const htmlRes = await fetch(`${ORIGIN}/`, { redirect: 'follow' })
  const html = await htmlRes.text()
  if (!html.includes('base:app_id')) errors.push('4626.fun/ missing base:app_id meta')
  if (!html.includes('base-app-icon-1024.png')) errors.push('4626.fun/ missing base-app-icon fc:miniapp imageUrl')
  if (html.includes('og-image.png') && html.match(/imageUrl":"https:\/\/4626\.fun\/assets\/og-image/)) {
    errors.push('4626.fun/ fc:miniapp still points imageUrl at og-image.png')
  }

  const manifestRes = await fetch(`${ORIGIN}/.well-known/farcaster.json`, { redirect: 'follow' })
  const manifest = await manifestRes.json()
  if (String(manifest?.miniapp?.heroImageUrl ?? '').includes('og-image')) {
    errors.push('farcaster.json heroImageUrl still uses og-image.png')
  }

  if (errors.length) {
    console.error('Base App icon production verification FAILED:')
    for (const e of errors) console.error(`- ${e}`)
    console.error('\nRunbook: docs/operations/base-app-icon-refresh.md')
    process.exit(1)
  }

  console.log('ok: production Base App icon surfaces look aligned')
  console.log(`favicon.ico etag=${favicon.etag}`)
  console.log(`app-icon.png etag=${appIcon.etag}`)
}

await main()
