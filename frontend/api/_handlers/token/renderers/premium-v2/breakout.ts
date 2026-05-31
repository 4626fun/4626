import sharp from 'sharp'

/** Hero/prepared cutouts were composited at ~0.86–0.96 opacity — frame bleeds through the hat. */
export async function solidifyBreakoutLayer(layer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(layer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = info.width * info.height
  for (let i = 0; i < pixels; i++) {
    const o = i * 4
    const a = data[o + 3]
    if (a <= 0) continue
    if (a < 200) {
      data[o + 3] = Math.min(255, Math.round(a + (255 - a) * 0.55))
    } else {
      data[o + 3] = Math.min(255, Math.round(a + (255 - a) * 0.35))
    }
  }

  return sharp(Buffer.from(data), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()
}
