import { handleWhoisCommand } from '../../keepr/whoisCommand.js'
import type { KeeprCommandResult } from '../types.js'

export async function executeWhoisCommandFamily(params: {
  text: string
}): Promise<KeeprCommandResult> {
  return handleWhoisCommand({ text: params.text })
}
