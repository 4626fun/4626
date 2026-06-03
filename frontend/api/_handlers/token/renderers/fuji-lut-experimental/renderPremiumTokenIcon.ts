import { applyLut3dToUint8Source } from '../../../../../server/_lib/image/lut3dGrade.js'
import {
  renderPremiumTokenIcon as renderPremiumTokenIconClassic,
  type PremiumTokenIconParams,
} from '../premium-classic/renderPremiumTokenIcon.js'

const DEFAULT_LUT_INTENSITY = 0.3

export type { PremiumTokenIconParams }

/**
 * v0 experimental lane: grade source bytes with Fuji Classic Chrome 3DL, then compose via premium-classic.
 * Segmentation still runs on ungraded bytes inside classic when hero cutout is not pre-supplied.
 */
export async function renderPremiumTokenIcon(params: PremiumTokenIconParams): Promise<Buffer> {
  const gradeOpts = { intensity: DEFAULT_LUT_INTENSITY }
  const sourceImage = await applyLut3dToUint8Source(params.sourceImage, gradeOpts)
  const heroCutoutSourceImage = await applyLut3dToUint8Source(params.heroCutoutSourceImage, gradeOpts)
  return renderPremiumTokenIconClassic({
    ...params,
    sourceImage,
    heroCutoutSourceImage,
    allowHeroCutoutBreakoutForNonPixelArt: params.allowHeroCutoutBreakoutForNonPixelArt,
  })
}
