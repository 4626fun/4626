import sharp from 'sharp'

/** Rembg breakout sprites must be fully opaque above the bezel — partial alpha shows frame/chrome through the hat. */
export async function solidifyBreakoutLayer(layer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(layer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = info.width * info.height
  for (let i = 0; i < pixels; i++) {
    const o = i * 4
    const a = data[o + 3] ?? 0
    if (a <= 24) continue
    data[o + 3] = 255
  }

  return sharp(Buffer.from(data), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()
}
