import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import {
  applyV2SubjectLut,
  resolveV2LutIntensity,
} from '../_handlers/token/renderers/premium-v2/subjectGrade.js'

describe('premiumV2SubjectLut', () => {
  it('resolveV2LutIntensity clamps to 0..1', () => {
    expect(resolveV2LutIntensity()).toBeGreaterThan(0)
    expect(resolveV2LutIntensity()).toBeLessThanOrEqual(1)
  })

  it('applyV2SubjectLut preserves fully transparent pixels', async () => {
    const input = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 32,
              height: 32,
              channels: 3,
              background: { r: 120, g: 80, b: 40 },
            },
          })
            .png()
            .toBuffer(),
          left: 16,
          top: 16,
        },
      ])
      .png()
      .toBuffer()

    const out = await applyV2SubjectLut(input)
    const corner = await sharp(out).ensureAlpha().raw().toBuffer()
    expect(corner[3]).toBeLessThan(10)
    const meta = await sharp(out).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(64)
  })
})
