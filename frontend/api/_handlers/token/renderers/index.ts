import {
  renderPremiumTokenIcon as renderClassic,
  type PremiumTokenIconParams,
} from './premium-classic/renderPremiumTokenIcon.js'
import { renderPremiumTokenIcon as renderFujiLut } from './fuji-lut-experimental/renderPremiumTokenIcon.js'
import { renderPremiumTokenIcon as renderPremiumV2 } from './premium-v2/renderPremiumTokenIcon.js'
import type { TokenIconRendererId } from './types.js'

export type { PremiumTokenIconParams, TokenIconRendererId }

export function resolveTokenIconRendererId(): TokenIconRendererId {
  const raw = (process.env.TOKEN_ICON_RENDERER ?? 'premium-classic').trim().toLowerCase()
  if (raw === 'fuji-lut-experimental' || raw === 'fuji_lut' || raw === 'fuji-lut') {
    return 'fuji-lut-experimental'
  }
  if (raw === 'premium-v2' || raw === 'premium_v2' || raw === 'v2') {
    return 'premium-v2'
  }
  return 'premium-classic'
}

export async function renderTokenIcon(
  params: PremiumTokenIconParams,
  rendererId: TokenIconRendererId = resolveTokenIconRendererId(),
): Promise<Buffer> {
  if (rendererId === 'fuji-lut-experimental') return renderFujiLut(params)
  if (rendererId === 'premium-v2') return renderPremiumV2(params)
  return renderClassic(params)
}
