export type FixedContentBox = {
  left: number
  top: number
  width: number
  height: number
}

export function getFixedContentBox(width: number, height: number): FixedContentBox {
  return {
    left: Math.round(width * 0.2),
    top: Math.round(height * 0.2),
    width: Math.round(width * 0.6),
    height: Math.round(height * 0.6),
  }
}
