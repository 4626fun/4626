import { PublicKey } from '@solana/web3.js'

const CREATOR_SHARE_HOOK_PROGRAM_ID = 'EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU'
const PROGRAM_ID = new PublicKey(CREATOR_SHARE_HOOK_PROGRAM_ID)

const CREATOR_CONFIG_SEED = Buffer.from('creator_config')
const PENDING_ENTRIES_SEED = Buffer.from('pending_entries')
const WINNER_RECORD_SEED = Buffer.from('winner_record')

export type CreatorShareHookPdas = {
  hookMint: string
  creatorConfig: string
  pendingEntries: string
  winnerRecord: string
}

export function deriveCreatorShareHookPdas(hookMint: string): CreatorShareHookPdas | null {
  const trimmed = hookMint.trim()
  if (!trimmed) return null
  try {
    const mint = new PublicKey(trimmed)
    const mintSeed = mint.toBuffer()
    const [creatorConfig] = PublicKey.findProgramAddressSync([CREATOR_CONFIG_SEED, mintSeed], PROGRAM_ID)
    const [pendingEntries] = PublicKey.findProgramAddressSync([PENDING_ENTRIES_SEED, mintSeed], PROGRAM_ID)
    const [winnerRecord] = PublicKey.findProgramAddressSync([WINNER_RECORD_SEED, mintSeed], PROGRAM_ID)
    return {
      hookMint: mint.toBase58(),
      creatorConfig: creatorConfig.toBase58(),
      pendingEntries: pendingEntries.toBase58(),
      winnerRecord: winnerRecord.toBase58(),
    }
  } catch {
    return null
  }
}
