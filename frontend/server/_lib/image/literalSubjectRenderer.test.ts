import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { getFixedContentBox } from './imageContentBox.js'
import { renderLiteralSubjectLayer } from './literalSubjectRenderer.js'

type Rgba = {
  r: number
  g: number
  b: number
  a: number
}

async function createPngFromSvg(svg: string): Promise<Uint8Array> {
  return await sharp(Buffer.from(svg)).png().toBuffer()
}

async function samplePixel(bytes: Uint8Array, x: number, y: number): Promise<Rgba> {
  const { data, info } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const index = (y * info.width + x) * info.channels

  return {
    r: data[index] ?? 0,
    g: data[index + 1] ?? 0,
    b: data[index + 2] ?? 0,
    a: data[index + 3] ?? 0,
  }
}

describe('literal subject renderer', () => {
  it('uses the shared fixed content box for odd non-square dimensions', async () => {
    const subjectBytes = await createPngFromSvg(`
      <svg width="121" height="89" viewBox="0 0 121 89" xmlns="http://www.w3.org/2000/svg">
        <rect width="121" height="89" fill="#22c55e"/>
      </svg>
    `)

    const result = await renderLiteralSubjectLayer({
      subjectBytes,
      width: 201,
      height: 149,
    })

    expect(getFixedContentBox(201, 149)).toEqual({
      left: 30,
      top: 22,
      width: 141,
      height: 105,
    })
    expect(result.contentBox).toEqual(getFixedContentBox(201, 149))
  })

  it('renders a dark inner background and fits the real subject into the fixed content box', async () => {
    const subjectBytes = await createPngFromSvg(`
      <svg width="60" height="120" viewBox="0 0 60 120" xmlns="http://www.w3.org/2000/svg">
        <rect width="60" height="120" fill="#22c55e"/>
      </svg>
    `)

    const result = await renderLiteralSubjectLayer({
      subjectBytes,
      width: 200,
      height: 200,
      layoutHint: 'contain',
    })

    const outerPixel = await samplePixel(result.interiorLayerBytes, 20, 20)
    const gutterPixel = await samplePixel(result.interiorLayerBytes, 50, 100)
    const subjectPixel = await samplePixel(result.interiorLayerBytes, 100, 100)

    expect(result.contentBox).toEqual(getFixedContentBox(200, 200))
    expect(outerPixel).toEqual({ r: 0, g: 0, b: 0, a: 0 })
    expect(gutterPixel).toEqual({ r: 10, g: 12, b: 18, a: 255 })
    expect(subjectPixel).toEqual({ r: 34, g: 197, b: 94, a: 255 })
  })

  it('preserves literal subject pixels instead of inventing a substitute image', async () => {
    const subjectBytes = await createPngFromSvg(`
      <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="60" height="120" fill="#ff4d4f"/>
        <rect x="60" y="0" width="60" height="120" fill="#2f6bff"/>
      </svg>
    `)

    const sourceLeftPixel = await samplePixel(subjectBytes, 30, 60)
    const sourceRightPixel = await samplePixel(subjectBytes, 90, 60)

    const result = await renderLiteralSubjectLayer({
      subjectBytes,
      width: 200,
      height: 200,
      layoutHint: 'contain',
    })

    const renderedLeftPixel = await samplePixel(result.interiorLayerBytes, 70, 100)
    const renderedRightPixel = await samplePixel(result.interiorLayerBytes, 130, 100)

    expect(renderedLeftPixel).toEqual(sourceLeftPixel)
    expect(renderedRightPixel).toEqual(sourceRightPixel)
    expect(renderedLeftPixel).not.toEqual(renderedRightPixel)
  })

  it('classifies an opaque photo-like subject as cover and fills the content box', async () => {
    const opaqueSubjectBytes = await createPngFromSvg(`
      <svg width="300" height="200" viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="300" height="200" fill="#2c3e50"/>
        <circle cx="150" cy="100" r="60" fill="#e67e22"/>
      </svg>
    `)

    const result = await renderLiteralSubjectLayer({
      subjectBytes: opaqueSubjectBytes,
      width: 200,
      height: 200,
    })

    expect(result.layout).toBe('cover')
    expect(result.contentBox).toEqual(getFixedContentBox(200, 200))
  })

  it('classifies a circular badge as coin and renders it smaller than the content box', async () => {
    const coinSubjectBytes = await createPngFromSvg(`
      <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="transparent"/>
        <circle cx="100" cy="100" r="80" fill="#3498db"/>
      </svg>
    `)
    const containSubjectBytes = await createPngFromSvg(`
      <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="#22c55e"/>
      </svg>
    `)

    const coinResult = await renderLiteralSubjectLayer({
      subjectBytes: coinSubjectBytes,
      width: 200,
      height: 200,
    })
    const containResult = await renderLiteralSubjectLayer({
      subjectBytes: containSubjectBytes,
      width: 200,
      height: 200,
    })

    expect(coinResult.layout).toBe('coin')

    const coinCenter = await samplePixel(coinResult.interiorLayerBytes, 100, 100)
    const containCenter = await samplePixel(containResult.interiorLayerBytes, 100, 100)
    expect(coinCenter.b).toBeGreaterThan(100)
    expect(containCenter.g).toBeGreaterThan(100)
  })

  it('respects layoutHint and skips auto-classification', async () => {
    const subjectBytes = await createPngFromSvg(`
      <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="#22c55e"/>
      </svg>
    `)

    const coverResult = await renderLiteralSubjectLayer({
      subjectBytes,
      width: 200,
      height: 200,
      layoutHint: 'cover',
    })
    const containResult = await renderLiteralSubjectLayer({
      subjectBytes,
      width: 200,
      height: 200,
      layoutHint: 'contain',
    })

    expect(coverResult.layout).toBe('cover')
    expect(containResult.layout).toBe('contain')
  })
})