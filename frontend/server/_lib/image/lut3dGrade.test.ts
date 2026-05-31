import { describe, expect, it } from 'vitest'

import {
  applyLut3dToRgba,
  DEFAULT_LUT_PATH,
  loadLut3dFromFile,
  parse3DL,
  sampleLut3dTrilinear,
} from './lut3dGrade.js'

const TINY_3DL = `
# 2x2x2 identity-ish LUT
0 0 0
255 0 0
0 255 0
255 255 0
0 0 255
255 0 255
0 255 255
255 255 255
`.trim()

describe('parse3DL', () => {
  it('parses a 2x2x2 grid', () => {
    const lut = parse3DL(TINY_3DL)
    expect(lut.size).toBe(2)
    expect(lut.data.length).toBe(2 * 2 * 2 * 3)
    expect(lut.data[0]).toBeCloseTo(0, 5)
    expect(lut.data[lut.data.length - 3]).toBeCloseTo(1, 5)
  })
})

describe('sampleLut3dTrilinear', () => {
  it('maps white higher than black on the tiny LUT', () => {
    const lut = parse3DL(TINY_3DL)
    const black = sampleLut3dTrilinear(lut, 0, 0, 0)
    const white = sampleLut3dTrilinear(lut, 1, 1, 1)
    expect(white[0]).toBeGreaterThan(black[0])
    expect(white[1]).toBeGreaterThan(black[1])
    expect(white[2]).toBeGreaterThan(black[2])
  })
})

describe('applyLut3dToRgba', () => {
  it('lifts pure black at full intensity', () => {
    const lut = parse3DL(TINY_3DL)
    const rgba = new Uint8ClampedArray([0, 0, 0, 255])
    applyLut3dToRgba(rgba, 1, 1, lut, 1)
    expect(rgba[0]).toBeGreaterThan(0)
  })

  it('leaves pixels unchanged at intensity 0', () => {
    const lut = parse3DL(TINY_3DL)
    const rgba = new Uint8ClampedArray([42, 84, 126, 200])
    const before = [...rgba]
    applyLut3dToRgba(rgba, 1, 1, lut, 0)
    expect([...rgba]).toEqual(before)
  })
})

describe('loadLut3dFromFile', () => {
  it('loads bundled Classic Chrome LUT', async () => {
    const lut = await loadLut3dFromFile(DEFAULT_LUT_PATH)
    expect(lut.size).toBeGreaterThan(2)
    expect(lut.data.length).toBe(lut.size ** 3 * 3)
  })
})
