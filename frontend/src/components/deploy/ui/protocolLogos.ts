/**
 * Vetted protocol logo paths for deploy-plan address rows and tables.
 * Primary source is `public/protocols/` (tracked in its manifest.json);
 * meteora and zora reuse existing brand assets already shipped in public/.
 */
export const PROTOCOL_LOGOS = {
  fun4626: '/favicon.svg',
  base: '/protocols/base.png',
  solana: '/protocols/solana.svg',
  uniswap: '/protocols/uniswap.svg',
  ajna: '/protocols/ajna.svg',
  charm: '/protocols/charm.png',
  chainlink: '/protocols/chainlink.svg',
  safe: '/protocols/safe.png',
  layerzero: '/protocols/layerzero-official.svg',
  meteora: '/immersive/assets/brand/meteora-v2.svg',
  zora: '/brands/zora-token.svg',
} as const

export type ProtocolLogoKey = keyof typeof PROTOCOL_LOGOS
