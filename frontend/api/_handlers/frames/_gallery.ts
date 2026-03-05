import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleOptions, setCors } from '../../server/auth/_shared.js'

declare const process: { env: Record<string, string | undefined> }

type VideoItem = {
  src: string
  aspectRatio: string
  caption: string
  autoplay: boolean
  muted: boolean
  loop: boolean
  controls: boolean
}

type VideoGallery = {
  type: 'video_gallery'
  title: string
  items: VideoItem[]
}

/**
 * Farcaster Frame for Video Gallery
 * 
 * GET /api/frames/gallery?id=...
 * GET /api/frames/gallery?vault=0x...
 * 
 * Returns HTML with Frame meta tags for video gallery
 * Also supports JSON response for direct gallery data
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const id = typeof req.query.id === 'string' ? req.query.id : ''
  const vault = typeof req.query.vault === 'string' ? req.query.vault : ''
  const format = typeof req.query.format === 'string' ? req.query.format : 'html'

  const baseUrl = process.env.APP_HOST || 'app.4626.fun'
  const apiUrl = process.env.API_HOST || 'api.4626.fun'
  const protocol = baseUrl.includes('localhost') ? 'http' : 'https'

  // In a real implementation, fetch gallery data from DB based on id/vault
  // For now, return a sample gallery
  const gallery: VideoGallery = {
    type: 'video_gallery',
    title: '4626 Highlights',
    items: [
      {
        src: `${protocol}://${baseUrl}/videos/intro.mp4`,
        aspectRatio: '16:9',
        caption: 'Welcome to 4626',
        autoplay: false,
        muted: true,
        loop: false,
        controls: true,
      },
      {
        src: `${protocol}://${baseUrl}/videos/how-it-works.mp4`,
        aspectRatio: '16:9',
        caption: 'How it works',
        autoplay: false,
        muted: true,
        loop: false,
        controls: true,
      },
    ],
  }

  // Return JSON if requested
  if (format === 'json') {
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ success: true, data: gallery })
  }

  // Generate Frame HTML
  const galleryUrl = vault 
    ? `${protocol}://${baseUrl}/vault/${vault}?tab=gallery`
    : `${protocol}://${baseUrl}/gallery/${id || 'featured'}`
  const assistantUrl = `${protocol}://${baseUrl}/?chatAction=help`
  
  const imageUrl = `${protocol}://${apiUrl}/v1/frames/gallery/image?id=${id || 'featured'}`

  const frameHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  
  <!-- Farcaster Frame Meta Tags -->
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${imageUrl}" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
  
  <!-- Button 1: Watch Videos -->
  <meta property="fc:frame:button:1" content="Watch Videos" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${galleryUrl}" />
  
  <!-- Button 2: Share -->
  <meta property="fc:frame:button:2" content="Share" />
  <meta property="fc:frame:button:2:action" content="link" />
  <meta property="fc:frame:button:2:target" content="https://warpcast.com/~/compose?text=Check%20out%20this%20gallery%20on%204626&embeds[]=${encodeURIComponent(galleryUrl)}" />
  
  <!-- Button 3: Ask Keepr -->
  <meta property="fc:frame:button:3" content="Ask Keepr" />
  <meta property="fc:frame:button:3:action" content="link" />
  <meta property="fc:frame:button:3:target" content="${assistantUrl}" />
  
  <!-- Open Graph -->
  <meta property="og:title" content="${gallery.title}" />
  <meta property="og:description" content="${gallery.items.length} videos" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${galleryUrl}" />
  <meta property="og:type" content="video.other" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${gallery.title}" />
  <meta name="twitter:description" content="${gallery.items.length} videos" />
  <meta name="twitter:image" content="${imageUrl}" />
  
  <!-- Video Meta (for first video) -->
  ${gallery.items[0] ? `
  <meta property="og:video" content="${gallery.items[0].src}" />
  <meta property="og:video:type" content="video/mp4" />
  ` : ''}
  
  <title>${gallery.title}</title>
  
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; background: #0f0f0f; color: #fff; }
    h1 { margin-bottom: 1rem; }
    .gallery { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
    .video-card { background: #1a1a1a; border-radius: 8px; overflow: hidden; }
    .video-card video { width: 100%; display: block; }
    .video-card .caption { padding: 0.75rem; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>${gallery.title}</h1>
  <div class="gallery">
    ${gallery.items.map(item => `
      <div class="video-card">
        <video 
          src="${item.src}" 
          ${item.controls ? 'controls' : ''} 
          ${item.muted ? 'muted' : ''} 
          ${item.loop ? 'loop' : ''} 
          ${item.autoplay ? 'autoplay' : ''}
          playsinline
        ></video>
        <div class="caption">${item.caption}</div>
      </div>
    `).join('')}
  </div>
  
  <script>
    // Gallery data for JS consumers
    window.__GALLERY_DATA__ = ${JSON.stringify(gallery)};
  </script>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  return res.status(200).send(frameHtml)
}
