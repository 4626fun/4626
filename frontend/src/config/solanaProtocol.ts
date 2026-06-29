/**
 * Live Solana mainnet protocol programs used by 4626 share-mesh / hook lanes.
 * Per-creator mints and Meteora pools are created post-deploy; these are shared infrastructure.
 */
export const SOLANA_PROTOCOL_PROGRAMS = {
  /** LayerZero V2 OFT executable on Solana (verified build). */
  layerZeroOft: '6ste36Y7fcbzJXkVQj3ApEqYb3wFZsZX63gT6wymhy3s',
  /** Creator share hook (lottery entries + fee settle relay). */
  creatorShareHook: 'EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU',
} as const

/** Wrapped SOL mint — default Meteora DLMM quote leg when `SOLANA_STRICT_SOL_PAIR=1`. */
export const SOLANA_NATIVE_MINT = 'So11111111111111111111111111111111111111112'
