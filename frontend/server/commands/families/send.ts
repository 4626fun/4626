import type { Address } from 'viem'

import type { KeeprVaultRow } from '../../_lib/keepr/keeprRegistry.js'
import { handleSendCommand } from '../../keepr/sendCommand.js'
import type { KeeprRole, KeeprCommandResult } from '../types.js'

export async function executeSendCommandFamily(params: {
  groupId: string
  senderWallet: Address
  text: string
  role: KeeprRole
  vault: KeeprVaultRow
}): Promise<KeeprCommandResult> {
  return handleSendCommand(params)
}
