import type { Address } from 'viem'

import type { KeeprVaultRow } from '../../_lib/keeprRegistry.js'
import { handleCoinCommand } from '../../zora/commands.js'
import type { KeeprRole, KeeprCommandResult } from '../types.js'

export async function executeCoinCommandFamily(params: {
  groupId: string
  senderWallet: Address
  text: string
  role: KeeprRole
  vault: KeeprVaultRow
}): Promise<KeeprCommandResult> {
  return handleCoinCommand(params)
}
