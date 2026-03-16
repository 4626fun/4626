import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { __testables } from '../_handlers/token/_image.ts'

async function createSourcePng(params: {
  width: number
  height: number
}): Promise<Uint8Array> {
  const { width, height } = params
  const bytes = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 229, g: 84, b: 66, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: Math.round(width * 0.58),
            height: Math.round(height * 0.32),
            channels: 4,
            background: { r: 38, g: 152, b: 255, alpha: 1 },
          },
        })
          .png()
          .toBuffer(),
        top: Math.round(height * 0.06),
        left: Math.round(width * 0.2),
      },
    ])
    .png()
    .toBuffer()
  return new Uint8Array(bytes)
}

describe('token image renderer', () => {
  it('keeps deterministic panel geometry', () => {
    const layout = __testables.getTokenIconLayout(512)
    expect(layout.panelSize).toBeGreaterThan(320)
    expect(layout.panelRadius).toBeGreaterThan(40)
    expect(layout.artSize).toBeGreaterThan(layout.panelSize)
  })

  it('creates a top breakout mask in the centered top band', async () => {
    const size = 512
    const layout = __testables.getTokenIconLayout(size)
    const mask = await __testables.createTopBreakoutMask({ size, layout })
    const { data, info } = await sharp(mask).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const centerStartX = Math.round(layout.panelX + layout.panelSize * 0.35)
    const centerEndX = Math.round(layout.panelX + layout.panelSize * 0.65)
    const upperStartY = Math.max(0, layout.panelY - Math.round(layout.panelSize * 0.12))
    const upperEndY = Math.min(size, layout.panelY + Math.round(layout.panelSize * 0.03))
    const lowerStartY = Math.min(size - 1, layout.panelY + Math.round(layout.panelSize * 0.12))
    const lowerEndY = Math.min(size, layout.panelY + Math.round(layout.panelSize * 0.24))

    let upperAlphaSum = 0
    let lowerAlphaSum = 0
    for (let y = upperStartY; y < upperEndY; y += 1) {
      for (let x = centerStartX; x < centerEndX; x += 1) {
        upperAlphaSum += data[(y * info.width + x) * info.channels + 3]
      }
    }
    for (let y = lowerStartY; y < lowerEndY; y += 1) {
      for (let x = centerStartX; x < centerEndX; x += 1) {
        lowerAlphaSum += data[(y * info.width + x) * info.channels + 3]
      }
    }

    expect(upperAlphaSum).toBeGreaterThan(0)
    expect(lowerAlphaSum).toBeLessThan(upperAlphaSum)
  })

  it('renders deterministic icon output for provided source artwork', async () => {
    const source = await createSourcePng({ width: 900, height: 1200 })
    const rendered = await __testables.renderDeterministicTokenIcon({
      size: 512,
      sourceBytes: source,
      symbol: 'AKITA',
    })
    const meta = await sharp(Buffer.from(rendered)).metadata()
    expect(meta.width).toBe(512)
    expect(meta.height).toBe(512)
  })

  it('renders deterministic fallback icon when source artwork is missing', async () => {
    const rendered = await __testables.renderDeterministicTokenIcon({
      size: 512,
      sourceBytes: null,
      symbol: 'AKITA',
    })
    const meta = await sharp(Buffer.from(rendered)).metadata()
    expect(meta.width).toBe(512)
    expect(meta.height).toBe(512)
  })
})
