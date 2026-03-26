import type { Address } from 'viem'

import { handleTwitterCommand } from '../../twitter/commands.js'
import type { KeeprRole, KeeprCommandResult } from '../types.js'

export async function executeTwitterCommandFamily(params: {
  groupId: string
  senderWallet: Address
  text: string
  role: KeeprRole
}): Promise<KeeprCommandResult> {
  return handleTwitterCommand(params)
}
