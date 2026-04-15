import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { classifyArtwork } from './imageClassifier.js'

async function createPngFromSvg(svg: string): Promise<Uint8Array> {
  return await sharp(Buffer.from(svg)).png().toBuffer()
}

describe('artwork classifier', () => {
  it('classifies a fully opaque rectangle as cover', async () => {
    const bytes = await createPngFromSvg(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#ff4d4f"/>
      </svg>
    `)
    expect(await classifyArtwork(bytes)).toBe('cover')
  })

  it('classifies a JPEG-like opaque photo as cover', async () => {
    const bytes = await createPngFromSvg(`
      <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="300" height="200" fill="#2c3e50"/>
        <circle cx="150" cy="100" r="60" fill="#e67e22"/>
        <rect x="0" y="140" width="300" height="60" fill="#27ae60"/>
      </svg>
    `)
    expect(await classifyArtwork(bytes)).toBe('cover')
  })

  it('classifies a centered circle on transparent background as coin', async () => {
    const bytes = await createPngFromSvg(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="transparent"/>
        <circle cx="100" cy="100" r="80" fill="#3498db"/>
      </svg>
    `)
    expect(await classifyArtwork(bytes)).toBe('coin')
  })

  it('classifies a circular badge with inner detail as coin', async () => {
    const bytes = await createPngFromSvg(`
      <svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
        <rect width="256" height="256" fill="transparent"/>
        <circle cx="128" cy="128" r="110" fill="#2980b9"/>
        <circle cx="128" cy="128" r="90" fill="#3498db"/>
        <text x="128" y="138" text-anchor="middle" font-size="48" fill="white">T</text>
      </svg>
    `)
    expect(await classifyArtwork(bytes)).toBe('coin')
  })

  it('classifies a transparent logo (wide rectangle) as contain', async () => {
    const bytes = await createPngFromSvg(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="transparent"/>
        <rect x="20" y="60" width="160" height="50" rx="10" fill="#e74c3c"/>
      </svg>
    `)
    expect(await classifyArtwork(bytes)).toBe('contain')
  })

  it('classifies a cutout mascot silhouette as contain', async () => {
    const bytes = await createPngFromSvg(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="transparent"/>
        <circle cx="100" cy="50" r="30" fill="#f1c40f"/>
        <rect x="70" y="75" width="60" height="100" rx="16" fill="#f1c40f"/>
      </svg>
    `)
    expect(await classifyArtwork(bytes)).toBe('contain')
  })

  it('classifies an off-center circle as contain rather than coin', async () => {
    const bytes = await createPngFromSvg(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="transparent"/>
        <circle cx="60" cy="60" r="50" fill="#9b59b6"/>
      </svg>
    `)
    expect(await classifyArtwork(bytes)).toBe('contain')
  })

  it('defaults to contain for very small images', async () => {
    const bytes = await createPngFromSvg(`
      <svg width="2" height="2" xmlns="http://www.w3.org/2000/svg">
        <rect width="2" height="2" fill="#ff0000"/>
      </svg>
    `)
    expect(await classifyArtwork(bytes)).toBe('contain')
  })

  it('classifies an opaque image with minor edge transparency as cover', async () => {
    const bytes = await createPngFromSvg(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#1a1a2e"/>
        <rect x="2" y="2" width="196" height="196" rx="8" fill="#16213e"/>
      </svg>
    `)
    expect(await classifyArtwork(bytes)).toBe('cover')
  })

  it('classifies a non-square elongated shape on transparent background as contain', async () => {
    const bytes = await createPngFromSvg(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="transparent"/>
        <rect x="40" y="20" width="120" height="160" rx="20" fill="#2ecc71"/>
      </svg>
    `)
    expect(await classifyArtwork(bytes)).toBe('contain')
  })
})
