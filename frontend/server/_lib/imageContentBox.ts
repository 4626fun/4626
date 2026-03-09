export type FixedContentBox = {
  left: number
  top: number
  width: number
  height: number
}

// Derived from 4626fun.svg: stroke rect (120,120,784,784,rx=190), stroke-width=64
// Inner edge = stroke center ± half-stroke → (152,152,720,720), inner rx ≈ 158
export function getFixedContentBox(width: number, height: number): FixedContentBox {
  return {
    left: Math.round(width * 0.1484),
    top: Math.round(height * 0.1484),
    width: Math.round(width * 0.7031),
    height: Math.round(height * 0.7031),
  }
}

export function getContentBoxInnerRadius(contentBox: FixedContentBox): number {
  // inner rx ≈ 22% of the inner width (from SVG: 158/720 ≈ 0.219), scales with box size
  return Math.round(contentBox.width * 0.219)
}
