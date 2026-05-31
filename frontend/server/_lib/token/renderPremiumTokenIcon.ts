/**
 * Server-runtime entry for premium token icon rendering.
 *
 * api/_handlers/token/* keeps the HTTP surface; Hermit avatar + AlfaClub charts
 * import from here so Vercel can ship one bundled server/_lib/*.js artifact
 * (see packages/server-core/build.mjs) instead of crossing into api/ at runtime.
 */
export {
  renderPremiumTokenIcon,
  type PremiumTokenIconParams,
} from '../../../api/_handlers/token/renderers/premium-classic/renderPremiumTokenIcon.js'
